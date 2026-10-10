import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { request } from "../src/api";
import { useAuth } from "../src/auth";
import { Action, Card, Copy, Field, Heading, Screen } from "../src/ui";

export default function PasswordReset() {
  const auth = useAuth();
  const params = useLocalSearchParams<{ token?: string }>();
  const [email, setEmail] = useState(auth.me?.user.email ?? "");
  const [token, setToken] = useState(typeof params.token === "string" ? params.token : "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(confirm: boolean) {
    setError("");
    setMessage("");
    if (confirm && password !== confirmation) { setError("Passwords must match."); return; }
    setBusy(true);
    try {
      const path = confirm ? "confirm" : "request";
      const result = await request<{ message: string }>(
        `/v1/auth/password-reset/${path}`, null, "POST",
        confirm ? { token: token.trim(), password } : { email },
      );
      if (confirm) {
        await auth.signOut();
        setToken("");
        setPassword("");
        setConfirmation("");
        setComplete(true);
      }
      setMessage(result.message);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to reset password.");
    } finally { setBusy(false); }
  }
  return (
    <Screen>
      <Heading eyebrow="Account recovery">A fresh, secure start.</Heading>
      {!complete && (
        <>
          <Card>
            <Copy>Enter your account email. If it exists, we will send a single-use link valid for 30 minutes.</Copy>
            <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address"
              autoCapitalize="none" autoComplete="email" />
            <Action title="Send reset instructions" busy={busy} disabled={busy || !email} onPress={() => void submit(false)} />
          </Card>
          <Card>
            <Copy>Open your email link, or paste its code. Changing your password signs out all devices.</Copy>
            <Field label="Password reset code" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} />
            <Field label="New password · 12–128 characters" value={password} onChangeText={setPassword}
              secureTextEntry autoComplete="new-password" />
            <Field label="Confirm new password" value={confirmation} onChangeText={setConfirmation} secureTextEntry />
            <Action title="Change password" busy={busy} disabled={busy || !token || !password || !confirmation}
              onPress={() => void submit(true)} />
          </Card>
        </>
      )}
      {Boolean(message) && <Copy>{message}</Copy>}
      {Boolean(error) && <Copy error>{error}</Copy>}
      <Action title="Back to sign in" secondary onPress={() => router.replace("/")} />
    </Screen>
  );
}
