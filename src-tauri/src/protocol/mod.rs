//! Protocolo `susu://` — serve bytes ao WebView sem carregar arquivos inteiros na memória.
//!
//! Rotas:
//! - `/media/<id>` — bytes da mídia original com suporte a **HTTP Range** (Mediabunny, `<video>`)
//! - `/thumb/<id>` — thumbnail em cache (imutável, cache longo no navegador)
//!
//! URL no WebView: `http://susu.localhost/...` (Windows/Android) ou `susu://localhost/...` (macOS/Linux).

mod range;

use tauri::http::{Request, Response, StatusCode, header};
use tauri::{AppHandle, Manager, Runtime, UriSchemeContext, UriSchemeResponder};

use crate::services::cache::MediaCache;
use crate::services::registry::MediaRegistry;
pub use range::{ByteRange, parse_range};

pub const SCHEME: &str = "susu";

/// Tamanho máximo de uma resposta para Range aberto (`bytes=N-`).
const MAX_CHUNK: u64 = 8 * 1024 * 1024;

pub fn handle<R: Runtime>(
    ctx: UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    let app = ctx.app_handle().clone();
    tauri::async_runtime::spawn_blocking(move || {
        responder.respond(route(&app, &request));
    });
}

fn base(status: StatusCode) -> tauri::http::response::Builder {
    Response::builder()
        .status(status)
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(
            header::ACCESS_CONTROL_EXPOSE_HEADERS,
            "Content-Range, Content-Length, Accept-Ranges",
        )
}

fn error(status: StatusCode, msg: &str) -> Response<Vec<u8>> {
    base(status)
        .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
        .body(msg.as_bytes().to_vec())
        .unwrap()
}

fn route<R: Runtime>(app: &AppHandle<R>, req: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    if req.method() == tauri::http::Method::OPTIONS {
        return base(StatusCode::NO_CONTENT)
            .header(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, HEAD, OPTIONS")
            .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "Range, Content-Type")
            .header(header::ACCESS_CONTROL_MAX_AGE, "86400")
            .body(Vec::new())
            .unwrap();
    }

    let path = percent_encoding::percent_decode_str(req.uri().path())
        .decode_utf8_lossy()
        .into_owned();
    let mut parts = path.trim_start_matches('/').splitn(2, '/');
    match (parts.next(), parts.next()) {
        (Some("media"), Some(id)) => serve_media(app, req, id),
        (Some("thumb"), Some(id)) => {
            serve_thumb(app, id.trim_end_matches(".jpg").trim_end_matches(".webp"))
        }
        _ => error(StatusCode::NOT_FOUND, "rota desconhecida"),
    }
}

fn serve_thumb<R: Runtime>(app: &AppHandle<R>, id: &str) -> Response<Vec<u8>> {
    let cache = app.state::<MediaCache>();
    match cache
        .find_thumb(id)
        .and_then(|(p, mime)| std::fs::read(p).ok().map(|b| (b, mime)))
    {
        Some((bytes, mime)) => base(StatusCode::OK)
            .header(header::CONTENT_TYPE, mime)
            .header(header::CACHE_CONTROL, "public, max-age=31536000, immutable")
            .body(bytes)
            .unwrap(),
        None => error(StatusCode::NOT_FOUND, "thumbnail não encontrado"),
    }
}

fn serve_media<R: Runtime>(
    app: &AppHandle<R>,
    req: &Request<Vec<u8>>,
    id: &str,
) -> Response<Vec<u8>> {
    let registry = app.state::<MediaRegistry>();
    let Some(entry) = registry.get(id) else {
        return error(StatusCode::NOT_FOUND, "mídia não registrada");
    };
    let size = entry.size;
    let range_header = req
        .headers()
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok());

    let range = match range_header.map(|h| parse_range(h, size)) {
        Some(Some(r)) => r,
        Some(None) => {
            return base(StatusCode::RANGE_NOT_SATISFIABLE)
                .header(header::CONTENT_RANGE, format!("bytes */{size}"))
                .body(Vec::new())
                .unwrap();
        }
        // Sem Range: trata como `bytes=0-` (resposta parcial limitada).
        None => ByteRange {
            start: 0,
            end: size.saturating_sub(1),
            open_ended: true,
        },
    };
    let end = if range.open_ended {
        range.end.min(range.start + MAX_CHUNK - 1)
    } else {
        range.end
    };
    let len = (end + 1).saturating_sub(range.start);

    if req.method() == tauri::http::Method::HEAD || size == 0 {
        return base(StatusCode::OK)
            .header(header::CONTENT_TYPE, entry.mime.as_str())
            .header(header::ACCEPT_RANGES, "bytes")
            .header(header::CONTENT_LENGTH, size.to_string())
            .body(Vec::new())
            .unwrap();
    }

    match registry.read_range(app, id, range.start, len as usize) {
        Ok(bytes) => {
            let real_end = range.start + bytes.len() as u64 - 1;
            base(StatusCode::PARTIAL_CONTENT)
                .header(header::CONTENT_TYPE, entry.mime.as_str())
                .header(header::ACCEPT_RANGES, "bytes")
                .header(
                    header::CONTENT_RANGE,
                    format!("bytes {}-{}/{}", range.start, real_end, size),
                )
                .header(header::CONTENT_LENGTH, bytes.len().to_string())
                .body(bytes)
                .unwrap()
        }
        Err(e) => {
            log::warn!("susu:// falha ao ler {id}: {e}");
            error(StatusCode::INTERNAL_SERVER_ERROR, "falha ao ler a mídia")
        }
    }
}
