import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ChipSelect } from '@/components/profile/ChipSelect';
import { Button, Header, Screen, Text, TextField } from '@/components/ui';
import { LANGUAGES, ROOM_TOPICS } from '@/constants/options';
import { roomTheme } from '@/constants/roomThemes';
import { api } from '@/services';
import { useAuthStore } from '@/store/authStore';
import { spacing } from '@/theme';
import { getErrorMessage } from '@/utils/errors';

export default function CreateRoomScreen() {
  const myLanguages = useAuthStore((s) => s.user?.languages ?? []);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [topic, setTopic] = useState(ROOM_TOPICS[0]);
  const [language, setLanguage] = useState(myLanguages[0] ?? LANGUAGES[0]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      const room = await api.rooms.createRoom({
        title,
        topic,
        language,
        description: description.trim() || undefined,
      });
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
        <TextField
          label="Welcome message (optional)"
          placeholder="e.g. Be kind. One person at a time. No personal numbers."
          value={description}
          onChangeText={setDescription}
          maxLength={200}
          multiline
          hint="Pinned at the top of the room for everyone who joins."
        />
        <ChipSelect
          label="Topic"
          options={ROOM_TOPICS.map((t) => `${roomTheme(t).emoji} ${t}`)}
          selected={[`${roomTheme(topic).emoji} ${topic}`]}
          onChange={([t]) => setTopic(ROOM_TOPICS.find((x) => t.endsWith(x)) ?? ROOM_TOPICS[0])}
          multiple={false}
        />
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
