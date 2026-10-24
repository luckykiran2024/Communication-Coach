import { Image, StyleSheet, View } from "react-native";

const gradientMask = require("../assets/diagonal-wash.png");

export function GradientWash({ start, end }: { start: string; end: string }) {
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[StyleSheet.absoluteFill, { backgroundColor: start }]}>
    <Image source={gradientMask} resizeMode="stretch" accessible={false}
      style={[StyleSheet.absoluteFill, { width: "100%", height: "100%", tintColor: end }]} />
  </View>;
}
