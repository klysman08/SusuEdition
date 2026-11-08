export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "heic", "heif"] as const;
export const VIDEO_EXTENSIONS = ["mp4", "m4v", "mov", "webm", "mkv"] as const;
export const SUPPORTED_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS] as const;

/** Valor do atributo `accept` do <input type="file"> no modo navegador. */
export const ACCEPT_ATTRIBUTE = "image/*,video/*";
