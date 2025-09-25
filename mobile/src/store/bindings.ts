import { realtime } from '@/services';
import { useCallStore } from './callStore';
import { useRoomStore } from './roomStore';
import { useWalletStore } from './walletStore';

/** Routes realtime server events into the stores. Call once at app start. */
export function bindRealtimeToStores(): () => void {
  const unsubscribers = [
    realtime.on('wallet:balance', ({ balance }) => useWalletStore.getState().setBalance(balance)),

    realtime.on('call:incoming', ({ callId, from }) => useCallStore.getState().onIncoming(callId, from)),
    realtime.on('call:accepted', ({ callId }) => useCallStore.getState().onAccepted(callId)),
    realtime.on('call:ended', ({ callId, reason, durationSec, coins }) =>
      useCallStore.getState().onEnded(callId, reason, durationSec, coins),
    ),

    realtime.on('room:updated', ({ room }) => useRoomStore.getState().onUpdated(room)),
    realtime.on('room:speaking', ({ roomId, userIds }) => useRoomStore.getState().onSpeaking(roomId, userIds)),
    realtime.on('room:closed', ({ roomId }) => useRoomStore.getState().onExit(roomId, 'closed')),
    realtime.on('room:removed', ({ roomId }) => useRoomStore.getState().onExit(roomId, 'removed')),
  ];
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}
