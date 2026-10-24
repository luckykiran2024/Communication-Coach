import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, type ImageStyle, type StyleProp } from "react-native";
import { useTheme } from "./ui";

export function SpringbokLogo({ size, style, repeat = false }: { size: number; style?: StyleProp<ImageStyle>; repeat?: boolean }) {
  const { reducedMotion } = useTheme();
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      lift.stopAnimation();
      lift.setValue(0);
      return;
    }
    const hop = Animated.sequence([
      Animated.delay(180),
      Animated.timing(lift, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(lift, { toValue: 0, duration: 650, easing: Easing.out(Easing.elastic(1.2)), useNativeDriver: true }),
    ]);
    const animation = repeat ? Animated.loop(Animated.sequence([hop, Animated.delay(2800)])) : hop;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then(systemReducedMotion => {
      if (!cancelled && !systemReducedMotion) animation.start();
    }).catch(() => undefined);
    return () => { cancelled = true; animation.stop(); };
  }, [lift, reducedMotion, repeat]);

  return <Animated.Image
    accessible
    accessibilityLabel="Communication Coach springbok logo"
    source={require("../assets/springbok-app-icon.png")}
    style={[{ width: size, height: size, borderRadius: size / 4 }, style, {
      transform: [
        { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) },
        { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) },
      ],
    }]}
  />;
}
