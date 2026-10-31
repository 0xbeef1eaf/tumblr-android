import { View } from 'react-native';

import type { LegacyPost } from '@/api/schemas/legacy';
import { normalizePost } from '@/domain/galleryItem';
import { htmlToPlain } from '@/domain/text';
import { Text } from '@/ui/primitives';
import { spacing } from '@/ui/theme';

import { ImageView, VideoPoster } from './MediaViews';

export interface LegacyBodyProps {
  post: LegacyPost;
  width: number;
}

/** Fallback for non-NPF posts: media list followed by the caption as plain text. */
export function LegacyBody({ post, width }: LegacyBodyProps) {
  const items = normalizePost(post);
  const body = 'body' in post && typeof post.body === 'string' ? post.body : undefined;
  const caption = htmlToPlain(post.caption ?? body);
  return (
    <View testID="legacy-body" style={{ gap: 2 }}>
      {items.map((item) =>
        item.kind === 'video' ? (
          <VideoPoster
            key={item.id}
            poster={item.variants}
            aspectRatio={item.aspectRatio}
            width={width}
            videoUrl={item.videoUrl}
            externalUrl={item.embedUrl ?? item.postUrl}
          />
        ) : (
          <ImageView
            key={item.id}
            variants={item.variants}
            aspectRatio={item.aspectRatio}
            width={width}
            placeholderColor={item.placeholderColor}
            altText={item.altText}
          />
        ),
      )}
      {caption ? (
        <Text variant="body" selectable style={{ paddingHorizontal: spacing.lg }}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}
