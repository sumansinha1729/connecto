import { model, Schema, Types } from 'mongoose';

import { REPORT_REASONS } from '../../config/options';

/** userId has favourited targetId */
const favoriteSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    targetId: { type: Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
favoriteSchema.index({ userId: 1, targetId: 1 }, { unique: true });
favoriteSchema.index({ targetId: 1 });
export const Favorite = model('Favorite', favoriteSchema);

/** userId has blocked targetId. Blocking hides both users from each other. */
const blockSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    targetId: { type: Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
blockSchema.index({ userId: 1, targetId: 1 }, { unique: true });
blockSchema.index({ targetId: 1 });
export const Block = model('Block', blockSchema);

const reportSchema = new Schema(
  {
    reporterId: { type: Types.ObjectId, ref: 'User', required: true },
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, default: '' },
    status: { type: String, enum: ['open', 'reviewed', 'actioned'], default: 'open' },
    resolvedBy: { type: Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
    resolutionNote: { type: String, default: null },
  },
  { timestamps: true },
);
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reporterId: 1, userId: 1, createdAt: -1 });
export const Report = model('Report', reportSchema);
