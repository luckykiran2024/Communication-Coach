import { useEffect } from "react";
import { Platform } from "react-native";
import { Redirect, router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useAuth } from "../src/auth";
import { Action, Copy, Heading, Screen } from "../src/ui";
import { tryCompleteAuthSession } from "../src/safe-storage";

const authCompletionAvailable = tryCompleteAuthSession(() => WebBrowser.maybeCompleteAuthSession());

export default function OAuthReturn() {
  const auth = useAuth();

  useEffect(() => {
    if (auth.token && auth.me) return;
    if (Platform.OS !== "web") {
      const timer = setTimeout(() => {
        if (!auth.token) {
          router.replace("/");
        }
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [auth.token, auth.me]);

  if (auth.token && auth.me) return <Redirect href={auth.me.profile ? "/home" : "/onboarding"} />;

  const isWeb = Platform.OS === "web";

  return (
    <Screen topInset>
      <Heading eyebrow="Secure sign-in">
        {isWeb ? "Returning to Communication Coach" : "Completing sign-in…"}
      </Heading>
      <Copy>
        {isWeb && !authCompletionAvailable
          ? "This browser blocked storage needed for social sign-in. Return to sign in with email, or open the app in a browser that allows site storage."
          : isWeb
          ? "Finish sign-in in the window where you started. If that window was closed, return and try again."
          : "Finishing your secure session. If this doesn't update shortly, return to sign in."}
      </Copy>
      <Action secondary title="Return to sign in" onPress={() => router.replace("/")} />
    </Screen>
  );
}
