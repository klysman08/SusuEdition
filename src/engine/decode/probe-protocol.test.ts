import { describe, expect, it } from "vitest";

import { captureDate, posterTime, thumbSize } from "./probe-protocol";

describe("thumbSize", () => {
  it("reduz para 320 px no lado menor mantendo a proporção", () => {
    expect(thumbSize(1920, 1080)).toEqual({ width: 569, height: 320 });
    expect(thumbSize(720, 1280)).toEqual({ width: 320, height: 569 });
  });
  it("não amplia mídias pequenas", () => {
    expect(thumbSize(200, 100)).toEqual({ width: 200, height: 100 });
  });
});

describe("posterTime", () => {
  it("usa 10% da duração, no máximo 1s após o primeiro frame", () => {
    expect(posterTime(0, 4)).toBeCloseTo(0.4);
    expect(posterTime(0.5, 60)).toBeCloseTo(1.5);
    expect(posterTime(0, 0)).toBe(0);
  });
});

describe("captureDate", () => {
  it("prefere a tag de data e cai para a criação do arquivo", () => {
    const d = new Date("2024-03-15T10:00:00Z");
    expect(captureDate({ date: d, creationTime: new Date("2020-01-01") })).toBe(d.getTime());
    expect(captureDate({ creationTime: d })).toBe(d.getTime());
  });
  it("ignora datas zeradas ou inválidas", () => {
    expect(captureDate({ creationTime: new Date(Date.UTC(1904, 0, 1)) })).toBeUndefined();
    expect(captureDate({ creationTime: new Date(0) })).toBeUndefined();
    expect(captureDate({ date: new Date("x") })).toBeUndefined();
    expect(captureDate({})).toBeUndefined();
  });
});
