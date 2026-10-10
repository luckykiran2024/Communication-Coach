import assert from "node:assert/strict";
import test from "node:test";
import { normalizeThemeMode, themeModes } from "../apps/mobile/src/theme-preferences";

test("theme choices contain only light and dark", () => {
  assert.deepEqual(themeModes, ["light", "dark"]);
});

test("explicit saved theme choices are preserved", () => {
  for (const mode of themeModes) assert.equal(normalizeThemeMode(mode), mode);
});

test("legacy system, missing and invalid preferences migrate to light", () => {
  for (const savedTheme of ["system", null, "", "invalid"]) {
    const migratedTheme = normalizeThemeMode(savedTheme);
    assert.equal(migratedTheme, "light");
    assert.equal(normalizeThemeMode(migratedTheme), migratedTheme);
  }
});
