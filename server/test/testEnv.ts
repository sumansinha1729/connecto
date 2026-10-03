/**
 * Configuration for the automated tests. `helpers.ts` imports this first, before any
 * server code reads its config. Timers are shortened so the tests run in seconds:
 * calls bill every 2 s, unanswered calls time out after 3 s, offline after 1 s.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const TEST_MONGO_URL = process.env.TEST_MONGO_URL ?? 'mongodb://127.0.0.1:27017';

Object.assign(process.env, {
  NODE_ENV: 'test',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'error',
  PORT: '0',
  MONGO_URI: `${TEST_MONGO_URL}/connecto_test`,
  JWT_SECRET: 'test-only-secret-that-is-long-enough-1234567890',
  DEV_OTP: '123456',
  OTP_RESEND_SEC: '1',
  CALL_BILLING_INTERVAL_SEC: '2',
  CALL_RING_TIMEOUT_SEC: '3',
  PRESENCE_GRACE_SEC: '1',
  API_RATE_LIMIT_PER_MIN: '10000',
  // Fake Agora project: voice tokens are built offline, so the token logic is tested too
  AGORA_APP_ID: '0123456789abcdef0123456789abcdef',
  AGORA_APP_CERTIFICATE: 'fedcba9876543210fedcba9876543210',
  STORAGE_DRIVER: 'local',
  STORAGE_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'connecto-test-uploads-')),
});
