import { render, screen } from '@testing-library/react-native';

import { makeItem } from './items.testutil';
import { QuickActionsSheet } from './QuickActionsSheet';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));
jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  Asset: { create: jest.fn(async () => ({})) },
}));
jest.mock('expo-file-system', () => ({ File: class {}, Paths: { cache: 'cache' } }));

describe('QuickActionsSheet Like row', () => {
  const item = makeItem({ id: 'p1:0', liked: false });
  const onLike = jest.fn();

  it('uses isLiked (optimistic / bookmark state) over item.liked', async () => {
    const { rerender } = await render(
      <QuickActionsSheet item={item} onClose={jest.fn()} onLike={onLike} isLiked={() => true} />,
    );
    expect(screen.getByTestId('quick-action-like')).toHaveProp('accessibilityLabel', 'Unlike');

    await rerender(
      <QuickActionsSheet item={item} onClose={jest.fn()} onLike={onLike} isLiked={() => false} />,
    );
    expect(screen.getByTestId('quick-action-like')).toHaveProp('accessibilityLabel', 'Like');
  });

  it('falls back to item.liked without isLiked', async () => {
    await render(
      <QuickActionsSheet item={{ ...item, liked: true }} onClose={jest.fn()} onLike={onLike} />,
    );
    expect(screen.getByTestId('quick-action-like')).toHaveProp('accessibilityLabel', 'Unlike');
  });
});
