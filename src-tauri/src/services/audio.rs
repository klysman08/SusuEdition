//! Decodificação de áudio (Symphonia, 100% Rust — funciona igual no Android).
//!
//! Para análise não precisamos de qualidade de reprodução: o áudio é convertido para
//! **mono a 11.025 Hz** em streaming (média por janela = filtro passa-baixa simples),
//! o que reduz a memória ~8× em relação ao PCM estéreo de 44,1 kHz.

use symphonia::core::codecs::CodecParameters;
use symphonia::core::codecs::audio::AudioDecoderOptions;
use symphonia::core::errors::Error as SymError;
use symphonia::core::formats::probe::Hint;
use symphonia::core::formats::{FormatOptions, TrackType};
use symphonia::core::io::{MediaSource, MediaSourceStream};
use symphonia::core::meta::MetadataOptions;

/// Taxa usada na análise (batidas e waveform).
pub const ANALYSIS_RATE: u32 = 11_025;

#[derive(Debug, thiserror::Error)]
pub enum AudioError {
    #[error("formato de áudio não suportado")]
    Unsupported,
    #[error("falha ao decodificar o áudio: {0}")]
    Decode(String),
}

impl From<SymError> for AudioError {
    fn from(e: SymError) -> Self {
        match e {
            SymError::Unsupported(_) => AudioError::Unsupported,
            other => AudioError::Decode(other.to_string()),
        }
    }
}

pub struct DecodedAudio {
    /// Mono, `ANALYSIS_RATE` Hz, amostras em [-1, 1].
    pub samples: Vec<f32>,
    pub source_rate: u32,
    pub channels: usize,
}

impl DecodedAudio {
    pub fn duration_sec(&self) -> f64 {
        self.samples.len() as f64 / ANALYSIS_RATE as f64
    }
}

/// Reamostrador por média de janela (box filter): cada amostra de saída é a média das
/// amostras de entrada que caem no seu intervalo. Barato e sem aliasing grosseiro.
struct BoxResampler {
    step: f64,
    next_boundary: f64,
    pos: f64,
    sum: f64,
    count: u32,
}

impl BoxResampler {
    fn new(from: u32, to: u32) -> Self {
        let step = from as f64 / to as f64;
        Self {
            step,
            next_boundary: step,
            pos: 0.0,
            sum: 0.0,
            count: 0,
        }
    }

    fn push(&mut self, x: f32, out: &mut Vec<f32>) {
        self.sum += x as f64;
        self.count += 1;
        self.pos += 1.0;
        while self.pos >= self.next_boundary {
            out.push(if self.count > 0 {
                (self.sum / self.count as f64) as f32
            } else {
                0.0
            });
            self.sum = 0.0;
            self.count = 0;
            self.next_boundary += self.step;
        }
    }
}

/// Decodifica a faixa de áudio principal para mono em `ANALYSIS_RATE`.
pub fn decode_to_analysis<S: MediaSource + 'static>(
    source: S,
    hint_ext: Option<&str>,
) -> Result<DecodedAudio, AudioError> {
    let mss = MediaSourceStream::new(Box::new(source), Default::default());
    let mut hint = Hint::new();
    if let Some(ext) = hint_ext {
        hint.with_extension(ext);
    }
    let mut format = symphonia::default::get_probe().probe(
        &hint,
        mss,
        FormatOptions::default(),
        MetadataOptions::default(),
    )?;

    let track = format
        .default_track(TrackType::Audio)
        .ok_or(AudioError::Unsupported)?;
    let track_id = track.id;
    let Some(CodecParameters::Audio(params)) = track.codec_params.clone() else {
        return Err(AudioError::Unsupported);
    };
    let mut decoder = symphonia::default::get_codecs()
        .make_audio_decoder(&params, &AudioDecoderOptions::default())?;

    let mut out = Vec::new();
    let mut interleaved: Vec<f32> = Vec::new();
    let mut resampler: Option<BoxResampler> = None;
    let mut source_rate = params.sample_rate.unwrap_or(0);
    let mut channels = 1usize;

    loop {
        let packet = match format.next_packet() {
            Ok(Some(p)) => p,
            Ok(None) => break,
            Err(SymError::IoError(e)) if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(SymError::ResetRequired) => break,
            Err(e) => return Err(e.into()),
        };
        if packet.track_id != track_id {
            continue;
        }
        let buf = match decoder.decode(&packet) {
            Ok(b) => b,
            // Pacotes corrompidos são ignorados (comum em MP3 com lixo no início).
            Err(SymError::DecodeError(_)) => continue,
            Err(e) => return Err(e.into()),
        };
        let spec = buf.spec();
        channels = spec.channels().count().max(1);
        if resampler.is_none() {
            source_rate = spec.rate();
            resampler = Some(BoxResampler::new(source_rate, ANALYSIS_RATE));
            out.reserve(params.sample_rate.map_or(0, |_| 1 << 20));
        }
        interleaved.clear();
        buf.copy_to_vec_interleaved(&mut interleaved);
        let rs = resampler.as_mut().expect("inicializado acima");
        let inv = 1.0 / channels as f32;
        for frame in interleaved.chunks_exact(channels) {
            rs.push(frame.iter().sum::<f32>() * inv, &mut out);
        }
    }

    if out.is_empty() {
        return Err(AudioError::Decode("nenhuma amostra decodificada".into()));
    }
    Ok(DecodedAudio {
        samples: out,
        source_rate,
        channels,
    })
}

