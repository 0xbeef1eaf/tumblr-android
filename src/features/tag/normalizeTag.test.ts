import { normalizeTag } from './normalizeTag';

describe('normalizeTag', () => {
  it.each([
    ['photography', 'photography'],
    ['  #Street   Photo ', 'Street Photo'],
    ['##cats', 'cats'],
    ['@someone', 'someone'],
    ['   ', ''],
    ['#', ''],
  ])('%j → %j', (input, expected) => {
    expect(normalizeTag(input)).toBe(expected);
  });
});
