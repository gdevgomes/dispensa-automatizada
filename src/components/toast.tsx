import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

const VISIBLE_MS = 2600;

/** Snackbar simples (estilo Material): `show(msg)` exibe por ~2,6s. */
export function useToast(bottom = 14): [(message: string) => void, ReactElement] {
  const [message, setMessage] = useState('');
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const show = useCallback(
    (next: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(next);
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start();
      }, VISIBLE_MS);
    },
    [opacity],
  );

  const element = (
    <Animated.View pointerEvents="none" style={[styles.toast, { bottom, opacity }]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );

  return [show, element];
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: '#323232',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 6,
  },
  text: { color: '#ffffff', fontSize: 14 },
});
