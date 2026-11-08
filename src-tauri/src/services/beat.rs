//! Detecção de BPM e batidas.
//!
//! 1. **Envelope de onset** por *spectral flux* (STFT 1024 / hop 256 a 11.025 Hz ≈ 43 quadros/s):
//!    soma dos aumentos de energia log-comprimida por faixa de frequência.
//! 2. **Tempo** por autocorrelação do envelope, ponderada por uma prioridade log-normal
//!    centrada em 120 BPM (evita erros de oitava 60↔120↔240).
//! 3. **Batidas** por programação dinâmica (Ellis, 2007): maximiza a soma de onsets nos
//!    instantes escolhidos penalizando intervalos que fogem do período estimado.

use std::sync::Arc;

use rustfft::num_complex::Complex32;
use rustfft::{Fft, FftPlanner};
use serde::{Deserialize, Serialize};

const WIN: usize = 1024;
const HOP: usize = 256;
const MIN_BPM: f64 = 60.0;
const MAX_BPM: f64 = 200.0;
const PRIOR_BPM: f64 = 120.0;
/// Largura da prioridade de tempo, em oitavas.
const PRIOR_OCTAVES: f64 = 0.9;
/// Quanto a DP penaliza intervalos diferentes do período (librosa usa 100).
const TIGHTNESS: f64 = 100.0;

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Beat {
    pub time_sec: f64,
    /// Força relativa 0..1 (onsets fortes ≈ 1).
    pub strength: f32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct BeatAnalysis {
    pub bpm: Option<f64>,
    pub beats: Vec<Beat>,
}

fn hann(n: usize) -> Vec<f32> {
    (0..n)
        .map(|i| 0.5 - 0.5 * (std::f32::consts::TAU * i as f32 / n as f32).cos())
        .collect()
}

/// Envelope de onset (um valor por quadro de `HOP` amostras).
pub fn onset_envelope(samples: &[f32]) -> Vec<f32> {
    if samples.len() < WIN {
        return Vec::new();
    }
    let frames = (samples.len() - WIN) / HOP + 1;
    let fft: Arc<dyn Fft<f32>> = FftPlanner::new().plan_fft_forward(WIN);
    let window = hann(WIN);
    let bins = WIN / 2 + 1;
    let norm = 2.0 / WIN as f32;

    let mut buf = vec![Complex32::new(0.0, 0.0); WIN];
    let mut scratch = vec![Complex32::new(0.0, 0.0); fft.get_inplace_scratch_len()];
    let mut prev = vec![0.0f32; bins];
    let mut cur = vec![0.0f32; bins];
    let mut env = Vec::with_capacity(frames);

    for f in 0..frames {
        let start = f * HOP;
        for (i, c) in buf.iter_mut().enumerate() {
            *c = Complex32::new(samples[start + i] * window[i], 0.0);
        }
        fft.process_with_scratch(&mut buf, &mut scratch);
        let mut flux = 0.0f32;
        for k in 0..bins {
            cur[k] = (1.0 + 100.0 * buf[k].norm() * norm).ln();
            if f > 0 {
                flux += (cur[k] - prev[k]).max(0.0);
            }
        }
        env.push(flux);
        std::mem::swap(&mut prev, &mut cur);
    }
    env
}

/// Remove a tendência local (média móvel) e normaliza pelo desvio padrão.
fn normalize(env: &[f32], fps: f64) -> Option<Vec<f32>> {
    let half = ((fps * 0.25).round() as usize).max(1);
    let mut prefix = vec![0.0f64; env.len() + 1];
    for (i, v) in env.iter().enumerate() {
        prefix[i + 1] = prefix[i] + *v as f64;
    }
    let detrended: Vec<f32> = (0..env.len())
        .map(|i| {
            let a = i.saturating_sub(half);
            let b = (i + half + 1).min(env.len());
            let mean = (prefix[b] - prefix[a]) / (b - a) as f64;
            (env[i] as f64 - mean).max(0.0) as f32
        })
        .collect();
    let n = detrended.len() as f64;
    let mean = detrended.iter().map(|v| *v as f64).sum::<f64>() / n;
    let var = detrended
        .iter()
        .map(|v| (*v as f64 - mean).powi(2))
        .sum::<f64>()
        / n;
    let std = var.sqrt();
    if !std.is_finite() || std < 1e-6 {
        return None;
    }
    Some(detrended.iter().map(|v| (*v as f64 / std) as f32).collect())
}

/// Período (em quadros, fracionário) pela autocorrelação ponderada.
fn estimate_period(o: &[f32], fps: f64) -> Option<f64> {
    let lag_min = (fps * 60.0 / MAX_BPM).floor().max(1.0) as usize;
    let lag_max = (fps * 60.0 / MIN_BPM).ceil() as usize;
    if o.len() <= lag_max * 2 {
        return None;
    }
    let lag0 = fps * 60.0 / PRIOR_BPM;
    let score: Vec<f64> = (lag_min..=lag_max)
        .map(|lag| {
            let n = o.len() - lag;
            let r = (0..n).map(|t| o[t] as f64 * o[t + lag] as f64).sum::<f64>() / n as f64;
            let w = (-0.5 * ((lag as f64 / lag0).log2() / PRIOR_OCTAVES).powi(2)).exp();
            r * w
        })
        .collect();
    let (best, _) = score.iter().enumerate().max_by(|a, b| a.1.total_cmp(b.1))?;
    // Interpolação parabólica para um período sub-quadro.
    let refine = if best > 0 && best + 1 < score.len() {
        let (y0, y1, y2) = (score[best - 1], score[best], score[best + 1]);
        let d = y0 - 2.0 * y1 + y2;
        if d.abs() > 1e-12 {
            (0.5 * (y0 - y2) / d).clamp(-0.5, 0.5)
        } else {
            0.0
        }
    } else {
        0.0
    };
    Some((lag_min + best) as f64 + refine)
}

/// Programação dinâmica de Ellis: devolve os quadros das batidas.
fn track_beats(o: &[f32], period: f64) -> Vec<usize> {
    let n = o.len();
    let mut cum = vec![0.0f64; n];
    let mut back: Vec<Option<usize>> = vec![None; n];
    let lo_off = (2.0 * period).round() as usize;
    let hi_off = (period / 2.0).round().max(1.0) as usize;

    for t in 0..n {
        let local = o[t] as f64;
        if t < hi_off {
            cum[t] = local;
            continue;
        }
        let lo = t.saturating_sub(lo_off);
        let hi = t - hi_off;
        let mut best = f64::NEG_INFINITY;
        let mut arg = None;
        for (tau, prev) in cum.iter().enumerate().take(hi + 1).skip(lo) {
            let penalty = TIGHTNESS * (((t - tau) as f64) / period).ln().powi(2);
            let v = prev - penalty;
            if v > best {
                best = v;
                arg = Some(tau);
            }
        }
        cum[t] = local + best.max(0.0);
        back[t] = arg.filter(|_| best > 0.0);
    }

    // A última batida é o melhor ponto no último período.
    let tail = n.saturating_sub(period.ceil() as usize);
    let Some(mut t) = (tail..n).max_by(|a, b| cum[*a].total_cmp(&cum[*b])) else {
        return Vec::new();
    };
    let mut beats = vec![t];
    while let Some(prev) = back[t] {
        beats.push(prev);
        t = prev;
    }
    beats.reverse();
    beats
}

/// Analisa amostras mono em `rate` Hz.
pub fn analyze(samples: &[f32], rate: u32) -> BeatAnalysis {
    let none = BeatAnalysis {
        bpm: None,
        beats: Vec::new(),
    };
    let fps = rate as f64 / HOP as f64;
    let env = onset_envelope(samples);
    let Some(o) = normalize(&env, fps) else {
        return none;
    };
    let Some(period) = estimate_period(&o, fps) else {
        return none;
    };
    let frames = track_beats(&o, period);
    if frames.len() < 2 {
        return none;
    }

    // Força: pico local do onset em torno da batida.
    let raw: Vec<f32> = frames
        .iter()
        .map(|&f| {
            o[f.saturating_sub(1)..(f + 2).min(o.len())]
                .iter()
                .cloned()
                .fold(0.0, f32::max)
        })
        .collect();

    // Remove batidas fracas nas pontas (silêncio/fade no início e no fim).
    let rms = (o.iter().map(|v| (*v as f64).powi(2)).sum::<f64>() / o.len() as f64).sqrt() as f32;
    let threshold = 0.5 * rms;
    let first = raw.iter().position(|s| *s >= threshold).unwrap_or(0);
    let last = raw
        .iter()
        .rposition(|s| *s >= threshold)
        .unwrap_or(raw.len() - 1);

    let mut sorted: Vec<f32> = raw[first..=last].to_vec();
    sorted.sort_by(f32::total_cmp);
    let p95 = sorted[((sorted.len() - 1) as f64 * 0.95) as usize].max(1e-6);

    let offset = (WIN / 2) as f64 / rate as f64;
    let beats = (first..=last)
        .map(|i| Beat {
            time_sec: ((frames[i] * HOP) as f64 / rate as f64 + offset).max(0.0),
            strength: ((raw[i] / p95).min(1.0) * 1000.0).round() / 1000.0,
        })
        .collect();

    BeatAnalysis {
        bpm: Some((60.0 * fps / period * 10.0).round() / 10.0),
        beats,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::audio::ANALYSIS_RATE;

    /// Faixa sintética: "kick" (seno grave com decaimento) a cada batida + ruído de fundo.
    fn click_track(bpm: f64, secs: f64, offset: f64) -> (Vec<f32>, Vec<f64>) {
        let rate = ANALYSIS_RATE as f64;
        let n = (secs * rate) as usize;
        let mut seed = 12345u32;
        let mut s: Vec<f32> = (0..n)
            .map(|_| {
                seed = seed.wrapping_mul(1_103_515_245).wrapping_add(12_345);
                ((seed >> 16) as f32 / 65_535.0 - 0.5) * 0.02
            })
            .collect();
        let period = 60.0 / bpm;
        let mut times = Vec::new();
        let mut t = offset;
        while t < secs - 0.2 {
            times.push(t);
            let start = (t * rate) as usize;
            for i in 0..((0.12 * rate) as usize) {
                if start + i >= n {
                    break;
                }
                let x = i as f64 / rate;
                s[start + i] += ((std::f64::consts::TAU * 80.0 * x).sin() * (-x * 30.0).exp() * 0.8)
                    as f32
                    + ((std::f64::consts::TAU * 2500.0 * x).sin() * (-x * 200.0).exp() * 0.4)
                        as f32;
            }
            t += period;
        }
        (s, times)
    }

    fn check(bpm: f64) {
        let (samples, truth) = click_track(bpm, 30.0, 0.37);
        let a = analyze(&samples, ANALYSIS_RATE);
        let got = a.bpm.expect("deveria detectar BPM");
        assert!((got - bpm).abs() <= 2.0, "BPM esperado {bpm}, obtido {got}");
        assert!(
            a.beats.len() as f64 >= truth.len() as f64 * 0.85,
            "poucas batidas: {}",
            a.beats.len()
        );
        let tol = 0.035;
        let aligned = a
            .beats
            .iter()
            .filter(|b| truth.iter().any(|t| (t - b.time_sec).abs() <= tol))
            .count();
        assert!(
            aligned as f64 >= a.beats.len() as f64 * 0.9,
            "{aligned}/{} batidas alinhadas (bpm {bpm})",
            a.beats.len()
        );
        assert!(a.beats.iter().all(|b| (0.0..=1.0).contains(&b.strength)));
    }

    #[test]
    fn detects_120_bpm() {
        check(120.0);
    }

    #[test]
    fn detects_90_bpm_without_octave_error() {
        check(90.0);
    }

    #[test]
    fn detects_140_bpm() {
        check(140.0);
    }

    #[test]
    fn silence_has_no_beats() {
        let a = analyze(&vec![0.0; ANALYSIS_RATE as usize * 10], ANALYSIS_RATE);
        assert_eq!(a.bpm, None);
        assert!(a.beats.is_empty());
    }
}
