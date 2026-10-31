import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import { FilterRow } from './FilterRow';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
}));

describe('FilterRow', () => {
  it('renders All, Photos, GIFs and Video with the active one selected', async () => {
    await render(<FilterRow value="gif" onChange={jest.fn()} />);
    expect(screen.getByLabelText('All').props.accessibilityState.selected).toBe(false);
    expect(screen.getByLabelText('Photos')).toBeTruthy();
    expect(screen.getByLabelText('GIFs').props.accessibilityState.selected).toBe(true);
    expect(screen.getByLabelText('Video')).toBeTruthy();
  });

  it.each([
    ['Photos', 'image'],
    ['GIFs', 'gif'],
    ['Video', 'video'],
  ])('%s → %s with a selection haptic', async (label, kind) => {
    const onChange = jest.fn();
    await render(<FilterRow value="all" onChange={onChange} />);
    await fireEvent.press(screen.getByLabelText(label));
    expect(onChange).toHaveBeenCalledWith(kind);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('ignores a press on the already-selected filter', async () => {
    const onChange = jest.fn();
    await render(<FilterRow value="all" onChange={onChange} />);
    await fireEvent.press(screen.getByLabelText('All'));
    expect(onChange).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  });

  it('survives a failing haptics call', async () => {
    jest.mocked(Haptics.selectionAsync).mockRejectedValueOnce(new Error('no haptics'));
    const onChange = jest.fn();
    await render(<FilterRow value="all" onChange={onChange} />);
    await fireEvent.press(screen.getByLabelText('Video'));
    expect(onChange).toHaveBeenCalledWith('video');
  });
});
