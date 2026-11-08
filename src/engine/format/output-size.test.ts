import { describe, expect, it } from "vitest";

import { outputSize, suggestedVideoBitrate } from "./output-size";

describe("outputSize", () => {
  it.each([
    ["9:16", "1080p", 1080, 1920],
    ["16:9", "1080p", 1920, 1080],
    ["4:3", "1080p", 1440, 1080],
    ["1:1", "1080p", 1080, 1080],
    ["4:5", "1080p", 1080, 1350],
    ["3:4", "1080p", 1080, 1440],
    ["9:16", "4k", 2160, 3840],
    ["16:9", "720p", 1280, 720],
  ] as const)("%s @ %s → %ix%i", (aspect, quality, width, height) => {
    expect(outputSize(aspect, quality)).toEqual({ width, height });
  });

  it("always returns even dimensions", () => {
    const { width, height } = outputSize("4:5", "720p");
    expect(width % 2).toBe(0);
    expect(height % 2).toBe(0);
  });
});

describe("suggestedVideoBitrate", () => {
  it("scales 1.5x for 60 fps", () => {
    expect(suggestedVideoBitrate("1080p", 30)).toBe(12_000_000);
    expect(suggestedVideoBitrate("1080p", 60)).toBe(18_000_000);
  });
});
