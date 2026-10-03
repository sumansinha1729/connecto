const IST = 'Asia/Kolkata';

export const formatNumber = (n: number) => n.toLocaleString('en-IN');

/** 120050 paise → "₹1,200.50" (whole rupees when there are no paise) */
export function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: rupees % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** 75 → "1:15", 3725 → "1:02:05" */
export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { timeZone: IST, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { timeZone: IST, day: 'numeric', month: 'short', year: 'numeric' });
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const sec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`;
  if (sec < 7 * 86400) return `${Math.floor(sec / 86400)} d ago`;
  return formatDate(iso);
}

/** "+919876543210" → "98765 43210" */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/^\+91/, '');
  return digits.length === 10 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : phone;
}

/** Chart labels: "14" → "2 PM" for hours, "2026-10-03" → "3 Oct" for days */
export function bucketLabel(key: string): string {
  if (/^\d{2}$/.test(key)) {
    const h = Number(key);
    return h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
  }
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short' });
}

export const titleCase = (text: string) => text.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Same avatar images as the app (DiceBear, "<style>:<seed>") */
export function avatarUrl(avatar: string, size = 96): string {
  const [style, seed] = avatar.includes(':') ? avatar.split(':') : ['adventurer', avatar];
  return `https://api.dicebear.com/9.x/${style}/png?seed=${encodeURIComponent(seed)}&size=${size}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}
