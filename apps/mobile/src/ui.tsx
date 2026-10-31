import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo, ActivityIndicator, Animated, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import { SymbolView, type AndroidSymbol, type SFSymbol } from "expo-symbols";
import { coachAccents, colorPalettes, normalizeColorTheme, type CoachAccent, type ColorTheme } from "@coach/core";
import { normalizeThemeMode, type ThemeMode } from "./theme-preferences";
import { radioSelection, wrappingTextStyle } from "./presentation";
import { GradientWash } from "./gradient-wash";

type IconName = "mic" | "person" | "client" | "recording" | "progress" | "spark" | "clock" | "play" | "settings" | "home" | "insights";
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
  home: { ios: "house.fill" as SFSymbol, android: "home" as AndroidSymbol, web: "home" as AndroidSymbol },
  insights: { ios: "chart.pie.fill" as SFSymbol, android: "monitoring" as AndroidSymbol, web: "monitoring" as AndroidSymbol },
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
  const [colorTheme, setColorThemeState] = useState<ColorTheme>("emerald");
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
      setColorThemeState(normalizeColorTheme(savedColorTheme));
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
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const edges = topInset ? ["top", "bottom", "left", "right"] as const : ["bottom", "left", "right"] as const;
  const behavior = Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined;
  const showNavigation = ["/home", "/progress", "/settings", "/appearance"].includes(pathname)
    || pathname.startsWith("/workshop") || pathname.startsWith("/practice/");
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={edges}>
    <View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, { height: 560, opacity: theme.isDark ? 0.92 : 0.68 }]}>
      <GradientWash start={theme.accentSurface} end={theme.background} />
    </View>
    <View pointerEvents="none" accessible={false} style={{ position: "absolute", width: 260, height: 260,
      borderRadius: 130, top: -130, right: -90, backgroundColor: theme.glow, opacity: theme.isDark ? 0.22 : 0.32 }} />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={behavior} keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets contentContainerStyle={[styles.page, { paddingHorizontal: width < 380 ? 14 : 20,
          paddingBottom: showNavigation ? 118 : 48 }]}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
    {showNavigation && <BottomNavigation pathname={pathname} />}
  </SafeAreaView>;
}

function BottomNavigation({ pathname }: { pathname: string }) {
  const theme = useTheme();
  const items: { label: string; icon: IconName; route: "/home" | "/workshop/daily" | "/progress" | "/settings"; active: boolean }[] = [
    { label: "Home", icon: "home", route: "/home", active: pathname === "/home" },
    { label: "Practice", icon: "play", route: "/workshop/daily", active: pathname.startsWith("/workshop") || pathname.startsWith("/practice/") },
    { label: "Progress", icon: "insights", route: "/progress", active: pathname === "/progress" },
    { label: "Profile", icon: "person", route: "/settings", active: pathname === "/settings" || pathname === "/appearance" },
  ];
  return <View style={{ position: "absolute", left: 14, right: 14, bottom: 10, minHeight: 70, borderRadius: 24,
    flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: 8,
    backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1,
    shadowColor: theme.glow, shadowOpacity: theme.isDark ? 0.55 : 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 14 }}>
    {items.map(item => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label}
      onPress={() => router.replace(item.route)} style={({ pressed }) => ({ minWidth: 64, minHeight: 58, borderRadius: 18,
        alignItems: "center", justifyContent: "center", gap: 4, opacity: pressed ? 0.7 : 1,
        backgroundColor: item.active ? theme.accentSurface : "transparent" })}>
      <Icon name={item.icon} size={22} color={item.active ? theme.accent : theme.muted} />
      <Text style={{ color: item.active ? theme.accent : theme.muted, fontFamily, fontSize: 11,
        fontWeight: item.active ? "700" : "500" }}>{item.label}</Text>
    </Pressable>)}
  </View>;
}

export function Heading({ children, eyebrow }: { children: ReactNode; eyebrow?: string }) {
  const theme = useTheme();
  return <View style={{ gap: 10, ...wrappingTextStyle }}>
    {eyebrow && <Text style={{ color: theme.positive, fontFamily, fontSize: 12, fontWeight: "700", letterSpacing: 1.5 }}>
      {eyebrow.toUpperCase()}
    </Text>}
    <Text accessibilityRole="header"
      style={{ color: theme.ink, fontFamily, fontSize: 28, fontWeight: "700", lineHeight: 34, letterSpacing: -0.5 }}>
      {children}
    </Text>
  </View>;
}

export function Copy({ children, error = false }: { children: ReactNode; error?: boolean }) {
  const theme = useTheme();
  return <Text accessibilityRole={error ? "alert" : undefined}
    style={{ color: error ? theme.error : theme.muted, fontFamily, fontSize: 16, lineHeight: 25 }}>{children}</Text>;
}

