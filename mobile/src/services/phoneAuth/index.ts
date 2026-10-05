import { phoneAuth } from './phoneAuth';
import { forceDevLogin } from './types';

export { phoneAuth } from './phoneAuth';
export { phoneAuthErrorMessage } from './types';

/** Real SMS through Firebase; otherwise our server's dev codes (local testing only) */
export const firebaseLoginEnabled =phoneAuth.available && !forceDevLogin;
