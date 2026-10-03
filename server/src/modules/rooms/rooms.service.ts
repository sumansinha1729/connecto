import { Types } from 'mongoose';

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
import { actsAsUser, assertListener, isListener } from '../users/accountRules';
import { User, type UserDoc } from '../users/user.model';
import { toPublicUser, type PublicUser } from '../users/user.serializer';
import { getBlockedIds, isBlockedEitherWay } from '../users/users.service';
import { agoraUid, voiceCredentials } from '../voice/agora';
import { Room, type RoomDoc, type RoomRole } from './room.model';

/*
 * Voice rooms: one Agora channel per room. The host, co-hosts and speakers can talk
 * (publisher tokens); the audience can only listen (subscriber tokens). A user is in
 * at most one room at a time. When the host leaves, the first co-host takes over;
 * without a co-host the room ends.
 *
 * Besides voice, rooms have a text chat (last CHAT_HISTORY messages kept) and
 * emoji reactions (not stored, just broadcast).
 */

/** Host + co-hosts + speakers */
export const MAX_STAGE = 10;
const CHAT_HISTORY = 50;
const CHAT_MAX_LENGTH = 200;
export const REACTIONS = ['❤️', '😂', '👏', '🙏', '🔥', '😮'] as const;
const CHAT_INTERVAL_MS = 1000;
const REACTION_INTERVAL_MS = 250;

export interface RoomParticipantDto {
  user: PublicUser;
  role: RoomRole;
  isMuted: boolean;
  handRaised: boolean;
  /** Their uid in the voice channel, so the app can show who is talking */
  voiceUid: number;
}

export interface RoomDto {
  id: string;
  title: string;
  topic: string;
  language: string;
  description: string;
  hostId: string;
  createdAt: string;
  participants: RoomParticipantDto[];
}

export interface RoomMessageDto {
  id: string;
  /** chat: a message · join: "X joined" · system: e.g. "X is now the host" */
  kind: 'chat' | 'join' | 'system';
  text: string;
  user: { id: string; name: string; avatar: string } | null;
  createdAt: string;
}

const ROLE_ORDER: Record<RoomRole, number> = { host: 0, cohost: 1, speaker: 2, listener: 3 };

async function toRoomDtos(rooms: RoomDoc[]): Promise<RoomDto[]> {
  const ids = rooms.flatMap((r) => r.participants.map((p) => p.userId));
  const users = new Map((await User.find({ _id: { $in: ids } })).map((u) => [u.id as string, u]));
  return rooms.map((room) => ({
    id: room.id,
    title: room.title,
    topic: room.topic,
    language: room.language,
    description: room.description ?? '',
    hostId: String(room.hostId),
    createdAt: room.createdAt.toISOString(),
    participants: room.participants
      .flatMap((p) => {
        const user = users.get(String(p.userId));
        return user
          ? [{ user: toPublicUser(user), role: p.role as RoomRole, isMuted: p.isMuted, handRaised: p.handRaised, voiceUid: agoraUid(user.id) }]
          : [];
      })
      .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]),
  }));
}

async function toRoomDto(room: RoomDoc): Promise<RoomDto> {
  return (await toRoomDtos([room]))[0];
}

const card = (user: UserDoc) => ({ id: user.id as string, name: user.name, avatar: user.avatar });

async function toMessageDtos(room: RoomDoc): Promise<RoomMessageDto[]> {
  const users = new Map((await User.find({ _id: { $in: room.messages.map((m) => m.userId) } })).map((u) => [u.id as string, u]));
  return room.messages.map((m) => {
    const user = users.get(String(m.userId));
    const kind = (m.kind ?? 'chat') as RoomMessageDto['kind'];
    return { id: String(m._id), kind, text: m.text, user: user ? card(user) : null, createdAt: m.createdAt.toISOString() };
  });
}

/** Pushes the latest room state to everyone inside it */
async function broadcast(roomId: string) {
  const room = await Room.findById(roomId);
  if (room && room.status === 'live') emitToRoom(roomId, 'room:updated', { room: await toRoomDto(room) });
}

/**
 * "X joined" and notes like "X is now the host": saved in the chat timeline (so people
 * who join later, and the person joining, see them too) and sent to everyone live.
 */
