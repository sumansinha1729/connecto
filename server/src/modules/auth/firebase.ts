import jwt from 'jsonwebtoken';

import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { logger } from '../../utils/logger';
import { normalizeIndianPhone } from '../../utils/phone';

/**
 * Firebase Phone Auth. Google sends the SMS and checks the code in the app; the app then
 * sends us the Firebase ID token, which we verify here and turn into the phone number.
 * Only the project ID is needed: the token is checked against Google's public keys.
 * https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 */
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

/** The code must have been entered recently: an old ID token can't be used to log in */
const MAX_SIGN_IN_AGE_SEC = 10 * 60;

type Certs = Record<string, string>;
let cache: { certs: Certs; expiresAt: number } | null = null;
let testCerts: Certs | null = null;

async function googleCerts(): Promise<Certs> {
  if (testCerts) return testCerts;
  if (cache && cache.expiresAt > Date.now()) return cache.certs;
  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) throw new Error(`Google certs: HTTP ${res.status}`);
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') ?? '')?.[1] ?? 3600);
  cache = { certs: (await res.json()) as Certs, expiresAt: Date.now() + maxAge * 1000 };
  return cache.certs;
}

/** Tests sign their own tokens; this swaps Google's keys for the test key */
export function setFirebaseCertsForTests(certs: Certs | null) {
  if (!env.isTest) throw new Error('Only for tests');
  testCerts = certs;
}

const rejected = () => ApiError.unauthorized('We couldn’t confirm your number. Please request a new code.');

/** Verifies a Firebase ID token from a phone sign-in and returns the number as +91XXXXXXXXXX */
export async function verifyFirebasePhone(idToken: string): Promise<string> {
  const projectId = env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new ApiError(503, 'INTERNAL', 'Phone login isn’t set up on the server yet.');

  const kid = jwt.decode(idToken, { complete: true })?.header.kid;
  let certs: Certs;
  try {
    certs = await googleCerts();
  } catch (error) {
    logger.error('Could not load Firebase signing keys', error);
    throw new ApiError(503, 'INTERNAL', 'Login is temporarily unavailable. Please try again.');
  }
  if (!kid || !certs[kid]) throw rejected();

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(idToken, certs[kid], {
      algorithms: ['RS256'],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
    }) as jwt.JwtPayload;
  } catch {
    throw rejected();
  }

  const authTime = Number(payload.auth_time);
  const now = Date.now() / 1000;
  if (!payload.sub || !authTime || authTime > now + 60 || now - authTime > MAX_SIGN_IN_AGE_SEC) throw rejected();
  if (payload.firebase?.sign_in_provider !== 'phone') throw rejected();

  const raw = typeof payload.phone_number === 'string' ? payload.phone_number : '';
  const phone = raw.startsWith('+91') ? normalizeIndianPhone(raw) : null;
  if (!phone) throw ApiError.badRequest('Only Indian (+91) mobile numbers can use Connecto.', 'INVALID_PHONE');
  return phone;
}
