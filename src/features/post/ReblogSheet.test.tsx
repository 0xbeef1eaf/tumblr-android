import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';

import { parseTags, ReblogSheet } from './ReblogSheet';

describe('parseTags', () => {
  it.each([
    ['', []],
    ['  ', []],
    ['cats', ['cats']],
    ['cats, #dogs , cats,,  ##birds ', ['cats', 'dogs', 'birds']],
    ['faroe islands, travel', ['faroe islands', 'travel']],
  ])('%j → %j', (input, expected) => {
    expect(parseTags(input)).toEqual(expected);
  });
});

describe('ReblogSheet', () => {
  it('confirms with trimmed comment and parsed tags', async () => {
    const onConfirm = jest.fn();
    await renderWithProviders(
      <ReblogSheet
        visible
        blogName="mine"
        isPending={false}
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByText('Reblog to mine')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Reblog comment'), '  nice  ');
    await fireEvent.changeText(screen.getByLabelText('Reblog tags'), 'a, #b');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirm reblog' }));
    expect(onConfirm).toHaveBeenCalledWith({ comment: 'nice', tags: ['a', 'b'] });
  });

  it('disables confirm while pending and closes on cancel', async () => {
    const onClose = jest.fn();
    await renderWithProviders(
      <ReblogSheet visible isPending onClose={onClose} onConfirm={jest.fn()} />,
    );
    expect(screen.getByText('Reblogging…')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Confirm reblog' }).props.accessibilityState.disabled,
    ).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when hidden', async () => {
    await renderWithProviders(
      <ReblogSheet visible={false} isPending={false} onClose={jest.fn()} onConfirm={jest.fn()} />,
    );
    expect(screen.queryByTestId('sheet')).toBeNull();
  });
});
