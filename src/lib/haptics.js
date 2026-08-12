export function haptic(pattern = 10) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {}
}

export const haptics = {
  light: () => haptic(10),
  medium: () => haptic(20),
  heavy: () => haptic(40),
  success: () => haptic([10, 30, 10]),
  error: () => haptic([40, 20, 40]),
  selection: () => haptic(8),
};
