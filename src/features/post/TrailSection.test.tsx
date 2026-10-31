import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';

import { FIXTURE_IDS, fixtureNpfPost } from './post.testutil';
import { TrailSection } from './TrailSection';

const { trail } = fixtureNpfPost(FIXTURE_IDS.trailOnly);

describe('TrailSection', () => {
  it('renders nothing for an empty trail', async () => {
    await renderWithProviders(<TrailSection trail={[]} />);
    expect(screen.queryByTestId('trail-section')).toBeNull();
  });

  it('starts collapsed as "via blogname" and expands on tap', async () => {
    await renderWithProviders(<TrailSection trail={trail} width={400} />);
    expect(screen.getByText('via alpine-archive')).toBeTruthy();
    expect(screen.queryByTestId('trail-item')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Expand reblog trail' }));
    expect(screen.getAllByTestId('trail-item')).toHaveLength(trail.length);
    expect(screen.getAllByTestId('npf-image').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Collapse reblog trail' }));
    expect(screen.queryByTestId('trail-item')).toBeNull();
  });

  it('can start expanded and summarises long chains', async () => {
    const [first] = trail;
    if (!first) throw new Error('fixture has no trail');
    await renderWithProviders(
      <TrailSection trail={[first, { ...first, blog: { name: 'second' } }]} defaultExpanded />,
    );
    expect(screen.getByText('via second · 2 reblogs')).toBeTruthy();
    expect(screen.getAllByTestId('trail-item')).toHaveLength(2);
  });
});
