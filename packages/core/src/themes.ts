export const colorThemes = ["emerald", "sunrise", "ocean", "berry"] as const;
export type ColorTheme = typeof colorThemes[number];
export type ColorMode = "light" | "dark";

export type ThemePalette = {
  background: string; surface: string; accentSurface: string; ink: string; muted: string;
  accent: string; onAccent: string; positive: string; onPositive: string; border: string;
  controlBorder: string; error: string; glow: string;
};

export const colorThemeDetails: Record<ColorTheme, { title: string; description: string }> = {
  emerald: { title: "Emerald Studio", description: "Forest green, soft sage and charcoal. Our signature palette." },
  ocean: { title: "Ocean Clarity", description: "Cool teal and blue for a crisp, focused feel." },
  sunrise: { title: "Sunrise Energy", description: "Warm coral and ivory for an expressive, welcoming feel." },
  berry: { title: "Berry Focus", description: "Plum and rose for a softer, reflective feel." },
};

export const colorPalettes: Record<ColorTheme, Record<ColorMode, ThemePalette>> = {
  emerald: {
    light: {
      background: "#F0F5F1", surface: "#FCFEFC", accentSurface: "#E1EFE6", ink: "#162B24", muted: "#4B6358",
      accent: "#146C50", onAccent: "#FFFFFF", positive: "#196449", onPositive: "#FFFFFF", border: "#C4D8CC",
      controlBorder: "#728D7E", error: "#AD3434", glow: "#B6D8C4",
    },
    dark: {
      background: "#0A1411", surface: "#14221D", accentSurface: "#19392B", ink: "#F1F7F3", muted: "#B2C7BA",
      accent: "#91DFB5", onAccent: "#10281D", positive: "#A4E7C0", onPositive: "#10281D", border: "#314D3F",
      controlBorder: "#729381", error: "#FFADA5", glow: "#285B41",
    },
  },
  sunrise: {
    light: {
      background: "#FFF7EF", surface: "#FFFFFF", accentSurface: "#FFE6D8", ink: "#1B1D3A", muted: "#655A64",
      accent: "#BE3D30", onAccent: "#FFFFFF", positive: "#17634F", onPositive: "#FFFFFF", border: "#E2C9BB",
      controlBorder: "#997D71", error: "#A92D34", glow: "#E9C7B8",
    },
    dark: {
      background: "#0D1124", surface: "#171D36", accentSurface: "#312341", ink: "#F8F5FF", muted: "#C8BED4",
      accent: "#FF806D", onAccent: "#13233F", positive: "#70DAB6", onPositive: "#13233F", border: "#4B405D",
      controlBorder: "#96859E", error: "#FFADA5", glow: "#5B3C55",
    },
  },
  ocean: {
    light: {
      background: "#F2FBFA", surface: "#FFFFFF", accentSurface: "#DDF6F2", ink: "#102B3A", muted: "#45616D",
      accent: "#007489", onAccent: "#FFFFFF", positive: "#006555", onPositive: "#FFFFFF", border: "#BDD9D7",
      controlBorder: "#6C9299", error: "#A92D34", glow: "#B7D9DA",
    },
    dark: {
      background: "#071A24", surface: "#102B3A", accentSurface: "#123D49", ink: "#F2FCFF", muted: "#B4CDD5",
      accent: "#38C7D7", onAccent: "#102B3A", positive: "#70DAB6", onPositive: "#102B3A", border: "#335767",
      controlBorder: "#739CA7", error: "#FFADA5", glow: "#245563",
    },
  },
  berry: {
    light: {
      background: "#FCF4FB", surface: "#FFFFFF", accentSurface: "#F5E4F4", ink: "#2A1837", muted: "#71596F",
      accent: "#913E96", onAccent: "#FFFFFF", positive: "#963B59", onPositive: "#FFFFFF", border: "#DEC6DD",
      controlBorder: "#A17D9F", error: "#A92D34", glow: "#DEC7DF",
    },
    dark: {
      background: "#1B1024", surface: "#291536", accentSurface: "#3A1C42", ink: "#FFF6FF", muted: "#D2BAD0",
      accent: "#E783D4", onAccent: "#2A1837", positive: "#F5A2BC", onPositive: "#2A1837", border: "#62436A",
      controlBorder: "#B28AB4", error: "#FFADA5", glow: "#5B3262",
    },
  },
};

export const palette = colorPalettes.sunrise;

export function normalizeColorTheme(saved: string | null): ColorTheme {
  return colorThemes.includes(saved as ColorTheme) ? saved as ColorTheme : "emerald";
}
