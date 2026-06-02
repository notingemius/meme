import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing } from '../theme/theme';
import type { ClientView } from '../game/engine/engine';
import type { ClientAction } from '../game/net/protocol';

type Props = {
  view: ClientView;
  error: string | null;
  send: (a: ClientAction) => void;
};

export default function LobbyView({ view, error, send }: Props) {
  const players = view.players;
  const canStart = players.length >= 3;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Лобі</Text>
        <View style={styles.codeBadge}>
          <Text style={styles.codeText}>{view.code}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.sectionLabel}>ГРАВЦІ · {players.length}/8</Text>
        {players.map((p) => (
          <View key={p.id} style={styles.playerRow}>
            <View style={[styles.avatar, { backgroundColor: p.avatarColor }]}>
              <Text style={styles.avatarText}>{p.nickname.slice(0, 1).toUpperCase()}</Text>
            </View>
            <Text style={styles.playerName}>{p.nickname}</Text>
            {p.id === view.hostPlayerId && (
              <View style={styles.hostTag}>
                <Text style={styles.hostTagText}>хост</Text>
              </View>
            )}
            {p.isBot && (
              <View style={styles.botTag}>
                <Text style={styles.botTagText}>бот</Text>
              </View>
            )}
          </View>
        ))}

        <TouchableOpacity
          style={styles.addBotBtn}
          onPress={() => send({ type: 'addBot' })}
          activeOpacity={0.85}
          disabled={players.length >= 8}
        >
          <Text style={styles.addBotText}>+ Додати бота</Text>
        </TouchableOpacity>
      </ScrollView>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.footer}>
        {!canStart && <Text style={styles.hint}>Потрібно щонайменше 3 гравці</Text>}
        <TouchableOpacity
          style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
          onPress={() => send({ type: 'start' })}
          disabled={!canStart}
          activeOpacity={0.85}
        >
          <Text style={styles.startBtnText}>Почати гру</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  codeBadge: {
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  codeText: { color: colors.primary, fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  sectionLabel: { color: colors.textFaint, fontSize: 12, letterSpacing: 1, marginBottom: spacing.md },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  playerName: { color: colors.text, fontSize: 16, fontWeight: '600', flex: 1 },
  hostTag: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  hostTagText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  botTag: {
    backgroundColor: colors.cardBorder,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  botTagText: { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  addBotBtn: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  addBotText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  error: { color: colors.danger, textAlign: 'center', paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  hint: { color: colors.textFaint, textAlign: 'center', marginBottom: spacing.sm, fontSize: 13 },
  startBtn: { backgroundColor: colors.success, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  startBtnDisabled: { backgroundColor: colors.cardBorder },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
