// Горизонтальный список карт + двушаговый выбор.
// 1. Скроллишь горизонтально все 8 карт (каждая полностью видна).
// 2. Тапаешь карту -> она подсвечивается синей рамкой + чуть поднимается + увеличивается.
// 3. Появляется панель сверху: «Зіграти цю карту? [ЗІГРАТИ]» - подтверждаешь.
// Без подтверждения - можешь поменять выбор тапнув другую карту.
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
  Alert,
} from 'react-native';
import type { MemeCard } from '@/game/deck';
import { useTheme } from '@/ThemeProvider';
import { tapHaptic } from '@/game/haptics';
import { playSound } from '@/game/sounds';

type Props = {
  hand: MemeCard[];
  onPick: (id: number) => void;
  disabled?: boolean;
  // Пометить мем как «поганий»: улетает на сервер (QA) + карта меняется на нову.
  onFlagBad?: (card: MemeCard) => void;
};

const SCREEN_W = Dimensions.get('window').width;
const CARD_W = 150;
const CARD_H = 215;

export function HandPicker({ hand, onPick, disabled, onFlagBad }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const { colors, isDark } = useTheme();

  // Reset selection if hand changes (new round)
  useEffect(() => {
    setSelectedId(null);
    setPreviewId(null);
  }, [hand]);

  const selected = selectedId != null ? hand.find((m) => m.id === selectedId) : null;
  const preview = previewId != null ? hand.find((m) => m.id === previewId) : null;

  // Подтверждение замены «поганого» мема.
  const confirmFlag = (card: MemeCard, afterClose?: () => void) => {
    if (!onFlagBad) return;
    Alert.alert(
      'Поганий мем?',
      `Замінити «${card.title}» на новий мем з колоди? Ми також позначимо його для перевірки.`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: '🚩 Замінити',
          style: 'destructive',
          onPress: () => {
            onFlagBad(card);
            afterClose?.();
          },
        },
      ],
    );
  };

  const handleCardTap = (id: number) => {
    tapHaptic();
    playSound('cardPick');
    setSelectedId(id);
  };

  return (
    <View style={{ width: '100%' }}>
      {/* Sticky banner with confirm button */}
      {selected && !disabled && (
        <View style={[styles.confirmBar, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.confirmLabel, { color: colors.primary }]}>ОБРАНО:</Text>
            <Text style={[styles.confirmName, { color: colors.text }]} numberOfLines={1}>
              {selected.title}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => onPick(selected.id)}
            style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.confirmBtnText}>ЗІГРАТИ →</Text>
          </TouchableOpacity>
        </View>
      )}

      {disabled && (
        <View style={[styles.confirmBar, styles.confirmBarDisabled, { backgroundColor: isDark ? colors.surface : '#F3F4F6', borderColor: colors.border }]}>
          <Text style={[styles.disabledMsg, { color: colors.textSecondary }]}>Чекаємо інших гравців…</Text>
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
            onTap={() => handleCardTap(card.id)}
            onLongPress={() => setPreviewId(card.id)}
            onFlag={onFlagBad ? () => confirmFlag(card) : undefined}
          />
        ))}
      </ScrollView>

      <View style={styles.hint}>
        <Text style={[styles.hintText, { color: colors.textMuted }]}>
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
            <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
              <Image source={{ uri: preview.image_url }} style={styles.modalImg} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>{preview.title}</Text>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setPreviewId(null)}
                  style={[styles.modalBtn, { backgroundColor: isDark ? colors.background : '#F3F4F6' }]}
                >
                  <Text style={[styles.modalBtnGhostText, { color: colors.text }]}>Закрити</Text>
                </TouchableOpacity>
                {!disabled && (
                  <TouchableOpacity
                    onPress={() => {
                      handleCardTap(preview.id);
                      setPreviewId(null);
                    }}
                    style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                  >
                    <Text style={styles.modalBtnPrimaryText}>Обрати ✓</Text>
                  </TouchableOpacity>
                )}
              </View>
              {!disabled && onFlagBad && (
                <TouchableOpacity
                  onPress={() => confirmFlag(preview, () => setPreviewId(null))}
                  style={[styles.modalFlagBtn, { backgroundColor: colors.errorBg, borderColor: '#FCA5A5' }]}
                >
                  <Text style={[styles.modalFlagText, { color: colors.error }]}>🚩 Поганий мем — замінити на новий</Text>
                </TouchableOpacity>
              )}
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
  onFlag,
}: {
  card: MemeCard;
  index: number;
  total: number;
  isSelected: boolean;
  disabled: boolean;
  onTap: () => void;
  onLongPress: () => void;
  onFlag?: () => void;
}) {
  const { colors } = useTheme();
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
          { backgroundColor: colors.cardBg, borderColor: colors.border },
          isSelected && { borderColor: colors.primary, borderWidth: 3 },
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
          <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.selectedBadgeText}>✓</Text>
          </View>
        )}
        {onFlag && !disabled && (
          <TouchableOpacity
            onPress={onFlag}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={styles.flagCorner}
          >
            <Text style={styles.flagCornerText}>🚩</Text>
          </TouchableOpacity>
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
    borderWidth: 1.5,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
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
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  confirmBarDisabled: {
    justifyContent: 'center',
  },
  disabledMsg: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  confirmLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  confirmName: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  confirmBtn: {
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
  modalBtnGhostText: {
    fontWeight: '600',
    fontSize: 14,
  },
  modalBtnPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  modalFlagBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalFlagText: {
    fontWeight: '600',
    fontSize: 13,
  },
  flagCorner: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(254,242,242,0.95)',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagCornerText: {
    fontSize: 14,
  },
});
