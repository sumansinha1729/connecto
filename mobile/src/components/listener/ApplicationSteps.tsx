import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Header, Icon, Screen, Text, TextField, type IconName } from '@/components/ui';
import { LISTENER_EARNING_PAISE_PER_MIN, MIN_AGE, VOICE_INTRO_MAX_SEC, VOICE_INTRO_MIN_SEC } from '@/constants/config';
import { useAuthStore } from '@/store/authStore';
import { colors, radius, spacing } from '@/theme';
import type { Me } from '@/types';
import { getErrorMessage } from '@/utils/errors';
import { formatRupees } from '@/utils/format';
import { VoicePlayer } from './VoicePlayer';
import { VoiceRecorder } from './VoiceRecorder';

const STEPS = [
  { key: 'details', title: 'Your details', subtitle: 'Only our team sees these. Your profile still shows your nickname and avatar.' },
  { key: 'about', title: 'About you', subtitle: 'Why would you be a good listener?' },
  {
    key: 'voice',
    title: 'Voice intro',
    subtitle: `Record ${VOICE_INTRO_MIN_SEC}–${VOICE_INTRO_MAX_SEC} seconds introducing yourself. Once you’re approved, callers can play it on your profile.`,
  },
  { key: 'review', title: 'Review & send', subtitle: 'Our team usually reviews applications within 24 hours.' },
] as const;

const PERKS: { icon: IconName; text: string }[] = [
  { icon: 'cash', text: `Earn ${formatRupees(LISTENER_EARNING_PAISE_PER_MIN)} for every minute you talk.` },
  { icon: 'time', text: 'Go available whenever you like, no fixed hours.' },
  { icon: 'shield-checkmark', text: 'Every listener is reviewed by our team.' },
];

/** "DD/MM/YYYY" while typing ↔ "YYYY-MM-DD" for the server */
function toIsoDate(ddmmyyyy: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmyyyy);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const date = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.getUTCDate() !== Number(dd)) return null;
  return `${yyyy}-${mm}-${dd}`;
}

