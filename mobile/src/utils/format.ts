import type { Gender } from '@/types';

export function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "2m 05s" style used in call history */
export function formatShortDuration(totalSec: number): string {
  if (totalSec <= 0) return '0s';
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function formatRelativeTime(iso: string): string {
  const diffSec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function formatCoins(amount: number, withSign = false): string {
  const abs = Math.abs(amount).toLocaleString('en-IN');
  if (!withSign) return abs;
  return amount >= 0 ? `+${abs}` : `-${abs}`;
}

export function maskPhone(phone: string): string {
  if (phone.length < 4) return phone;
  return `+91 ${'•'.repeat(phone.length - 4)}${phone.slice(-4)}`;
}

const GENDER_LABEL: Record<Gender, string> = { male: 'M', female: 'F', other: 'Other' };

/** "24 · F" */
export function formatAgeGender(age: number | null, gender: Gender | null): string {
  return [age, gender ? GENDER_LABEL[gender] : null].filter(Boolean).join(' · ');
}
