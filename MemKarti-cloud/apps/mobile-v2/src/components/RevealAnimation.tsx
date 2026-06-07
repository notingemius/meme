// Анимация раскрытия выложенных мемов:
// каждая карточка "падает" сверху с задержкой по индексу.
// Без reanimated — используем встроенный Animated из RN.
import { useRef, useEffect } from 'react';
import {
  View,
  Animated,
  Easing,
  type ViewStyle,
} from 'react-native';

export function DropIn({
  children,
  delay = 0,
  duration = 700,
  fromY = -400,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  fromY?: number;
  style?: ViewStyle;
}) {
  const ty = useRef(new Animated.Value(fromY)).current;
  const op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(ty, {
        toValue: 0,
        duration,
        delay,
        easing: Easing.out(Easing.bounce),
        useNativeDriver: true,
      }),
      Animated.timing(op, {
        toValue: 1,
        duration: Math.min(duration / 2, 400),
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [ty, op, delay, duration]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: op,
          transform: [{ translateY: ty }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// Простой fade-in
export function FadeIn({
  children,
  delay = 0,
  duration = 400,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  style?: ViewStyle;
}) {
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(op, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, [op, delay, duration]);
  return (
    <Animated.View style={[style, { opacity: op }]}>{children}</Animated.View>
  );
}
