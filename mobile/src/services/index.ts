import type { Api } from './contracts';
import { httpApi } from './http';

/** The backend API (server/ in this repo). Screens and stores only use this. */
export const api: Api = httpApi;

export { realtime } from './realtime';
export { session } from './session';
