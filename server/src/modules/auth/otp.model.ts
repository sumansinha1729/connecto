import { model, Schema } from 'mongoose';

const otpSchema = new Schema(
  {
    phone: { type: String, required: true },
    /** HMAC of "<phone>:<code>", the code itself is never stored */
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    /** Set when used, superseded by a newer code, or locked after too many attempts */
    consumedAt: { type: Date, default: null },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

otpSchema.index({ phone: 1, createdAt: -1 });
// Old rows are only needed for rate limiting, so drop them after a day
otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export const Otp = model('Otp', otpSchema);
