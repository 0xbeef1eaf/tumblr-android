import type { GalleryItem } from '@/domain/galleryItem';
import { Icon, Pressable } from '@/ui/primitives';
import { useTheme } from '@/ui/theme';

import { useLike } from './useLike';

export interface LikeButtonProps {
  item: GalleryItem;
  size?: number;
  color?: string;
}

/** Heart toggle for tiles and the viewer; guests toggle a local bookmark instead. */
export function LikeButton({ item, size = 24, color }: LikeButtonProps) {
  const { colors } = useTheme();
  const { liked, toggle, isPending } = useLike(item);
  return (
    <Pressable
      onPress={toggle}
      disabled={isPending}
      accessibilityLabel={liked ? 'Unlike' : 'Like'}
      accessibilityState={{ selected: liked, disabled: isPending }}
      testID="like-button"
    >
      <Icon
        name={liked ? 'heart' : 'heart-outline'}
        size={size}
        color={liked ? colors.like : (color ?? colors.text)}
      />
    </Pressable>
  );
}
