import { env } from '../../config/env';
import { logger } from '../../utils/logger';

/** Sends OTP codes. Swap the implementation for MSG91 / Firebase in the real-OTP step. */
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
