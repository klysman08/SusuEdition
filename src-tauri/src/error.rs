//! Erro único da aplicação, serializável para o frontend.

use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("I/O: {0}")]
    Io(#[from] std::io::Error),

    #[error("{0}")]
    Tauri(#[from] tauri::Error),

    #[error("mídia não encontrada: {0}")]
    MediaNotFound(String),

    #[error("formato não suportado: {0}")]
    Unsupported(String),
}

/// O frontend recebe `{ kind, message }` em vez de uma string opaca.
impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let kind = match self {
            AppError::Io(_) => "io",
            AppError::Tauri(_) => "tauri",
            AppError::MediaNotFound(_) => "mediaNotFound",
            AppError::Unsupported(_) => "unsupported",
        };
        let mut s = serializer.serialize_struct("AppError", 2)?;
        s.serialize_field("kind", kind)?;
        s.serialize_field("message", &self.to_string())?;
        s.end()
    }
}

pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_kind_and_message() {
        let json = serde_json::to_value(AppError::MediaNotFound("abc".into())).unwrap();
        assert_eq!(json["kind"], "mediaNotFound");
        assert_eq!(json["message"], "mídia não encontrada: abc");
    }
}
