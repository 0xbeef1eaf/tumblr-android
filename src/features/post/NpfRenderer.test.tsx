import { fireEvent, screen } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import { StyleSheet } from 'react-native';

import type { NpfBlock, NpfLayout } from '@/api/schemas/npf';
import { renderWithProviders } from '@/test/render';

import { NpfRenderer } from './NpfRenderer';
import { FIXTURE_IDS, fixtureNpfPost } from './post.testutil';

jest.mock('expo-linking', () => ({ openURL: jest.fn(async () => true) }));
jest.mock('expo-video', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    useVideoPlayer: jest.fn(() => ({ play: jest.fn(), loop: false })),
    VideoView: View,
  };
});

const WIDTH = 400;
const text = (value: string, extra: object = {}): NpfBlock => ({
  type: 'text',
  text: value,
  ...extra,
});
const styleOf = (node: { props: { style?: unknown } }) =>
  StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
function textOf(node: unknown): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (typeof node === 'object' && node !== null && 'props' in node) {
    return textOf((node as { props: { children?: unknown } }).props.children);
  }
  return '';
}
/** The nested inline run whose text is exactly `value`. */
const segment = (value: string) =>
  screen
    .getAllByTestId('npf-segment')
    .find((node) => textOf(node.props.children) === value) as never;
/** The block-level text element that contains `value`. */
const content = (value: string) =>
  screen
    .getAllByTestId('npf-text-content')
    .find((node) => textOf(node.props.children).includes(value)) as never;

describe('NpfRenderer text', () => {
  it('renders inline bold and links as nested text', async () => {
    const post = fixtureNpfPost(FIXTURE_IDS.rows);
    await renderWithProviders(
      <NpfRenderer content={post.content} layout={post.layout} width={WIDTH} truncate={false} />,
    );
    expect(segment('Faroe Islands, part 2')).toBeTruthy();
    const bold = segment('Four days');
    expect(styleOf(bold).fontWeight).toBe('700');
    const link = segment('e hou');
    expect(styleOf(link).textDecorationLine).toBe('underline');
    await fireEvent.press(link);
    expect(Linking.openURL).toHaveBeenCalledWith('https://example.com');
  });

  it('styles subtypes: headings, quotes, indented, chat', async () => {
    await renderWithProviders(
      <NpfRenderer
        width={WIDTH}
        content={[
          text('Big', { subtype: 'heading1' }),
          text('Smaller', { subtype: 'heading2' }),
          text('Quoted', { subtype: 'quote' }),
          text('Chatty', { subtype: 'chat' }),
          text('Nested', { subtype: 'indented', indent_level: 1 }),
        ]}
      />,
    );
    expect(screen.getByTestId('npf-text-heading1')).toBeTruthy();
    expect(styleOf(content('Big')).fontSize).toBeGreaterThan(
      Number(styleOf(content('Smaller')).fontSize),
    );
    expect(styleOf(content('Quoted')).fontStyle).toBe('italic');
    expect(styleOf(content('Chatty')).fontFamily).toBe('monospace');
    expect(styleOf(screen.getByTestId('npf-text-indented')).paddingLeft).toBeGreaterThan(
      Number(styleOf(screen.getByTestId('npf-text-quote')).paddingLeft),
    );
  });

  it('numbers consecutive ordered list items and bullets unordered ones', async () => {
    await renderWithProviders(
      <NpfRenderer
        width={WIDTH}
        content={[
          text('one', { subtype: 'ordered-list-item' }),
          text('two', { subtype: 'ordered-list-item' }),
          text('para'),
          text('again', { subtype: 'ordered-list-item' }),
          text('dot', { subtype: 'unordered-list-item' }),
        ]}
      />,
    );
    expect(screen.getAllByText('1.')).toHaveLength(2);
    expect(screen.getByText('2.')).toBeTruthy();
    expect(screen.getByText('•')).toBeTruthy();
  });

  it('renders nothing for empty text and unknown blocks', async () => {
    await renderWithProviders(
      <NpfRenderer width={WIDTH} content={[text(''), { type: 'audio' }, { type: 'paywall' }]} />,
    );
    expect(screen.queryByTestId(/npf-text/)).toBeNull();
  });
});

