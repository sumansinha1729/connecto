import { model, Schema, Types, type HydratedDocument, type InferSchemaType } from 'mongoose';

export const ROOM_ROLES = ['host', 'speaker', 'listener'] as const;
export type RoomRole = (typeof ROOM_ROLES)[number];

const participantSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ROOM_ROLES, required: true },
    isMuted: { type: Boolean, default: true },
    handRaised: { type: Boolean, default: false },
    joinedAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const roomSchema = new Schema(
  {
    title: { type: String, required: true },
    topic: { type: String, required: true },
    language: { type: String, required: true },
    hostId: { type: Types.ObjectId, ref: 'User', required: true },
    /** Agora channel name */
    channel: { type: String, required: true },
    status: { type: String, enum: ['live', 'ended'], default: 'live' },
    participants: { type: [participantSchema], default: [] },
    /** Removed by the host; can't rejoin */
    removedUserIds: { type: [Types.ObjectId], default: [] },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

roomSchema.index({ status: 1, createdAt: -1 });
roomSchema.index({ 'participants.userId': 1, status: 1 });

export type RoomDoc = HydratedDocument<InferSchemaType<typeof roomSchema>>;
export const Room = model('Room', roomSchema);
