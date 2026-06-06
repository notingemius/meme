// Карта что "переворачивается" с обратной стороны на переднюю.
// 3D эффект через transform: rotateY + опционально perspective.
// На полпути (90°) меняется content с back на front (через opacity).
import { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, Easing, StyleSheet } from 'react-native';

type Props = {
  imageUrl: string;
  title: string;
  height?: number;
  delay?: number;
};

export function FlipCard({ imageUrl, title, height = 260, delay = 0 }: Props) {
  const flip = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(flip, {
      toValue: 1,
      duration: 700,
      delay,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [flip, delay]);

  // Front: rotate 180° → 360° (visible from 90°+)
  const frontRotateY = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });
  // Back: rotate 0° → 180° (visible until 90°)
  const backRotateY = flip.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  // Show back when flip < 0.5, front when flip >= 0.5
  const frontOpacity = flip.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });
  const backOpacity = flip.interpolate({
    inputRange: [0, 0.5, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });

  return (
    <View style={[styles.wrapper, { height }]}>
      {/* Back side — рубашка карты */}
      <Animated.View
        style={[
          styles.face,
          styles.back,
          {
            opacity: backOpacity,
            transform: [{ perspective: 1000 }, { rotateY: backRotateY }],
          },
        ]}
      >
        <View style={styles.backInner}>
          <Text style={styles.backLogo}>МК</Text>
          <View style={styles.backRow}>
            <Text style={styles.backDot}>♠</Text>
            <Text style={styles.backDot}>♣</Text>
            <Text style={styles.backDot}>♥</Text>
            <Text style={styles.backDot}>♦</Text>
          </View>
        </View>
      </Animated.View>

      {/* Front side — настоящая картинка */}
      <Animated.View
        style={[
          styles.face,
          {
            opacity: frontOpacity,
            transform: [{ perspective: 1000 }, { rotateY: frontRotateY }],
          },
        ]}
      >
        <Image source={{ uri: imageUrl }} style={styles.img} />
        <View style={styles.titleBg}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%', position: 'relative' },
  face: {
    position: 'absolute',
    inset: 0 as any,
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  back: {
    backgroundColor: '#1E40AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backInner: { alignItems: 'center', justifyContent: 'center' },
  backLogo: { color: '#FBBF24', fontSize: 48, fontWeight: '900', letterSpacing: 3 },
  backRow: { flexDirection: 'row', marginTop: 12, gap: 12 },
  backDot: { color: '#FBBF24', fontSize: 24 },
  img: { width: '100%', flex: 1, backgroundColor: '#F3F4F6' },
  titleBg: {
    backgroundColor: 'rgba(17,24,39,0.85)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  title: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
});