/// Picos normalizados (0..1) em `buckets` faixas — desenho da waveform.
pub fn peaks(samples: &[f32], buckets: usize) -> Vec<f32> {
    if samples.is_empty() || buckets == 0 {
        return Vec::new();
    }
    let n = buckets.min(samples.len());
    let mut out: Vec<f32> = (0..n)
        .map(|i| {
            let a = i * samples.len() / n;
            let b = ((i + 1) * samples.len() / n).max(a + 1);
            samples[a..b].iter().fold(0.0f32, |m, x| m.max(x.abs()))
        })
        .collect();
    let max = out.iter().cloned().fold(0.0f32, f32::max);
    if max > 0.0 {
        for p in &mut out {
            *p = (*p / max * 1000.0).round() / 1000.0;
        }
    }
    out
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use std::io::Cursor;

    /// WAV PCM 16-bit em memória.
    pub fn wav(samples: &[f32], rate: u32, channels: u16) -> Vec<u8> {
        let data_len = (samples.len() * 2) as u32;
        let mut v = Vec::with_capacity(44 + data_len as usize);
        v.extend_from_slice(b"RIFF");
        v.extend_from_slice(&(36 + data_len).to_le_bytes());
        v.extend_from_slice(b"WAVEfmt ");
        v.extend_from_slice(&16u32.to_le_bytes());
        v.extend_from_slice(&1u16.to_le_bytes());
        v.extend_from_slice(&channels.to_le_bytes());
        v.extend_from_slice(&rate.to_le_bytes());
        v.extend_from_slice(&(rate * channels as u32 * 2).to_le_bytes());
        v.extend_from_slice(&(channels * 2).to_le_bytes());
        v.extend_from_slice(&16u16.to_le_bytes());
        v.extend_from_slice(b"data");
        v.extend_from_slice(&data_len.to_le_bytes());
        for s in samples {
            v.extend_from_slice(&((s.clamp(-1.0, 1.0) * 32767.0) as i16).to_le_bytes());
        }
        v
    }

    #[test]
    fn decodes_stereo_wav_to_mono_analysis_rate() {
        let rate = 44_100;
        let secs = 2.0;
        let frames = (rate as f64 * secs) as usize;
        let mut inter = Vec::with_capacity(frames * 2);
        for i in 0..frames {
            let s = (i as f32 * 440.0 * std::f32::consts::TAU / rate as f32).sin() * 0.5;
            inter.push(s);
            inter.push(s);
        }
        let decoded = decode_to_analysis(Cursor::new(wav(&inter, rate, 2)), Some("wav")).unwrap();
        assert_eq!(decoded.source_rate, rate);
        assert_eq!(decoded.channels, 2);
        assert!(
            (decoded.duration_sec() - secs).abs() < 0.01,
            "duração {}",
            decoded.duration_sec()
        );
    }

    #[test]
    fn rejects_garbage() {
        assert!(decode_to_analysis(Cursor::new(vec![7u8; 4096]), None).is_err());
    }

    #[test]
    fn peaks_are_normalized() {
        let s: Vec<f32> = (0..1000)
            .map(|i| if i < 500 { 0.25 } else { -0.5 })
            .collect();
        let p = peaks(&s, 4);
        assert_eq!(p, vec![0.5, 0.5, 1.0, 1.0]);
    }
}
