import type { Room } from '@/types';
import type { RoomService } from '../contracts';
import { realtime } from '../realtime';
import { ApiError } from '@/utils/errors';
import { createId, pickRandom } from '@/utils/id';
import type { DbRoom, DbState } from './db';
import { isBlockedEitherWay, latency, requireMe, toPublicUser } from './helpers';

function toRoom(db: DbState, room: DbRoom): Room {
  return {
    id: room.id,
    title: room.title,
    topic: room.topic,
    language: room.language,
    hostId: room.hostId,
    createdAt: room.createdAt,
    participants: room.participants.flatMap((p) => {
      const user = db.users[p.userId];
      return user ? [{ user: toPublicUser(user), role: p.role, isMuted: p.isMuted, handRaised: p.handRaised }] : [];
    }),
  };
}

function getRoomOrThrow(db: DbState, roomId: string): DbRoom {
  const room = db.rooms[roomId];
  if (!room) throw new ApiError('NOT_FOUND', 'This room has ended.');
  return room;
}

function getParticipant(room: DbRoom, userId: string) {
  const participant = room.participants.find((p) => p.userId === userId);
  if (!participant) throw new ApiError('NOT_FOUND', 'You are not in this room.');
  return participant;
}

function broadcast(db: DbState, room: DbRoom) {
  realtime.emit('room:updated', { room: toRoom(db, room) });
}

// ---------- Simulated activity of the other people in the room ----------

let activity: { roomId: string; timers: ReturnType<typeof setInterval>[] } | null = null;

function stopActivity() {
  activity?.timers.forEach(clearInterval);
  activity = null;
}

function startActivity(db: DbState, roomId: string, meId: string) {
  stopActivity();
  const room = () => db.rooms[roomId];

  const speaking = setInterval(() => {
    const r = room();
    if (!r) return stopActivity();
    const candidates = r.participants.filter((p) => p.role !== 'listener' && !p.isMuted && p.userId !== meId);
    const count = Math.floor(Math.random() * 3);
    const userIds = [...candidates]
      .sort(() => Math.random() - 0.5)
      .slice(0, count)
      .map((p) => p.userId);
    realtime.emit('room:speaking', { roomId, userIds });
  }, 1500);

  const churn = setInterval(() => {
    const r = room();
    if (!r) return stopActivity();
    const listeners = r.participants.filter((p) => p.role === 'listener' && p.userId !== meId);
    if (Math.random() < 0.5 || listeners.length < 2) {
      const newcomer = pickRandom(
        Object.values(db.users).filter(
          (u) => u.isOnline && u.profileComplete && u.id !== meId && !r.participants.some((p) => p.userId === u.id),
        ),
      );
      if (newcomer) r.participants.push({ userId: newcomer.id, role: 'listener', isMuted: true, handRaised: false });
    } else {
      const leaving = pickRandom(listeners);
      if (leaving) r.participants = r.participants.filter((p) => p.userId !== leaving.userId);
    }
    broadcast(db, r);
  }, 9000);

  const timers = [speaking, churn];

  // When you host, people in the audience occasionally ask to speak
  if (room()?.hostId === meId) {
    timers.push(
      setInterval(() => {
        const r = room();
        if (!r) return stopActivity();
        const listener = pickRandom(r.participants.filter((p) => p.role === 'listener' && !p.handRaised && p.userId !== meId));
        if (listener) {
          listener.handRaised = true;
          broadcast(db, r);
        }
      }, 12_000),
    );
  }

  activity = { roomId, timers };
}

export const mockRooms: RoomService = {
  async listRooms() {
    await latency();
    const { db, me } = await requireMe();
    return Object.values(db.rooms)
      .filter((r) => !isBlockedEitherWay(db, me.id, r.hostId))
      .sort((a, b) => b.participants.length - a.participants.length)
      .map((r) => toRoom(db, r));
  },

  async createRoom({ title, topic, language }) {
    await latency(400, 700);
    const { db, me } = await requireMe();
    if (title.trim().length < 3) throw new ApiError('VALIDATION', 'Give your room a title (at least 3 characters).');
    const room: DbRoom = {
      id: createId('room'),
      title: title.trim(),
      topic,
      language,
      hostId: me.id,
      createdAt: new Date().toISOString(),
      participants: [{ userId: me.id, role: 'host', isMuted: false, handRaised: false }],
    };
    db.rooms[room.id] = room;
    return toRoom(db, room);
  },

  async joinRoom(roomId) {
    await latency(300, 600);
    const { db, me } = await requireMe();
    const room = getRoomOrThrow(db, roomId);
    if (!room.participants.some((p) => p.userId === me.id)) {
      room.participants.push({ userId: me.id, role: 'listener', isMuted: true, handRaised: false });
    }
    startActivity(db, roomId, me.id);
    broadcast(db, room);
    return toRoom(db, room);
  },

  async leaveRoom(roomId) {
    const { db, me } = await requireMe();
    if (activity?.roomId === roomId) stopActivity();
    const room = db.rooms[roomId];
    if (!room) return;
    if (room.hostId === me.id) {
      delete db.rooms[roomId];
      realtime.emit('room:closed', { roomId });
    } else {
      room.participants = room.participants.filter((p) => p.userId !== me.id);
      broadcast(db, room);
    }
  },

  async setHandRaised(roomId, raised) {
    const { db, me } = await requireMe();
    const room = getRoomOrThrow(db, roomId);
    const participant = getParticipant(room, me.id);
    participant.handRaised = raised;
    broadcast(db, room);

    // The simulated host usually invites you up after a few seconds
    if (raised && room.hostId !== me.id && Math.random() < 0.8) {
      setTimeout(() => {
        if (!db.rooms[roomId] || !participant.handRaised) return;
        participant.role = 'speaker';
        participant.handRaised = false;
        participant.isMuted = true;
        broadcast(db, room);
      }, 3000 + Math.random() * 3000);
    }
  },

  async setMuted(roomId, muted) {
    const { db, me } = await requireMe();
    const room = getRoomOrThrow(db, roomId);
    const participant = getParticipant(room, me.id);
    if (participant.role === 'listener') throw new ApiError('VALIDATION', 'Raise your hand to speak.');
    participant.isMuted = muted;
    broadcast(db, room);
  },

  async setRole(roomId, userId, role) {
    const { db, me } = await requireMe();
    const room = getRoomOrThrow(db, roomId);
    if (room.hostId !== me.id) throw new ApiError('VALIDATION', 'Only the host can do that.');
    const participant = getParticipant(room, userId);
    participant.role = role;
    participant.handRaised = false;
    participant.isMuted = role === 'listener' ? true : false;
    broadcast(db, room);
  },

  async removeParticipant(roomId, userId) {
    const { db, me } = await requireMe();
    const room = getRoomOrThrow(db, roomId);
    if (room.hostId !== me.id) throw new ApiError('VALIDATION', 'Only the host can do that.');
    room.participants = room.participants.filter((p) => p.userId !== userId);
    broadcast(db, room);
  },
};
