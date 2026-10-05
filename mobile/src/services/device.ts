import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * A random id for this phone (or browser tab), so the server can tell two devices on the same
 * account apart: only the device that answered a call joins it.
 */
const KEY = 'connecto.deviceId';
let cached: string | null = null;

const randomId = () => `${Platform.OS}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  try {
    if (Platform.OS === 'web') {
      // Per tab: two tabs on one account behave like two phones
      cached = sessionStorage.getItem(KEY) ?? randomId();
      sessionStorage.setItem(KEY, cached);
    } else {
      cached = (await AsyncStorage.getItem(KEY)) ?? randomId();
      await AsyncStorage.setItem(KEY, cached);
    }
  } catch {
    cached ??= randomId();
  }
  return cached;
}

/** The id if already loaded (it's loaded at startup) */
export const currentDeviceId = () => cached;

getDeviceId();
