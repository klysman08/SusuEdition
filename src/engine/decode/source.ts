import { BlobSource, UrlSource } from "mediabunny";

import type { ProbeSource } from "./probe-protocol";

/** Fonte Mediabunny a partir de uma URL (`susu://`, leitura por Range) ou de um Blob. */
export function makeSource(src: ProbeSource, maxCacheSize = 8 * 1024 * 1024) {
  return src.type === "url"
    ? new UrlSource(src.url, { maxCacheSize, getRetryDelay: (n) => (n < 2 ? 0.2 : null) })
    : new BlobSource(src.blob);
}

/** Bytes de uma fonte (fotos). */
export async function sourceBlob(src: ProbeSource): Promise<Blob> {
  return src.type === "blob" ? src.blob : (await fetch(src.url)).blob();
}