export function Card({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "accent" }) {
  const theme = useTheme();
  return <View style={{ padding: 20, borderRadius: 24, backgroundColor: theme.surface,
    borderColor: tone === "accent" ? theme.accent : theme.border, borderWidth: 1, gap: 16, overflow: "hidden",
    shadowColor: tone === "accent" ? theme.accent : theme.glow, shadowOpacity: theme.isDark ? 0.32 : 0.16,
    shadowRadius: tone === "accent" ? 18 : 12, shadowOffset: { width: 0, height: 8 }, elevation: tone === "accent" ? 8 : 4 }}>
    {tone === "accent" && <GradientWash start={theme.accentSurface} end={theme.surface} />}
    {children}
  </View>;
}

export function Action({ title, onPress, secondary = false, disabled = false, busy = false, icon }: {
  title: string; onPress(): void; secondary?: boolean; disabled?: boolean; busy?: boolean; icon?: IconName;
}) {
  const theme = useTheme();
  const textColor = secondary ? theme.ink : theme.onAccent;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }}
    disabled={disabled || busy} onPress={onPress} style={({ pressed }) => ({
      minHeight: 52, padding: 16, gap: 10, flexDirection: "row", alignItems: "center", justifyContent: "center",
      borderRadius: 26, borderWidth: 1, borderColor: secondary ? theme.controlBorder : theme.accent,
      backgroundColor: secondary ? theme.surface : theme.accent,
      shadowColor: secondary ? theme.glow : theme.accent, shadowOpacity: secondary ? 0.08 : 0.28,
      shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: secondary ? 1 : 5,
      opacity: disabled || busy ? .55 : pressed ? .8 : 1,
    })}>
    {busy ? <ActivityIndicator color={textColor} /> : <>
      {icon && <Icon name={icon} size={19} color={textColor} />}
      <Text style={{ color: textColor, fontFamily, fontWeight: "700", fontSize: 16, textAlign: "center", ...wrappingTextStyle }}>
        {title}
      </Text>
    </>}
  </Pressable>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return <View style={{ gap: 8 }}>
    <Text style={{ color: theme.ink, fontFamily, fontWeight: "600" }}>{label}</Text>
    <TextInput {...props} accessibilityLabel={label} placeholderTextColor={theme.muted}
      onFocus={event => { setFocused(true); props.onFocus?.(event); }}
      onBlur={event => { setFocused(false); props.onBlur?.(event); }}
      style={[{ borderWidth: 1, borderColor: focused ? theme.accent : theme.controlBorder, borderRadius: 18,
        padding: 14, minHeight: 54, color: theme.ink, backgroundColor: theme.accentSurface, fontFamily, fontSize: 16,
        shadowColor: focused ? theme.accent : "transparent", shadowOpacity: 0.2, shadowRadius: 8 }, props.style]} />
  </View>;
}

export function Choices({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string; onChange(value: string): void }) {
  const theme = useTheme();
  return <View style={{ gap: 10 }}>
    <Text style={{ color: theme.ink, fontFamily, fontWeight: "600" }}>{label}</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map(option => <Pressable key={option} accessibilityRole="radio" {...radioSelection(option === value)}
        onPress={() => onChange(option)} style={{ minHeight: 48, justifyContent: "center", borderRadius: 16, padding: 13,
          borderWidth: 1, borderColor: option === value ? theme.accent : theme.controlBorder,
          backgroundColor: option === value ? theme.accentSurface : theme.surface }}>
        <Text style={{ color: option === value ? theme.accent : theme.ink, fontFamily,
          fontWeight: option === value ? "700" : "400" }}>{option}</Text>
      </Pressable>)}
    </View>
  </View>;
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
  return <Pressable accessibilityRole="button" accessibilityLabel={label ?? (active ? "Stop voice prompt" : "Hear prompt")}
    accessibilityState={{ busy: active }} onPress={onPress} style={({ pressed }) => ({
      width: 84, height: 84, borderRadius: 42, alignItems: "center", justifyContent: "center", alignSelf: "center",
      backgroundColor: active ? theme.positive : theme.accent, borderWidth: 8,
      borderColor: active ? `${theme.positive}33` : `${theme.accent}33`,
      transform: [{ scale: theme.reducedMotion ? 1 : pressed ? 0.95 : 1 }],
    })}>
    <Icon name="mic" size={34} color={active ? theme.onPositive : theme.onAccent} />
  </Pressable>;
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const theme = useTheme();
  return <View style={{ height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: theme.border }}><View style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: "100%", borderRadius: 5, backgroundColor: color ?? theme.accent,
    shadowColor: color ?? theme.accent, shadowOpacity: 0.8, shadowRadius: 8 }} /></View>;
}

const styles = StyleSheet.create({ page: { width: "100%", maxWidth: 700, alignSelf: "center", paddingTop: 22, gap: 20, flexGrow: 1 } });
