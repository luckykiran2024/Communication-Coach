import { useEffect, useRef, useState } from "react";
import { Platform, Switch, View } from "react-native";
import { Redirect, router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { exchangeCodeAsync, makeRedirectUri, ResponseType, useAuthRequest, useAutoDiscovery } from "expo-auth-session";
import { brand } from "@coach/core";
import { useAuth } from "../src/auth";
import { Action, Card, Copy, Field, Heading, Screen } from "../src/ui";
import { supabaseGoogleConfigured } from "../src/supabase-config";
import { ApiError } from "../src/api";
import { SpringbokLogo } from "../src/springbok-logo";

WebBrowser.maybeCompleteAuthSession();

type SocialProps = { auth: ReturnType<typeof useAuth>; busy: boolean; register: boolean; accepted: boolean;
  setBusy(value: boolean): void; setMessage(value: string): void; onAcceptanceRequired(): void };

function SupabaseGoogleButton({ auth, busy, register, accepted, setBusy, setMessage, onAcceptanceRequired }: SocialProps) {
  const [needsPassword, setNeedsPassword] = useState(false);
  const [existingPassword, setExistingPassword] = useState("");
  async function signIn() {
    setBusy(true); setMessage("");
    try {
      await auth.signInWithSupabaseGoogle(needsPassword ? existingPassword : undefined, register && accepted);
      setExistingPassword("");
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 409) {
        setNeedsPassword(true);
        setMessage("You already have an account. Enter its existing password below, then continue with Google again to link safely.");
      } else if (failure instanceof ApiError && failure.status === 428) {
        onAcceptanceRequired();
      } else {
        setMessage(failure instanceof Error ? failure.message : "Google sign-in failed. Please try again.");
      }
    } finally { setBusy(false); }
  }
  return <>
    {needsPassword && <Field label="Existing account password" value={existingPassword} onChangeText={setExistingPassword}
      secureTextEntry autoComplete="current-password" />}
    <Action title="Continue with Google" secondary icon="person" busy={busy}
      disabled={busy || (register && !accepted) || (needsPassword && existingPassword.length < 12)} onPress={signIn} />
  </>;
}

function GoogleButton({ auth, busy, register, accepted, setBusy, setMessage, onAcceptanceRequired }: SocialProps) {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const [request, response, prompt] = Google.useAuthRequest({ webClientId, androidClientId, iosClientId, responseType: ResponseType.Token, selectAccount: true }, { scheme: "communicationcoach", path: "oauth" });
  const handledToken = useRef("");
  useEffect(() => {
    const accessToken = response?.type === "success" ? response.authentication?.accessToken ?? response.params.access_token : undefined;
    if (!accessToken || handledToken.current === accessToken) return;
    handledToken.current = accessToken;
    setBusy(true); setMessage("");
    auth.signInWithProvider("google", accessToken, register && accepted).catch(failure => {
      if (failure instanceof ApiError && failure.status === 428) onAcceptanceRequired();
      else setMessage((failure as Error).message);
    }).finally(() => setBusy(false));
  }, [auth, response, register, accepted, setBusy, setMessage, onAcceptanceRequired]);
  return <Action title="Continue with Google" secondary icon="person" disabled={!request || busy || (register && !accepted)} busy={busy} onPress={() => { setMessage(""); void prompt().catch(failure => setMessage((failure as Error).message)); }} />;
}

function MicrosoftButton({ auth, busy, register, accepted, setBusy, setMessage, onAcceptanceRequired }: SocialProps) {
  const clientId = process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID as string;
  const discovery = useAutoDiscovery("https://login.microsoftonline.com/common/v2.0");
  const redirectUri = makeRedirectUri({ scheme: "communicationcoach", path: "oauth" });
  const [request, response, prompt] = useAuthRequest({
    clientId, responseType: ResponseType.Code, usePKCE: true, redirectUri,
    scopes: ["openid", "profile", "email"], extraParams: { prompt: "select_account" },
  }, discovery);
  const handledCode = useRef("");
  useEffect(() => {
    const code = response?.type === "success" ? response.params.code : undefined;
    if (!code || !request?.codeVerifier || !discovery || handledCode.current === code) return;
    handledCode.current = code;
    const codeVerifier = request.codeVerifier;
    setBusy(true);
    setMessage("");
    void (async () => {
      try {
        const tokens = await exchangeCodeAsync({
          clientId, code, redirectUri, extraParams: { code_verifier: codeVerifier },
        }, discovery);
        if (!tokens.idToken) throw new Error("Microsoft did not return an ID token. Check the application configuration.");
        await auth.signInWithProvider("microsoft", tokens.idToken, register && accepted);
      } catch (failure) {
        if (failure instanceof ApiError && failure.status === 428) onAcceptanceRequired();
        else setMessage(failure instanceof Error ? failure.message : "Microsoft sign-in failed.");
      } finally { setBusy(false); }
    })();
  }, [auth, clientId, discovery, redirectUri, request, response, register, accepted, setBusy, setMessage, onAcceptanceRequired]);
  return <Action title="Continue with Microsoft" secondary icon="client" disabled={!request || busy || (register && !accepted)} busy={busy}
    onPress={() => { setMessage(""); void prompt().catch(failure => setMessage((failure as Error).message)); }} />;
}

