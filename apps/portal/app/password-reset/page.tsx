import type { Metadata } from "next";
import { AccountLink } from "../account-link";

export const metadata: Metadata = {
  title: "Reset your C2Coach password",
  robots: { index: false, follow: false },
};

type AccountPageProps = { searchParams: Promise<{ token?: string | string[] }> };

export default async function PasswordResetPage({ searchParams }: AccountPageProps) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  return <AccountLink action="password-reset" token={token} />;
}

