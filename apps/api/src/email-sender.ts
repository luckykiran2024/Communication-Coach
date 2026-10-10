import type { EmailTokenPurpose } from "./store";

export type AccountEmail = { to: string; purpose: EmailTokenPurpose; link: string; token: string };
export interface EmailSender {
  send(message: AccountEmail): Promise<void>;
}

export class ConsoleEmailSender implements EmailSender {
  constructor(private readonly log: (value: string) => void = console.info) {}
  async send(message: AccountEmail) {
    if (process.env.NODE_ENV === "production") throw new Error("Console email is disabled in production");
    this.log(`[development email] ${message.purpose}: ${message.link}`);
  }
}

export class ResendEmailSender implements EmailSender {
  constructor(private readonly apiKey: string, private readonly from: string, private readonly fetchImpl = fetch) {}
  async send(message: AccountEmail) {
    const verification = message.purpose === "verify_email";
    const response = await this.fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: this.from, to: [message.to],
        subject: verification ? "Verify your Communication Coach email" : "Reset your Communication Coach password",
        text: [
          verification ? "Confirm your email in Communication Coach." : "Choose a new password in Communication Coach.",
          message.link,
          `Or paste this code into the app: ${message.token}`,
          "This single-use link expires in 30 minutes. Ignore this email if you did not request it.",
        ].join("\n\n"),
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Account email delivery failed");
  }
}

export function createEmailSender(env: NodeJS.ProcessEnv = process.env): EmailSender | null {
  if (env.EMAIL_PROVIDER === "resend" && env.RESEND_API_KEY && env.EMAIL_FROM) {
    if (env.RESEND_API_KEY.startsWith("replace-with-") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.EMAIL_FROM)) return null;
    return new ResendEmailSender(env.RESEND_API_KEY, env.EMAIL_FROM);
  }
  if (env.NODE_ENV !== "production" && (!env.EMAIL_PROVIDER || env.EMAIL_PROVIDER === "console")) {
    return new ConsoleEmailSender();
  }
  return null;
}
