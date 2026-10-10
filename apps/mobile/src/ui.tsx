import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo, ActivityIndicator, Animated, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols";
import { coachAccents, colorPalettes, colorThemes, type CoachAccent, type ColorTheme } from "@coach/core";
import { normalizeThemeMode, type ThemeMode } from "./theme-preferences";

type IconName = "mic" | "person" | "client" | "recording" | "progress" | "spark" | "clock" | "play" | "settings";
const icons: Record<IconName, { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol }> = {
  mic: { ios: "mic.fill" as SFSymbol, android: "mic" as AndroidSymbol, web: "mic" as AndroidSymbol },
  person: { ios: "person.fill" as SFSymbol, android: "person" as AndroidSymbol, web: "person" as AndroidSymbol },
  client: { ios: "person.2.fill" as SFSymbol, android: "groups" as AndroidSymbol, web: "groups" as AndroidSymbol },
  recording: { ios: "record.circle.fill" as SFSymbol, android: "fiber_smart_record" as AndroidSymbol, web: "fiber_smart_record" as AndroidSymbol },
  progress: { ios: "chart.bar.xaxis" as SFSymbol, android: "auto_graph" as AndroidSymbol, web: "auto_graph" as AndroidSymbol },
  spark: { ios: "sparkles" as SFSymbol, android: "auto_awesome" as AndroidSymbol, web: "auto_awesome" as AndroidSymbol },
  clock: { ios: "clock.fill" as SFSymbol, android: "schedule" as AndroidSymbol, web: "schedule" as AndroidSymbol },
  play: { ios: "play.fill" as SFSymbol, android: "play_arrow" as AndroidSymbol, web: "play_arrow" as AndroidSymbol },
  settings: { ios: "gearshape.fill" as SFSymbol, android: "settings" as AndroidSymbol, web: "settings" as AndroidSymbol },
};
const fontFamily = Platform.select({ ios: "System", android: "sans-serif", default: "system-ui" });

export type { ThemeMode } from "./theme-preferences";
type Preferences = { themeMode: ThemeMode; setThemeMode(mode: ThemeMode): void; colorTheme: ColorTheme; setColorTheme(theme: ColorTheme): void; avatarUri: string; setAvatarUri(uri: string): void; voiceAccent: CoachAccent; setVoiceAccent(accent: CoachAccent): void; reducedMotion: boolean; setReducedMotion(value: boolean): void };
const PreferencesContext = createContext<Preferences | null>(null);
const preferenceKeys = { theme: "coach-theme-v1", colorTheme: "coach-color-theme-v1", avatar: "coach-avatar-v1", voiceAccent: "coach-voice-accent-v1", reducedMotion: "coach-reduced-motion-v1" };
async function readPreference(key: string) {
  if (Platform.OS === "web") return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  const SecureStore = await import("expo-secure-store");
  return SecureStore.getItemAsync(key);
}
async function writePreference(key: string, value: string | null) {
  if (Platform.OS === "web") { if (typeof localStorage !== "undefined") value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value); return; }
  const SecureStore = await import("expo-secure-store");
  if (value === null) await SecureStore.deleteItemAsync(key); else await SecureStore.setItemAsync(key, value);
}
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("light");
  const [colorTheme, setColorThemeState] = useState<ColorTheme>("sunrise");
  const [avatarUri, setAvatarUriState] = useState("");
  const [voiceAccent, setVoiceAccentState] = useState<CoachAccent>("Indian English");
  const [reducedMotion, setReducedMotionState] = useState(false);
  useEffect(() => {
    void Promise.all([
      readPreference(preferenceKeys.theme), readPreference(preferenceKeys.colorTheme),
      readPreference(preferenceKeys.avatar), readPreference(preferenceKeys.voiceAccent),
      readPreference(preferenceKeys.reducedMotion), AccessibilityInfo.isReduceMotionEnabled(),
    ]).then(([savedTheme, savedColorTheme, savedAvatar, savedVoiceAccent, savedReducedMotion, systemReducedMotion]) => {
      const nextTheme = normalizeThemeMode(savedTheme);
      setThemeModeState(nextTheme);
      if (savedTheme !== nextTheme) void writePreference(preferenceKeys.theme, nextTheme);
      if (colorThemes.includes(savedColorTheme as ColorTheme)) setColorThemeState(savedColorTheme as ColorTheme);
      if (savedAvatar) setAvatarUriState(savedAvatar);
      if (coachAccents.includes(savedVoiceAccent as CoachAccent)) setVoiceAccentState(savedVoiceAccent as CoachAccent);
      setReducedMotionState(savedReducedMotion === "true" || systemReducedMotion === true);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", value => setReducedMotionState(value));
    return () => subscription.remove();
  }, []);
  function setThemeMode(mode: ThemeMode) { setThemeModeState(mode); void writePreference(preferenceKeys.theme, mode); }
  function setColorTheme(theme: ColorTheme) { setColorThemeState(theme); void writePreference(preferenceKeys.colorTheme, theme); }
  function setAvatarUri(uri: string) { setAvatarUriState(uri); void writePreference(preferenceKeys.avatar, uri || null); }
  function setVoiceAccent(accent: CoachAccent) { setVoiceAccentState(accent); void writePreference(preferenceKeys.voiceAccent, accent); }
  function setReducedMotion(value: boolean) { setReducedMotionState(value); void writePreference(preferenceKeys.reducedMotion, String(value)); }
  return <PreferencesContext.Provider value={{ themeMode, setThemeMode, colorTheme, setColorTheme, avatarUri, setAvatarUri, voiceAccent, setVoiceAccent, reducedMotion, setReducedMotion }}>{children}</PreferencesContext.Provider>;
}
export function usePreferences() { const value = useContext(PreferencesContext); if (!value) throw new Error("PreferencesProvider missing"); return value; }
export function useTheme() {
  const { themeMode, colorTheme, reducedMotion } = usePreferences();
  return { ...colorPalettes[colorTheme][themeMode], isDark: themeMode === "dark", reducedMotion };
}

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  return <SymbolView name={icons[name]} size={size} tintColor={color} weight="semibold" />;
}

