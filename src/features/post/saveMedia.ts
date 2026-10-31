import { Directory, File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';

export class SavePermissionError extends Error {
  constructor() {
    super('Permission to save to your gallery was denied');
    this.name = 'SavePermissionError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Download each URL to cache and add it to the device gallery. Resolves the saved count. */
export async function saveMediaToLibrary(urls: readonly string[]): Promise<number> {
  const permission = await requestPermissionsAsync(true);
  if (!permission.granted) throw new SavePermissionError();
  const cache = new Directory(Paths.cache);
  let saved = 0;
  for (const url of urls) {
    // Without `idempotent` a second save of the same URL rejects (DestinationAlreadyExists).
    const file = await File.downloadFileAsync(url, cache, { idempotent: true });
    await Asset.create(file.uri);
    saved += 1;
  }
  return saved;
}
