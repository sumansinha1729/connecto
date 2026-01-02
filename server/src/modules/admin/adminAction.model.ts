import { model, Schema, Types } from 'mongoose';

export const ADMIN_ACTIONS = [
  'ban_user',
  'unban_user',
  'approve_listener',
  'reject_listener',
  'revoke_listener',
  'resolve_report',
  'adjust_wallet',
  'end_room',
  'mark_payout_paid',
  'reject_payout',
] as const;
export type AdminActionType = (typeof ADMIN_ACTIONS)[number];

/** Audit log: who did what to whom, so moderation decisions can be reviewed later */
const adminActionSchema = new Schema(
  {
    adminId: { type: Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: ADMIN_ACTIONS, required: true },
    targetUserId: { type: Types.ObjectId, ref: 'User', default: null },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

adminActionSchema.index({ createdAt: -1 });
adminActionSchema.index({ targetUserId: 1, createdAt: -1 });

export const AdminAction = model('AdminAction', adminActionSchema);
