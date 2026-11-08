export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "heic", "heif"] as const;
export const VIDEO_EXTENSIONS = ["mp4", "m4v", "mov", "webm", "mkv"] as const;
export const SUPPORTED_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS] as const;
/** Formatos de música decodificados pelo Symphonia (vídeos MP4/MOV também servem como fonte de áudio). */
export const AUDIO_EXTENSIONS = ["mp3", "m4a", "aac", "wav", "ogg", "oga", "flac", "mp4", "mov"] as const;

/** Valor do atributo `accept` do <input type="file"> no modo navegador. */
export const ACCEPT_ATTRIBUTE = "image/*,video/*";
export const AUDIO_ACCEPT_ATTRIBUTE = "audio/*,video/mp4,video/quicktime";
