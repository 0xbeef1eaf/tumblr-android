import { fx } from './fixtures.testutil';
import { decodeEntities, htmlToPlain, npfTextToPlain, truncate } from './text';
import { isNpfPost } from '@/api/schemas/post';

describe('htmlToPlain', () => {
  it.each([
    ['<p>Hello <b>world</b></p>', 'Hello world'],
    ['<p>One</p><p>Two</p>', 'One\nTwo'],
    ['Line<br>break<br/>again', 'Line\nbreak\nagain'],
    ['Tom &amp; Jerry &lt;3 &#39;hi&#39; &#x263A;', "Tom & Jerry <3 'hi' ☺"],
    ['<script>alert(1)</script>Safe', 'Safe'],
    ['  lots   of\t space  ', 'lots of space'],
    ['', ''],
    [undefined, ''],
  ])('%p → %p', (input, expected) => {
    expect(htmlToPlain(input)).toBe(expected);
  });

  it('strips a real legacy caption', () => {
    expect(htmlToPlain(fx.legacyPhotoset.caption as string)).toBe(
      'Portra 400, Lisbon.\nShot on a Nikon FM2',
    );
  });
});

describe('decodeEntities', () => {
  it('leaves unknown entities untouched', () => {
    expect(decodeEntities('&bogus; &#0;')).toBe('&bogus; &#0;');
  });
});

describe('npfTextToPlain', () => {
  it('joins text blocks and ignores media blocks', () => {
    const post = fx.npfPhotosetRows;
    if (!isNpfPost(post)) throw new Error('expected NPF');
    expect(npfTextToPlain(post.content)).toBe(
      'Faroe Islands, part 2\nFour days of rain and one hour of light. Worth it.',
    );
  });

  it.each([[[]], [null], [undefined], [[{ type: 'image' }]]])('empty for %p', (blocks) => {
    expect(npfTextToPlain(blocks)).toBe('');
  });
});

describe('truncate', () => {
  it.each([
    ['short', 10, 'short'],
    ['exactly ten', 11, 'exactly ten'],
    ['the quick brown fox jumps', 15, 'the quick…'],
    ['abcdefghijklmnop', 8, 'abcdefg…'],
  ])('%p (max %i) → %p', (input, max, expected) => {
    expect(truncate(input, max)).toBe(expected);
  });

  it('counts code points, not UTF-16 units', () => {
    expect(truncate('😀😀😀', 3)).toBe('😀😀😀');
  });

  it('defaults to 280 characters', () => {
    expect(Array.from(truncate('a '.repeat(400))).length).toBeLessThanOrEqual(280);
  });
});
