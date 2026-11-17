import { describe, expect, it } from "vitest";

import { convertibleImage } from "./convert-image";

describe("convertibleImage", () => {
  it("reconhece HEIC/HEIF pelo MIME ou pela extensão", () => {
    expect(convertibleImage("image/heif")).toBe("heif");
    expect(convertibleImage("image/heic")).toBe("heif");
    expect(convertibleImage("", "IMG_0001.HEIC")).toBe("heif");
    expect(convertibleImage(undefined, "foto.heif")).toBe("heif");
  });

  it("reconhece AVIF", () => {
    expect(convertibleImage("image/avif")).toBe("avif");
    expect(convertibleImage("", "x.avif")).toBe("avif");
  });

  it("formatos que o app lê direto não são convertidos", () => {
    expect(convertibleImage("image/jpeg", "a.jpg")).toBeNull();
    expect(convertibleImage("image/png")).toBeNull();
    // Cópia já convertida: o MIME manda (o nome ainda termina em .heic).
    expect(convertibleImage("image/jpeg")).toBeNull();
  });
});
