import {
  blogKey,
  formatVia,
  mapWithConcurrency,
  rankSuggestions,
  type SourceFollowing,
} from './suggestions';

const source = (name: string, ...blogs: (string | [string, number])[]): SourceFollowing => ({
  name,
  blogs: blogs.map((b) =>
    typeof b === 'string' ? { name: b } : { name: b[0], title: `${b[0]} title`, updated: b[1] },
  ),
});

describe('rankSuggestions', () => {
  it('ranks by how many sources follow a blog and records them as via', () => {
    const result = rankSuggestions(
      [
        source('alice', 'solo', 'shared', 'everyone'),
        source('bob', 'shared', 'everyone'),
        source('carol', 'everyone'),
      ],
      [],
    );
    expect(result.map((s) => [s.name, s.via])).toEqual([
      ['everyone', ['alice', 'bob', 'carol']],
      ['shared', ['alice', 'bob']],
      ['solo', ['alice']],
    ]);
  });

  it('breaks ties by latest post, then by first appearance', () => {
    const result = rankSuggestions(
      [source('alice', 'first', ['stale', 100], ['fresh', 300]), source('bob', 'second')],
      [],
    );
    expect(result.map((s) => s.name)).toEqual(['fresh', 'stale', 'first', 'second']);
  });

  it('drops excluded blogs (case and .tumblr.com insensitive) and the sources themselves', () => {
    const result = rankSuggestions(
      [source('alice', 'Followed', 'mine.tumblr.com', 'bob', 'new'), source('bob', 'alice')],
      ['followed.tumblr.com', 'MINE', 'alice', 'bob'],
    );
    expect(result.map((s) => s.name)).toEqual(['new']);
  });

  it('does not count a source twice and keeps the first title and newest updated', () => {
    const [only] = rankSuggestions(
      [
        { name: 'alice', blogs: [{ name: 'x' }, { name: 'X', title: 'Late' }] },
        { name: 'bob', blogs: [{ name: 'x', title: 'From bob', updated: 50 }] },
      ],
      [],
    );
    expect(only).toEqual({ name: 'x', title: 'From bob', updated: 50, via: ['alice', 'bob'] });
  });

  it('keeps the top `limit` and ignores empty (hidden) sources', () => {
    const many = Array.from({ length: 40 }, (_, i) => `blog-${i}`);
    expect(rankSuggestions([source('a', ...many), source('hidden')], [])).toHaveLength(30);
    expect(rankSuggestions([source('a', ...many)], [], 5)).toHaveLength(5);
    expect(rankSuggestions([source('hidden')], [])).toEqual([]);
  });
});

describe('formatVia', () => {
  it.each([
    [['alice'], 'Followed by alice'],
    [['alice', 'bob'], 'Followed by alice, bob'],
    [['alice', 'bob', 'carol', 'dan', 'erin'], 'Followed by alice, bob +3'],
  ])('%j → %s', (via, text) => expect(formatVia(via)).toBe(text));
});

describe('blogKey', () => {
  it('normalises names for comparison', () => {
    expect(blogKey('  Staff.tumblr.com ')).toBe('staff');
  });
});

describe('mapWithConcurrency', () => {
  it('never runs more than `limit` tasks at once and keeps input order', async () => {
    let inFlight = 0;
    let peak = 0;
    const result = await mapWithConcurrency([5, 1, 4, 2, 3, 0, 6], 3, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, n));
      inFlight--;
      return n * 2;
    });
    expect(peak).toBe(3);
    expect(result).toEqual([10, 2, 8, 4, 6, 0, 12]);
  });
});
