import { model, Schema, Types, type HydratedDocument, type InferSchemaType } from 'mongoose';

const walletSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true, unique: true },
    balance: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

export const Wallet = model('Wallet', walletSchema);

export const TRANSACTION_TYPES = ['signup_bonus', 'recharge', 'call_charge', 'call_earning', 'refund', 'adjustment'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

const transactionSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: TRANSACTION_TYPES, required: true },
    /** Signed: positive = credit, negative = debit */
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, default: null },
    description: { type: String, required: true },
    /** Makes an operation safe to retry: the same key is only ever applied once */
    idempotencyKey: { type: String },
    meta: { type: Schema.Types.Mixed, default: undefined },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });

export type TransactionDoc = HydratedDocument<InferSchemaType<typeof transactionSchema>>;
export const Transaction = model('Transaction', transactionSchema);
