import crypto from 'node:crypto';

import { RtcRole, RtcTokenBuilder } from 'agora-token';

import { env } from '../../config/env';
import type { VoiceCredentials } from '../../realtime/events';

/** Stable numeric Agora uid for a user (Agora uids are 32-bit integers) */
export function agoraUid(userId: string): number {
  return (crypto.createHash('sha256').update(userId).digest().readUInt32BE(0) % 2_000_000_000) + 1;
}

/**
 * Short-lived token that lets one user join one channel. `canSpeak` = publisher
 * (1:1 calls, room host/speakers); otherwise listen-only (room audience).
 * Returns null when Agora isn't configured, so everything else still works in dev.
 */
export function voiceCredentials(channel: string, userId: string, canSpeak: boolean): VoiceCredentials | null {
  if (!env.agora) return null;
  const uid = agoraUid(userId);
  const ttl = env.AGORA_TOKEN_TTL_SEC;
  const token = RtcTokenBuilder.buildTokenWithUid(
    env.agora.appId,
    env.agora.certificate,
    channel,
    uid,
    canSpeak ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER,
    ttl,
    ttl,
  );
  return { appId: env.agora.appId, channel, token, uid, expiresInSec: ttl, canSpeak };
}
