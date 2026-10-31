import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { File } from 'expo-file-system';

import { saveMediaToLibrary, SavePermissionError } from './saveMedia';

jest.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///cache/' },
  Directory: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
  },
  File: {
    downloadFileAsync: jest.fn(async (url: string) => ({
      uri: `file:///cache/${url.split('/').pop()}`,
    })),
  },
}));
jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  Asset: { create: jest.fn(async () => ({})) },
}));

describe('saveMediaToLibrary', () => {
  it('downloads every url and adds it to the gallery', async () => {
    const count = await saveMediaToLibrary(['https://x/a.jpg', 'https://x/b.mp4']);
    expect(count).toBe(2);
    expect(requestPermissionsAsync).toHaveBeenCalledWith(true);
    expect(File.downloadFileAsync).toHaveBeenCalledTimes(2);
    expect(Asset.create).toHaveBeenNthCalledWith(1, 'file:///cache/a.jpg');
    expect(Asset.create).toHaveBeenNthCalledWith(2, 'file:///cache/b.mp4');
  });

  it('throws SavePermissionError and downloads nothing when permission is denied', async () => {
    jest.mocked(requestPermissionsAsync).mockResolvedValueOnce({ granted: false } as never);
    await expect(saveMediaToLibrary(['https://x/a.jpg'])).rejects.toBeInstanceOf(
      SavePermissionError,
    );
    expect(File.downloadFileAsync).not.toHaveBeenCalled();
  });
});
