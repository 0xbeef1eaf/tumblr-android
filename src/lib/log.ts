/**
 * Tiny levelled logger. Debug/info are dropped in production bundles; warn/error always
 * go to the console (and are the hook point for a crash reporter later).
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, ...details: unknown[]): void;
  info(message: string, ...details: unknown[]): void;
  warn(message: string, ...details: unknown[]): void;
  error(message: string, ...details: unknown[]): void;
}

type Sink = (level: LogLevel, scope: string, message: string, details: unknown[]) => void;

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';

const consoleSink: Sink = (level, scope, message, details) => {
  // Tests only surface errors; use setLogSink() to assert on other levels.
  if (isTest && level !== 'error') return;
  if (!isDev && (level === 'debug' || level === 'info')) return;
  const line = `[${scope}] ${message}`;
  if (level === 'error') console.error(line, ...details);
  else if (level === 'warn') console.warn(line, ...details);
  else console.log(line, ...details);
};

let sink: Sink = consoleSink;

/** Replace the output sink (tests, crash reporting). Returns a restore function. */
export function setLogSink(next: Sink): () => void {
  const previous = sink;
  sink = next;
  return () => {
    sink = previous;
  };
}

export function createLogger(scope: string): Logger {
  return {
    debug: (message, ...details) => sink('debug', scope, message, details),
    info: (message, ...details) => sink('info', scope, message, details),
    warn: (message, ...details) => sink('warn', scope, message, details),
    error: (message, ...details) => sink('error', scope, message, details),
  };
}

export const log = createLogger('app');
