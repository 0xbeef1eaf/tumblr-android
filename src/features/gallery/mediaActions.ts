import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { Share } from 'react-native';

import type { GalleryItem } from '@/domain/galleryItem';
import { createLogger } from '@/lib/log';
import { toast } from '@/ui/primitives';

const logger = createLogger('media-actions');

/** Full-resolution URL to save: the video itself, else the widest image variant. */
export function saveableUrl(item: Pick<GalleryItem, 'kind' | 'videoUrl' | 'variants'>) {
  if (item.kind === 'video' && item.videoUrl) return item.videoUrl;
  return item.variants[0]?.url;
}

/** A filesystem-safe name that keeps the original extension (`.gif`, `.mp4`…). */
export function downloadFileName(item: Pick<GalleryItem, 'id'>, url: string): string {
  const ext = /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(url)?.[1]?.toLowerCase() ?? 'jpg';
  return `tumblr-${item.id.replace(/[^a-z0-9_-]/gi, '_')}.${ext}`;
}

export async function shareItem(item: Pick<GalleryItem, 'postUrl' | 'summary'>): Promise<void> {
  try {
    await Share.share({ message: item.postUrl, url: item.postUrl, title: item.summary });
  } catch (error) {
    logger.warn('Share failed', error);
  }
}

export async function copyItemLink(item: Pick<GalleryItem, 'postUrl'>): Promise<void> {
  try {
    await Clipboard.setStringAsync(item.postUrl);
    toast.show('Link copied');
  } catch (error) {
    logger.warn('Copy failed', error);
    toast.error("Couldn't copy the link");
  }
}

/** Download to the cache directory, then add to the photo library (scoped MediaStore). */
export async function saveItem(
  item: Pick<GalleryItem, 'id' | 'kind' | 'videoUrl' | 'variants'>,
): Promise<boolean> {
  const url = saveableUrl(item);
  if (!url) {
    toast.error('Nothing to save');
    return false;
  }
  try {
    const permission = await requestPermissionsAsync(true);
    if (!permission.granted) {
      toast.error('Allow photo access in system settings to save');
      return false;
    }
    const target = new File(Paths.cache, downloadFileName(item, url));
    const file = await File.downloadFileAsync(url, target, { idempotent: true });
    await Asset.create(file.uri);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    toast.success(item.kind === 'video' ? 'Video saved' : 'Saved to photos');
    return true;
  } catch (error) {
    logger.warn('Save failed', error);
    toast.error("Couldn't save — check your connection");
    return false;
  }
}
