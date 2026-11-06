type RealtimeEvent = Record<string, unknown>;
import { initialRealtimeResponse } from "./realtime-events";
import { withDeadline } from "./deadline";
import { readRealtimeAnswer } from "./realtime-answer";

export type RealtimeCall = {
  providerCallId: string;
  send(event: RealtimeEvent): void;
  close(): void;
};

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

export async function connectRealtimeCall(input: { clientSecret: string; model?: string; signal?: AbortSignal; onProviderCallCreated(id: string): Promise<void>; onEvent?(event: RealtimeEvent): void }): Promise<RealtimeCall> {
  const { RTCPeerConnection, RTCSessionDescription, mediaDevices } = await import("react-native-webrtc");
  const peer = new RTCPeerConnection({});
  let localStream: import("react-native-webrtc").MediaStream | null = null;
  const controller = new AbortController();
  const abort = () => controller.abort();
  input.signal?.addEventListener("abort", abort, { once: true });
  if (input.signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 30000);
  const check = () => { if (controller.signal.aborted) throw new Error("Voice connection cancelled or timed out."); };
  try {
    check();
    const media = mediaDevices.getUserMedia({ audio: true, video: false }).then(stream => {
      if (controller.signal.aborted) { stream.getTracks().forEach(track => track.stop()); check(); }
      return stream;
    });
    localStream = await withDeadline(media, 15000, controller.signal);
    check();
    for (const track of localStream.getTracks()) peer.addTrack(track, localStream as never);
    const channel = peer.createDataChannel("oai-events");
    channel.onmessage = (event: { data: unknown }) => {
      try { input.onEvent?.(JSON.parse(String(event.data)) as RealtimeEvent); } catch { input.onEvent?.({ type: "client.parse_error" }); }
    };
    const offer = await peer.createOffer({});
    await peer.setLocalDescription(offer);
    await waitForIceGathering(peer);
    check();
    const offerSdp = peer.localDescription?.sdp ?? offer.sdp;
    const response = await fetch(`https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(input.model ?? "gpt-realtime-2.1-mini")}`, { method: "POST", headers: { Authorization: `Bearer ${input.clientSecret}`, "Content-Type": "application/sdp" }, body: offerSdp, signal: controller.signal });
    const { providerCallId, sdp: answerSdp } = await readRealtimeAnswer(response, input.onProviderCallCreated);
    check();
    await peer.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: answerSdp }));
    check();
    const send = (event: RealtimeEvent) => { if (channel.readyState === "open") channel.send(JSON.stringify(event)); };
    const close = () => { channel.close(); localStream?.getTracks().forEach(track => track.stop()); peer.close(); };
    const call = { providerCallId, send, close } satisfies RealtimeCall;
    if (channel.readyState === "open") send(initialRealtimeResponse());
    else channel.onopen = () => send(initialRealtimeResponse());
    return call;
  } catch (error) {
    controller.abort();
    localStream?.getTracks().forEach(track => track.stop());
    peer.close();
    throw error;
  } finally { clearTimeout(timer); input.signal?.removeEventListener("abort", abort); }
}
