import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';

import type { Person } from '../api/types';
import { avatarUrl, formatPhone } from '../lib/format';

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

// ---------- Layout ----------

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Card({ title, right, children, className }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-2xl border border-border bg-surface', className)}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {right}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

type Tone = 'default' | 'primary' | 'success' | 'warning' | 'danger';

const TONE_TEXT: Record<Tone, string> = {
  default: 'text-text',
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

export function Stat({ label, value, hint, tone = 'default', icon, to }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone; icon?: ReactNode; to?: string }) {
  const body = (
    <div className={cx('h-full rounded-2xl border border-border bg-surface p-4', to && 'transition hover:border-primary/60')}>
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted">
        {label}
        {icon && <span className="text-faint">{icon}</span>}
      </div>
      <div className={cx('tabular mt-2 text-2xl font-semibold', TONE_TEXT[tone])}>{value}</div>
      {hint && <div className="mt-1 text-xs text-faint">{hint}</div>}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

// ---------- Small pieces ----------

const BADGE: Record<Tone, string> = {
  default: 'bg-surface-2 text-muted',
  primary: 'bg-primary/15 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
};

export function Badge({ tone = 'default', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', BADGE[tone])}>{children}</span>;
}

export function Avatar({ avatar, size = 32 }: { avatar: string; size?: number }) {
  return <img src={avatarUrl(avatar, size * 2)} alt="" width={size} height={size} className="shrink-0 rounded-full bg-surface-2" style={{ width: size, height: size }} />;
}

/** Avatar + name (+ phone), linking to the person's page */
export function PersonCell({ person, showPhone = true }: { person: Person | null; showPhone?: boolean }) {
  if (!person) return <span className="text-faint">Deleted user</span>;
  return (
    <Link to={`/users/${person.id}`} className="group flex min-w-0 items-center gap-2.5">
      <Avatar avatar={person.avatar} />
      <span className="min-w-0">
        <span className="block truncate font-medium group-hover:text-primary">{person.name || 'No name yet'}</span>
        {showPhone && <span className="tabular block text-xs text-faint">{formatPhone(person.phone)}</span>}
      </span>
    </Link>
  );
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const BUTTON: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark',
  secondary: 'border border-border bg-surface-2 text-text hover:border-primary/60',
  danger: 'bg-danger text-white hover:bg-danger/85',
  ghost: 'text-muted hover:bg-surface-2 hover:text-text',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  children,
  className,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
        BUTTON[variant],
        className,
      )}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (value: T) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-border bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx('rounded-lg px-3 py-1.5 text-sm font-medium transition', value === o.value ? 'bg-primary text-white' : 'text-muted hover:text-text')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- States ----------

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
      <Loader2 size={16} className="animate-spin" /> {label}
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <Inbox size={28} className="text-faint" />
      <div className="text-sm font-medium">{title}</div>
      {hint && <div className="max-w-sm text-xs text-faint">{hint}</div>}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
      <AlertTriangle size={18} />
      <span className="flex-1">{error instanceof Error ? error.message : 'Something went wrong.'}</span>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

// ---------- Tables ----------

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-faint">
            {head.map((h, i) => (
              <th key={i} className="px-5 pb-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={cx('px-5 py-3 align-middle', className)}>{children}</td>
);
