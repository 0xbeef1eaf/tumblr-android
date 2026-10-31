import type { SearchHistoryEntry } from './searchHistoryStore';
import { buildSuggestions } from './useSuggestions';

const at = 1;
const recents: SearchHistoryEntry[] = [
  { type: 'tag', value: 'cats', at },
  { type: 'blog', value: 'catlover', at },
  { type: 'tag', value: 'street photography', at },
  { type: 'tag', value: 'space', at },
];

function describe_(query: string, history: SearchHistoryEntry[] = recents) {
  return buildSuggestions(query, history).map((s) => `${s.kind}:${s.value}`);
}

describe('buildSuggestions', () => {
  it.each<[string, string, string[]]>([
    ['empty', '', []],
    ['whitespace only', '   ', []],
    ['hash only', '#', []],
    ['plain word: tag, blog and no recents', 'dogs', ['tag:dogs', 'blog:dogs']],
    ['blog name is lower-cased, tag keeps case', 'Dogs', ['tag:Dogs', 'blog:dogs']],
    ['leading # is stripped', '#dogs', ['tag:dogs', 'blog:dogs']],
    ['spaces cannot be a blog name', 'big dogs', ['tag:big dogs']],
    ['dashes and digits are blog-like', 'my-blog-42', ['tag:my-blog-42', 'blog:my-blog-42']],
    ['underscores are not blog-like', 'my_blog', ['tag:my_blog']],
    ['more than 32 chars is not blog-like', 'a'.repeat(33), [`tag:${'a'.repeat(33)}`]],
    [
      'matching recents follow, minus duplicates of the first two',
      'cat',
      ['tag:cat', 'blog:cat', 'recent:cats', 'recent:catlover'],
    ],
    ['exact recent tag is not repeated', 'cats', ['tag:cats', 'blog:cats']],
    [
      'recents match case-insensitively on substrings',
      'PHOTO',
      ['tag:PHOTO', 'blog:photo', 'recent:street photography'],
    ],
  ])('%s', (_name, query, expected) => {
    expect(describe_(query)).toEqual(expected);
  });

  it('puts the tag suggestion first and keeps the recent entry type', () => {
    const [first, , recent] = buildSuggestions('catl', recents);
    expect(first).toMatchObject({ kind: 'tag', value: 'catl' });
    expect(recent).toMatchObject({ kind: 'recent', entryType: 'blog', value: 'catlover' });
  });

  it('caps matching recents at five', () => {
    const many = Array.from({ length: 12 }, (_, i): SearchHistoryEntry => ({
      type: 'tag',
      value: `cat${i}`,
      at,
    }));
    expect(buildSuggestions('cat', many).filter((s) => s.kind === 'recent')).toHaveLength(5);
  });

  it('gives every suggestion a unique key', () => {
    const keys = buildSuggestions('cat', recents).map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