async function announce(roomId: string, kind: 'join' | 'system', text: string, user: UserDoc) {
  const message = { _id: new Types.ObjectId(), kind, userId: user._id, text, createdAt: new Date() };
  await Room.updateOne({ _id: roomId }, { $push: { messages: { $each: [message], $slice: -CHAT_HISTORY } } });
  emitToRoom(roomId, 'room:message', {
    roomId,
    message: { id: String(message._id), kind, text, user: card(user), createdAt: message.createdAt.toISOString() },
  });
}

const canSpeak = (role: RoomRole) => role !== 'listener';
const isModerator = (role: RoomRole) => role === 'host' || role === 'cohost';

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

/** The host or a co-host; returns their role */
function assertModerator(room: RoomDoc, user: UserDoc): RoomRole {
  const role = room.participants.find((p) => p.userId.equals(user._id))?.role as RoomRole | undefined;
  if (!role || !isModerator(role)) throw ApiError.forbidden('Only the host or a co-host can do that.');
  return role;
}

function getTarget(room: RoomDoc, userId: string) {
  const target = room.participants.find((p) => String(p.userId) === userId);
  if (!target) throw ApiError.notFound('This person has left the room.');
  return target;
}

/** One voice session at a time: rooms are off-limits while you're in (or ringing for) a call */
function assertNotInCall(me: UserDoc) {
  if (me.activeCallId) throw ApiError.conflict('Finish your call first.');
}

// ---------- Simple per-person rate limits (in memory, single server) ----------

const lastAction = new Map<string, number>();
setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [key, at] of lastAction) if (at < cutoff) lastAction.delete(key);
}, 60_000).unref();

function throttle(key: string, intervalMs: number, message: string) {
  const now = Date.now();
  if (now - (lastAction.get(key) ?? 0) < intervalMs) throw ApiError.tooManyRequests(message);
  lastAction.set(key, now);
}

