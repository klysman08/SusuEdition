//! Fotos: leitura de dimensões/EXIF sem decodificar e geração de thumbnail.
//!
//! Performance:
//! - Dimensões lidas só do cabeçalho (`imagesize`).
//! - JPEG decodificado já reduzido no domínio DCT (1/2, 1/4, 1/8) via `jpeg-decoder`,
//!   o que torna uma foto de 48 MP ~10× mais barata de miniaturizar.
//! - O thumbnail sai já orientado (EXIF), em JPEG pequeno.

use std::io::{BufRead, BufReader, Cursor, Read, Seek, SeekFrom};

use image::{DynamicImage, GrayImage, ImageReader, RgbImage};

use super::media_types::{MediaKind, MediaMeta};

/// Lado menor do thumbnail, em px (tiles de ~160 css px em telas 2×).
pub const THUMB_SHORT_SIDE: u32 = 320;
const THUMB_QUALITY: u8 = 80;

#[derive(Debug, thiserror::Error)]
pub enum ImageError {
    #[error("I/O: {0}")]
    Io(#[from] std::io::Error),
    #[error("formato de imagem não suportado")]
    Unsupported,
    #[error("imagem inválida: {0}")]
    Decode(String),
}

#[derive(Debug, Default, Clone, Copy, PartialEq)]
struct ExifInfo {
    orientation: u16,
    captured_at: Option<i64>,
}

fn read_exif<R: BufRead + Seek>(r: &mut R) -> ExifInfo {
    let mut info = ExifInfo {
        orientation: 1,
        captured_at: None,
    };
    let Ok(exif) = exif::Reader::new().read_from_container(r) else {
        return info;
    };
    if let Some(o) = exif
        .get_field(exif::Tag::Orientation, exif::In::PRIMARY)
        .and_then(|f| f.value.get_uint(0))
        .filter(|o| (1..=8).contains(o))
    {
        info.orientation = o as u16;
    }
    let date_field = exif
        .get_field(exif::Tag::DateTimeOriginal, exif::In::PRIMARY)
        .or_else(|| exif.get_field(exif::Tag::DateTime, exif::In::PRIMARY));
    if let Some(exif::Value::Ascii(parts)) = date_field.map(|f| &f.value)
        && let Some(dt) = parts
            .first()
            .and_then(|p| exif::DateTime::from_ascii(p).ok())
    {
        info.captured_at = Some(epoch_ms(
            dt.year as i64,
            dt.month as u32,
            dt.day as u32,
            dt.hour,
            dt.minute,
            dt.second,
        ));
    }
    info
}

/// Data/hora "civil" (sem fuso, como no EXIF) → epoch ms. Algoritmo de Howard Hinnant.
fn epoch_ms(y: i64, m: u32, d: u32, hh: u8, mm: u8, ss: u8) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let mp = (m as i64 + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d as i64 - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146_097 + doe - 719_468;
    ((days * 86_400) + hh as i64 * 3600 + mm as i64 * 60 + ss as i64) * 1000
}

fn apply_orientation(img: RgbImage, orientation: u16) -> RgbImage {
    use image::imageops::{flip_horizontal, flip_vertical, rotate90, rotate180, rotate270};
    match orientation {
        2 => flip_horizontal(&img),
        3 => rotate180(&img),
        4 => flip_vertical(&img),
        5 => flip_horizontal(&rotate90(&img)),
        6 => rotate90(&img),
        7 => flip_horizontal(&rotate270(&img)),
        8 => rotate270(&img),
        _ => img,
    }
}

/// Tamanho mínimo (raw) que garante `short` px no lado menor após o thumbnail.
fn target_size(w: u32, h: u32, short: u32) -> (u32, u32) {
    let min = w.min(h).max(1);
    if min <= short {
        return (w, h);
    }
    let scale = short as f64 / min as f64;
    (
        ((w as f64) * scale).ceil() as u32,
        ((h as f64) * scale).ceil() as u32,
    )
}

fn decode_jpeg_scaled<R: Read>(r: R, tw: u32, th: u32) -> Result<RgbImage, ImageError> {
    let mut dec = jpeg_decoder::Decoder::new(BufReader::new(r));
    let (sw, sh) = dec
        .scale(
            tw.min(u16::MAX as u32) as u16,
            th.min(u16::MAX as u32) as u16,
        )
        .map_err(|e| ImageError::Decode(e.to_string()))?;
    let pixels = dec
        .decode()
        .map_err(|e| ImageError::Decode(e.to_string()))?;
    let info = dec.info().ok_or(ImageError::Unsupported)?;
    let (w, h) = (sw as u32, sh as u32);
    let bad = || ImageError::Decode("buffer de pixels inconsistente".into());
    Ok(match info.pixel_format {
        jpeg_decoder::PixelFormat::RGB24 => RgbImage::from_raw(w, h, pixels).ok_or_else(bad)?,
        jpeg_decoder::PixelFormat::L8 => {
            DynamicImage::ImageLuma8(GrayImage::from_raw(w, h, pixels).ok_or_else(bad)?).to_rgb8()
        }
        jpeg_decoder::PixelFormat::L16 => {
            let gray: Vec<u8> = pixels.chunks_exact(2).map(|c| c[0]).collect();
            DynamicImage::ImageLuma8(GrayImage::from_raw(w, h, gray).ok_or_else(bad)?).to_rgb8()
        }
        jpeg_decoder::PixelFormat::CMYK32 => {
            let rgb: Vec<u8> = pixels
                .chunks_exact(4)
                .flat_map(|p| {
                    let k = p[3] as u32;
                    [p[0], p[1], p[2]].map(|c| ((c as u32 * k) / 255) as u8)
                })
                .collect();
            RgbImage::from_raw(w, h, rgb).ok_or_else(bad)?
        }
    })
}

/// Extrai metadados e gera o thumbnail (JPEG) de uma foto.
pub fn process_image<R: Read + Seek>(
    mut r: R,
    mime: &str,
) -> Result<(MediaMeta, Vec<u8>), ImageError> {
    if mime == "image/heif" || mime == "image/avif" {
        return Err(ImageError::Unsupported);
    }

    let exif = {
        let mut br = BufReader::new(&mut r);
        read_exif(&mut br)
    };
    r.seek(SeekFrom::Start(0))?;
    let raw =
        imagesize::reader_size(BufReader::new(&mut r)).map_err(|_| ImageError::Unsupported)?;
    let (raw_w, raw_h) = (raw.width as u32, raw.height as u32);
    r.seek(SeekFrom::Start(0))?;

    let (tw, th) = target_size(raw_w, raw_h, THUMB_SHORT_SIDE);
    let decoded = if mime == "image/jpeg" {
        decode_jpeg_scaled(&mut r, tw, th)?
    } else {
        ImageReader::new(BufReader::new(&mut r))
            .with_guessed_format()?
            .decode()
            .map_err(|e| ImageError::Decode(e.to_string()))?
            .to_rgb8()
    };

    let (dw, dh) = decoded.dimensions();
    let (fw, fh) = target_size(dw, dh, THUMB_SHORT_SIDE);
    let resized = if (fw, fh) != (dw, dh) {
        image::imageops::thumbnail(&decoded, fw, fh)
    } else {
        decoded
    };
    let oriented = apply_orientation(resized, exif.orientation);

    let mut out = Cursor::new(Vec::with_capacity(32 * 1024));
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, THUMB_QUALITY)
        .encode_image(&oriented)
        .map_err(|e| ImageError::Decode(e.to_string()))?;

