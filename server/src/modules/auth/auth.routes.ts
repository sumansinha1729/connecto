import { Router, type Request } from 'express';
import { z } from 'zod';

import { env } from '../../config/env';
import { rateLimit } from '../../middleware/rateLimit';
import { validate } from '../../middleware/validate';
import { loginWithFirebase, requestOtp, verifyOtp } from './auth.service';
import { revokeSession, rotateSession, type ClientMeta } from './tokens';

export const authRouter = Router();

const clientMeta = (req: Request): ClientMeta => ({ ip: req.ip, userAgent: req.get('user-agent') });

// Per-IP limits on top of the per-number OTP limits in the service
const ipLimit = { windowSec: env.OTP_WINDOW_SEC, message: 'Too many attempts. Please try again later.' };
const otpRequestLimiter = rateLimit({ ...ipLimit, max: env.OTP_IP_MAX_PER_WINDOW });
const otpVerifyLimiter = rateLimit({ ...ipLimit, max: env.OTP_IP_MAX_PER_WINDOW * 3 });

const phoneBody = z.object({ phone: z.string().min(10).max(16) });
const firebaseBody = z.object({ idToken: z.string().min(100).max(4096) });
const refreshBody = z.object({ refreshToken: z.string().min(20) });

// Firebase Phone Auth (the real login): the app signs in with Firebase and sends us the ID token
authRouter.post('/firebase', otpVerifyLimiter, validate({ body: firebaseBody }), async (req, res) => {
  res.json(await loginWithFirebase(req.body.idToken, clientMeta(req)));
});

// Admin panel: same, but only for admins and never creates accounts
authRouter.post('/admin/firebase', otpVerifyLimiter, validate({ body: firebaseBody }), async (req, res) => {
  res.json(await loginWithFirebase(req.body.idToken, clientMeta(req), { adminOnly: true }));
});

// Our own codes, printed to the server console (DEV_OTP works for every number).
// For local development and tests only: there is no SMS provider behind them.
if (!env.isProduction) {
  authRouter.post('/otp/request', otpRequestLimiter, validate({ body: phoneBody }), async (req, res) => {
    res.json(await requestOtp(req.body.phone, clientMeta(req)));
  });

  authRouter.post(
    '/otp/verify',
    otpVerifyLimiter,
    validate({ body: phoneBody.extend({ code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.') }) }),
    async (req, res) => {
      res.json(await verifyOtp(req.body.phone, req.body.code, clientMeta(req)));
    },
  );

  // Admin panel login: same codes and limits, but only for admins and never creates accounts
  authRouter.post('/admin/otp/request', otpRequestLimiter, validate({ body: phoneBody }), async (req, res) => {
    res.json(await requestOtp(req.body.phone, clientMeta(req), { adminOnly: true }));
  });

  authRouter.post(
    '/admin/otp/verify',
    otpVerifyLimiter,
    validate({ body: phoneBody.extend({ code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.') }) }),
    async (req, res) => {
      res.json(await verifyOtp(req.body.phone, req.body.code, clientMeta(req), { adminOnly: true }));
    },
  );
}

authRouter.post('/refresh', validate({ body: refreshBody }), async (req, res) => {
  res.json(await rotateSession(req.body.refreshToken, clientMeta(req)));
});

authRouter.post('/logout', validate({ body: refreshBody }), async (req, res) => {
  await revokeSession(req.body.refreshToken);
  res.status(204).end();
});
