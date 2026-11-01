"use client";

import { useEffect } from "react";

type AccountLinkProps = {
  action: "password-reset" | "verify-email";
  token: string;
};

const actionCopy = {
  "password-reset": {
    eyebrow: "Password recovery",
    title: "Continue securely in C2Coach",
    body: "Open C2Coach to choose a new password. This link is single-use and expires after 30 minutes.",
    button: "Open C2Coach",
  },
  "verify-email": {
    eyebrow: "Account security",
    title: "Confirm your email in C2Coach",
    body: "Open C2Coach to finish confirming your email address.",
    button: "Open C2Coach",
  },
} as const;

export function AccountLink({ action, token }: AccountLinkProps) {
  const copy = actionCopy[action];
  const appUrl = `communicationcoach://${action}?token=${encodeURIComponent(token)}`;

  useEffect(() => {
    if (token) window.location.replace(appUrl);
  }, [appUrl, token]);

  return (
    <main className="account-link-shell">
      <section className="account-link-card" aria-labelledby="account-link-title">
        <p className="account-link-eyebrow">{copy.eyebrow}</p>
        <h1 id="account-link-title">{token ? copy.title : "This link is incomplete"}</h1>
        <p>
          {token
            ? copy.body
            : "Request a new link from the C2Coach app. For your security, do not share recovery links or codes."}
        </p>
        {token ? (
          <>
            <a className="account-link-button" href={appUrl}>{copy.button}</a>
            <p className="account-link-help">
              If the app does not open, make sure the latest C2Coach APK is installed, then tap the button again.
            </p>
          </>
        ) : null}
        <a className="account-link-home" href="/">Return to c2coach.work</a>
      </section>
    </main>
  );
}

