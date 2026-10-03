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

/** "1h 20m", "45m", "30s": total talk time */
export function formatTalkTime(totalSec: number): string {
  if (totalSec < 60) return `${Math.max(0, Math.round(totalSec))}s`;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** Section titles in call history: "Today", "Yesterday", "Mon, 29 Sep" */
export function formatDayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatCoins(amount: number, withSign = false): string {
  const abs = Math.abs(amount).toLocaleString('en-IN');
  if (!withSign) return abs;
  return amount >= 0 ? `+${abs}` : `-${abs}`;
}

/** "+919876543210" or "9876543210" → "+91 ••••••3210" */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length < 4) return phone;
  return `+91 ${'•'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}

const GENDER_LABEL: Record<Gender, string> = { male: 'M', female: 'F', other: 'Other' };

/** "24 · F" */
export function formatAgeGender(age: number | null, gender: Gender | null): string {
  return [age, gender ? GENDER_LABEL[gender] : null].filter(Boolean).join(' · ');
}

/** 12345 paise → "₹123.45" (drops ".00" for whole rupees) */
export function formatRupees(paise: number, withSign = false): string {
  const rupees = Math.abs(paise) / 100;
  const text = `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: rupees % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
  if (!withSign) return paise < 0 ? `-${text}` : text;
  return paise >= 0 ? `+${text}` : `-${text}`;
}

/** "1996-04-15" → "15/04/1996" */
export function formatDateOfBirth(iso: string | null): string | null {
  if (!iso) return null;
  const [yyyy, mm, dd] = iso.split('-');
  return `${dd}/${mm}/${yyyy}`;
}
