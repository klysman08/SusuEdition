//! Parser de cabeçalho HTTP `Range` (apenas um intervalo de bytes).

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ByteRange {
    pub start: u64,
    /// Inclusivo.
    pub end: u64,
    /// `bytes=N-`: o cliente aceita qualquer quantidade a partir de `start`.
    pub open_ended: bool,
}

/// Retorna `None` quando o intervalo não é satisfazível (→ 416).
pub fn parse_range(header: &str, size: u64) -> Option<ByteRange> {
    let spec = header.trim().strip_prefix("bytes=")?;
    let first = spec.split(',').next()?.trim();
    let (a, b) = first.split_once('-')?;
    let (a, b) = (a.trim(), b.trim());
    if size == 0 {
        return None;
    }
    let last = size - 1;
    match (a.is_empty(), b.is_empty()) {
        // bytes=-N → últimos N bytes
        (true, false) => {
            let n: u64 = b.parse().ok()?;
            if n == 0 {
                return None;
            }
            Some(ByteRange {
                start: size.saturating_sub(n),
                end: last,
                open_ended: false,
            })
        }
        // bytes=N-
        (false, true) => {
            let start: u64 = a.parse().ok()?;
            (start <= last).then_some(ByteRange {
                start,
                end: last,
                open_ended: true,
            })
        }
        // bytes=N-M
        (false, false) => {
            let start: u64 = a.parse().ok()?;
            let end: u64 = b.parse().ok()?;
            (start <= end && start <= last).then_some(ByteRange {
                start,
                end: end.min(last),
                open_ended: false,
            })
        }
        (true, true) => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_common_forms() {
        assert_eq!(
            parse_range("bytes=0-99", 1000),
            Some(ByteRange {
                start: 0,
                end: 99,
                open_ended: false
            })
        );
        assert_eq!(
            parse_range("bytes=900-", 1000),
            Some(ByteRange {
                start: 900,
                end: 999,
                open_ended: true
            })
        );
        assert_eq!(
            parse_range("bytes=-100", 1000),
            Some(ByteRange {
                start: 900,
                end: 999,
                open_ended: false
            })
        );
        assert_eq!(
            parse_range("bytes=990-5000", 1000),
            Some(ByteRange {
                start: 990,
                end: 999,
                open_ended: false
            })
        );
        assert_eq!(parse_range("bytes=0-1, 5-6", 1000).unwrap().end, 1);
    }

    #[test]
    fn rejects_unsatisfiable() {
        assert_eq!(parse_range("bytes=1000-", 1000), None);
        assert_eq!(parse_range("bytes=5-1", 1000), None);
        assert_eq!(parse_range("items=0-1", 1000), None);
        assert_eq!(parse_range("bytes=0-1", 0), None);
        assert_eq!(parse_range("bytes=-0", 1000), None);
    }
}
