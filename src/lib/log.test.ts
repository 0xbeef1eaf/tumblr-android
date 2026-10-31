import { createLogger, setLogSink, type LogLevel } from './log';

it('routes through the sink with scope and details', () => {
  const calls: [LogLevel, string, string, unknown[]][] = [];
  const restore = setLogSink((level, scope, message, details) =>
    calls.push([level, scope, message, details]),
  );
  const logger = createLogger('test');
  logger.debug('d');
  logger.info('i', 1);
  logger.warn('w');
  logger.error('e', { x: 1 });
  restore();
  logger.info('after restore');
  expect(calls).toEqual([
    ['debug', 'test', 'd', []],
    ['info', 'test', 'i', [1]],
    ['warn', 'test', 'w', []],
    ['error', 'test', 'e', [{ x: 1 }]],
  ]);
});
