import { useEffect, useState } from "react";
import { Alert, Image, Linking, Switch, Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { brand, coachAccents, colorThemes, type CoachAccent, type ColorTheme } from "@coach/core";
import { useAuth } from "../src/auth";
import { Action, Card, Choices, Copy, Field, Heading, Icon, Screen, usePreferences, useTheme } from "../src/ui";

const socialLinks = [
  { name: "Twitter", url: process.env.EXPO_PUBLIC_TWITTER_URL ?? "https://twitter.com/" },
  { name: "Facebook", url: process.env.EXPO_PUBLIC_FACEBOOK_URL ?? "https://www.facebook.com/" },
  { name: "Instagram", url: process.env.EXPO_PUBLIC_INSTAGRAM_URL ?? "https://www.instagram.com/" },
  { name: "Reddit", url: process.env.EXPO_PUBLIC_REDDIT_URL ?? "https://www.reddit.com/" },
];
const colorThemeLabels = { sunrise: "Sunrise energy", ocean: "Ocean clarity", berry: "Berry focus" } as const;

export default function Settings() {
  const auth = useAuth();
  const theme = useTheme();
  const { themeMode, setThemeMode, colorTheme, setColorTheme, avatarUri, setAvatarUri, voiceAccent, setVoiceAccent, reducedMotion, setReducedMotion } = usePreferences();
  const [avatarDraft, setAvatarDraft] = useState(avatarUri);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { setAvatarDraft(avatarUri); }, [avatarUri]);
  useEffect(() => { void ImagePicker.getPendingResultAsync().then(result => { if (result && "canceled" in result && !result.canceled && result.assets[0]?.uri) { setAvatarUri(result.assets[0].uri); setAvatarDraft(result.assets[0].uri); setMessage("Display picture restored from your device."); } }); }, [setAvatarUri]);
  if (auth.loading) return <Screen><Copy>Loading your settings…</Copy></Screen>;
  if (!auth.token) return <Redirect href="/" />;
  if (!auth.me?.profile) return <Redirect href="/onboarding" />;
  const profile = auth.me.profile;
  const initials = profile.displayName.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();
  function saveAvatar() {
    const value = avatarDraft.trim();
    if (value && !/^https?:\/\//i.test(value)) { setError("Use an image URL starting with https:// or http://."); return; }
    setAvatarUri(value); setError(""); setMessage(value ? "Display picture saved on this device." : "Display picture removed.");
  }
  async function chooseAvatar() {
    setError("");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError("Allow photo access to choose a display picture from your device."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (!result.canceled && result.assets[0]?.uri) { setAvatarUri(result.assets[0].uri); setAvatarDraft(result.assets[0].uri); setMessage("Display picture saved on this device."); }
  }
  async function openSocial(name: string, url: string) {
    try { await Linking.openURL(url); } catch { setError(`Could not open ${name}.`); }
  }
  function confirmDeleteAccount() {
    Alert.alert("Delete account?", "This permanently removes your profile, practice history, sessions and entitlements. This cannot be undone.", [{ text: "Keep account", style: "cancel" }, { text: "Delete permanently", style: "destructive", onPress: () => auth.deleteAccount().catch(failure => setError(failure.message)) }]);
  }
  return <Screen>
    <Heading eyebrow={brand.name}>Make the app yours.</Heading>
    <Copy>Personalise your practice, return to your progress, and keep up with the Communication Coach community.</Copy>

    <Card>
      <View style={{ alignItems: "center", gap: 12 }}>
        {avatarUri ? <Image accessibilityLabel="Your display picture" source={{ uri: avatarUri }} style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: theme.border }} /> : <View accessibilityLabel="Your display picture placeholder" style={{ width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", backgroundColor: theme.accent }}><Text style={{ color: "#FFFFFF", fontSize: 28, fontWeight: "700" }}>{initials}</Text></View>}
        <Heading eyebrow="Display picture">{profile.displayName}</Heading>
      </View>
      <Field label="Display picture URL" placeholder="https://…" autoCapitalize="none" keyboardType="url" value={avatarDraft} onChangeText={setAvatarDraft} />
      <Copy>Use a private or public image URL. The link is stored only on this device and is not uploaded to the coaching server.</Copy>
      <Action title="Choose from device" secondary onPress={() => void chooseAvatar()} />
      <Action title="Save display picture" onPress={saveAvatar} />
    </Card>

    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Icon name="settings" size={23} color={theme.accent} /><Heading eyebrow="Appearance">Theme</Heading></View>
      <Choices label="Choose your theme" options={["system", "light", "dark"]} value={themeMode} onChange={value => { setThemeMode(value as typeof themeMode); setMessage("Theme updated."); }} />
      <Copy>System follows your phone. Light and dark keep the app consistent across sessions.</Copy>
      <Choices label="Choose your colour palette" options={colorThemes.map(item => colorThemeLabels[item])} value={colorThemeLabels[colorTheme]} onChange={value => { const next = (Object.keys(colorThemeLabels) as ColorTheme[]).find(item => colorThemeLabels[item] === value) ?? "sunrise"; setColorTheme(next); setMessage(`${value} palette selected.`); }} />
      <Copy>Each palette keeps coral, teal, and neutral contrast in a different visual mood. This changes the app colours, not your practice data.</Copy>
      <Choices label="Coach voice accent" options={coachAccents} value={voiceAccent} onChange={value => { setVoiceAccent(value as CoachAccent); setMessage(`Coach voice set to ${value}.`); }} />
      <Copy>Indian English is the default. Your device’s installed speech voice determines the final sound and pronunciation.</Copy>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Copy>Reduce motion</Copy><Switch accessibilityLabel="Reduce motion" value={reducedMotion} onValueChange={value => { setReducedMotion(value); setMessage(value ? "Nonessential motion reduced." : "Motion effects restored."); }} /></View>
      <Copy>This removes nonessential screen transitions and voice-wave movement. It does not affect audio, recording, or speech.</Copy>
    </Card>

    <Card>
      <Heading eyebrow="Your practice">Shortcuts</Heading>
      <Copy>Current plan: {profile.planId}</Copy>
      <Action title="Change practice plan" icon="clock" onPress={() => router.push("/plans")} />
      <Action title="View my progress" secondary icon="progress" onPress={() => router.push("/progress")} />
      <Action title="Edit practice profile" secondary icon="person" onPress={() => router.push("/onboarding")} />
    </Card>

    <Card>
      <Heading eyebrow="Stay connected">Follow us</Heading>
      <Copy>Replace these platform destinations with your branded profile links before launch.</Copy>
      {socialLinks.map(link => <Action key={link.name} title={`Follow on ${link.name}`} secondary onPress={() => void openSocial(link.name, link.url)} />)}
    </Card>

    {Boolean(message) && <Copy>{message}</Copy>}
    {Boolean(error) && <Copy error>{error}</Copy>}
    <Card>
      <Heading eyebrow="Account access">Sign out</Heading>
      <Copy>Sign out of this device, or end every active session if you are using a shared device.</Copy>
      <Action title="Sign out" secondary onPress={() => auth.signOut().catch(failure => setError(failure.message))} />
      <Action title="Sign out all devices" secondary onPress={() => auth.signOutAll().catch(failure => setError(failure.message))} />
      <Action title="Delete my account" secondary onPress={confirmDeleteAccount} />
    </Card>
  </Screen>;
}
