import assert from "node:assert/strict";
import test from "node:test";
import { colorPalettes, colorThemes, normalizeColorTheme } from "../src/themes";

function luminance(hex: string) {
  const channels = [1, 3, 5].map(offset => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("new or invalid palette preferences choose emerald; existing saved choices survive", () => {
  for (const saved of [null, "", "unknown"]) assert.equal(normalizeColorTheme(saved), "emerald");
  for (const saved of colorThemes) assert.equal(normalizeColorTheme(saved), saved);
});

test("all palette text, status and button colours meet normal-text contrast", () => {
  for (const id of colorThemes) for (const mode of ["light", "dark"] as const) {
    const colors = colorPalettes[id][mode];
    for (const surface of [colors.surface, colors.accentSurface, colors.background]) {
      for (const foreground of [colors.ink, colors.muted, colors.positive, colors.accent, colors.error]) {
        assert.ok(contrast(foreground, surface) >= 4.5, `${id}/${mode}: ${foreground} on ${surface}`);
      }
    }
    assert.ok(contrast(colors.onAccent, colors.accent) >= 4.5, `${id}/${mode}: primary action text`);
    assert.ok(contrast(colors.onPositive, colors.positive) >= 4.5, `${id}/${mode}: active microphone icon`);
  }
});

test("input and secondary-action boundaries remain visible across all palettes", () => {
  for (const id of colorThemes) for (const mode of ["light", "dark"] as const) {
    const colors = colorPalettes[id][mode];
    assert.ok(contrast(colors.controlBorder, colors.surface) >= 3, `${id}/${mode}: control outline`);
  }
});
