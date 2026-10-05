import { env } from '../../config/env';
import { logger } from '../../utils/logger';

/**
 * Dev codes only (local development and tests): the code is printed to the server console.
 * Real logins use Firebase Phone Auth, where Google sends the SMS (see firebase.ts).
 */
export interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<void>;
}

const consoleProvider: SmsProvider = {
  async sendOtp(phone, code) {
    if (env.isProduction) logger.warn('No SMS provider configured: OTP was only logged');
    logger.info(`[sms] OTP for ${phone}: ${code}`);
  },
};

export const sms: SmsProvider = consoleProvider;
