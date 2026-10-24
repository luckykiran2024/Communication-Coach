export const wrappingTextStyle = { flexShrink: 1, minWidth: 0 } as const;
export const practiceNavigation = {
  group: { title: "Practice session" }, nested: { headerShown: false },
} as const;

export function radioSelection(checked: boolean) {
  return { accessibilityState: { checked }, "aria-checked": checked };
}

export function textPracticeDescription(enabled: boolean | undefined, retry: boolean) {
  const task = retry ? "Answer the new situation independently in your own words." : "Save what you would say in this situation.";
  const review = enabled === true
    ? "After both responses, the app requests an AI review. Your answers remain saved if the service is unavailable."
    : enabled === false
      ? "AI feedback is disabled here; completing both responses runs a limited local evidence check."
      : "The server determines which review is available when you complete both responses.";
  return `${task} ${review}`;
}
