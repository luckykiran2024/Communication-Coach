import { Text, View } from "react-native";
import { useTheme } from "./ui";

const birds = ["🐣", "🐦", "🦜", "🦉", "🦅"] as const;
export function birdForLevel(level: number) { return birds[Math.max(0, Math.min(4, level - 1))]; }

export function AnimalLevelBadge({ level, title }: { level: number; title: string }) {
  const theme = useTheme();
  return <View accessibilityRole="text" accessibilityLabel={`Level ${level}: ${title}`}
    style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: theme.border,
      backgroundColor: theme.accentSurface, borderRadius: 24, paddingHorizontal: 12, paddingVertical: 6 }}>
    <Text aria-hidden style={{ fontSize: 23 }}>{birdForLevel(level)}</Text>
    <Text style={{ color: theme.ink, fontWeight: "800", fontSize: 12, letterSpacing: 0.7 }}>
      LEVEL {level} · {title.toUpperCase()}
    </Text>
  </View>;
}

export const achievementBird: Record<string, string> = {
  "first-answer": "🐣", "two-day-streak": "🐦", "three-goals": "🦜",
  "three-retries": "🦉", "ten-days": "🦅",
};
