import { CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore, type FormEvent } from 'react';

import { Button, cx } from './ui';

/*
 * Promise-based dialogs and toasts, callable from anywhere:
 *   if (await askConfirm({ title: 'Approve?' })) …
 *   const values = await askForm({ title: 'Reject', fields: [{ name: 'note', label: 'Reason' }] });
 *   toast('Saved');
 */

export interface Field {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'checkbox';
  placeholder?: string;
  /** Minimum length for text, ignored for checkboxes */
  minLength?: number;
  hint?: string;
}

interface DialogRequest {
  title: string;
  message?: string;
  confirmText?: string;
  destructive?: boolean;
  fields?: Field[];
  resolve: (values: Record<string, string | boolean> | null) => void;
}

function createStore<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      listeners.forEach((l) => l());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const dialogStore = createStore<DialogRequest | null>(null);
const toastStore = createStore<{ id: number; text: string; error: boolean }[]>([]);

export function askConfirm(options: Omit<DialogRequest, 'resolve' | 'fields'>): Promise<boolean> {
  return new Promise((resolve) => dialogStore.set({ ...options, resolve: (v) => resolve(v !== null) }));
}

export function askForm(options: Omit<DialogRequest, 'resolve'> & { fields: Field[] }): Promise<Record<string, string | boolean> | null> {
  return new Promise((resolve) => dialogStore.set({ ...options, resolve }));
}

let toastId = 1;
export function toast(text: string, error = false) {
  const id = toastId++;
  toastStore.set([...toastStore.get(), { id, text, error }]);
  setTimeout(() => toastStore.set(toastStore.get().filter((t) => t.id !== id)), error ? 6000 : 3500);
}

// ---------- Hosts (mounted once in App) ----------

export function DialogHost() {
  const dialog = useSyncExternalStore(dialogStore.subscribe, dialogStore.get);
  const [values, setValues] = useState<Record<string, string | boolean>>({});

  useEffect(() => {
    setValues(Object.fromEntries((dialog?.fields ?? []).map((f) => [f.name, f.type === 'checkbox' ? false : ''])));
  }, [dialog]);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!dialog) return null;

  function close(result: Record<string, string | boolean> | null) {
    dialog!.resolve(result);
    dialogStore.set(null);
  }

  const invalid = (dialog.fields ?? []).some((f) => {
    const v = values[f.name];
    if (f.type === 'checkbox') return false;
    const text = String(v ?? '').trim();
    if (f.type === 'number') return text === '' || Number.isNaN(Number(text)) || Number(text) === 0;
    return text.length < (f.minLength ?? 0);
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!invalid) close(values);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && close(null)}>
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl" role="dialog" aria-modal="true">
        <h2 className="text-lg font-semibold">{dialog.title}</h2>
        {dialog.message && <p className="mt-2 text-sm text-muted">{dialog.message}</p>}
        <div className="mt-4 space-y-4">
          {(dialog.fields ?? []).map((f, i) =>
            f.type === 'checkbox' ? (
              <label key={f.name} className="flex items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--color-danger)]"
                  checked={Boolean(values[f.name])}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.checked })}
                />
                {f.label}
              </label>
            ) : (
              <label key={f.name} className="block text-sm">
                <span className="mb-1.5 block font-medium">{f.label}</span>
                {f.type === 'textarea' ? (
                  <textarea
                    autoFocus={i === 0}
                    rows={3}
                    placeholder={f.placeholder}
                    value={String(values[f.name] ?? '')}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                    className="w-full rounded-xl border border-border bg-bg px-3 py-2 outline-none focus:border-primary"
                  />
                ) : (
                  <input
                    autoFocus={i === 0}
                    type={f.type === 'number' ? 'number' : 'text'}
                    placeholder={f.placeholder}
                    value={String(values[f.name] ?? '')}
                    onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                    className="h-10 w-full rounded-xl border border-border bg-bg px-3 outline-none focus:border-primary"
                  />
                )}
                {f.hint && <span className="mt-1 block text-xs text-faint">{f.hint}</span>}
              </label>
            ),
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" onClick={() => close(null)}>
            Cancel
          </Button>
          <Button type="submit" variant={dialog.destructive ? 'danger' : 'primary'} disabled={invalid} autoFocus={!dialog.fields?.length}>
            {dialog.confirmText ?? 'Confirm'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ToastHost() {
  const toasts = useSyncExternalStore(toastStore.subscribe, toastStore.get);
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            'flex max-w-sm items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-xl',
            t.error ? 'border-danger/40 bg-[#2a1220] text-danger' : 'border-success/40 bg-[#0f2418] text-success',
          )}
        >
          {t.error ? <XCircle size={16} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
          <span className="text-text">{t.text}</span>
        </div>
      ))}
    </div>
  );
}
