import type { ExpoConfig } from "expo/config";
const variant = process.env.APP_VARIANT ?? "development";
const baseId = process.env.APP_IDENTIFIER ?? "com.example.communicationcoach";
const production = variant === "production";
const preview = variant === "preview";
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "";
const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "";
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
const microsoftClientId = process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID ?? "";
const supabaseConfigured = process.env.EXPO_PUBLIC_SUPABASE_OAUTH_ENABLED === "true"
  && /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(process.env.EXPO_PUBLIC_SUPABASE_URL ?? "")
  && Boolean(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_"));
const documentationPlaceholder = /(^|[.@])example\.(com|org|net)(?=[:/]|$)/i;
const configuredClientId = (value: string) => Boolean(value && !value.startsWith("replace-with-") && !documentationPlaceholder.test(value) && !["android-client-id", "ios-client-id", "web-client-id"].includes(value));
if (production && baseId.startsWith("com.example.")) throw new Error("Set APP_IDENTIFIER before production builds.");
if (preview && !/^https?:\/\//.test(apiUrl)) throw new Error("Set EXPO_PUBLIC_API_URL before preview builds and updates.");
if (production && (!apiUrl.startsWith("https://") || apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1") || documentationPlaceholder.test(apiUrl))) {
  throw new Error("Set EXPO_PUBLIC_API_URL to the production HTTPS API before building.");
}
if (production && process.env.EXPO_PUBLIC_SUPABASE_OAUTH_ENABLED === "true" && !supabaseConfigured) {
  throw new Error("Configure the hosted Supabase URL and publishable key before production builds.");
}
if (production && !supabaseConfigured && (!configuredClientId(googleAndroidClientId) || !configuredClientId(googleIosClientId))) {
  throw new Error("Configure Supabase Google sign-in or Google Android/iOS client IDs before production builds.");
}
if (production && microsoftClientId && !configuredClientId(microsoftClientId)) {
  throw new Error("Set a valid Microsoft client ID or leave Microsoft sign-in disabled.");
}
const config: ExpoConfig = {
  owner: "luckysoma",
  name: (process.env.APP_NAME ?? "Communication Coach") + (production ? "" : " " + variant),
  slug: "communication-platform", scheme: "communicationcoach", version: "0.1.0",
  extra: { eas: { projectId: "e874ae5c-f1cb-4d6b-bcf5-19b25231c0fd" } },
  runtimeVersion: { policy: "appVersion" },
  updates: { url: "https://u.expo.dev/e874ae5c-f1cb-4d6b-bcf5-19b25231c0fd", checkAutomatically: "ON_LOAD", fallbackToCacheTimeout: 0 },
  orientation: "portrait", userInterfaceStyle: "automatic",
  ios: { bundleIdentifier: production ? baseId : baseId + "." + variant, supportsTablet: true },
  android: { package: production ? baseId : baseId + "." + variant, softwareKeyboardLayoutMode: "resize" },
  plugins: ["expo-router", "expo-secure-store", "expo-image-picker", "expo-iap", "expo-updates", "expo-system-ui", ["expo-build-properties", { android: { usesCleartextTraffic: !production && apiUrl.startsWith("http://") } }], ["expo-audio", { microphonePermission: "Allow microphone access for your speaking practice.", enableBackgroundRecording: false, enableBackgroundPlayback: false }], ["@config-plugins/react-native-webrtc", { microphonePermission: "Allow microphone access for your live speaking practice.", cameraPermission: "Allow camera access for future practice features." }]],
  web: { bundler: "metro" },
};
export default config;
