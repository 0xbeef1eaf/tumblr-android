import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Chip } from './Chip';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { Sheet } from './Sheet';
import { Skeleton } from './Skeleton';
import { Text, textVariants } from './Text';
import { toast, ToastHost, useToastStore } from './Toast';

import { palettes } from '../theme';

describe('Text', () => {
  it.each(Object.keys(textVariants) as (keyof typeof textVariants)[])(
    'variant %s',
    async (variant) => {
      await render(<Text variant={variant}>hello</Text>);
      const style = StyleSheet.flatten(screen.getByText('hello').props.style);
      expect(style.fontSize).toBe(textVariants[variant].fontSize);
    },
  );

  it('applies tone colours from the theme', async () => {
    await render(<Text tone="accent">tinted</Text>);
    expect(StyleSheet.flatten(screen.getByText('tinted').props.style).color).toBe(
      palettes.dark.accent,
    );
  });
});

describe('Pressable', () => {
  it('enforces a 44dp minimum and fires onPress', async () => {
    const onPress = jest.fn();
    await render(
      <Pressable onPress={onPress} accessibilityLabel="Tap me">
        <Text>t</Text>
      </Pressable>,
    );
    const button = screen.getByRole('button', { name: 'Tap me' });
    expect(StyleSheet.flatten(button.props.style)).toMatchObject({ minWidth: 44, minHeight: 44 });
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', async () => {
    const onPress = jest.fn();
    await render(<Pressable onPress={onPress} disabled accessibilityLabel="Off" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Off' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('Chip', () => {
  it('reports selection and supports remove', async () => {
    const onPress = jest.fn();
    const onRemove = jest.fn();
    await render(<Chip label="cats" selected onPress={onPress} onRemove={onRemove} />);
    const chip = screen.getByRole('button', { name: 'cats' });
    expect(chip.props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(chip);
    await fireEvent.press(screen.getByRole('button', { name: 'Remove cats' }));
    expect(onPress).toHaveBeenCalled();
    expect(onRemove).toHaveBeenCalled();
  });
});

describe('Icon', () => {
  it('renders an Ionicons glyph', async () => {
    await render(<Icon name="heart" accessibilityLabel="Like" testID="icon" />);
    expect(screen.getByTestId('icon')).toBeTruthy();
  });
});

describe('Skeleton', () => {
  it('renders with an aspect ratio and is hidden from accessibility', async () => {
    await render(<Skeleton aspectRatio={0.75} />);
    const node = screen.getByTestId('skeleton', { includeHiddenElements: true });
    expect(StyleSheet.flatten(node.props.style).aspectRatio).toBe(0.75);
  });
});

describe('Sheet', () => {
  it('renders children when visible and closes from the scrim', async () => {
    const onClose = jest.fn();
    await render(
      <Sheet visible onClose={onClose} title="Actions">
        <Text>Open post</Text>
      </Sheet>,
    );
    expect(screen.getByText('Actions')).toBeTruthy();
    expect(screen.getByText('Open post')).toBeTruthy();
    // The scrim starts transparent (animation not run in tests), which RNTL treats as hidden.
    await fireEvent.press(screen.getByTestId('sheet-scrim', { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalled();
  });

  it('unmounts after the exit animation', async () => {
    jest.useFakeTimers();
    const { rerender } = await render(<Sheet visible onClose={jest.fn()} title="Bye" />);
    await rerender(<Sheet visible={false} onClose={jest.fn()} title="Bye" />);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.queryByText('Bye')).toBeNull();
    jest.useRealTimers();
  });

  it('renders nothing when never shown', async () => {
    await render(<Sheet visible={false} onClose={jest.fn()} />);
    expect(screen.queryByTestId('sheet')).toBeNull();
  });
});

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useToastStore.getState().clear();
  });
  afterEach(() => jest.useRealTimers());

  it('queues, dedupes consecutive messages and caps the queue', async () => {
    toast.show('a');
    toast.show('a');
    toast.error('b');
    toast.success('c');
    toast.show('d');
    expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual(['b', 'c', 'd']);
    expect(useToastStore.getState().toasts[0]?.kind).toBe('error');
  });

  it('host shows the current toast and auto-dismisses it', async () => {
    await render(<ToastHost />);
    await act(async () => {
      toast.show('Tumblr is asking us to slow down', { durationMs: 1000 });
    });
    expect(screen.getByText('Tumblr is asking us to slow down')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.queryByText('Tumblr is asking us to slow down')).toBeNull();
  });

  it('runs the action and dismisses', async () => {
    const onPress = jest.fn();
    await render(<ToastHost />);
    await act(async () => {
      toast.show('Removed', { action: { label: 'Undo', onPress } });
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(onPress).toHaveBeenCalled();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