/** Keeps people from sharing phone numbers or links in a public room */
export function cleanChatText(text: string): string {
  return text
    .replace(/(?:https?:\/\/|www\.)\S+/gi, '[link removed]')
    .replace(/(?:\+?\d[\s-]?){7,}\d/g, '[number hidden]')
    .trim();
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

export async function createRoom(host: UserDoc, input: { title: string; topic: string; language: string; description?: string }) {
  assertListener(host, 'host voice rooms');
  assertNotInCall(host);
  await leaveAllRooms(host.id);

  const room = new Room({
    ...input,
    description: input.description ?? '',
    hostId: host._id,
    channel: 'pending',
    participants: [{ userId: host._id, role: 'host', isMuted: false }],
  });
  room.channel = `room_${room.id}`;
  await room.save();

  addUserToRoomChannel(host.id, room.id);
  return { room: await toRoomDto(room), voice: voiceCredentials(room.channel, host.id, true), messages: [] as RoomMessageDto[] };
}

/** Host or co-host: change the title or the welcome message / rules */
export async function updateRoom(me: UserDoc, roomId: string, input: { title?: string; description?: string }) {
  const room = await getLiveRoom(roomId);
  assertModerator(room, me);
  await Room.updateOne({ _id: room._id }, { $set: input });
  await broadcast(room.id);
}

export async function joinRoom(
  me: UserDoc,
  roomId: string,
): Promise<{ room: RoomDto; voice: VoiceCredentials | null; messages: RoomMessageDto[] }> {
  if (!me.profileComplete) throw ApiError.badRequest('Complete your profile before joining rooms.');
  if (!actsAsUser(me) && !isListener(me)) throw ApiError.forbidden('Your listener application is still being reviewed.');
  assertNotInCall(me);
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
  if (!existing) await announce(room.id, 'join', 'joined', me);
  const updated = await getLiveRoom(room.id);
  const role = (existing?.role ?? 'listener') as RoomRole;
  return {
    room: await toRoomDto(updated),
    voice: voiceCredentials(updated.channel, me.id, canSpeak(role)),
    messages: await toMessageDtos(updated),
  };
}

export async function leaveRoom(me: UserDoc | string, roomId: string): Promise<void> {
  const userId = typeof me === 'string' ? me : me.id;
  const room = await Room.findOne({ _id: roomId, status: 'live' });
  if (!room) return;

  if (String(room.hostId) === userId) {
    // The first co-host takes over; otherwise the room ends
    const next = room.participants.find((p) => p.role === 'cohost');
    if (!next) {
      await endRoom(room.id);
      return;
    }
    const handedOver = await Room.updateOne(
      { _id: room._id, status: 'live', hostId: room.hostId, 'participants.userId': next.userId },
      { $set: { hostId: next.userId, 'participants.$.role': 'host' } },
    );
    if (handedOver.modifiedCount === 0) return leaveRoom(userId, roomId); // something changed meanwhile; try again
    await Room.updateOne({ _id: room._id }, { $pull: { participants: { userId } } });
    removeUserFromRoomChannel(userId, room.id);
    await broadcast(room.id);
    const newHost = await User.findById(next.userId);
    if (newHost) await announce(room.id, 'system', `${newHost.name} is now the host`, newHost);
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

/** Leaves (or hands over / ends, if hosting) every live room the user is in, except `exceptRoomId` */
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

/** Fresh voice credentials for your current role (tokens are short-lived and renewed by the app) */
export async function getRoomVoice(me: UserDoc, roomId: string): Promise<VoiceCredentials | null> {
  const room = await getLiveRoom(roomId);
  const participant = getParticipant(room, me._id);
  return voiceCredentials(room.channel, me.id, canSpeak(participant.role as RoomRole));
}

export async function setHandRaised(me: UserDoc, roomId: string, raised: boolean) {
  const room = await getLiveRoom(roomId);
  const participant = getParticipant(room, me._id);
  if (participant.role !== 'listener') throw ApiError.badRequest('You are already on stage.');
  await Room.updateOne({ _id: room._id, 'participants.userId': me._id }, { $set: { 'participants.$.handRaised': raised } });
  await broadcast(room.id);
}

export async function setMuted(me: UserDoc, roomId: string, muted: boolean) {
  const room = await getLiveRoom(roomId);
  const participant = getParticipant(room, me._id);
  if (!canSpeak(participant.role as RoomRole)) throw ApiError.badRequest('Raise your hand to speak.');
  await Room.updateOne({ _id: room._id, 'participants.userId': me._id }, { $set: { 'participants.$.isMuted': muted } });
  await broadcast(room.id);
}

/**
 * Host or co-host: invite someone on stage, or move them back to the audience.
 * Only the host can make or unmake co-hosts.
 */
export async function setRole(actor: UserDoc, roomId: string, userId: string, role: 'cohost' | 'speaker' | 'listener') {
  const room = await getLiveRoom(roomId);
  const actorRole = assertModerator(room, actor);
  if (actor.id === userId) throw ApiError.badRequest('You can’t change your own role.');
  const target = getTarget(room, userId);
  const targetRole = target.role as RoomRole;
  if (targetRole === 'host') throw ApiError.forbidden('The host’s role can’t be changed.');
  if ((role === 'cohost' || targetRole === 'cohost') && actorRole !== 'host') throw ApiError.forbidden('Only the host can change co-hosts.');
  if (role === targetRole) return;
  // A co-host may end up hosting the room, and only listeners host rooms
  if (role === 'cohost') {
    const user = await User.findById(target.userId);
    if (!user || !isListener(user)) throw ApiError.forbidden('Only listeners can be co-hosts.');
  }

  const joiningStage = !canSpeak(targetRole) && canSpeak(role);
  if (joiningStage && room.participants.filter((p) => canSpeak(p.role as RoomRole)).length >= MAX_STAGE) {
    throw ApiError.conflict(`The stage is full (${MAX_STAGE} people). Move someone to the audience first.`);
  }

  const update: Record<string, unknown> = { 'participants.$.role': role, 'participants.$.handRaised': false };
  // New speakers start muted and unmute themselves when ready; the audience is always muted
  if (joiningStage || role === 'listener') update['participants.$.isMuted'] = true;
  await Room.updateOne({ _id: room._id, 'participants.userId': target.userId }, { $set: update });

  if (canSpeak(targetRole) !== canSpeak(role)) {
    emitToUser(userId, 'room:voice', { roomId: room.id, voice: voiceCredentials(room.channel, userId, canSpeak(role)) });
  }
  await broadcast(room.id);
  if (role === 'cohost') {
    const user = await User.findById(target.userId);
    if (user) await announce(room.id, 'system', `${user.name} is now a co-host`, user);
  }
}

/** Host or co-host: mute someone on stage (they can unmute themselves again) */
export async function muteParticipant(actor: UserDoc, roomId: string, userId: string) {
  const room = await getLiveRoom(roomId);
  const actorRole = assertModerator(room, actor);
  const target = getTarget(room, userId);
  if (!canSpeak(target.role as RoomRole)) throw ApiError.badRequest('They are in the audience and already muted.');
  if (target.role === 'host' && actorRole !== 'host') throw ApiError.forbidden('You can’t mute the host.');
  await Room.updateOne({ _id: room._id, 'participants.userId': target.userId }, { $set: { 'participants.$.isMuted': true } });
  if (actor.id !== userId) emitToUser(userId, 'room:muted', { roomId: room.id, by: actor.name });
  await broadcast(room.id);
}

/** Host or co-host: remove someone; they can't rejoin this room */
export async function removeParticipant(actor: UserDoc, roomId: string, userId: string) {
  const room = await getLiveRoom(roomId);
  const actorRole = assertModerator(room, actor);
  if (actor.id === userId) throw ApiError.badRequest('You can’t remove yourself. Leave the room instead.');
  const target = getTarget(room, userId);
  if (target.role === 'host') throw ApiError.forbidden('The host can’t be removed.');
  if (target.role === 'cohost' && actorRole !== 'host') throw ApiError.forbidden('Only the host can remove a co-host.');

  await Room.updateOne({ _id: room._id }, { $pull: { participants: { userId } }, $addToSet: { removedUserIds: userId } });
  emitToUser(userId, 'room:removed', { roomId: room.id });
  removeUserFromRoomChannel(userId, room.id);
  await broadcast(room.id);
}

// ---------- Chat & reactions ----------

export async function sendMessage(me: UserDoc, roomId: string, input: string): Promise<RoomMessageDto> {
  const room = await getLiveRoom(roomId);
  getParticipant(room, me._id);
  const text = cleanChatText(input).slice(0, CHAT_MAX_LENGTH);
  if (!text) throw ApiError.badRequest('Type a message first.');
  throttle(`chat:${room.id}:${me.id}`, CHAT_INTERVAL_MS, 'You’re sending messages too fast.');

  const message = { _id: new Types.ObjectId(), userId: me._id, text, createdAt: new Date() };
  await Room.updateOne({ _id: room._id }, { $push: { messages: { $each: [message], $slice: -CHAT_HISTORY } } });
  const dto: RoomMessageDto = { id: String(message._id), kind: 'chat', text, user: card(me), createdAt: message.createdAt.toISOString() };
  emitToRoom(room.id, 'room:message', { roomId: room.id, message: dto });
  return dto;
}

/** Your own message, or anyone's if you're the host or a co-host */
export async function deleteMessage(me: UserDoc, roomId: string, messageId: string) {
  const room = await getLiveRoom(roomId);
  const message = room.messages.find((m) => String(m._id) === messageId);
  if (!message) return;
  if (!message.userId.equals(me._id)) assertModerator(room, me);
  await Room.updateOne({ _id: room._id }, { $pull: { messages: { _id: message._id } } });
  emitToRoom(room.id, 'room:message-deleted', { roomId: room.id, messageId });
}

export async function react(me: UserDoc, roomId: string, emoji: string) {
  if (!(REACTIONS as readonly string[]).includes(emoji)) throw ApiError.badRequest('Unknown reaction.');
  const room = await getLiveRoom(roomId);
  getParticipant(room, me._id);
  throttle(`react:${room.id}:${me.id}`, REACTION_INTERVAL_MS, 'Slow down a little.');
  emitToRoom(room.id, 'room:reaction', { roomId: room.id, userId: me.id, emoji });
}

// ---------- Restarts ----------

/** Rooms can't outlive a restart (nobody's socket is in them any more) */
export async function endRoomsOnStartup() {
  await Room.updateMany({ status: 'live' }, { status: 'ended', endedAt: new Date() });
}
