// Визуальный обратный отсчёт фазы.
// Сам по себе НЕ останавливает игру — engine-логика автопика живёт в solo.tsx / wifi.tsx.
// Здесь только UI: цветной бейдж + полоска прогресса.
import { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';

type Props = {
  // Меняется каждый раз когда фаза стартует заново — таймер сбрасывается.
  resetKey: string | number;
  // Сколько секунд длится фаза.
  totalSec: number;
  // Опционально — текст под цифрой ("обери мем", "голосуй").
  label?: string;
};

export function PhaseTimer({ resetKey, totalSec, label }: Props) {
  const [left, setLeft] = useState(totalSec);
  const startedAt = useRef(Date.now());
  const progress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    startedAt.current = Date.now();
    setLeft(totalSec);
    progress.setValue(1);
    Animated.timing(progress, {
      toValue: 0,
      duration: totalSec * 1000,
      useNativeDriver: false,
    }).start();

    const id = setInterval(() => {
      const elapsed = (Date.now() - startedAt.current) / 1000;
      const remaining = Math.max(0, totalSec - elapsed);
      setLeft(Math.ceil(remaining));
      if (remaining <= 0) clearInterval(id);
    }, 250);

    return () => clearInterval(id);
  }, [resetKey, totalSec, progress]);

  const isUrgent = left <= 5;
  const isWarning = left <= 10 && !isUrgent;

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.badge,
          isUrgent && styles.badgeUrgent,
          isWarning && styles.badgeWarning,
        ]}
      >
        <Text style={[styles.time, isUrgent && styles.timeUrgent]}>{left}</Text>
        <Text style={[styles.unit, isUrgent && styles.timeUrgent]}>сек</Text>
      </View>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.barBg}>
        <Animated.View
          style={[
            styles.barFill,
            isUrgent && { backgroundColor: '#DC2626' },
            isWarning && { backgroundColor: '#F59E0B' },
            {
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 8,
    gap: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#E0E7FF',
    minWidth: 64,
    justifyContent: 'center',
  },
  badgeWarning: { backgroundColor: '#FEF3C7' },
  badgeUrgent: { backgroundColor: '#FEE2E2' },
  time: { fontSize: 18, fontWeight: '800', color: '#2563EB' },
  timeUrgent: { color: '#DC2626' },
  unit: { fontSize: 11, color: '#2563EB', marginLeft: 2, fontWeight: '600' },
  label: { fontSize: 12, color: '#6B7280', fontWeight: '600', flex: 1 },
  barBg: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 2,
  },
  barFill: { height: 4, backgroundColor: '#3B82F6', borderRadius: 2 },
});
