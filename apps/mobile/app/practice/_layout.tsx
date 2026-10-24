import { Stack } from "expo-router";
import { practiceNavigation } from "../../src/presentation";

export default function PracticeLayout() {
  return <Stack screenOptions={practiceNavigation.nested}><Stack.Screen name="[id]" /></Stack>;
}
