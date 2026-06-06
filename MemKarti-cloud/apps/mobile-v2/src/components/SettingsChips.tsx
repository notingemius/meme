// Чипсы выбора значения (раунды / таймеры) — выглядят как сегмент-контрол.
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type Props<T extends string | number> = {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  emoji?: string;
};

export function SettingsChips<T extends string | number>({
  label,
  value,
  options,
  onChange,
  emoji,
}: Props<T>) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {emoji ? `${emoji}  ` : ''}{label}
      </Text>
      <View style={styles.row}>
        {options.map((opt) => {
          const isSel = opt.value === value;
          return (
            <TouchableOpacity
              key={String(opt.value)}
              onPress={() => onChange(opt.value)}
              style={[styles.chip, isSel && styles.chipSel]}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, isSel && styles.chipTextSel]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: {
    fontSize: 11, fontWeight: '700', color: '#6B7280',
    letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 7,
    alignItems: 'center',
  },
  chipSel: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  chipTextSel: {
    color: '#2563EB',
    fontWeight: '700',
  },
});
