import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { SearchBar, SEARCH_DEBOUNCE_MS } from './SearchBar';

interface HarnessProps {
  onDebounced: (text: string) => void;
  onSubmit?: (text: string) => void;
  onClear?: () => void;
  initial?: string;
}

function Harness({
  onDebounced,
  onSubmit = jest.fn(),
  onClear = jest.fn(),
  initial = '',
}: HarnessProps) {
  const [value, setValue] = useState(initial);
  return (
    <SearchBar
      value={value}
      onChangeText={setValue}
      onDebouncedChange={onDebounced}
      onSubmit={onSubmit}
      onClear={() => {
        onClear();
        setValue('');
      }}
    />
  );
}

const advance = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

describe('SearchBar', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('debounces typing by 300 ms and only reports the last value', async () => {
    const onDebounced = jest.fn();
    await render(<Harness onDebounced={onDebounced} />);
    onDebounced.mockClear();

    await fireEvent.changeText(screen.getByTestId('search-input'), 'c');
    await advance(200);
    await fireEvent.changeText(screen.getByTestId('search-input'), 'cat');
    await advance(SEARCH_DEBOUNCE_MS - 1);
    expect(onDebounced).not.toHaveBeenCalled();
    await advance(1);
    expect(onDebounced).toHaveBeenCalledTimes(1);
    expect(onDebounced).toHaveBeenCalledWith('cat');
  });

  it('reports an emptied field immediately', async () => {
    const onDebounced = jest.fn();
    await render(<Harness onDebounced={onDebounced} initial="cat" />);
    await advance(SEARCH_DEBOUNCE_MS);
    onDebounced.mockClear();
    await fireEvent.changeText(screen.getByTestId('search-input'), '');
    expect(onDebounced).toHaveBeenCalledWith('');
  });

  it('submits the current text', async () => {
    const onSubmit = jest.fn();
    await render(<Harness onDebounced={jest.fn()} onSubmit={onSubmit} />);
    await fireEvent.changeText(screen.getByTestId('search-input'), 'space');
    await fireEvent(screen.getByTestId('search-input'), 'submitEditing');
    expect(onSubmit).toHaveBeenCalledWith('space');
  });

  it('shows a clear button only with text and clears on press', async () => {
    const onClear = jest.fn();
    await render(<Harness onDebounced={jest.fn()} onClear={onClear} />);
    expect(screen.queryByTestId('search-clear')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('search-input'), 'x');
    await fireEvent.press(screen.getByTestId('search-clear'));
    expect(onClear).toHaveBeenCalled();
    expect(screen.getByTestId('search-input').props.value).toBe('');
    expect(screen.queryByTestId('search-clear')).toBeNull();
  });

  it('has a descriptive placeholder and auto focuses', async () => {
    await render(<Harness onDebounced={jest.fn()} />);
    const input = screen.getByTestId('search-input');
    expect(input.props.placeholder).toBe('Search tags and blogs');
    expect(input.props.autoFocus).toBe(true);
  });
});
