/**
 * Each room topic gets its own emoji and background, so rooms look different
 * from each other at a glance. Keys match ROOM_TOPICS (constants/options).
 */
export interface RoomTheme {
  emoji: string;
  /** Background gradient, top → bottom */
  colors: readonly [string, string];
  /** Accent for chips and highlights */
  accent: string;
}

const THEMES: Record<string, RoomTheme> = {
  'Just chatting': { emoji: '💬', colors: ['#33246B', '#120E24'], accent: '#A78BFA' },
  Breakups: { emoji: '💔', colors: ['#5C1A33', '#140C1C'], accent: '#FB7185' },
  Career: { emoji: '💼', colors: ['#16406A', '#0D1424'], accent: '#60A5FA' },
  Stress: { emoji: '🌿', colors: ['#15513F', '#0C1A18'], accent: '#34D399' },
  Relationships: { emoji: '💞', colors: ['#66205E', '#170C1E'], accent: '#F472B6' },
  Music: { emoji: '🎵', colors: ['#4C1D95', '#160D2B'], accent: '#C084FC' },
  Movies: { emoji: '🎬', colors: ['#5E2E14', '#190F0A'], accent: '#FB923C' },
  Cricket: { emoji: '🏏', colors: ['#14532D', '#0B1A12'], accent: '#4ADE80' },
  'Late night talks': { emoji: '🌙', colors: ['#1E2563', '#0A0C20'], accent: '#818CF8' },
};

const DEFAULT_THEME = THEMES['Just chatting'];

export const roomTheme = (topic: string): RoomTheme => THEMES[topic] ?? DEFAULT_THEME;
