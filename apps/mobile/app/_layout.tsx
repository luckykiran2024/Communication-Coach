import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../src/auth";
import { PreferencesProvider, useTheme } from "../src/ui";
export default function Layout() {
  return <PreferencesProvider><AuthProvider><AppStack /></AuthProvider></PreferencesProvider>;
}
function AppStack() {
  const theme = useTheme();
  return <><StatusBar style={theme.isDark ? "light" : "dark"} /><Stack screenOptions={{ animation: theme.reducedMotion ? "none" : "fade", animationDuration: theme.reducedMotion ? 0 : 180, headerStyle: { backgroundColor: theme.surface }, headerTintColor: theme.ink, headerShadowVisible: false, contentStyle: { backgroundColor: theme.background } }}>
    <Stack.Screen name="index" options={{ headerShown: false }} />
    <Stack.Screen name="verify-email" options={{ title: "Verify your email" }} />
    <Stack.Screen name="password-reset" options={{ title: "Password recovery" }} />
    <Stack.Screen name="onboarding" options={{ title: "Your practice profile" }} />
    <Stack.Screen name="home" options={{ title: "Today", headerBackVisible: false }} />
    <Stack.Screen name="workshop/[module]" options={{ title: "Practice workshop" }} />
    <Stack.Screen name="voice" options={{ title: "Audio readiness" }} />
    <Stack.Screen name="plans" options={{ title: "Practice plans" }} />
    <Stack.Screen name="progress" options={{ title: "Progress" }} />
    <Stack.Screen name="settings" options={{ title: "Settings" }} />
    <Stack.Screen name="legal" options={{ title: "About & legal" }} />
    <Stack.Screen name="payment" options={{ title: "Confirm your plan" }} />
  </Stack></>;
}
