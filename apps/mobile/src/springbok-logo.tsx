import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, Image, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "./ui";

export function SpringbokLogo({ size, style, repeat = false }: { size: number; style?: StyleProp<ViewStyle>; repeat?: boolean }) {
  const { isDark, reducedMotion } = useTheme();
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

  return <Animated.View
    accessible
    accessibilityLabel="Communication Coach springbok logo"
    style={[{
      width: size, height: size, borderRadius: size / 4, alignItems: "center", justifyContent: "center",
      backgroundColor: isDark ? "#FFFFFF" : "#146C50", overflow: "hidden",
    }, style, {
      transform: [
        { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) },
        { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) },
      ],
    }]}
  >
    <Image source={require("../assets/springbok-mark.png")} style={{ width: size * 0.82, height: size * 0.82 }} resizeMode="contain" />
  </Animated.View>;
}

