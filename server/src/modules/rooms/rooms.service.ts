import type { Types } from 'mongoose';

import { env } from '../../config/env';
import type { VoiceCredentials } from '../../realtime/events';
import {
  addUserToRoomChannel,
  closeRoomChannel,
  emitToRoom,
  emitToUser,
  removeUserFromRoomChannel,
} from '../../realtime/io';
import { ApiError } from '../../utils/ApiError';
import { User, type UserDoc } from '../users/user.model';
import { toPublicUser, type PublicUser } from '../users/user.serializer';
import { getBlockedIds, isBlockedEitherWay } from '../users/users.service';
import { voiceCredentials } from '../voice/agora';
import { Room, type RoomDoc, type RoomRole } from './room.model';

/*
 * Voice rooms: one Agora channel per room. The host and speakers can talk
 * (publisher tokens); listeners can only hear (subscriber tokens). A user is
 * in at most one room at a time. When the host leaves, the room ends.
 */

export interface RoomDto {
  id: string;
  title: string;
  topic: string;
  language: string;
  hostId: string;
  createdAt: string;
  participants: { user: PublicUser; role: RoomRole; isMuted: boolean; handRaised: boolean }[];
}

async function toRoomDtos(rooms: RoomDoc[]): Promise<RoomDto[]> {
  const ids = rooms.flatMap((r) => r.participants.map((p) => p.userId));
  const users = new Map((await User.find({ _id: { $in: ids } })).map((u) => [u.id as string, u]));
  return rooms.map((room) => ({
    id: room.id,
    title: room.title,
    topic: room.topic,
    language: room.language,
    hostId: String(room.hostId),
    createdAt: room.createdAt.toISOString(),
    participants: room.participants.flatMap((p) => {
      const user = users.get(String(p.userId));
      return user ? [{ user: toPublicUser(user), role: p.role as RoomRole, isMuted: p.isMuted, handRaised: p.handRaised }] : [];
    }),
  }));
}

async function toRoomDto(room: RoomDoc): Promise<RoomDto> {
  return (await toRoomDtos([room]))[0];
}

/** Pushes the latest room state to everyone inside it */
async function broadcast(roomId: string) {
  const room = await Room.findById(roomId);
  if (room && room.status === 'live') emitToRoom(roomId, 'room:updated', { room: await toRoomDto(room) });
}

const canSpeak = (role: RoomRole) => role !== 'listener';

async function getLiveRoom(roomId: string): Promise<RoomDoc> {
  const room = await Room.findOne({ _id: roomId, status: 'live' });
  if (!room) throw ApiError.notFound('This room has ended.');
  return room;
}

function getParticipant(room: RoomDoc, userId: Types.ObjectId) {
  const participant = room.participants.find((p) => p.userId.equals(userId));
  if (!participant) throw ApiError.badRequest('You are not in this room.');
  return participant;
}

function assertHost(room: RoomDoc, user: UserDoc) {
  if (!room.hostId.equals(user._id)) throw ApiError.forbidden('Only the host can do that.');
}

// ---------- Listing & lifecycle ----------

export async function listRooms(me: UserDoc): Promise<RoomDto[]> {
  const blocked = await getBlockedIds(me._id);
  const rooms = await Room.find({ status: 'live', hostId: { $nin: blocked } }).sort({ createdAt: -1 }).limit(100);
  const dtos = await toRoomDtos(rooms);
  return dtos.sort((a, b) => b.participants.length - a.participants.length);
}

export async function getRoom(me: UserDoc, roomId: string): Promise<RoomDto> {
  const room = await getLiveRoom(roomId);
  if (await isBlockedEitherWay(me._id, room.hostId)) throw ApiError.notFound('This room has ended.');
  return toRoomDto(room);
}

export async function createRoom(host: UserDoc, input: { title: string; topic: string; language: string }) {
  if (!host.profileComplete) throw ApiError.badRequest('Complete your profile before starting a room.');
  await leaveAllRooms(host.id);

  const room = new Room({
    ...input,
    hostId: host._id,
    channel: 'pending',
    participants: [{ userId: host._id, role: 'host', isMuted: false }],
  });
  room.channel = `room_${room.id}`;
  await room.save();

  addUserToRoomChannel(host.id, room.id);
  return { room: await toRoomDto(room), voice: voiceCredentials(room.channel, host.id, true) };
}

