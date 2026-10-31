import * as Clipboard from 'expo-clipboard';
import { File } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { Share } from 'react-native';

import { useToastStore } from '@/ui/primitives';

import { makeItem } from './items.testutil';
import { copyItemLink, downloadFileName, saveableUrl, saveItem, shareItem } from './mediaActions';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  Asset: { create: jest.fn(async () => ({ id: 'asset' })) },
}));
jest.mock('expo-file-system', () => {
  class MockFile {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = `file:///cache/${String(parts[parts.length - 1])}`;
    }
    static downloadFileAsync = jest.fn(async (_url: string, target: MockFile) => target);
  }
  return { File: MockFile, Paths: { cache: 'cache' } };
});

const item = makeItem({ id: '123:0' });

describe('media actions', () => {
  beforeEach(() => useToastStore.getState().clear());

  it('chooses what to save and how to name it', () => {
    expect(saveableUrl(item)).toBe(item.variants[0]?.url);
    expect(saveableUrl(makeItem({ id: 'v:0', kind: 'video', videoUrl: 'https://v/x.mp4' }))).toBe(
      'https://v/x.mp4',
    );
    expect(downloadFileName(item, 'https://x/a.GIF?x=1')).toBe('tumblr-123_0.gif');
    expect(downloadFileName(item, 'https://x/a')).toBe('tumblr-123_0.jpg');
  });

  it('shares the post link', async () => {
    const spy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    await shareItem(item);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ url: item.postUrl }));
  });

  it('copies the link and confirms', async () => {
    await copyItemLink(item);
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(item.postUrl);
    expect(useToastStore.getState().toasts[0]?.message).toBe('Link copied');
  });

  it('downloads then saves to the library', async () => {
    await expect(saveItem(item)).resolves.toBe(true);
    expect(File.downloadFileAsync).toHaveBeenCalledWith(item.variants[0]?.url, expect.anything(), {
      idempotent: true,
    });
    expect(Asset.create).toHaveBeenCalledWith('file:///cache/tumblr-123_0.jpg');
    expect(useToastStore.getState().toasts[0]?.kind).toBe('success');
  });

  it('does not save without permission', async () => {
    jest.mocked(requestPermissionsAsync).mockResolvedValueOnce({ granted: false } as never);
    await expect(saveItem(item)).resolves.toBe(false);
    expect(Asset.create).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts[0]?.kind).toBe('error');
  });
});