function fromIsoDate(iso: string | null): string {
  if (!iso) return '';
  const [yyyy, mm, dd] = iso.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

function ageFrom(iso: string): number {
  const dob = new Date(`${iso}T00:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  if (now.getUTCMonth() < dob.getUTCMonth() || (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}

/** Auto-inserts the slashes: "15041995" → "15/04/1995" */
function formatDobInput(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
}

interface ApplicationStepsProps {
  /** Back from the first step */
  onExit: () => void;
  onSubmitted: (user: Me) => void;
  exitLabel?: 'back' | 'close';
}

export function ApplicationSteps({ onExit, onSubmitted, exitLabel = 'back' }: ApplicationStepsProps) {
  const user = useAuthStore((s) => s.user)!;
  const uploadVoiceIntro = useAuthStore((s) => s.uploadVoiceIntro);
  const submit = useAuthStore((s) => s.submitListenerApplication);
  const saved = user.listenerApplication;
  // Editing an application that is already waiting for review
  const isUpdate = user.listenerStatus === 'pending';

  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState(saved.fullName ?? '');
  const [dob, setDob] = useState(fromIsoDate(saved.dateOfBirth));
  const [city, setCity] = useState(saved.city ?? '');
  const [about, setAbout] = useState(saved.about ?? '');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const current = STEPS[step];

  const validate = (): string | null => {
    if (current.key === 'details') {
      if (fullName.trim().length < 3) return 'Enter your full name as on your ID.';
      const iso = toIsoDate(dob);
      if (!iso) return 'Enter your date of birth as DD/MM/YYYY.';
      if (ageFrom(iso) < MIN_AGE) return `Listeners must be ${MIN_AGE} or older.`;
      if (city.trim().length < 2) return 'Enter your city.';
    }
    if (current.key === 'about' && about.trim().length < 20) return 'Tell us a bit more (at least 20 characters).';
    if (current.key === 'voice' && !user.listenerApplication.voiceIntroUrl) return 'Record and save your voice intro first.';
    return null;
  };

  const next = async () => {
    const problem = validate();
    if (problem) return setError(problem);
    setError(null);
    if (current.key !== 'review') return setStep(step + 1);

    setSending(true);
    try {
      const updated = await submit({ fullName: fullName.trim(), dateOfBirth: toIsoDate(dob)!, city: city.trim(), about: about.trim() });
      setSending(false);
      onSubmitted(updated);
    } catch (e) {
      setError(getErrorMessage(e));
      setSending(false);
    }
  };

  return (
    <Screen
      scroll
      keyboard
      padded={false}
      footer={
        <View style={styles.footer}>
          {error && (
            <Text variant="caption" color="danger" center>
              {error}
            </Text>
          )}
          <Button
            title={current.key === 'review' ? (isUpdate ? 'Update application' : 'Send application') : 'Continue'}
            onPress={next}
            loading={sending}
          />
        </View>
      }
    >
      <Header back={step === 0 ? exitLabel : 'back'} onBack={() => (step === 0 ? onExit() : setStep(step - 1))} />
      <View style={styles.content}>
        <View style={styles.progress}>
          {STEPS.map((s, i) => (
            <View key={s.key} style={[styles.progressBar, i <= step && styles.progressActive]} />
          ))}
        </View>
        <View style={styles.titles}>
          <Text variant="title">{current.title}</Text>
          <Text variant="body" color="muted">
            {current.subtitle}
          </Text>
        </View>

        {current.key === 'details' && (
          <>
            <View style={styles.perks}>
              {PERKS.map((p) => (
                <View key={p.text} style={styles.perk}>
                  <Icon name={p.icon} size={18} color={colors.primary} />
                  <Text variant="caption" color="muted" style={styles.flex}>
                    {p.text}
                  </Text>
                </View>
              ))}
            </View>
            <TextField label="Full name" placeholder="As on your ID" value={fullName} onChangeText={setFullName} autoCapitalize="words" maxLength={80} />
            <TextField
              label="Date of birth"
              placeholder="DD/MM/YYYY"
              value={dob}
              onChangeText={(text) => setDob(formatDobInput(text))}
              keyboardType="number-pad"
              maxLength={10}
            />
            <TextField label="City" placeholder="e.g. Pune" value={city} onChangeText={setCity} autoCapitalize="words" maxLength={60} />
          </>
        )}

        {current.key === 'about' && (
          <TextField
            label="Experience & motivation"
            placeholder="e.g. I’ve volunteered on a helpline for two years and love helping people feel heard."
            value={about}
            onChangeText={setAbout}
            multiline
            maxLength={500}
            hint={about.trim().length < 20 ? `${20 - about.trim().length} more characters needed` : `${about.length}/500`}
          />
        )}

        {current.key === 'voice' && (
          <>
            <Card style={styles.tips}>
              <Text variant="bodyStrong">Tips</Text>
              <Text variant="caption" color="muted">
                Find a quiet place. Say your nickname, the languages you speak, and why people can trust you to listen.
              </Text>
            </Card>
            <VoiceRecorder
              savedUrl={user.listenerApplication.voiceIntroUrl}
              savedDurationSec={user.listenerApplication.voiceIntroDurationSec}
              onSave={async (uri, durationSec) => {
                await uploadVoiceIntro(uri, durationSec);
              }}
            />
          </>
        )}

        {current.key === 'review' && (
          <Card style={styles.review}>
            <ReviewRow label="Full name" value={fullName} />
            <ReviewRow label="Date of birth" value={dob} />
            <ReviewRow label="City" value={city} />
            <ReviewRow label="About you" value={about} />
            <View style={styles.reviewItem}>
              <Text variant="label" color="muted">
                Voice intro
              </Text>
              {user.listenerApplication.voiceIntroUrl && (
                <VoicePlayer
                  key={user.listenerApplication.voiceIntroUrl}
                  uri={user.listenerApplication.voiceIntroUrl}
                  fallbackDurationSec={user.listenerApplication.voiceIntroDurationSec}
                />
              )}
            </View>
          </Card>
        )}
      </View>
    </Screen>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewItem}>
      <Text variant="label" color="muted">
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  progress: { flexDirection: 'row', gap: spacing.sm },
  progressBar: { flex: 1, height: 4, borderRadius: radius.full, backgroundColor: colors.border },
  progressActive: { backgroundColor: colors.primary },
  titles: { gap: spacing.xs },
  perks: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.primarySoft },
  perk: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  flex: { flex: 1 },
  tips: { gap: spacing.xs },
  review: { gap: spacing.lg },
  reviewItem: { gap: spacing.xs },
  footer: { gap: spacing.sm, paddingHorizontal: spacing.lg },
});
