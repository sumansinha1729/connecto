import { create } from 'zustand';

/**
 * In-app dialogs, drawn by <DialogHost /> (mounted once at the root) so they look
 * the same on phones and on the web, instead of system/browser popups.
 * Call `notify` / `confirm` from anywhere, including outside React components.
 */

export interface DialogRequest {
  id: number;
  /** `confirm` has Cancel + confirm buttons; `notice` has a single OK */
  kind: 'confirm' | 'notice';
  title: string;
  message?: string;
  confirmText: string;
  cancelText: string;
  destructive: boolean;
  resolve: (confirmed: boolean) => void;
}

/** Dialogs waiting to be shown; the first one is on screen */
export const useDialogStore = create<{ queue: DialogRequest[] }>()(() => ({ queue: [] }));

let nextId = 1;

function show(request: Omit<DialogRequest, 'id' | 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => {
    useDialogStore.setState((s) => ({ queue: [...s.queue, { ...request, id: nextId++, resolve }] }));
  });
}

/** Closes a dialog; `confirmed` is false for Cancel, the back button or tapping outside */
export function closeDialog(id: number, confirmed: boolean) {
  const { queue } = useDialogStore.getState();
  const dialog = queue.find((d) => d.id === id);
  if (!dialog) return;
  useDialogStore.setState({ queue: queue.filter((d) => d.id !== id) });
  dialog.resolve(confirmed);
}

export async function notify(title: string, message?: string): Promise<void> {
  await show({ kind: 'notice', title, message, confirmText: 'OK', cancelText: '', destructive: false });
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  /** Red confirm button, for things that are hard to undo */
  destructive?: boolean;
}

/** Resolves true only when the confirm button is pressed */
export function confirm({ title, message, confirmText = 'OK', cancelText = 'Cancel', destructive = false }: ConfirmOptions): Promise<boolean> {
  return show({ kind: 'confirm', title, message, confirmText, cancelText, destructive });
}