export function IconButton({ name, label, onPress }: { name: IconName; label: string; onPress(): void }) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, opacity: pressed ? 0.7 : 1 })}><Icon name={name} size={22} color={theme.accent} /></Pressable>;
}

export function Screen({ children, topInset = false }: { children: ReactNode; topInset?: boolean }) {
  const theme = useTheme();
  const edges = topInset ? ["top", "bottom", "left", "right"] as const : ["bottom", "left", "right"] as const;
  const behavior = Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined;
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={edges}><KeyboardAvoidingView style={{ flex: 1 }} behavior={behavior} keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}><ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} automaticallyAdjustKeyboardInsets contentContainerStyle={styles.page}>{children}</ScrollView></KeyboardAvoidingView></SafeAreaView>;
}

export function Heading({ children, eyebrow }: { children: ReactNode; eyebrow?: string }) {
  const theme = useTheme();
  return <View style={{ gap: 10 }}>{eyebrow && <Text style={{ color: theme.positive, fontFamily, fontSize: 12, fontWeight: "700", letterSpacing: 2 }}>{eyebrow.toUpperCase()}</Text>}<Text accessibilityRole="header" style={{ color: theme.ink, fontFamily, fontSize: 32, fontWeight: "700", lineHeight: 39, letterSpacing: -0.4 }}>{children}</Text></View>;
}

export function Copy({ children, error = false }: { children: ReactNode; error?: boolean }) {
  const theme = useTheme();
  return <Text accessibilityRole={error ? "alert" : undefined} style={{ color: error ? "#C44242" : theme.muted, fontFamily, fontSize: 16, lineHeight: 25 }}>{children}</Text>;
}

export function Card({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "accent" }) {
  const theme = useTheme();
  return <View style={{ padding: 22, borderRadius: 22, backgroundColor: tone === "accent" ? theme.accentSurface : theme.surface, borderColor: theme.border, borderWidth: 1, gap: 14 }}>{children}</View>;
}

