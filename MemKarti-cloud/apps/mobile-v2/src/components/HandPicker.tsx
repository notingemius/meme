// Горизонтальный список карт + двушаговый выбор.
// 1. Скроллишь горизонтально все 8 карт (каждая полностью видна).
// 2. Тапаешь карту → она подсвечивается синей рамкой + чуть поднимается + увеличивается.
// 3. Появляется панель сверху: «Зіграти цю карту? [ЗІГРАТИ]» — подтверждаешь.
// Без подтверждения — можешь поменять выбор тапнув другую карту.
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  Animated,
  StyleSheet,
  Dimensions,
  Modal,
  Pressable,
} from 'react-native';
import type { MemeCard } from '@/game/deck';

type Props = {
  hand: MemeCard[];
  onPick: (id: number) => void;
  disabled?: boolean;
};

const SCREEN_W = Dimensions.get('window').width;
const CARD_W = 150;
const CARD_H = 215;

export function HandPicker({ hand, onPick, disabled }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);

  // Reset selection if hand changes (new round)
  useEffect(() => {
    setSelectedId(null);
    setPreviewId(null);
  }, [hand]);

  const selected = selectedId != null ? hand.find((m) => m.id === selectedId) : null;
  const preview = previewId != null ? hand.find((m) => m.id === previewId) : null;

  return (
    <View style={{ width: '100%' }}>
      {/* Sticky banner with confirm button */}
      {selected && !disabled && (
        <View style={styles.confirmBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.confirmLabel}>ОБРАНО:</Text>
            <Text style={styles.confirmName} numberOfLines={1}>
              {selected.title}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => onPick(selected.id)}
            style={styles.confirmBtn}
          >
            <Text style={styles.confirmBtnText}>ЗІГРАТИ →</Text>
          </TouchableOpacity>
        </View>
      )}

      {disabled && (
        <View style={[styles.confirmBar, styles.confirmBarDisabled]}>
          <Text style={styles.disabledMsg}>Чекаємо інших гравців…</Text>
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
        contentContainerStyle={styles.scrollContent}
        snapToInterval={CARD_W + 12}
        decelerationRate="fast"
      >
        {hand.map((card, i) => (
          <HandCard
            key={card.id}
            card={card}
            index={i}
            total={hand.length}
            isSelected={selectedId === card.id}
            disabled={!!disabled}
            onTap={() => setSelectedId(card.id)}
            onLongPress={() => setPreviewId(card.id)}
          />
        ))}
      </ScrollView>

      <View style={styles.hint}>
        <Text style={styles.hintText}>
          ← Гортай для перегляду · Тап = обрати · Утримай = збільшити
        </Text>
      </View>

      {/* Full-screen preview modal */}
      <Modal
        visible={previewId != null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewId(null)}
      >
        <Pressable style={styles.modalBg} onPress={() => setPreviewId(null)}>
          {preview && (
            <View style={styles.modalCard}>
              <Image source={{ uri: preview.image_url }} style={styles.modalImg} />
              <Text style={styles.modalTitle}>{preview.title}</Text>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setPreviewId(null)}
                  style={[styles.modalBtn, styles.modalBtnGhost]}
                >
                  <Text style={styles.modalBtnGhostText}>Закрити</Text>
                </TouchableOpacity>
                {!disabled && (
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedId(preview.id);
                      setPreviewId(null);
                    }}
                    style={[styles.modalBtn, styles.modalBtnPrimary]}
                  >
                    <Text style={styles.modalBtnPrimaryText}>Обрати ✓</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

function HandCard({
  card,
  index,
  total,
  isSelected,
  disabled,
  onTap,
  onLongPress,
}: {
  card: MemeCard;
  index: number;
  total: number;
  isSelected: boolean;
  disabled: boolean;
  onTap: () => void;
  onLongPress: () => void;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 400,
      delay: index * 60,
      useNativeDriver: true,
    }).start();
  }, [enter, index]);

  useEffect(() => {
    Animated.spring(lift, {
      toValue: isSelected ? 1 : 0,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [isSelected, lift]);

  const translateY = Animated.add(
    enter.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }),
    lift.interpolate({ inputRange: [0, 1], outputRange: [0, -16] }),
  );
  const scale = lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const opacity = enter.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }, { scale }],
      }}
    >
      <TouchableOpacity
        onPress={onTap}
        onLongPress={onLongPress}
        delayLongPress={250}
        activeOpacity={0.85}
        disabled={disabled}
        style={[
          styles.card,
          isSelected && styles.cardSelected,
          disabled && !isSelected && styles.cardDimmed,
        ]}
      >
        <Image source={{ uri: card.image_url }} style={styles.cardImage} />
        <View style={styles.cardTitleBg}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {card.title}
          </Text>
        </View>
        {isSelected && (
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedBadgeText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 12,
    alignItems: 'flex-end',
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },
  cardSelected: {
    borderColor: '#2563EB',
    borderWidth: 3,
    elevation: 10,
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  cardDimmed: {
    opacity: 0.45,
  },
  cardImage: {
    width: '100%',
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  cardTitleBg: {
    backgroundColor: 'rgba(17,24,39,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    minHeight: 38,
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  selectedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedBadgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  confirmBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  confirmBarDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    justifyContent: 'center',
  },
  disabledMsg: {
    color: '#6B7280',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  confirmLabel: {
    fontSize: 10,
    color: '#2563EB',
    fontWeight: '700',
    letterSpacing: 1,
  },
  confirmName: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    marginTop: 2,
  },
  confirmBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },

  hint: {
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  hintText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '500',
  },

  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    width: '100%',
    maxWidth: 380,
  },
  modalImg: {
    width: '100%',
    height: 380,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginTop: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnGhost: {
    backgroundColor: '#F3F4F6',
  },
  modalBtnGhostText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 14,
  },
  modalBtnPrimary: {
    backgroundColor: '#2563EB',
  },
  modalBtnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
