import { useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';

import { adminApi } from '../api/admin';
import { errorMessage, sessionStore } from '../api/client';
import { Button } from '../components/ui';
import { confirmFirebaseCode, firebaseErrorMessage, firebaseLoginEnabled, sendFirebaseCode } from '../lib/firebase';

/** Phone + one-time code (Firebase sends the SMS). Only admin numbers can log in. */
export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const digits = phone.replace(/\D/g, '').slice(-10);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (firebaseLoginEnabled) {
        await sendFirebaseCode(digits, recaptchaRef.current!);
      } else {
        const res = await adminApi.requestCode(digits);
        setDevOtp(res.devOtp ?? null);
      }
      setStep('code');
    } catch (err) {
      setError(firebaseErrorMessage(err, errorMessage));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = firebaseLoginEnabled
        ? await adminApi.loginWithFirebase(await confirmFirebaseCode(code))
        : await adminApi.verifyCode(digits, code);
      queryClient.clear();
      sessionStore.set(res);
      navigate('/', { replace: true });
    } catch (err) {
      setError(firebaseErrorMessage(err, errorMessage));
      setBusy(false);
    }
  }

  const input = 'h-11 w-full rounded-xl border border-border bg-bg px-3 text-base outline-none focus:border-primary tabular';

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Connecto Admin</h1>
            <p className="text-xs text-faint">For the Connecto team only</p>
          </div>
        </div>

        {step === 'phone' ? (
          <form onSubmit={sendCode} className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Admin mobile number</span>
              <input autoFocus inputMode="numeric" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" variant="primary" className="w-full" loading={busy} disabled={digits.length !== 10}>
              Send code
            </Button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <p className="text-sm text-muted">
              {firebaseLoginEnabled ? (
                <>
                  We sent a 6-digit code to <span className="tabular text-text">+91 {digits}</span>.
                </>
              ) : (
                <>
                  If <span className="tabular text-text">{digits}</span> is an admin number, a 6-digit code was sent to it.
                </>
              )}
            </p>
            {devOtp && <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">Test mode: use code {devOtp}</p>}
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Code</span>
              <input
                autoFocus
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className={`${input} tracking-[0.4em]`}
              />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" variant="primary" className="w-full" loading={busy} disabled={code.length !== 6}>
              Log in
            </Button>
            <button
              type="button"
              className="w-full text-center text-xs text-muted hover:text-text"
              onClick={() => {
                setStep('phone');
                setCode('');
                setError(null);
              }}
            >
              Use a different number
            </button>
          </form>
        )}
        {/* Google's "not a robot" check for Firebase (invisible unless it needs a puzzle) */}
        <div ref={recaptchaRef} />
      </div>
    </div>
  );
}