export default function Welcome() {
  const auth = useAuth();
  const [register, setRegister] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [socialMessage, setSocialMessage] = useState("");
  const googleConfigured = Platform.OS === "android" ? Boolean(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) : Platform.OS === "ios" ? Boolean(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) : Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
  const microsoftConfigured = Boolean(process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID);
  const supabaseConfigured = supabaseGoogleConfigured();
  const socialProps = { auth, busy, register, accepted, setBusy, setMessage: setSocialMessage,
    onAcceptanceRequired: () => { setRegister(true); setSocialMessage("Please review and accept the Terms of Service before creating an account."); } };
  if (auth.loading) return <Screen topInset><Copy>Restoring your session…</Copy></Screen>;
  if (auth.token && auth.me) return <Redirect href={auth.me.profile ? "/home" : "/onboarding"} />;
  async function submit() {
    if (register && !accepted) { setError("Review and accept the Terms of Service to create an account."); return; }
    setBusy(true); setError("");
    try { await auth.signIn(email, password, register, accepted); } catch (failure) { setError((failure as Error).message); } finally { setBusy(false); }
  }
  return <Screen topInset><SpringbokLogo size={96} repeat style={{ marginBottom: 16 }} /><Heading eyebrow={brand.name}>{brand.tagline}</Heading><Copy>A little practice. A clearer message. Build the communication skills your work calls for.</Copy>
    <Card><Heading eyebrow="Start with you">{register ? "Make room for your voice." : "Welcome back."}</Heading>
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field label="Password · at least 12 characters" value={password} onChangeText={setPassword} secureTextEntry autoComplete={register ? "new-password" : "current-password"} />
      {register && <>
        <Action secondary title="Read Terms of Service & Privacy Policy" onPress={() => router.push("/legal")} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Switch accessibilityLabel="Agree to Terms of Service and acknowledge Privacy Policy" value={accepted} onValueChange={setAccepted} />
          <View style={{ flex: 1 }}><Copy>I agree to the Terms of Service and acknowledge the Privacy Policy.</Copy></View>
        </View>
      </>}
      {Boolean(error || auth.error) && <Copy error>{error || auth.error}</Copy>}
      <Action title={register ? "Create account" : "Sign in"} busy={busy} disabled={register && !accepted} onPress={submit} />
      <Action secondary title="Forgot password?" onPress={() => router.push("/password-reset")} />
      <Copy>Or continue with</Copy>
      {supabaseConfigured
        ? <SupabaseGoogleButton {...socialProps} />
        : googleConfigured
          ? <GoogleButton {...socialProps} />
          : <Action title="Google sign-in · setup pending" secondary icon="person"
            onPress={() => setSocialMessage("Google sign-in is awaiting provider configuration. Email and password still work.")} />}
      {microsoftConfigured ? <MicrosoftButton {...socialProps} /> : <Action title="Set up Microsoft sign-in" secondary icon="client" onPress={() => setSocialMessage("Add EXPO_PUBLIC_MICROSOFT_CLIENT_ID to apps/mobile/.env, then restart Expo.")} />}
      {Boolean(socialMessage) && <Copy>{socialMessage}</Copy>}
      <Action secondary title={register ? "Already have an account? Sign in" : "Create a new account"} onPress={() => { setRegister(!register); setError(""); setSocialMessage(""); }} />
    </Card>
    <Copy>
      Development preview. Email verification and recovery require a configured email sender.
      Use test accounts until release verification is complete.
    </Copy>
  </Screen>;
}
