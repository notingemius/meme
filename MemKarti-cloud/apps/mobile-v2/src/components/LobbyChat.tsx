// Простой чат для лобби LAN. Только текст. Не больше 200 символов на сообщение.
import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { ChatMessage } from '@/game/lanGame';
import { Avatar } from './Avatar';

type Props = {
  messages: ChatMessage[];
  myId: string;
  onSend: (text: string) => void;
};

export function LobbyChat({ messages, myId, onSend }: Props) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages.length]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft('');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>💬 ЧАТ ЛОБІ</Text>
      <View style={styles.box}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={{ padding: 10 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 && (
            <Text style={styles.empty}>Поки порожньо. Напиши перше повідомлення!</Text>
          )}
          {messages.map((m) => {
            const isMine = m.playerId === myId;
            return (
              <View
                key={m.id}
                style={[styles.msgRow, isMine && styles.msgRowMine]}
              >
                {!isMine && (
                  <View style={{ marginRight: 6 }}>
                    <Avatar id={m.playerId} nickname={m.nickname} size={22} />
                  </View>
                )}
                <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
                  {!isMine && (
                    <Text style={styles.bubbleNick}>{m.nickname}</Text>
                  )}
                  <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
                    {m.text}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={styles.inputRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Напиши щось…"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              maxLength={200}
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!draft.trim()}
              style={[styles.sendBtn, !draft.trim() && { opacity: 0.4 }]}
            >
              <Text style={styles.sendText}>↑</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16, marginBottom: 24 },
  label: {
    fontSize: 11, fontWeight: '700', color: '#6B7280',
    letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase',
  },
  box: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  scroll: { maxHeight: 200, minHeight: 80 },
  empty: { color: '#9CA3AF', fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6 },
  msgRowMine: { justifyContent: 'flex-end' },
  bubble: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, maxWidth: '80%',
  },
  bubbleOther: { backgroundColor: '#F3F4F6' },
  bubbleMine: { backgroundColor: '#2563EB' },
  bubbleNick: { fontSize: 10, fontWeight: '700', color: '#6B7280', marginBottom: 2 },
  bubbleText: { fontSize: 14, color: '#111827' },
  bubbleTextMine: { color: '#FFFFFF' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', padding: 8,
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  input: {
    flex: 1, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: '#111827',
  },
  sendBtn: {
    backgroundColor: '#2563EB',
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', marginLeft: 4,
  },
  sendText: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', lineHeight: 22 },
});
