import { useState } from "react";
import { request } from "./api";
import { useAuth } from "./auth";
import { Action, Card, Choices, Copy, Field, Heading } from "./ui";

export function ReportContent({ conversationId, target }: { conversationId: string; target: "feedback" | "voice" }) {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("offensive");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit() {
    setBusy(true); setError("");
    try {
      const result = await request<{ message: string }>("/v1/me/content-reports", auth.token, "POST", { conversationId, target, reason, details });
      setMessage(result.message); setOpen(false); setDetails("");
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  return <Card>
    <Heading eyebrow="AI content">Report a concern</Heading>
    <Copy>Report offensive, unsafe or incorrect AI content without leaving the app.</Copy>
    {open ? <>
      <Choices label="Reason" options={["offensive", "unsafe", "incorrect", "other"]} value={reason} onChange={setReason} />
      <Field label="Details (optional, up to 1,000 characters)" value={details} onChangeText={setDetails} multiline maxLength={1000} />
      <Copy>Your report links to this practice for review. Avoid adding sensitive information.</Copy>
      <Action title="Submit report" busy={busy} onPress={() => void submit()} />
      <Action title="Cancel report" secondary disabled={busy} onPress={() => setOpen(false)} />
    </> : <Action title="Report AI content" secondary onPress={() => { setOpen(true); setMessage(""); }} />}
    {Boolean(message) && <Copy>{message}</Copy>}
    {Boolean(error) && <Copy error>{error}</Copy>}
  </Card>;
}
