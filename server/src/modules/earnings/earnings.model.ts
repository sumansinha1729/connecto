import { model, Schema, Types, type HydratedDocument, type InferSchemaType } from 'mongoose';

/*
 * Listener earnings, kept completely separate from the coin wallet:
 * coins are bought and spent by users; earnings are real money (in paise)
 * that listeners withdraw.
 */

const earningsAccountSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, unique: true },
    balancePaise: { type: Number, required: true, default: 0, min: 0 },
    /** Everything ever earned, for stats */
    lifetimePaise: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);
export const EarningsAccount = model('EarningsAccount', earningsAccountSchema);

export const EARNING_ENTRY_TYPES = ['call', 'payout', 'payout_reversal', 'adjustment'] as const;
export type EarningEntryType = (typeof EARNING_ENTRY_TYPES)[number];

const earningsEntrySchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: EARNING_ENTRY_TYPES, required: true },
    /** Signed: positive = earned/returned, negative = withdrawn */
    amountPaise: { type: Number, required: true },
    balanceAfterPaise: { type: Number, default: null },
    description: { type: String, required: true },
    /** One row per call / payout; also makes writes safe to retry */
    entryKey: { type: String },
    meta: { type: Schema.Types.Mixed, default: undefined },
  },
  { timestamps: true },
);
earningsEntrySchema.index({ userId: 1, createdAt: -1 });
earningsEntrySchema.index({ entryKey: 1 }, { unique: true, partialFilterExpression: { entryKey: { $type: 'string' } } });
export type EarningsEntryDoc = HydratedDocument<InferSchemaType<typeof earningsEntrySchema>>;
export const EarningsEntry = model('EarningsEntry', earningsEntrySchema);

export const PAYOUT_STATUSES = ['requested', 'paid', 'rejected'] as const;

const payoutRequestSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    amountPaise: { type: Number, required: true, min: 1 },
    /** Snapshot of where to pay, as it was when requested */
    method: {
      kind: { type: String, enum: ['upi', 'bank'], required: true },
      upiId: { type: String, default: null },
      accountName: { type: String, default: null },
      accountNumber: { type: String, default: null },
      ifsc: { type: String, default: null },
    },
    status: { type: String, enum: PAYOUT_STATUSES, default: 'requested' },
    processedAt: { type: Date, default: null },
    processedBy: { type: Types.ObjectId, ref: 'User', default: null },
    /** UPI / bank transaction reference (UTR) when paid */
    reference: { type: String, default: null },
    /** Reason when rejected */
    note: { type: String, default: null },
  },
  { timestamps: true },
);
payoutRequestSchema.index({ userId: 1, createdAt: -1 });
payoutRequestSchema.index({ status: 1, createdAt: 1 });
// At most one open request per listener
payoutRequestSchema.index({ userId: 1 }, { unique: true, partialFilterExpression: { status: 'requested' } });
export type PayoutRequestDoc = HydratedDocument<InferSchemaType<typeof payoutRequestSchema>>;
export const PayoutRequest = model('PayoutRequest', payoutRequestSchema);