export function Action({ title, onPress, secondary = false, disabled = false, busy = false, icon }: { title: string; onPress(): void; secondary?: boolean; disabled?: boolean; busy?: boolean; icon?: IconName }) {
  const theme = useTheme();
  const textColor = secondary ? theme.ink : theme.isDark ? "#13233F" : "#FFFFFF";
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => ({ minHeight: 52, padding: 16, gap: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 14, borderWidth: 1, borderColor: theme.border, backgroundColor: secondary ? theme.surface : theme.accent, opacity: disabled || busy ? .55 : pressed ? .8 : 1 })}>{busy ? <ActivityIndicator color={textColor} /> : <>{icon && <Icon name={icon} size={19} color={textColor} />}<Text style={{ color: textColor, fontFamily, fontWeight: "700", fontSize: 16 }}>{title}</Text></>}</Pressable>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const theme = useTheme();
  return <View style={{ gap: 8 }}><Text style={{ color: theme.ink, fontFamily, fontWeight: "600" }}>{label}</Text><TextInput {...props} accessibilityLabel={label} placeholderTextColor={theme.muted} style={[{ borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 14, minHeight: 52, color: theme.ink, backgroundColor: theme.surface, fontFamily, fontSize: 16 }, props.style]} /></View>;
}

export function Choices({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string; onChange(value: string): void }) {
  const theme = useTheme();
  return <View style={{ gap: 10 }}><Text style={{ color: theme.ink, fontFamily, fontWeight: "600" }}>{label}</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{options.map(option => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: option === value }} onPress={() => onChange(option)} style={{ minHeight: 46, justifyContent: "center", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: option === value ? theme.accent : theme.border, backgroundColor: theme.surface }}><Text style={{ color: option === value ? theme.accent : theme.ink, fontFamily, fontWeight: option === value ? "700" : "400" }}>{option}</Text></Pressable>)}</View></View>;
}

export function VoiceWave({ active = false, color }: { active?: boolean; color?: string }) {
  const theme = useTheme();
  const values = useRef([0.35, 0.65, 0.48, 0.9, 0.58, 0.75, 0.4].map(() => new Animated.Value(0.35))).current;
  useEffect(() => {
    const loops = values.map((value, index) => Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: active ? 0.45 + ((index * 13) % 50) / 100 : 0.35, duration: 240 + index * 50, useNativeDriver: true }),
      Animated.timing(value, { toValue: active ? 0.35 + ((index * 17) % 55) / 100 : 0.35, duration: 260 + index * 35, useNativeDriver: true }),
    ])));
    if (active && !theme.reducedMotion) loops.forEach(loop => loop.start());
    return () => loops.forEach(loop => loop.stop());
  }, [active, theme.reducedMotion, values]);
  return <View accessibilityLabel={active ? "Voice activity" : "Voice activity idle"} style={{ height: 58, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>{values.map((value, index) => <Animated.View key={index} style={{ width: 6, height: 48, borderRadius: 8, backgroundColor: color ?? theme.accent, transform: [{ scaleY: theme.reducedMotion ? 0.6 : value }], opacity: active ? 1 : 0.45 }} />)}</View>;
}

export function MicButton({ active = false, label, onPress }: { active?: boolean; label?: string; onPress(): void }) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label ?? (active ? "Stop voice prompt" : "Hear prompt")} accessibilityState={{ busy: active }} onPress={onPress} style={({ pressed }) => ({ width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", alignSelf: "center", backgroundColor: active ? theme.positive : theme.accent, borderWidth: 8, borderColor: active ? `${theme.positive}33` : `${theme.accent}33`, transform: [{ scale: theme.reducedMotion ? 1 : pressed ? 0.95 : 1 }] })}><Icon name="mic" size={34} color={active ? "#FFFFFF" : theme.isDark ? "#13233F" : "#FFFFFF"} /></Pressable>;
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const theme = useTheme();
  return <View style={{ height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: theme.border }}><View style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: "100%", borderRadius: 5, backgroundColor: color ?? theme.accent }} /></View>;
}

const styles = StyleSheet.create({ page: { width: "100%", maxWidth: 700, alignSelf: "center", padding: 24, paddingBottom: 48, gap: 24, flexGrow: 1 } });
