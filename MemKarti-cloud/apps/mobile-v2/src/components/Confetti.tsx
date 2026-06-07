// Конфетти на победе — 40 разноцветных квадратиков падают сверху с разной
// скоростью и поворотом. Pure RN Animated (без сторонних либ).
import { useEffect, useRef, useMemo } from 'react';
import { View, Animated, Easing, Dimensions, StyleSheet } from 'react-native';

const COUNT = 40;
const COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#A855F7',
];

const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;

type Particle = {
  x: number; // start x
  drift: number; // how much it moves horizontally
  size: number;
  color: string;
  rotateStart: number;
  rotateEnd: number;
  duration: number;
  delay: number;
};

export function Confetti() {
  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: COUNT }, () => ({
        x: Math.random() * SCREEN_W,
        drift: (Math.random() - 0.5) * 200,
        size: 6 + Math.random() * 8,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotateStart: Math.random() * 360,
        rotateEnd: Math.random() * 720 - 360,
        duration: 2500 + Math.random() * 2500,
        delay: Math.random() * 800,
      })),
    [],
  );

  return (
    <View pointerEvents="none" style={styles.container}>
      {particles.map((p, i) => (
        <ConfettiBit key={i} p={p} />
      ))}
    </View>
  );
}

function ConfettiBit({ p }: { p: Particle }) {
  const y = useRef(new Animated.Value(-30)).current;
  const x = useRef(new Animated.Value(p.x)).current;
  const rotate = useRef(new Animated.Value(p.rotateStart)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(y, {
        toValue: SCREEN_H + 50,
        duration: p.duration,
        delay: p.delay,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(x, {
        toValue: p.x + p.drift,
        duration: p.duration,
        delay: p.delay,
        useNativeDriver: true,
      }),
      Animated.timing(rotate, {
        toValue: p.rotateEnd,
        duration: p.duration,
        delay: p.delay,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(p.duration * 0.7 + p.delay),
        Animated.timing(opacity, {
          toValue: 0,
          duration: p.duration * 0.3,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [y, x, rotate, opacity, p]);

  return (
    <Animated.View
      style={[
        styles.bit,
        {
          width: p.size,
          height: p.size * 0.6,
          backgroundColor: p.color,
          opacity,
          transform: [
            { translateX: x },
            { translateY: y },
            {
              rotate: rotate.interpolate({
                inputRange: [-360, 360],
                outputRange: ['-360deg', '360deg'],
              }),
            },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  bit: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 2,
  },
});
