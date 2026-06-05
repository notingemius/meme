import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
} from 'react-native';
import type { ClientView } from '@/game/lanGame';

type Props = {
  view: ClientView;
  insets: { top: number; bottom: number };
  isHost: boolean;
  onSubmit: (memeCardId: number) => void;
  onVote: (submissionId: string) => void;
  onNextRound: () => void; // только хост вызывает
  onExit: () => void;
};

export function LanGameUI({ view, insets, isHost, onSubmit, onVote, onNextRound, onExit }: Props) {
  const me = view.players.find((p) => p.id === view.myId);

  // ============= FINISHED =============
  if (view.phase === 'finished') {
    const sorted = [...view.players].sort((a, b) => b.score - a.score);
    const top = sorted[0];
    return (
      <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.bigTitle}>🏆 Гру завершено</Text>
          <Text style={styles.sub}>
            Переможець: <Text style={styles.winnerName}>{top?.nickname ?? '—'}</Text>
          </Text>
          <View style={styles.podium}>
            {sorted.map((p, i) => (
              <View key={p.id} style={styles.podiumRow}>
                <Text style={styles.podiumPlace}>{i + 1}.</Text>
                <Text style={styles.podiumName}>{p.nickname}</Text>
                <Text style={styles.podiumScore}>{p.score} оч.</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity onPress={onExit} style={[styles.btnPrimary, { marginTop: 24 }]}>
            <Text style={styles.btnPrimaryText}>На головну</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ============= REVEAL =============
  if (view.phase === 'reveal') {
    const winnerSub = view.submissions.find((s) => s.id === view.roundWinner?.submissionId);
    const winnerPlayer = winnerSub
      ? view.players.find((p) => p.id === winnerSub.playerId)
      : null;
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <RoundHeader view={view} />
          <Text style={styles.label}>СИТУАЦІЯ</Text>
          <Text style={styles.situation}>{view.situation?.text_ua}</Text>

          {winnerSub && winnerPlayer ? (
            <View style={styles.winnerCard}>
              <Text style={styles.winnerLabel}>ПЕРЕМОЖЕЦЬ РАУНДУ</Text>
              <Text style={styles.winnerName}>{winnerPlayer.nickname}</Text>
              <Image source={{ uri: winnerSub.memeCard.image_url }} style={styles.bigImg} />
              <Text style={styles.memeTitle}>{winnerSub.memeCard.title}</Text>
            </View>
          ) : null}

          <Text style={[styles.label, { marginTop: 24 }]}>УСІ ВАРІАНТИ</Text>
          {view.submissions.map((sub) => {
            const player = view.players.find((p) => p.id === sub.playerId);
            const isWinner = sub.id === view.roundWinner?.submissionId;
            return (
              <View key={sub.id} style={[styles.subCard, isWinner && styles.subCardWinner]}>
                <Image source={{ uri: sub.memeCard.image_url }} style={styles.subImg} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.subMemeTitle} numberOfLines={2}>{sub.memeCard.title}</Text>
                  <Text style={styles.subPlayer}>від {player?.nickname ?? '?'}</Text>
                </View>
              </View>
            );
          })}

          <Text style={[styles.label, { marginTop: 24 }]}>РАХУНОК</Text>
          {view.players.map((p) => (
            <View key={p.id} style={styles.scoreRow}>
              <Text style={styles.scoreName}>{p.nickname}{p.id === view.myId ? ' (ти)' : ''}</Text>
              <Text style={styles.scoreVal}>★ {p.score}</Text>
            </View>
          ))}

          {isHost && (
            <TouchableOpacity onPress={onNextRound} style={[styles.btnPrimary, { marginTop: 24 }]}>
              <Text style={styles.btnPrimaryText}>
                {view.round >= view.totalRounds ? 'Подивитись фінал' : 'Наступний раунд →'}
              </Text>
            </TouchableOpacity>
          )}
          {!isHost && (
            <Text style={styles.waiting}>Чекаємо хоста для наступного раунду…</Text>
          )}
        </ScrollView>
      </View>
    );
  }

  // ============= VOTE =============
  if (view.phase === 'vote') {
    const canVoteFor = (subPlayerId: string) => subPlayerId !== view.myId;
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <RoundHeader view={view} />
          <Text style={styles.label}>СИТУАЦІЯ</Text>
          <Text style={styles.situation}>{view.situation?.text_ua}</Text>

          <Text style={[styles.label, { marginTop: 24 }]}>ОБЕРИ НАЙСМІШНІШИЙ (не за свій)</Text>
          {view.submissions.map((sub) => {
            const isMine = sub.playerId === view.myId;
            const voted = view.myVotedSubmissionId === sub.id;
            return (
              <TouchableOpacity
                key={sub.id}
                disabled={!canVoteFor(sub.playerId) || !!view.myVotedSubmissionId}
                onPress={() => onVote(sub.id)}
                style={[
                  styles.voteCard,
                  voted && styles.voteCardSelected,
                  isMine && { opacity: 0.4 },
                ]}
              >
                <Image source={{ uri: sub.memeCard.image_url }} style={styles.voteImg} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.subMemeTitle} numberOfLines={2}>{sub.memeCard.title}</Text>
                  {isMine && <Text style={styles.subPlayer}>(твій вибір)</Text>}
                  {voted && <Text style={styles.votedBadge}>✓ Твій голос</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
          {view.myVotedSubmissionId && (
            <Text style={styles.waiting}>Голос прийнято. Чекаємо інших…</Text>
          )}
        </ScrollView>
      </View>
    );
  }

  // ============= PICK =============
  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <RoundHeader view={view} />
        <Text style={styles.label}>СИТУАЦІЯ</Text>
        <Text style={styles.situation}>{view.situation?.text_ua}</Text>

        <Text style={[styles.label, { marginTop: 24 }]}>ТВОЯ РУКА — ОБЕРИ МЕМ</Text>
        {view.myHand.map((meme) => {
          const isPicked = view.myPickedSubmissionId &&
            view.submissions.some((s) => s.id === view.myPickedSubmissionId && s.memeCard.id === meme.id);
          return (
            <TouchableOpacity
              key={meme.id}
              disabled={!!view.myPickedSubmissionId}
              onPress={() => onSubmit(meme.id)}
              style={[styles.memeCard, isPicked && styles.memeCardSelected]}
            >
              <Image source={{ uri: meme.image_url }} style={styles.memeImg} />
              <Text style={styles.memeTitle} numberOfLines={2}>{meme.title}</Text>
              {isPicked && <Text style={styles.pickedBadge}>✓ Обрано</Text>}
            </TouchableOpacity>
          );
        })}
        {view.myPickedSubmissionId && (
          <Text style={styles.waiting}>Чекаємо інших гравців…</Text>
        )}
      </ScrollView>
    </View>
  );
}

function RoundHeader({ view }: { view: ClientView }) {
  return (
    <View style={styles.roundHeader}>
      <Text style={styles.roundText}>
        Раунд {view.round} / {view.totalRounds}
      </Text>
      <Text style={styles.roundText}>
        {view.players.length} гравців
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  roundHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  roundText: { color: '#6B7280', fontSize: 13, fontWeight: '500' },

  label: { fontSize: 11, fontWeight: '600', color: '#6B7280', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  situation: { fontSize: 18, fontWeight: '600', color: '#FFFFFF', backgroundColor: '#2563EB', padding: 18, borderRadius: 14, lineHeight: 25 },

  memeCard: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12, overflow: 'hidden' },
  memeCardSelected: { borderColor: '#2563EB', borderWidth: 2 },
  memeImg: { width: '100%', height: 180, backgroundColor: '#F3F4F6' },
  memeTitle: { fontSize: 14, color: '#111827', padding: 12, fontWeight: '500' },
  pickedBadge: { position: 'absolute', top: 8, right: 8, padding: 6, backgroundColor: '#2563EB', color: '#FFFFFF', borderRadius: 6, fontSize: 11, fontWeight: '700' },

  voteCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12, padding: 10, alignItems: 'center' },
  voteCardSelected: { borderColor: '#2563EB', borderWidth: 2, backgroundColor: '#EFF6FF' },
  voteImg: { width: 100, height: 100, borderRadius: 8, backgroundColor: '#F3F4F6' },

  subCard: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10, padding: 10, alignItems: 'center' },
  subCardWinner: { borderColor: '#F59E0B', borderWidth: 2, backgroundColor: '#FEF3C7' },
  subImg: { width: 70, height: 70, borderRadius: 6, backgroundColor: '#F3F4F6' },
  subMemeTitle: { fontSize: 13, color: '#111827', fontWeight: '600' },
  subPlayer: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  votedBadge: { fontSize: 12, color: '#2563EB', fontWeight: '700', marginTop: 4 },

  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, marginBottom: 6 },
  scoreName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  scoreVal: { fontSize: 14, fontWeight: '700', color: '#2563EB' },

  winnerCard: { backgroundColor: '#FEF3C7', borderRadius: 16, padding: 16, marginTop: 16, alignItems: 'center' },
  winnerLabel: { fontSize: 11, fontWeight: '700', color: '#92400E', letterSpacing: 1, marginBottom: 6 },
  winnerName: { fontSize: 22, fontWeight: '700', color: '#78350F', marginBottom: 12 },
  bigImg: { width: '100%', height: 240, borderRadius: 12, backgroundColor: '#fff' },

  waiting: { textAlign: 'center', color: '#6B7280', marginTop: 20, fontStyle: 'italic' },

  btnPrimary: { backgroundColor: '#2563EB', borderRadius: 10, paddingVertical: 16, alignItems: 'center' },
  btnPrimaryText: { fontSize: 15, color: '#FFFFFF', fontWeight: '600' },

  bigTitle: { fontSize: 32, fontWeight: '700', color: '#111827' },
  sub: { fontSize: 16, color: '#6B7280', marginTop: 8 },
  podium: { marginTop: 24 },
  podiumRow: { flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8 },
  podiumPlace: { fontSize: 20, fontWeight: '700', color: '#2563EB', width: 40 },
  podiumName: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1 },
  podiumScore: { fontSize: 14, fontWeight: '700', color: '#2563EB' },
});
