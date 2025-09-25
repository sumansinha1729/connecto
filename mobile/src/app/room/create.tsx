import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ChipSelect } from '@/components/profile/ChipSelect';
import { Button, Header, Screen, Text, TextField } from '@/components/ui';
import { LANGUAGES, ROOM_TOPICS } from '@/constants/options';
import { api } from '@/services';
import { useAuthStore } from '@/store/authStore';
import { spacing } from '@/theme';
import { getErrorMessage } from '@/utils/errors';

export default function CreateRoomScreen() {
  const myLanguages = useAuthStore((s) => s.user?.languages ?? []);
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState(ROOM_TOPICS[0]);
  const [language, setLanguage] = useState(myLanguages[0] ?? LANGUAGES[0]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      const room = await api.rooms.createRoom({ title, topic, language });
      router.replace(`/room/${room.id}`);
    } catch (e) {
      setError(getErrorMessage(e));
      setSaving(false);
    }
  };

  return (
    <Screen
      scroll
      keyboard
      padded={false}
      footer={
        <View style={styles.footer}>
          <Button title="Start room" icon="mic" onPress={create} loading={saving} disabled={title.trim().length < 3} />
        </View>
      }
    >
      <Header title="Start a room" back="close" />
      <View style={styles.content}>
        <Text variant="body" color="muted">
          You’ll be the host. People can join to listen, and you choose who gets to speak.
        </Text>
        <TextField
          label="Room title"
          placeholder="e.g. Sunday night vent session"
          value={title}
          onChangeText={setTitle}
          maxLength={60}
          error={error}
          autoFocus
        />
        <ChipSelect label="Topic" options={ROOM_TOPICS} selected={[topic]} onChange={([t]) => setTopic(t)} multiple={false} />
        <ChipSelect
          label="Language"
          options={[...myLanguages, ...LANGUAGES.filter((l) => !myLanguages.includes(l))]}
          selected={[language]}
          onChange={([l]) => setLanguage(l)}
          multiple={false}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  footer: { paddingHorizontal: spacing.lg },
});
