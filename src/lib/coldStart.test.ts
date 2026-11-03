import { COLD_START_PATH, coldStartPath } from './coldStart';

describe('coldStartPath', () => {
  it.each(['/', '', 'tumblrgallery:///', 'tumblrgallery://', 'exp://192.168.0.2:8081/--/'])(
    'sends the launcher root %j to Dashboard',
    (path) => {
      expect(coldStartPath(path, true)).toBe(COLD_START_PATH);
    },
  );

  it('keeps deep links and later navigations untouched', () => {
    expect(coldStartPath('tumblrgallery:///tag/cats', true)).toBe('tumblrgallery:///tag/cats');
    expect(coldStartPath('/blog/staff', true)).toBe('/blog/staff');
    expect(coldStartPath('/', false)).toBe('/');
  });
});
