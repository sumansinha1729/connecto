import { model, Schema, Types, type HydratedDocument, type InferSchemaType } from 'mongoose';

/** host: owns the room · cohost: helps moderate, takes over if the host leaves · speaker · listener (audience) */
export const ROOM_ROLES = ['host', 'cohost', 'speaker', 'listener'] as const;
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

/** The room's chat timeline (messages, "X joined", system notes); only the most recent are kept */
const messageSchema = new Schema(
  {
    kind: { type: String, enum: ['chat', 'join', 'system'], default: 'chat' },
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: true },
);

const roomSchema = new Schema(
  {
    title: { type: String, required: true },
    topic: { type: String, required: true },
    language: { type: String, required: true },
    /** Welcome message / room rules, pinned at the top of the room */
    description: { type: String, default: '' },
    hostId: { type: Types.ObjectId, ref: 'User', required: true },
    /** Agora channel name */
    channel: { type: String, required: true },
    status: { type: String, enum: ['live', 'ended'], default: 'live' },
    participants: { type: [participantSchema], default: [] },
    messages: { type: [messageSchema], default: [] },
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
