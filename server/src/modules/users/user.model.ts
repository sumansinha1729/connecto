import { model, Schema, type HydratedDocument, type InferSchemaType } from 'mongoose';

import { GENDERS } from '../../config/options';

const userSchema = new Schema(
  {
    /** E.164 format, e.g. +919876543210 */
    phone: { type: String, required: true, unique: true },
    name: { type: String, default: '', trim: true },
    gender: { type: String, enum: GENDERS, default: null },
    age: { type: Number, default: null },
    bio: { type: String, default: '' },
    languages: { type: [String], default: [] },
    interests: { type: [String], default: [] },
    /** "<style>:<seed>", rendered by DiceBear on the client */
    avatar: { type: String, required: true },
    /**
     * Account type. A user pays to call listeners; a listener only receives calls and
     * earns. Only an admin approval turns an account into a listener.
     */
    role: { type: String, enum: ['user', 'listener'], default: 'user' },
    /**
     * What the person chose at signup. "listener" accounts wait on the review screen
     * until approved (or until they choose to continue as a user).
     */
    signupIntent: { type: String, enum: ['user', 'listener'], default: 'user' },
    isAdmin: { type: Boolean, default: false },
    /** Listener is accepting calls right now (always false for regular users) */
    isAvailable: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    lastSeenAt: { type: Date, default: null },
    /** Average of ratingSum / ratingCount, stored for sorting */
    rating: { type: Number, default: 0 },
    ratingSum: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    totalCalls: { type: Number, default: 0 },
    /**
     * The ringing/active call this user is in. Claimed with an atomic
     * "only if null" update, so a user can never be in two calls at once.
     */
    activeCallId: { type: Schema.Types.ObjectId, ref: 'Call', default: null },
    /** Kept in sync on save; only complete profiles are shown to others */
    profileComplete: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'banned', 'deleted'], default: 'active' },
    /** On deleted accounts only: keyed hash of the old phone, so blocks follow the person if they sign up again */
    deletedPhoneHash: { type: String, default: null },
    banReason: { type: String, default: null },
    bannedAt: { type: Date, default: null },

    /** Listener programme: users apply, admins approve */
    listenerStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    listenerApplication: {
      /** Private details, only admins see them */
      fullName: { type: String, default: null },
      dateOfBirth: { type: Date, default: null },
      city: { type: String, default: null },
      about: { type: String, default: null },
      voiceIntroKey: { type: String, default: null },
      voiceIntroDurationSec: { type: Number, default: null },
      appliedAt: { type: Date, default: null },
      reviewedAt: { type: Date, default: null },
      reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      /** Rejection reason shown to the applicant, or an internal note */
      note: { type: String, default: null },
    },

    /** Where a listener wants earnings paid (private) */
    payoutMethod: {
      kind: { type: String, enum: ['upi', 'bank'], default: null },
      upiId: { type: String, default: null },
      accountName: { type: String, default: null },
      accountNumber: { type: String, default: null },
      ifsc: { type: String, default: null },
    },
  },
  { timestamps: true },
);

userSchema.pre('save', function () {
  this.profileComplete = Boolean(this.name && this.gender && this.age && this.languages.length > 0);
  if (this.role === 'user') this.isAvailable = false;
});

// Matches the default sort of the discover list
userSchema.index({ status: 1, profileComplete: 1, isOnline: -1, role: 1, rating: -1 });
userSchema.index({ listenerStatus: 1, 'listenerApplication.appliedAt': 1 });
userSchema.index({ deletedPhoneHash: 1 }, { sparse: true });

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const User = model('User', userSchema);
