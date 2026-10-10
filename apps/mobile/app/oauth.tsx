import { Redirect, router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "../src/auth";
import { Action, Copy, Heading, Screen } from "../src/ui";

WebBrowser.maybeCompleteAuthSession();

export default function OAuthReturn() {
  const auth = useAuth();
  if (auth.token && auth.me) return <Redirect href={auth.me.profile ? "/home" : "/onboarding"} />;
  return <Screen topInset>
    <Heading eyebrow="Secure sign-in">Returning to Communication Coach</Heading>
    <Copy>Finish sign-in in the window where you started. If that window was closed, return and try again.</Copy>
    <Action secondary title="Return to sign in" onPress={() => router.replace("/")} />
  </Screen>;
}
