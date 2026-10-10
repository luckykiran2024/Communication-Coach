export function initialRealtimeResponse() {
  return { type: "response.create", response: { output_modalities: ["audio"] } } as const;
}
