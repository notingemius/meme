import { View, Text, StyleSheet } from 'react-native';

// Цвет аватарки — детерминированный hash от id игрока.
// Палитра тёплая и контрастная, чтобы 2 рядом стоящих игрока легко различить.
const COLORS = [
  '#EF4444', // red
  '#F59E0B', // amber
  '#10B981', // emerald
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#A855F7', // purple
];

function colorFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return COLORS[h % COLORS.length];
}

function initial(nickname: string): string {
  const trimmed = nickname.trim();
  if (!trimmed) return '?';
  return trimmed[0].toUpperCase();
}

type Props = {
  id: string;
  nickname: string;
  size?: number;
  border?: boolean;
};

export function Avatar({ id, nickname, size = 36, border = false }: Props) {
  const bg = colorFor(id);
  const fontSize = Math.floor(size * 0.45);
  return (
    <View
      style={[
        styles.bg,
        { backgroundColor: bg, width: size, height: size, borderRadius: size / 2 },
        border && { borderWidth: 2, borderColor: '#FFFFFF' },
      ]}
    >
      <Text style={[styles.letter, { fontSize }]}>{initial(nickname)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { alignItems: 'center', justifyContent: 'center' },
  letter: { color: '#FFFFFF', fontWeight: '800' },
});
