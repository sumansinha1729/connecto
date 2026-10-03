type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

// Read directly (not from config/env) so the logger works even while the config is being validated
const configured = process.env.LOG_LEVEL as Level | undefined;
const minLevel: Level = configured && configured in LEVELS ? configured : process.env.NODE_ENV === 'production' ? 'info' : 'debug';

function write(level: Level, message: string, meta?: unknown) {
  if (LEVELS[level] < LEVELS[minLevel]) return;
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${message}`;
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (meta === undefined) out(line);
  else out(line, meta);
}

export const logger = {
  debug: (message: string, meta?: unknown) => write('debug', message, meta),
  info: (message: string, meta?: unknown) => write('info', message, meta),
  warn: (message: string, meta?: unknown) => write('warn', message, meta),
  error: (message: string, meta?: unknown) => write('error', message, meta),
};
