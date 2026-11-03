import { coldStartPath } from '@/lib/coldStart';

/** expo-router system-URL hook: a plain launch opens Dashboard (DESIGN §2). */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  return coldStartPath(path, initial);
}
