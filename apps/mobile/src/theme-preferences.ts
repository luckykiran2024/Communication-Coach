export const themeModes = ["light", "dark"] as const;
export type ThemeMode = typeof themeModes[number];

export function normalizeThemeMode(savedTheme: string | null): ThemeMode {
  return savedTheme === "dark" ? "dark" : "light";
}