    let swap = exif.orientation >= 5;
    let meta = MediaMeta {
        kind: MediaKind::Image,
        width: if swap { raw_h } else { raw_w },
        height: if swap { raw_w } else { raw_h },
        rotation: 0,
        orientation: Some(exif.orientation),
        duration_sec: None,
        has_audio: None,
        captured_at: exif.captured_at,
        codec: None,
        decodable: Some(true),
        thumb_ext: "jpg".into(),
    };
    Ok((meta, out.into_inner()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn jpeg(w: u32, h: u32) -> Vec<u8> {
        let img = RgbImage::from_fn(w, h, |x, y| {
            image::Rgb([(x % 256) as u8, (y % 256) as u8, 128])
        });
        let mut out = Cursor::new(Vec::new());
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 85)
            .encode_image(&img)
            .unwrap();
        out.into_inner()
    }

    /// Insere um segmento APP1/EXIF mínimo com a tag Orientation logo após o SOI.
    fn with_orientation(jpeg: &[u8], orientation: u16) -> Vec<u8> {
        let mut tiff = Vec::new();
        tiff.extend_from_slice(b"II*\0");
        tiff.extend_from_slice(&8u32.to_le_bytes()); // offset do IFD0
        tiff.extend_from_slice(&1u16.to_le_bytes()); // 1 entrada
        tiff.extend_from_slice(&0x0112u16.to_le_bytes()); // Orientation
        tiff.extend_from_slice(&3u16.to_le_bytes()); // SHORT
        tiff.extend_from_slice(&1u32.to_le_bytes());
        tiff.extend_from_slice(&orientation.to_le_bytes());
        tiff.extend_from_slice(&[0, 0]);
        tiff.extend_from_slice(&0u32.to_le_bytes()); // próximo IFD
        let mut app1 = b"Exif\0\0".to_vec();
        app1.extend_from_slice(&tiff);
        let len = (app1.len() + 2) as u16;
        let mut out = vec![0xFF, 0xD8, 0xFF, 0xE1];
        out.extend_from_slice(&len.to_be_bytes());
        out.extend_from_slice(&app1);
        out.extend_from_slice(&jpeg[2..]);
        out
    }

    fn thumb_dims(bytes: &[u8]) -> (u32, u32) {
        let img = image::load_from_memory(bytes).unwrap();
        (img.width(), img.height())
    }

    #[test]
    fn large_jpeg_gets_small_thumbnail() {
        let (meta, thumb) = process_image(Cursor::new(jpeg(4000, 3000)), "image/jpeg").unwrap();
        assert_eq!((meta.width, meta.height), (4000, 3000));
        let (w, h) = thumb_dims(&thumb);
        assert_eq!(h, THUMB_SHORT_SIDE);
        assert!((426..=428).contains(&w), "largura {w}");
    }

    #[test]
    fn exif_orientation_swaps_dimensions_and_rotates_thumbnail() {
        let data = with_orientation(&jpeg(1200, 800), 6);
        let (meta, thumb) = process_image(Cursor::new(data), "image/jpeg").unwrap();
        assert_eq!(meta.orientation, Some(6));
        assert_eq!((meta.width, meta.height), (800, 1200));
        let (w, h) = thumb_dims(&thumb);
        assert!(h > w, "thumbnail deve ficar em retrato: {w}x{h}");
    }

    #[test]
    fn small_png_is_not_upscaled() {
        let img = RgbImage::from_pixel(100, 50, image::Rgb([1, 2, 3]));
        let mut png = Cursor::new(Vec::new());
        img.write_to(&mut png, image::ImageFormat::Png).unwrap();
        png.set_position(0);
        let (meta, thumb) = process_image(png, "image/png").unwrap();
        assert_eq!((meta.width, meta.height), (100, 50));
        assert_eq!(thumb_dims(&thumb), (100, 50));
    }

    #[test]
    fn heif_is_reported_as_unsupported() {
        assert!(matches!(
            process_image(Cursor::new(vec![0u8; 16]), "image/heif"),
            Err(ImageError::Unsupported)
        ));
    }

    #[test]
    fn exif_dates_become_epoch_ms() {
        assert_eq!(epoch_ms(1970, 1, 1, 0, 0, 0), 0);
        assert_eq!(epoch_ms(2024, 5, 1, 12, 30, 0), 1_714_566_600_000);
    }
}
