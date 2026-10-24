import { Pressable, Text, View } from "react-native";
import { colorPalettes, colorThemeDetails, colorThemes } from "@coach/core";
import { Choices, Copy, usePreferences, useTheme } from "./ui";
import { normalizeThemeMode } from "./theme-preferences";
import { radioSelection } from "./presentation";

export function AppearanceMode() {
  const { themeMode, setThemeMode } = usePreferences();
  return <Choices label="Appearance" options={["Light", "Dark"]} value={themeMode === "dark" ? "Dark" : "Light"}
    onChange={value => setThemeMode(normalizeThemeMode(value.toLowerCase()))} />;
}

export function PaletteChoices() {
  const theme = useTheme();
  const { themeMode, colorTheme, setColorTheme } = usePreferences();
  return <View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={{ color: theme.ink, fontSize: 20, fontWeight: "700" }}>Your colour palette</Text>
    <Copy>Emerald Studio is our recommendation. Choose the atmosphere that feels right for you.</Copy>
    {colorThemes.map(id => {
      const colors = colorPalettes[id][themeMode];
      const selected = id === colorTheme;
      return <Pressable key={id} accessibilityRole="radio" accessibilityLabel={colorThemeDetails[id].title}
        {...radioSelection(selected)} onPress={() => setColorTheme(id)} style={({ pressed }) => ({
          padding: 16, borderRadius: 18, borderWidth: 1, borderColor: selected ? theme.accent : theme.controlBorder,
          backgroundColor: selected ? theme.accentSurface : theme.surface, gap: 10, opacity: pressed ? 0.8 : 1,
        })}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <View accessible={false} style={{ flexDirection: "row", gap: 4 }}>
            {[colors.background, colors.accentSurface, colors.accent].map((color, index) =>
              <View key={index} style={{ width: 22, height: 22, borderRadius: 11,
                backgroundColor: color, borderWidth: 1, borderColor: colors.controlBorder }} />)}
          </View>
          <Text style={{ color: theme.ink, fontSize: 16, fontWeight: "700", flexShrink: 1 }}>
            {colorThemeDetails[id].title}{selected ? " · Selected" : ""}
          </Text>
        </View>
        <Text style={{ color: theme.muted, fontSize: 14, lineHeight: 21 }}>{colorThemeDetails[id].description}</Text>
      </Pressable>;
    })}
  </View>;
}
