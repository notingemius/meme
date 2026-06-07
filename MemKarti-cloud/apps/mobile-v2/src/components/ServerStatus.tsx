// Live indicator of the online server (Bunny). Pings the server on mount and
// every 20s, showing a colored dot + latency and how many rooms are currently
// active (server stats). green = online, red = offline, grey = checking.
import { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { SERVER_URL } from '@/config';

type Status = 'checking' | 'online' | 'offline';

export function ServerStatus() {
  const [status, setStatus] = useState<Status>('checking');
  const [ping, setPing] = useState<number | null>(null);
  const [rooms, setRooms] = useState<number | null>(null);

  const check = useCallback(async () => {
    setStatus((s) => (s === 'online' ? s : 'checking'));
    const t0 = Date.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      // Root endpoint returns { ok, service, rooms } — gives us live stats.
      const res = await fetch(`${SERVER_URL}/`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) {
        setStatus('online');
        setPing(Date.now() - t0);
        try {
          const data = await res.json();
          setRooms(typeof data?.rooms === 'number' ? data.rooms : null);
        } catch {
          setRooms(null);
        }
      } else {
        setStatus('offline');
      }
    } catch {
      setStatus('offline');
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, 20000);
    return () => clearInterval(id);
  }, [check]);

  const color = status === 'online' ? '#10B981' : status === 'offline' ? '#EF4444' : '#9CA3AF';
  const label =
    status === 'online'
      ? `Онлайн-сервер працює${ping != null ? ` · ${ping} мс` : ''}${
          rooms != null ? ` · ${rooms} ${roomsWord(rooms)}` : ''
        }`
      : status === 'offline'
        ? 'Онлайн-сервер недоступний'
        : 'Перевіряю сервер…';

  return (
    <TouchableOpacity onPress={check} activeOpacity={0.7} style={styles.row}>
      {status === 'checking' ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <View style={[styles.dot, { backgroundColor: color }]} />
      )}
      <Text style={[styles.txt, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// Ukrainian plural for "кімната" (room): 1 кімната, 2-4 кімнати, 5+ кімнат.
function roomsWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'кімната';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'кімнати';
  return 'кімнат';
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  dot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
  txt: { fontSize: 12, fontWeight: '600' },
});
