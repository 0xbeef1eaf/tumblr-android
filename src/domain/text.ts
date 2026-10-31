import { asTextBlock, type NpfBlock } from '@/api/schemas/npf';

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
};

export function decodeEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Legacy caption/body HTML → plain text with paragraph breaks preserved. */
export function htmlToPlain(html: string | undefined | null): string {
  if (!html) return '';
  const withBreaks = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|figure)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decodeEntities(withBreaks)
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

/** Concatenate the text of NPF text blocks (one per line); other block types are ignored. */
export function npfTextToPlain(blocks: readonly NpfBlock[] | undefined | null): string {
  if (!blocks) return '';
  return blocks
    .map((block) => asTextBlock(block)?.text.trim() ?? '')
    .filter((text) => text.length > 0)
    .join('\n');
}

/** Truncate to `max` characters, preferring a word boundary, appending `…`. */
export function truncate(text: string, max = 280, ellipsis = '…'): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  const budget = Math.max(0, max - ellipsis.length);
  const cut = chars.slice(0, budget).join('');
  const lastSpace = cut.search(/\s\S*$/);
  const base = lastSpace > budget * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}${ellipsis}`;
}
