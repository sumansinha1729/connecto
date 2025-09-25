import type { Gender, UserRole } from '@/types';
import type { DbRoom, DbUser } from './db';

type SeedUser = [
  name: string,
  gender: Gender,
  age: number,
  role: UserRole,
  online: boolean,
  languages: string[],
  interests: string[],
  bio: string,
  rating: number,
  totalCalls: number,
];

const SEED_USERS: SeedUser[] = [
  ['Ananya', 'female', 24, 'listener', true, ['Hindi', 'English'], ['Breakups', 'Relationships', 'Music'], 'Good listener, no judgement. Tell me about your day ☕', 4.8, 1240],
  ['Rohan', 'male', 27, 'listener', true, ['Hindi', 'English'], ['Career', 'Stress', 'Cricket'], 'Software engineer by day, your late-night buddy by night.', 4.6, 830],
  ['Meera', 'female', 29, 'listener', true, ['Tamil', 'English'], ['Family', 'Stress', 'Spirituality'], 'Counselling student. Here to listen, not to fix.', 4.9, 2105],
  ['Kabir', 'male', 25, 'listener', true, ['Hindi', 'Punjabi'], ['Gaming', 'Movies', 'Just chatting'], 'Bollywood trivia champion. Let’s talk about anything.', 4.4, 410],
  ['Ishita', 'female', 22, 'listener', true, ['Bengali', 'Hindi', 'English'], ['Books', 'Loneliness', 'Music'], 'Poetry, rains and long conversations.', 4.7, 960],
  ['Arjun', 'male', 31, 'listener', false, ['Telugu', 'English'], ['Career', 'Fitness'], 'Gym, careers and life advice.', 4.5, 640],
  ['Sneha', 'female', 26, 'listener', true, ['Marathi', 'Hindi'], ['Relationships', 'Breakups', 'Travel'], 'Been through it all. You are not alone 💜', 4.9, 1780],
  ['Vikram', 'male', 28, 'listener', true, ['Kannada', 'English', 'Hindi'], ['Stress', 'Career', 'Books'], 'Calm voice, honest opinions.', 4.3, 290],
  ['Priya', 'female', 23, 'listener', false, ['Malayalam', 'English'], ['Music', 'Movies', 'Just chatting'], 'Music is my therapy. What is yours?', 4.6, 520],
  ['Zoya', 'female', 25, 'listener', true, ['Urdu', 'Hindi'], ['Loneliness', 'Spirituality', 'Books'], 'Shayari and sukoon.', 4.8, 1105],
  ['Dev', 'male', 30, 'listener', true, ['Gujarati', 'Hindi', 'English'], ['Family', 'Career', 'Travel'], 'Dad jokes included at no extra cost.', 4.2, 210],
  ['Tara', 'female', 27, 'listener', true, ['Odia', 'Hindi', 'English'], ['Stress', 'Fitness', 'Relationships'], 'Yoga teacher. Breathe in, talk it out.', 4.7, 700],
  ['Neel', 'male', 21, 'user', true, ['Bengali', 'English'], ['Gaming', 'Cricket'], 'College student, always up for a chat.', 0, 35],
  ['Riya', 'female', 20, 'user', true, ['Hindi', 'English'], ['Movies', 'Music'], 'New here 👋', 0, 12],
  ['Aditya', 'male', 24, 'user', false, ['Tamil', 'English'], ['Career', 'Gaming'], 'Looking for people to talk tech with.', 0, 58],
  ['Pooja', 'female', 28, 'user', true, ['Telugu', 'Hindi'], ['Family', 'Relationships'], 'Just need someone to talk to sometimes.', 0, 22],
  ['Sam', 'other', 26, 'user', true, ['English', 'Hindi'], ['Books', 'Travel', 'Just chatting'], 'Introvert who loves deep conversations.', 0, 40],
  ['Farhan', 'male', 29, 'user', true, ['Urdu', 'Hindi', 'English'], ['Cricket', 'Movies'], 'Cricket se zyada kuch nahi.', 0, 77],
];

const AVATAR_STYLES = ['adventurer', 'lorelei', 'notionists', 'micah'];

export function seedUsers(): Record<string, DbUser> {
  const users: Record<string, DbUser> = {};
  SEED_USERS.forEach(([name, gender, age, role, online, languages, interests, bio, rating, totalCalls], i) => {
    const id = `u_seed_${i + 1}`;
    users[id] = {
      id,
      phone: `90000000${String(i + 1).padStart(2, '0')}`,
      name,
      gender,
      age,
      bio,
      languages,
      interests,
      avatar: `${AVATAR_STYLES[i % AVATAR_STYLES.length]}:${name}`,
      role,
      isOnline: online,
      isAvailable: online,
      rating,
      ratingCount: Math.round(totalCalls * 0.6),
      totalCalls,
      createdAt: new Date(Date.now() - (i + 5) * 86400_000).toISOString(),
      profileComplete: true,
    };
  });
  return users;
}

const SEED_ROOMS: [title: string, topic: string, language: string, hostIndex: number, speakers: number[], listeners: number[]][] = [
  ['Heartbreak hotel 💔 talk it out', 'Breakups', 'Hindi', 7, [1, 4], [13, 14, 16, 17, 18]],
  ['Late night chill & music', 'Late night talks', 'English', 5, [10], [2, 13, 17]],
  ['Career doubts? Ask anything', 'Career', 'English', 2, [6, 8], [15, 16, 18, 13]],
  ['IPL discussion 🏏', 'Cricket', 'Hindi', 18, [4], [13, 15]],
];

export function seedRooms(): Record<string, DbRoom> {
  const rooms: Record<string, DbRoom> = {};
  const userId = (index: number) => `u_seed_${index}`;
  SEED_ROOMS.forEach(([title, topic, language, host, speakers, listeners], i) => {
    const id = `r_seed_${i + 1}`;
    rooms[id] = {
      id,
      title,
      topic,
      language,
      hostId: userId(host),
      createdAt: new Date(Date.now() - (i + 1) * 12 * 60_000).toISOString(),
      participants: [
        { userId: userId(host), role: 'host', isMuted: false, handRaised: false },
        ...speakers.map((s) => ({ userId: userId(s), role: 'speaker' as const, isMuted: false, handRaised: false })),
        ...listeners.map((l) => ({ userId: userId(l), role: 'listener' as const, isMuted: true, handRaised: false })),
      ],
    };
  });
  return rooms;
}
