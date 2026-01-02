/**
 * Build-time settings from mobile/.env (EXPO_PUBLIC_* variables).
 * Restart `npx expo start --clear` after changing them.
 */

/** Backend base URL. On the Android emulator use http://10.0.2.2:4050 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4050').replace(/\/+$/, '');
