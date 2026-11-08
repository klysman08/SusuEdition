//! Comandos de áudio: análise da música (waveform, BPM e batidas).

use tauri::{AppHandle, Manager, Runtime};

use crate::error::{AppError, AppResult};
use crate::services::audio::{ANALYSIS_RATE, decode_to_analysis, peaks};
use crate::services::beat;
use crate::services::cache::MediaCache;
use crate::services::media_types::AudioAnalysis;
use crate::services::registry::MediaRegistry;

/// Quantidade de picos da waveform (≈ 1 a cada 60 ms numa faixa de 4 min).
const PEAK_BUCKETS: usize = 4000;

/// Decodifica a música e detecta batidas. Resultado em cache por id do arquivo.
#[tauri::command]
pub async fn audio_analyze<R: Runtime>(app: AppHandle<R>, id: String) -> AppResult<AudioAnalysis> {
    tauri::async_runtime::spawn_blocking(move || analyze_blocking(&app, &id))
        .await
        .map_err(|e| AppError::Unsupported(e.to_string()))?
}

fn analyze_blocking<R: Runtime>(app: &AppHandle<R>, id: &str) -> AppResult<AudioAnalysis> {
    let cache = app.state::<MediaCache>();
    if let Some(cached) = cache.get_audio(id) {
        return Ok(cached);
    }
    let registry = app.state::<MediaRegistry>();
    let entry = registry.entry(id)?;
    let file = registry.open_new(app, id)?;
    let ext = entry.mime.rsplit('/').next().map(|m| match m {
        "mpeg" => "mp3",
        "mp4" | "x-m4a" | "m4a" => "m4a",
        "x-wav" | "wave" => "wav",
        other => other,
    });

    let started = std::time::Instant::now();
    let decoded =
        decode_to_analysis(file, ext).map_err(|e| AppError::Unsupported(e.to_string()))?;
    let beats = beat::analyze(&decoded.samples, ANALYSIS_RATE);
    let analysis = AudioAnalysis {
        duration_sec: decoded.duration_sec(),
        source_rate: decoded.source_rate,
        channels: decoded.channels,
        peaks: peaks(&decoded.samples, PEAK_BUCKETS),
        bpm: beats.bpm,
        beats: beats.beats,
    };
    log::info!(
        "áudio {id}: {:.1}s, {:?} BPM, {} batidas em {} ms",
        analysis.duration_sec,
        analysis.bpm,
        analysis.beats.len(),
        started.elapsed().as_millis()
    );
    if let Err(e) = cache.put_audio(id, &analysis) {
        log::warn!("falha ao gravar análise de áudio {id}: {e}");
    }
    Ok(analysis)
}
