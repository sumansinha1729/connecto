import fs from 'node:fs/promises';
import path from 'node:path';

import { env } from '../../config/env';
import { hmac, safeEqual } from '../../utils/crypto';

/**
 * Where uploaded files (listener voice intros) live. Only a local-disk driver
 * exists for now; an S3 driver with the same interface is added once the
 * client's AWS account is ready (see MANUAL_TASKS.md).
 */
export interface FileStorage {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  /** A link that works without login for `ttlSec` seconds */
  getDownloadUrl(key: string, ttlSec?: number): string;
}

/** Keys are flat, e.g. "voice-intro_<userId>_<timestamp>.webm" */
export const STORAGE_KEY_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,120}$/i;

const root = path.resolve(env.STORAGE_DIR);

export function localPath(key: string): string {
  if (!STORAGE_KEY_PATTERN.test(key)) throw new Error(`Invalid storage key: ${key}`);
  return path.join(root, key);
}

/** Signature for /media links, so files can't be guessed or shared forever */
export function signMediaLink(key: string, expiresAt: number): string {
  return hmac(`media:${key}:${expiresAt}`);
}

export function verifyMediaLink(key: string, expiresAt: number, signature: string): boolean {
  return Date.now() < expiresAt && /^[a-f0-9]{64}$/.test(signature) && safeEqual(signature, signMediaLink(key, expiresAt));
}

const localStorage: FileStorage = {
  async put(key, data) {
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(localPath(key), data);
  },

  async delete(key) {
    await fs.rm(localPath(key), { force: true });
  },

  getDownloadUrl(key, ttlSec = 15 * 60) {
    const expiresAt = Date.now() + ttlSec * 1000;
    return `${env.publicBaseUrl}/media/${key}?exp=${expiresAt}&sig=${signMediaLink(key, expiresAt)}`;
  },
};

export const storage: FileStorage = localStorage;
