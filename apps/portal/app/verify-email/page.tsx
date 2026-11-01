import type { Metadata } from "next";
import { AccountLink } from "../account-link";

export const metadata: Metadata = {
  title: "Verify your C2Coach email",
  robots: { index: false, follow: false },
};

type AccountPageProps = { searchParams: Promise<{ token?: string | string[] }> };

export default async function VerifyEmailPage({ searchParams }: AccountPageProps) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  return <AccountLink action="verify-email" token={token} />;
}