describe('NpfRenderer images and layout', () => {
  const rowsPost = fixtureNpfPost(FIXTURE_IDS.rows);

  it('lays out side-by-side images with equal widths and own aspect ratios', async () => {
    await renderWithProviders(
      <NpfRenderer
        content={rowsPost.content}
        layout={rowsPost.layout}
        width={WIDTH}
        truncate={false}
      />,
    );
    const rows = screen.getAllByTestId('npf-row');
    expect(rows).toHaveLength(5); // [0,1] [2] [3] + two text blocks
    const images = screen.getAllByTestId('npf-image');
    expect(images).toHaveLength(4);
    const half = (WIDTH - 2) / 2;
    expect(styleOf(images[0] as never).width).toBe(half);
    expect(styleOf(images[1] as never).width).toBe(half);
    expect(styleOf(images[2] as never).width).toBe(WIDTH);
    expect(styleOf(images[0] as never).aspectRatio).toBeGreaterThan(0);
  });

  it('cuts off at truncate_after and reveals the rest on "Read more"', async () => {
    await renderWithProviders(
      <NpfRenderer content={rowsPost.content} layout={rowsPost.layout} width={WIDTH} />,
    );
    // truncate_after = 2 → blocks 0..2 only
    expect(screen.getAllByTestId('npf-image')).toHaveLength(3);
    expect(screen.queryAllByTestId('npf-segment')).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Read more' }));
    expect(screen.getAllByTestId('npf-image')).toHaveLength(4);
    expect(segment('Faroe Islands, part 2')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Read more' })).toBeNull();
  });

  it('shows no "Read more" when truncation is off or nothing is hidden', async () => {
    const { unmount } = await renderWithProviders(
      <NpfRenderer
        content={rowsPost.content}
        layout={rowsPost.layout}
        width={WIDTH}
        truncate={false}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Read more' })).toBeNull();
    await unmount();
    const layout: NpfLayout[] = [{ type: 'rows', display: [{ blocks: [0] }], truncate_after: 5 }];
    await renderWithProviders(<NpfRenderer content={[text('a')]} layout={layout} width={WIDTH} />);
    expect(screen.queryByRole('button', { name: 'Read more' })).toBeNull();
  });

  it('reports image taps with the block index', async () => {
    const onMediaPress = jest.fn();
    await renderWithProviders(
      <NpfRenderer
        content={rowsPost.content}
        layout={rowsPost.layout}
        width={WIDTH}
        truncate={false}
        onMediaPress={onMediaPress}
      />,
    );
    await fireEvent.press(screen.getAllByRole('image')[1] as never);
    expect(onMediaPress).toHaveBeenCalledWith(1);
  });
});

describe('NpfRenderer video and links', () => {
  it('shows a poster for native video and plays it inline on tap', async () => {
    const post = fixtureNpfPost(FIXTURE_IDS.nativeVideo);
    await renderWithProviders(<NpfRenderer content={post.content} width={WIDTH} />);
    expect(screen.getByTestId('npf-video')).toBeTruthy();
    expect(screen.queryByTestId('npf-inline-video')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Play video' }));
    expect(screen.getByTestId('npf-inline-video')).toBeTruthy();
  });

  it('opens embedded providers externally', async () => {
    const post = fixtureNpfPost(FIXTURE_IDS.embedVideo);
    await renderWithProviders(<NpfRenderer content={post.content} width={WIDTH} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Play video' }));
    expect(Linking.openURL).toHaveBeenCalled();
    expect(screen.queryByTestId('npf-inline-video')).toBeNull();
  });

  it('renders link blocks as cards that open the (unwrapped) url', async () => {
    await renderWithProviders(
      <NpfRenderer
        width={WIDTH}
        content={[
          {
            type: 'link',
            url: 'https://t.umblr.com/redirect?z=https%3A%2F%2Fexample.org%2Fread',
            title: 'A good read',
            description: 'About things',
            site_name: 'example.org',
          },
        ]}
      />,
    );
    expect(screen.getByText('A good read')).toBeTruthy();
    expect(screen.getByText('example.org')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('npf-link-card'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://example.org/read');
  });
});
