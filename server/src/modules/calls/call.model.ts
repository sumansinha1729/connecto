import { model, Schema, Types, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const CALL_STATUSES = ['ringing', 'active', 'completed', 'missed', 'rejected', 'cancelled'] as const;
export const FINAL_STATUSES = ['completed', 'missed', 'rejected', 'cancelled'] as const;
export type FinalStatus = (typeof FINAL_STATUSES)[number];

/** Stored reason a call ended (the per-user wording is derived when notifying) */
export const END_REASONS = ['hangup', 'rejected', 'no_answer', 'cancelled', 'insufficient_balance', 'disconnected', 'server_restart'] as const;
export type EndReason = (typeof END_REASONS)[number];

const callSchema = new Schema(
  {
    callerId: { type: Types.ObjectId, ref: 'User', required: true },
    calleeId: { type: Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: CALL_STATUSES, default: 'ringing' },
    /** Agora channel name */
    channel: { type: String, required: true },
    answeredAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    endReason: { type: String, enum: END_REASONS, default: null },
    endedBy: { type: Types.ObjectId, ref: 'User', default: null },
    durationSec: { type: Number, default: 0 },
    /** Minutes charged so far; also guards against billing the same minute twice */
    billedMinutes: { type: Number, default: 0 },
    coinsCharged: { type: Number, default: 0 },
    /** What the listener earned from this call, in paise */
    earnedPaise: { type: Number, default: 0 },
    ratings: {
      type: [new Schema({ userId: { type: Types.ObjectId, required: true }, stars: { type: Number, required: true } }, { _id: false })],
      default: [],
    },
  },
  { timestamps: true },
);

callSchema.index({ callerId: 1, createdAt: -1 });
callSchema.index({ calleeId: 1, createdAt: -1 });
callSchema.index({ status: 1 });

export type CallDoc = HydratedDocument<InferSchemaType<typeof callSchema>>;
export const Call = model('Call', callSchema);
