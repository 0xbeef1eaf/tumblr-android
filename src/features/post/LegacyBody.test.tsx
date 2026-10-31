import { screen } from '@testing-library/react-native';

import tagged from '@/api/fixtures/tagged.photography.json';
import type { LegacyPost } from '@/api/schemas/legacy';
import { PostSchema } from '@/api/schemas/post';
import { renderWithProviders } from '@/test/render';

import { LegacyBody } from './LegacyBody';

const legacy = (id: string): LegacyPost => {
  const raw = tagged.response.find((p) => p.id_string === id);
  return PostSchema.parse(raw) as LegacyPost;
};

describe('LegacyBody', () => {
  it('renders photo posts as images with the caption as plain text', async () => {
    const post = legacy('742389025154692486');
    await renderWithProviders(<LegacyBody post={post} width={400} />);
    expect(screen.getAllByTestId('npf-image').length).toBeGreaterThan(0);
    expect(screen.getByText('Morning fog over Þingvellir & the rift valley.')).toBeTruthy();
  });

  it('renders video posts as a poster with a play button', async () => {
    await renderWithProviders(<LegacyBody post={legacy('742388862291743935')} width={400} />);
    expect(screen.getByTestId('npf-video')).toBeTruthy();
  });

  it('renders text-only legacy posts as just their text', async () => {
    await renderWithProviders(<LegacyBody post={legacy('742388725589636672')} width={400} />);
    expect(screen.queryByTestId('npf-image')).toBeNull();
    expect(screen.queryByTestId('npf-video')).toBeNull();
  });
});
