import { act, render, screen } from '@testing-library/react-native';

import { setMockNetworkState } from '@/test/network';

import { OFFLINE_MESSAGE, OfflineBanner } from './OfflineBanner';

describe('OfflineBanner', () => {
  it('is hidden while connected', async () => {
    await render(<OfflineBanner />);
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });

  it('announces the DESIGN §7 copy when offline and hides again on reconnect', async () => {
    await act(async () => setMockNetworkState('offline'));
    await render(<OfflineBanner />);
    const banner = screen.getByRole('alert', { name: OFFLINE_MESSAGE });
    expect(banner.props.accessibilityLiveRegion).toBe('polite');
    expect(screen.getByText("You're offline — showing cached content")).toBeTruthy();

    await act(async () => setMockNetworkState('wifi'));
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });

  it('stays hidden on mobile data', async () => {
    await act(async () => setMockNetworkState('cellular'));
    await render(<OfflineBanner />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
