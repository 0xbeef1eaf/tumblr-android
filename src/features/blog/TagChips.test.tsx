import { fireEvent, render, screen } from '@testing-library/react-native';

import { normalizePosts, type GalleryItem } from '@/domain/galleryItem';
import { fx } from '@/domain/fixtures.testutil';

import { aggregateTags, MAX_TAG_CHIPS, TagChips } from './TagChips';

function item(postId: string, tags: string[], index = 0): GalleryItem {
  const base = normalizePosts([fx.legacyPhoto])[0];
  if (!base) throw new Error('fixture');
  return { ...base, id: `${postId}:${index}`, postId, tags, indexInPost: index };
}

describe('aggregateTags', () => {
  it('orders by frequency, ties by first appearance', () => {
    const items = [item('1', ['b', 'a']), item('2', ['c', 'a']), item('3', ['a', 'c', 'd'])];
    expect(aggregateTags(items)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('counts case-insensitively and shows the first spelling', () => {
    expect(aggregateTags([item('1', ['Film']), item('2', ['film']), item('3', ['x'])])).toEqual([
      'Film',
      'x',
    ]);
  });

  it('counts a tag once per post, not once per photo', () => {
    const items = [
      item('1', ['multi'], 0),
      item('1', ['multi'], 1),
      item('2', ['single']),
      item('3', ['single']),
    ];
    expect(aggregateTags(items)).toEqual(['single', 'multi']);
  });

  it('ignores blanks and duplicates inside a post', () => {
    expect(aggregateTags([item('1', ['a', 'A', ' ', ''])])).toEqual(['a']);
  });

  it(`caps at ${MAX_TAG_CHIPS}`, () => {
    const tags = Array.from({ length: 30 }, (_, i) => `t${i}`);
    expect(aggregateTags([item('1', tags)])).toHaveLength(MAX_TAG_CHIPS);
  });

  it('always includes the selected tag, first, even if not in the loaded items', () => {
    expect(aggregateTags([item('1', ['a'])], 'iceland')).toEqual(['iceland', 'a']);
    const tags = Array.from({ length: 30 }, (_, i) => `t${i}`);
    const result = aggregateTags([item('1', tags)], 'zzz');
    expect(result).toHaveLength(MAX_TAG_CHIPS);
    expect(result[0]).toBe('zzz');
  });

  it('does not duplicate a selected tag that is already present (any case)', () => {
    expect(aggregateTags([item('1', ['Iceland', 'a'])], 'iceland')).toEqual(['Iceland', 'a']);
  });
});

describe('TagChips', () => {
  const items = [item('1', ['film', 'iceland']), item('2', ['film'])];

  it('renders nothing without tags', async () => {
    await render(<TagChips items={[]} onSelect={jest.fn()} />);
    expect(screen.queryByTestId('tag-chips')).toBeNull();
  });

  it('selects a tag on press', async () => {
    const onSelect = jest.fn();
    await render(<TagChips items={items} onSelect={onSelect} />);
    expect(screen.getAllByText(/^#/).map((n) => n.props.children)).toEqual(['#film', '#iceland']);
    await fireEvent.press(screen.getByText('#iceland'));
    expect(onSelect).toHaveBeenCalledWith('iceland');
  });

  it('clears the filter when the selected chip is pressed again', async () => {
    const onSelect = jest.fn();
    await render(<TagChips items={items} selected="Film" onSelect={onSelect} />);
    await fireEvent.press(screen.getByText('#film'));
    expect(onSelect).toHaveBeenCalledWith(undefined);
  });
});
