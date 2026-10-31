import { useVideoPlayer, VideoView } from 'expo-video';

export interface InlineVideoProps {
  url: string;
  width: number;
  aspectRatio: number;
}

/** Native `expo-video` player with system controls; starts playing as soon as it mounts. */
export function InlineVideo({ url, width, aspectRatio }: InlineVideoProps) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={{ width, aspectRatio }}
      nativeControls
      contentFit="contain"
      testID="npf-inline-video"
    />
  );
}
