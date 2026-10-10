import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { request } from "../src/api";
import { useAuth } from "../src/auth";
import { Action, Card, Copy, Field, Heading, Screen } from "../src/ui";

export default function VerifyEmail() {
  const auth = useAuth();
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(typeof params.token === "string" ? params.token : "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(confirm: boolean) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const path = confirm ? "confirm" : "request";
      const result = await request<{ message: string }>(
        `/v1/auth/verify-email/${path}`, auth.token, "POST",
        confirm ? { token: token.trim(), password } : undefined,
      );
      if (confirm) {
        setToken("");
        setPassword("");
        await auth.refresh();
      }
      setMessage(result.message);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to verify email.");
    } finally { setBusy(false); }
  }
  return (
    <Screen>
      <Heading eyebrow="Account security">Your email, confirmed.</Heading>
      {auth.token ? (
        <Card>
          <Copy>{auth.me?.user.email}</Copy>
          {auth.me?.user.emailVerifiedAt ? <Copy>Your email is verified.</Copy> : (
            <>
              <Copy>Request a link, then paste the code from your email. It expires in 30 minutes.</Copy>
              <Action title="Send verification email" busy={busy} disabled={busy} onPress={() => void submit(false)} />
              <Field label="Email verification code" value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} />
              <Field label="Current password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" />
              <Action title="Confirm email" busy={busy} disabled={busy || !token || !password} onPress={() => void submit(true)} />
              <Copy>Confirm only an account you created. Never share your code.</Copy>
            </>
          )}
        </Card>
      ) : <Copy>Sign in to the account you created before confirming this email. You can paste your code here afterwards.</Copy>}
      {Boolean(message) && <Copy>{message}</Copy>}
      {Boolean(error) && <Copy error>{error}</Copy>}
      <Action title="Recover or set my password" secondary onPress={() => router.push("/password-reset")} />
      <Action title="Back to sign in" secondary onPress={() => router.replace("/")} />
    </Screen>
  );
}
