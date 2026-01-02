import { Router } from 'express';

import { ApiError } from '../../utils/ApiError';
import { localPath, STORAGE_KEY_PATTERN, verifyMediaLink } from './storage';

/** Serves locally stored files through signed, expiring links (see storage.getDownloadUrl). */
export const mediaRouter = Router();

const CONTENT_TYPES: Record<string, string> = {
  webm: 'audio/webm',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
};

mediaRouter.get('/:key', (req, res, next) => {
  const key = req.params.key;
  const expiresAt = Number(req.query.exp);
  const signature = String(req.query.sig ?? '');
  if (!STORAGE_KEY_PATTERN.test(key) || !verifyMediaLink(key, expiresAt, signature)) {
    throw ApiError.forbidden('This link has expired.');
  }

  const extension = key.split('.').pop() ?? '';
  res.sendFile(
    localPath(key),
    {
      headers: {
        'Content-Type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
        'Cache-Control': 'private, max-age=600',
      },
      dotfiles: 'deny',
    },
    (error) => {
      if (error && !res.headersSent) next(ApiError.notFound('File not found.'));
    },
  );
});
