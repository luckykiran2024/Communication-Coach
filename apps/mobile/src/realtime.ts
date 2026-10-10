type RealtimeEvent = Record<string, unknown>;
import { initialRealtimeResponse } from "./realtime-events";

export type RealtimeCall = {
  providerCallId: string;
  send(event: RealtimeEvent): void;
  close(): void;
};

function providerCallIdFromLocation(location: string | null) {
  const match = location?.match(/^(?:https:\/\/api\.openai\.com)?\/v1\/realtime\/calls\/([^/?#]+)$/);
  if (!match) throw new Error("The voice provider did not return a controllable call identifier.");
  return decodeURIComponent(match[1]);
}

function waitForIceGathering(peer: { iceGatheringState: string; onicegatheringstatechange: ((event: unknown) => void) | null }) {
  if (peer.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>(resolve => {
    const finish = () => {
      if (peer.iceGatheringState !== "complete") return;
      peer.onicegatheringstatechange = null;
      resolve();
    };
    peer.onicegatheringstatechange = finish;
    setTimeout(() => { peer.onicegatheringstatechange = null; resolve(); }, 5000);
  });
}

export async function connectRealtimeCall(input: { clientSecret: string; model?: string; onEvent?(event: RealtimeEvent): void }): Promise<RealtimeCall> {
  const { RTCPeerConnection, RTCSessionDescription, mediaDevices } = await import("react-native-webrtc");
  const peer = new RTCPeerConnection({});
  let localStream: import("react-native-webrtc").MediaStream | null = null;
  try {
    localStream = await mediaDevices.getUserMedia({ audio: true, video: false });
    for (const track of localStream.getTracks()) peer.addTrack(track, localStream as never);
    const channel = peer.createDataChannel("oai-events");
    channel.onmessage = (event: { data: unknown }) => {
      try { input.onEvent?.(JSON.parse(String(event.data)) as RealtimeEvent); } catch { input.onEvent?.({ type: "client.parse_error" }); }
    };
    const offer = await peer.createOffer({});
    await peer.setLocalDescription(offer);
    await waitForIceGathering(peer);
    const offerSdp = peer.localDescription?.sdp ?? offer.sdp;
    const response = await fetch(`https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(input.model ?? "gpt-realtime-2.1-mini")}`, { method: "POST", headers: { Authorization: `Bearer ${input.clientSecret}`, "Content-Type": "application/sdp" }, body: offerSdp });
    const answerSdp = await response.text();
    if (!response.ok || !answerSdp.startsWith("v=")) throw new Error("The voice provider did not accept the WebRTC offer.");
    const providerCallId = providerCallIdFromLocation(response.headers.get("location"));
    await peer.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: answerSdp }));
    const send = (event: RealtimeEvent) => { if (channel.readyState === "open") channel.send(JSON.stringify(event)); };
    const close = () => { channel.close(); localStream?.getTracks().forEach(track => track.stop()); peer.close(); };
    const call = { providerCallId, send, close } satisfies RealtimeCall;
    if (channel.readyState === "open") send(initialRealtimeResponse());
    else channel.onopen = () => send(initialRealtimeResponse());
    return call;
  } catch (error) {
    localStream?.getTracks().forEach(track => track.stop());
    peer.close();
    throw error;
  }
}
