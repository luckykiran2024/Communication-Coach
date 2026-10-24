import { router } from "expo-router";
import { Text, View } from "react-native";
import { colorThemeDetails } from "@coach/core";
import { AppearanceMode, PaletteChoices } from "../src/appearance-controls";
import { Action, Card, Copy, Heading, Icon, Screen, usePreferences, useTheme, VoiceWave } from "../src/ui";

export default function Appearance() {
  const theme = useTheme();
  const { colorTheme, themeMode } = usePreferences();
  return <Screen>
    <Heading eyebrow="Make it yours">Your practice, in a new light.</Heading>
    <AppearanceMode />
    <Card tone="accent">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: theme.surface,
          borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}>
          <Icon name="spark" size={22} color={theme.positive} />
        </View>
        <Text style={{ color: theme.positive, fontSize: 11, letterSpacing: 1.5, fontWeight: "700", flexShrink: 1 }}>
          COMMUNICATION COACH
        </Text>
      </View>
      <Heading>Find the words.{"\n"}Make them count.</Heading>
      <Copy>A quiet space to organise your thoughts, practise your response and speak with intention.</Copy>
      <VoiceWave />
      <Action title="Continue to practice" icon="play" onPress={() => router.push("/")} />
      <Text style={{ color: theme.muted, fontSize: 13, textAlign: "center", lineHeight: 20 }}>
        {colorThemeDetails[colorTheme].title} · {themeMode === "dark" ? "Dark" : "Light"}
      </Text>
    </Card>
    <PaletteChoices />
    <Card>
      <Heading eyebrow="Designed for focus">A little more breathing room.</Heading>
      <Copy>Soft colour transitions, readable text and clear controls carry through your practice and feedback screens.</Copy>
      <Copy>Changes are saved on this device. Your practice history and coaching scores stay the same.</Copy>
    </Card>
  </Screen>;
}
