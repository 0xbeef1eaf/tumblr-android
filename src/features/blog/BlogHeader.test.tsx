import { fireEvent, render, screen } from '@testing-library/react-native';

import type { BlogInfo } from '@/api/schemas/blog';

import { BlogHeader, formatCount } from './BlogHeader';

jest.mock('@/features/auth', () => ({ __esModule: true, useSession: () => ({ status: 'guest' }) }));

const info = (overrides: Partial<BlogInfo>): BlogInfo =>
  ({ name: 'demo', avatar: [], is_adult: false, is_nsfw: false, ...overrides }) as BlogInfo;

describe('formatCount', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1K'],
    [1843, '1.8K'],
    [12_500, '13K'],
    [2_300_000, '2.3M'],
  ])('%d → %s', (n, expected) => {
    expect(formatCount(n)).toBe(expected);
  });
});

describe('BlogHeader', () => {
  it('falls back to the name while info is loading', async () => {
    await render(<BlogHeader name="demo" isLoading />);
    expect(screen.getByText('demo')).toBeTruthy();
    expect(screen.getByTestId('skeleton', { includeHiddenElements: true })).toBeTruthy();
  });

  it('uses the avatar endpoint at 128px', async () => {
    await render(<BlogHeader name="demo" info={info({ title: 'Demo Blog' })} />);
    expect(screen.getByLabelText('demo avatar').props.source).toEqual({
      uri: 'https://api.tumblr.com/v2/blog/demo/avatar/128',
    });
    expect(screen.getByText('Demo Blog')).toBeTruthy();
  });

  it('strips HTML and expands a long description', async () => {
    const long = `<p>${'word '.repeat(40)}</p>`;
    await render(<BlogHeader name="demo" info={info({ description: long })} />);
    const description = screen.getByTestId('blog-description');
    expect(description.props.numberOfLines).toBe(2);
    expect(String(description.props.children)).not.toContain('<p>');
    await fireEvent.press(screen.getByText('Show more'));
    expect(screen.getByTestId('blog-description').props.numberOfLines).toBeUndefined();
    await fireEvent.press(screen.getByText('Show less'));
    expect(screen.getByTestId('blog-description').props.numberOfLines).toBe(2);
  });

  it('shows no expander for a short description and pluralises posts', async () => {
    await render(<BlogHeader name="demo" info={info({ description: 'Hi', total_posts: 1 })} />);
    expect(screen.queryByText('Show more')).toBeNull();
    expect(screen.getByText('1 post')).toBeTruthy();
  });
});
