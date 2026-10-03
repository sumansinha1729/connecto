import { realtime } from '@/services';
import { useAuthStore } from './authStore';
import { useCallStore } from './callStore';
import { useRoomStore } from './roomStore';
import { useEarningsStore } from './earningsStore';
import { useWalletStore } from './walletStore';

/** Routes realtime server events into the stores. Call once at app start. */
export function bindRealtimeToStores(): () => void {
  const unsubscribers = [
    realtime.on('wallet:balance', ({ balance }) => useWalletStore.getState().setBalance(balance)),
    realtime.on('earnings:balance', ({ balancePaise }) => useEarningsStore.getState().setBalance(balancePaise)),

    realtime.on('call:incoming', ({ callId, from }) => useCallStore.getState().onIncoming(callId, from)),
    realtime.on('call:accepted', ({ callId, voice }) => useCallStore.getState().onAccepted(callId, voice ?? null)),
    realtime.on('call:ended', ({ callId, reason, durationSec, coins, earnedPaise }) =>
      useCallStore.getState().onEnded(callId, reason, durationSec, coins, earnedPaise ?? 0),
    ),

    realtime.on('room:updated', ({ room }) => useRoomStore.getState().onUpdated(room)),
    realtime.on('room:voice', ({ roomId, voice }) => useRoomStore.getState().onVoice(roomId, voice)),
    realtime.on('room:closed', ({ roomId }) => useRoomStore.getState().onExit(roomId, 'closed')),
    realtime.on('room:removed', ({ roomId }) => useRoomStore.getState().onExit(roomId, 'removed')),

    realtime.on('account:updated', () => useAuthStore.getState().refreshMe()),
  ];
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