export async function joinRoom(me: UserDoc, roomId: string): Promise<{ room: RoomDto; voice: VoiceCredentials | null }> {
  if (!me.profileComplete) throw ApiError.badRequest('Complete your profile before joining rooms.');
  const room = await getLiveRoom(roomId);
  if (await isBlockedEitherWay(me._id, room.hostId)) throw ApiError.notFound('This room has ended.');
  if (room.removedUserIds.some((id) => String(id) === me.id)) throw ApiError.forbidden('The host removed you from this room.');

  const existing = room.participants.find((p) => p.userId.equals(me._id));
  if (!existing) {
    await leaveAllRooms(me.id, room.id);
    const added = await Room.updateOne(
      {
        _id: room._id,
        status: 'live',
        'participants.userId': { $ne: me._id },
        $expr: { $lt: [{ $size: '$participants' }, env.ROOM_MAX_PARTICIPANTS] },
      },
      { $push: { participants: { userId: me._id, role: 'listener', isMuted: true, handRaised: false } } },
    );
    if (added.modifiedCount === 0 && !(await Room.exists({ _id: room._id, 'participants.userId': me._id }))) {
      throw ApiError.conflict('This room is full.');
    }
  }

  addUserToRoomChannel(me.id, room.id);
  await broadcast(room.id);
  const updated = await getLiveRoom(room.id);
  const role = (existing?.role ?? 'listener') as RoomRole;
  return { room: await toRoomDto(updated), voice: voiceCredentials(updated.channel, me.id, canSpeak(role)) };
}

export async function leaveRoom(me: UserDoc | string, roomId: string) {
  const userId = typeof me === 'string' ? me : me.id;
  const room = await Room.findOne({ _id: roomId, status: 'live' });
  if (!room) return;

  if (String(room.hostId) === userId) {
    await endRoom(room.id);
    return;
  }
  await Room.updateOne({ _id: room._id }, { $pull: { participants: { userId } } });
  removeUserFromRoomChannel(userId, room.id);
  await broadcast(room.id);
}

export async function endRoom(roomId: string) {
  const ended = await Room.findOneAndUpdate({ _id: roomId, status: 'live' }, { status: 'ended', endedAt: new Date() });
  if (!ended) return;
  emitToRoom(roomId, 'room:closed', { roomId });
  closeRoomChannel(roomId);
}

/** Leaves (or ends, if hosting) every live room the user is in, except `exceptRoomId` */
export async function leaveAllRooms(userId: string, exceptRoomId?: string) {
  const rooms = await Room.find({ status: 'live', 'participants.userId': userId }, { _id: 1 });
  for (const room of rooms) {
    if (String(room._id) !== exceptRoomId) await leaveRoom(userId, String(room._id));
  }
}

export async function liveRoomIdsForUser(userId: string): Promise<string[]> {
  const rooms = await Room.find({ status: 'live', 'participants.userId': userId }, { _id: 1 }).lean();
  return rooms.map((r) => String(r._id));
}

// ---------- In-room actions ----------

export async function setHandRaised(me: UserDoc, roomId: string, raised: boolean) {
  const room = await getLiveRoom(roomId);
  const participant = getParticipant(room, me._id);
  if (participant.role !== 'listener') throw ApiError.badRequest('You are already on stage.');
  await Room.updateOne(
    { _id: room._id, 'participants.userId': me._id },
    { $set: { 'participants.$.handRaised': raised } },
  );
  await broadcast(room.id);
}

export async function setMuted(me: UserDoc, roomId: string, muted: boolean) {
  const room = await getLiveRoom(roomId);
  const participant = getParticipant(room, me._id);
  if (!canSpeak(participant.role as RoomRole)) throw ApiError.badRequest('Raise your hand to speak.');
  await Room.updateOne({ _id: room._id, 'participants.userId': me._id }, { $set: { 'participants.$.isMuted': muted } });
  await broadcast(room.id);
}

/** Host only: invite someone on stage, or move them back to the audience */
export async function setRole(host: UserDoc, roomId: string, userId: string, role: 'speaker' | 'listener') {
  const room = await getLiveRoom(roomId);
  assertHost(room, host);
  if (host.id === userId) throw ApiError.badRequest('You are the host.');
  const target = room.participants.find((p) => String(p.userId) === userId);
  if (!target) throw ApiError.notFound('This person has left the room.');

  await Room.updateOne(
    { _id: room._id, 'participants.userId': target.userId },
    // New speakers start muted and unmute themselves when ready
    { $set: { 'participants.$.role': role, 'participants.$.handRaised': false, 'participants.$.isMuted': true } },
  );
  emitToUser(userId, 'room:voice', { roomId: room.id, voice: voiceCredentials(room.channel, userId, canSpeak(role)) });
  await broadcast(room.id);
}

/** Host only: remove someone; they can't rejoin this room */
export async function removeParticipant(host: UserDoc, roomId: string, userId: string) {
  const room = await getLiveRoom(roomId);
  assertHost(room, host);
  if (host.id === userId) throw ApiError.badRequest('You can’t remove yourself. Leave the room instead.');
  if (!room.participants.some((p) => String(p.userId) === userId)) throw ApiError.notFound('This person has left the room.');

  await Room.updateOne({ _id: room._id }, { $pull: { participants: { userId } }, $addToSet: { removedUserIds: userId } });
  emitToUser(userId, 'room:removed', { roomId: room.id });
  removeUserFromRoomChannel(userId, room.id);
  await broadcast(room.id);
}

// ---------- Restarts ----------

/** Rooms can't outlive a restart (nobody's socket is in them any more) */
export async function endRoomsOnStartup() {
  await Room.updateMany({ status: 'live' }, { status: 'ended', endedAt: new Date() });
}
