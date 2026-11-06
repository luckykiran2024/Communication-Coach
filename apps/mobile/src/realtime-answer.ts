/** Bind the provider ID before reading SDP: body/peer setup can fail after call creation. */
export async function readRealtimeAnswer(response: Response, bind: (providerCallId: string) => Promise<void>) {
  if (!response.ok) throw new Error("The voice provider did not accept the WebRTC offer.");
  const location = response.headers.get("location");
  const match = location?.match(/^(?:https:\/\/api\.openai\.com)?\/v1\/realtime\/calls\/([A-Za-z0-9._:-]{1,200})$/);
  if (!match) throw new Error("The voice provider did not return a controllable call identifier.");
  const providerCallId = match[1];
  await bind(providerCallId);
  const sdp = await response.text();
  if (!sdp.startsWith("v=")) throw new Error("The voice provider did not accept the WebRTC offer.");
  return { providerCallId, sdp };
}
