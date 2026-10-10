import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { Redirect, router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { exchangeCodeAsync, makeRedirectUri, ResponseType, useAuthRequest, useAutoDiscovery } from "expo-auth-session";
import { brand } from "@coach/core";
import { useAuth } from "../src/auth";
import { Action, Card, Copy, Field, Heading, Screen } from "../src/ui";

WebBrowser.maybeCompleteAuthSession();

type SocialProps = { auth: ReturnType<typeof useAuth>; busy: boolean; setBusy(value: boolean): void; setMessage(value: string): void };

function GoogleButton({ auth, busy, setBusy, setMessage }: SocialProps) {
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
    auth.signInWithProvider("google", accessToken).catch(failure => setMessage((failure as Error).message)).finally(() => setBusy(false));
  }, [auth, response, setBusy, setMessage]);
  return <Action title="Continue with Google" secondary icon="person" disabled={!request || busy} busy={busy} onPress={() => { setMessage(""); void prompt().catch(failure => setMessage((failure as Error).message)); }} />;
}

function MicrosoftButton({ auth, busy, setBusy, setMessage }: SocialProps) {
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
        await auth.signInWithProvider("microsoft", tokens.idToken);
      } catch (failure) {
        setMessage(failure instanceof Error ? failure.message : "Microsoft sign-in failed.");
      } finally { setBusy(false); }
    })();
  }, [auth, clientId, discovery, redirectUri, request, response, setBusy, setMessage]);
  return <Action title="Continue with Microsoft" secondary icon="client" disabled={!request || busy} busy={busy}
    onPress={() => { setMessage(""); void prompt().catch(failure => setMessage((failure as Error).message)); }} />;
}

export default function Welcome() {
  const auth = useAuth();
  const [register, setRegister] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [socialMessage, setSocialMessage] = useState("");
  const googleConfigured = Platform.OS === "android" ? Boolean(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) : Platform.OS === "ios" ? Boolean(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) : Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID);
  const microsoftConfigured = Boolean(process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID);
  if (auth.loading) return <Screen topInset><Copy>Restoring your session…</Copy></Screen>;
  if (auth.token && auth.me) return <Redirect href={auth.me.profile ? "/home" : "/onboarding"} />;
  async function submit() {
    setBusy(true); setError("");
    try { await auth.signIn(email, password, register); } catch (failure) { setError((failure as Error).message); } finally { setBusy(false); }
  }
  return <Screen topInset><Heading eyebrow={brand.name}>{brand.tagline}</Heading><Copy>A little practice. A clearer message. Build the communication skills your work calls for.</Copy>
    <Card><Heading eyebrow="Start with you">{register ? "Make room for your voice." : "Welcome back."}</Heading>
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field label="Password · at least 12 characters" value={password} onChangeText={setPassword} secureTextEntry autoComplete={register ? "new-password" : "current-password"} />
      {Boolean(error || auth.error) && <Copy error>{error || auth.error}</Copy>}
      <Action title={register ? "Create account" : "Sign in"} busy={busy} onPress={submit} />
      <Action secondary title="Forgot password?" onPress={() => router.push("/password-reset")} />
      <Copy>Or continue with</Copy>
      {googleConfigured ? <GoogleButton auth={auth} busy={busy} setBusy={setBusy} setMessage={setSocialMessage} /> : <Action title="Set up Google sign-in" secondary icon="person" onPress={() => setSocialMessage("Add the Google Android/iOS client ID to apps/mobile/.env, then restart Expo.")} />}
      {microsoftConfigured ? <MicrosoftButton auth={auth} busy={busy} setBusy={setBusy} setMessage={setSocialMessage} /> : <Action title="Set up Microsoft sign-in" secondary icon="client" onPress={() => setSocialMessage("Add EXPO_PUBLIC_MICROSOFT_CLIENT_ID to apps/mobile/.env, then restart Expo.")} />}
      {Boolean(socialMessage) && <Copy>{socialMessage}</Copy>}
      <Action secondary title={register ? "Already have an account? Sign in" : "Create a new account"} onPress={() => setRegister(!register)} />
      <Action secondary title="About, terms & privacy" onPress={() => router.push("/legal")} />
    </Card>
    <Copy>
      Development preview. Email verification and recovery require a configured email sender.
      Use test accounts until release verification is complete.
    </Copy>
  </Screen>;
}
