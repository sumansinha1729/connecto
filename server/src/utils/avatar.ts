import crypto from 'node:crypto';

/** Same styles as mobile/src/constants/avatars.ts */
const AVATAR_STYLES = ['adventurer', 'lorelei', 'notionists', 'micah', 'big-smile', 'fun-emoji'];

export const AVATAR_PATTERN = /^[a-z-]{3,20}:[A-Za-z0-9_-]{1,40}$/;

export function randomAvatar(): string {
  const style = AVATAR_STYLES[crypto.randomInt(AVATAR_STYLES.length)];
  return `${style}:${crypto.randomBytes(6).toString('hex')}`;
}
