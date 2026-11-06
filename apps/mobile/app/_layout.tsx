import { Stack, type ErrorBoundaryProps } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../src/auth";
import { PreferencesProvider, useTheme } from "../src/ui";
import { practiceNavigation } from "../src/presentation";

/** This fallback deliberately works even when a theme or auth provider fails. */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <View style={{ flex: 1, justifyContent: "center", padding: 28, gap: 16, backgroundColor: "#f5f8f5" }}>
    <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "700", color: "#10251e" }}>Let’s try that again</Text>
    <Text style={{ fontSize: 16, color: "#10251e" }}>This screen could not open. Your saved practice is still available when you reconnect.</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Try opening the screen again" onPress={() => { void retry(); }}
      style={{ minHeight: 48, justifyContent: "center", padding: 16, borderRadius: 12, backgroundColor: "#10251e" }}>
      <Text style={{ color: "white", fontSize: 16 }}>Try again</Text>
    </Pressable>
  </View>;
}
export default function Layout() {
  return <PreferencesProvider><AuthProvider><AppStack /></AuthProvider></PreferencesProvider>;
}
function AppStack() {
  const theme = useTheme();
  return <><StatusBar style={theme.isDark ? "light" : "dark"} /><Stack screenOptions={{ animation: theme.reducedMotion ? "none" : "fade", animationDuration: theme.reducedMotion ? 0 : 180, headerStyle: { backgroundColor: theme.background }, headerTintColor: theme.ink, headerTitleStyle: { fontWeight: "700" }, headerShadowVisible: false, contentStyle: { backgroundColor: theme.background } }}>
    <Stack.Screen name="index" options={{ headerShown: false }} />
    <Stack.Screen name="oauth" options={{ title: "Secure sign-in", headerBackVisible: false }} />
    <Stack.Screen name="verify-email" options={{ title: "Verify your email" }} />
    <Stack.Screen name="password-reset" options={{ title: "Password recovery" }} />
    <Stack.Screen name="onboarding" options={{ title: "Your practice profile" }} />
    <Stack.Screen name="home" options={{ title: "Today", headerBackVisible: false }} />
    <Stack.Screen name="coach" options={{ title: "AI Live Coach", headerBackVisible: false }} />
    <Stack.Screen name="workshop/[module]" options={{ title: "Practice workshop" }} />
    <Stack.Screen name="practice" options={practiceNavigation.group} />
    <Stack.Screen name="voice" options={{ title: "Audio readiness" }} />
    <Stack.Screen name="plans" options={{ title: "Practice plans" }} />
    <Stack.Screen name="progress" options={{ title: "Progress" }} />
    <Stack.Screen name="feedback/[id]" options={{ title: "Your practice review" }} />
    <Stack.Screen name="settings" options={{ title: "Settings" }} />
    <Stack.Screen name="appearance" options={{ title: "Colour & appearance" }} />
    <Stack.Screen name="legal" options={{ title: "About & legal" }} />
    <Stack.Screen name="payment" options={{ title: "Confirm your plan" }} />
  </Stack></>;
}

