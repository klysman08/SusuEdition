import { describe, expect, it } from "vitest";

import { isNewerVersion, parseRelease, parseVersion, pickAsset } from "./updates";

describe("versões", () => {
  it("lê tags com ou sem 'v' e ignora o sufixo de pré-release", () => {
    expect(parseVersion("v0.8.0")).toEqual([0, 8, 0]);
    expect(parseVersion("1.12.3-2")).toEqual([1, 12, 3]);
    expect(parseVersion("nightly")).toBeNull();
  });

  it("compara número a número (0.10.0 é mais nova que 0.9.9)", () => {
    expect(isNewerVersion("v0.10.0", "0.9.9")).toBe(true);
    expect(isNewerVersion("v0.8.1", "0.8.0")).toBe(true);
    expect(isNewerVersion("v1.0.0", "0.99.99")).toBe(true);
    expect(isNewerVersion("v0.8.0", "0.8.0")).toBe(false);
    expect(isNewerVersion("v0.7.9", "0.8.0")).toBe(false);
    expect(isNewerVersion("???", "0.8.0")).toBe(false);
  });
});

describe("release do GitHub", () => {
  const base = "https://github.com/klysman08/SusuEdition";
  const names = [
    "SusuEdition_0.9.0_x64-setup.exe",
    "SusuEdition_0.9.0_x64_en-US.msi",
    "SusuEdition_v0.9.0_android.apk",
  ];
  const raw = {
    tag_name: "v0.9.0",
    draft: false,
    html_url: `${base}/releases/tag/v0.9.0`,
    published_at: "2026-11-20T10:00:00Z",
    assets: names.map((name) => ({ name, browser_download_url: `${base}/releases/download/v0.9.0/${name}` })),
  };

  it("escolhe o instalador da plataforma", () => {
    expect(pickAsset(names, "windows")).toBe(names[0]);
    expect(pickAsset(names, "android")).toBe(names[2]);
    expect(pickAsset(names, "linux")).toBeNull();
    expect(pickAsset([names[1]!], "windows")).toBe(names[1]);
  });

  it("extrai versão, página e link de download", () => {
    expect(parseRelease(raw, "android")).toEqual({
      version: "0.9.0",
      pageUrl: raw.html_url,
      downloadUrl: `${base}/releases/download/v0.9.0/${names[2]}`,
      publishedAt: raw.published_at,
    });
    expect(parseRelease(raw, "web")?.downloadUrl).toBeNull();
  });

  it("recusa rascunhos, tags inválidas e links de fora do repositório", () => {
    expect(parseRelease({ ...raw, draft: true }, "windows")).toBeNull();
    expect(parseRelease({ ...raw, tag_name: "latest" }, "windows")).toBeNull();
    expect(parseRelease({ ...raw, html_url: "https://example.com/x" }, "windows")).toBeNull();
    const foreign = { ...raw, assets: [{ name: names[0], browser_download_url: "https://example.com/setup.exe" }] };
    expect(parseRelease(foreign, "windows")?.downloadUrl).toBeNull();
    expect(parseRelease(null, "windows")).toBeNull();
  });
});
