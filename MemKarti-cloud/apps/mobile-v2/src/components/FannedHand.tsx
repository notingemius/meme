// Hearthstone-style рука: карты веером.
// Используем absolute-позиционирование + transform: rotate.
// Без reanimated — встроенный Animated API из RN.
import { useRef, useEffect } from 'react';
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
} from 'react-native';
import type { MemeCard } from '@/game/deck';

type Props = {
  hand: MemeCard[];
  onPick: (id: number) => void;
  disabled?: boolean;
  pickedId?: number | null;
};

const SCREEN_W = Dimensions.get('window').width;

const CARD_W = 110;
const CARD_H = 175;

export function FannedHand({ hand, onPick, disabled, pickedId }: Props) {
  // Если 1-5 карт — веер; если 6-8 — горизонтальный скролл (или плотнее веер)
  // Делаем веер 8 карт с пересечением. Если экран узкий, помещаем в ScrollView.
  const total = hand.length;
  if (total === 0) return null;

  const center = (total - 1) / 2;
  // Расстояние между центрами соседних карт по X.
  // На 8 картах: пытаемся уложить в SCREEN_W - 32 (по 16 паддингу).
  const targetSpan = SCREEN_W - 40;
  const stepX = total > 1 ? Math.min(70, targetSpan / (total - 1)) : 0;
  const totalSpan = (total - 1) * stepX;

  // Минимально нужная высота View
  const maxOffsetY = Math.abs(center) * 10; // карты по краям опускаются
  const containerHeight = CARD_H + maxOffsetY + 24;

  return (
    <View style={[styles.container, { height: containerHeight }]}>
      {hand.map((card, i) => (
        <FannedCard
          key={card.id}
          card={card}
          index={i}
          center={center}
          stepX={stepX}
          totalSpan={totalSpan}
          disabled={disabled}
          isPicked={pickedId === card.id}
          onPick={() => onPick(card.id)}
        />
      ))}
    </View>
  );
}

function FannedCard({
  card,
  index,
  center,
  stepX,
  totalSpan,
  disabled,
  isPicked,
  onPick,
}: {
  card: MemeCard;
  index: number;
  center: number;
  stepX: number;
  totalSpan: number;
  disabled?: boolean;
  isPicked?: boolean;
  onPick: () => void;
}) {
  const dealAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(dealAnim, {
      toValue: 1,
      duration: 500,
      delay: index * 70,
      useNativeDriver: true,
    }).start();
  }, [dealAnim, index]);

  const offset = index - center;
  const rotateZ = `${offset * 5}deg`;
  const translateX = -totalSpan / 2 + index * stepX;
  const translateY = Math.abs(offset) * 8;

  // Animation: cards "fly in" from below
  const animatedTranslateY = dealAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [120, translateY],
  });
  const animatedOpacity = dealAnim;

  return (
    <Animated.View
      style={[
        styles.cardWrap,
        {
          left: '50%',
          marginLeft: translateX - CARD_W / 2,
          zIndex: index,
          opacity: animatedOpacity,
          transform: [
            { translateY: animatedTranslateY },
            { rotate: rotateZ },
            { scale: isPicked ? 1.05 : 1 },
          ],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPick}
        disabled={disabled}
        style={[styles.card, isPicked && styles.cardPicked, disabled && !isPicked && { opacity: 0.6 }]}
      >
        <Image source={{ uri: card.image_url }} style={styles.cardImage} />
        <View style={styles.cardTitleBg}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {card.title}
          </Text>
        </View>
        {isPicked && <View style={styles.pickedTag}><Text style={styles.pickedTagText}>✓</Text></View>}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    overflow: 'visible',
  },
  cardWrap: {
    position: 'absolute',
    top: 0,
    width: CARD_W,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardPicked: {
    borderColor: '#2563EB',
    borderWidth: 3,
  },
  cardImage: {
    width: '100%',
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  cardTitleBg: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  pickedTag: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickedTagText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

// Альтернатива: широкая рука 8+ карт через ScrollView
export function FannedHandScrollable(props: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ minWidth: '100%', alignItems: 'center' }}
    >
      <FannedHand {...props} />
    </ScrollView>
  );
}
