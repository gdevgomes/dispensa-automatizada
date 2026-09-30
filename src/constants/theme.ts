/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

/** Paleta inspirada no tema padrão do MUI (Material UI). */
export const Palette = {
  primary: '#1976d2',
  primaryDark: '#1565c0',
  primaryLight: '#e3f2fd',
  success: '#2e7d32',
  successLight: '#e8f5e9',
  successBorder: 'rgba(46, 125, 50, 0.3)',
  warning: '#ed6c02',
  warningLight: '#fff3e0',
  error: '#d32f2f',
  errorLight: '#fdecea',
  divider: 'rgba(0, 0, 0, 0.12)',
  onPrimary: '#ffffff',
} as const;

export const Colors = {
  light: {
    text: 'rgba(0, 0, 0, 0.87)',
    background: '#ffffff',
    backgroundElement: '#f5f5f5',
    backgroundSelected: '#e0e0e0',
    textSecondary: 'rgba(0, 0, 0, 0.6)',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
