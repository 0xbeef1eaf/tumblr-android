import type { NpfFormatting } from '@/api/schemas/npf';

export type InlineStyle =
  'bold' | 'italic' | 'strikethrough' | 'small' | 'link' | 'mention' | 'color';

export interface TextSegment {
  text: string;
  styles: InlineStyle[];
  url?: string;
  /** `#rrggbb` for `color` ranges. */
  color?: string;
}

const KNOWN: readonly InlineStyle[] = [
  'bold',
  'italic',
  'strikethrough',
  'small',
  'link',
  'mention',
  'color',
];

const isKnown = (type: string): type is InlineStyle => (KNOWN as readonly string[]).includes(type);

/** Tumblr wraps outbound links in `t.umblr.com/redirect?z=<url>`; show/open the target. */
export function resolveLink(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 't.umblr.com' && parsed.pathname === '/redirect') {
      return parsed.searchParams.get('z') ?? url;
    }
  } catch {
    // Not an absolute URL; use as is.
  }
  return url;
}

function colorOf(range: NpfFormatting): string | undefined {
  const hex = range.hex?.replace(/^#/, '');
  return hex && /^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex) ? `#${hex}` : undefined;
}

/**
 * Split text into runs sharing the same set of overlapping formatting ranges.
 * NPF offsets count Unicode code points, so emoji do not shift later ranges.
 */
export function buildSegments(
  text: string,
  formatting: readonly NpfFormatting[] | undefined,
): TextSegment[] {
  const chars = Array.from(text);
  const ranges = (formatting ?? []).filter(
    (r) => isKnown(r.type) && r.end > r.start && r.start < chars.length,
  );
  if (ranges.length === 0) return text ? [{ text, styles: [] }] : [];

  const cuts = new Set<number>([0, chars.length]);
  for (const r of ranges) {
    cuts.add(Math.max(0, r.start));
    cuts.add(Math.min(chars.length, r.end));
  }
  const points = [...cuts].sort((a, b) => a - b);

  const segments: TextSegment[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i] as number;
    const to = points[i + 1] as number;
    const active = ranges.filter((r) => r.start <= from && r.end >= to);
    const styles = [...new Set(active.map((r) => r.type as InlineStyle))];
    const link = active.find((r) => r.type === 'link' || r.type === 'mention');
    const color = active.map(colorOf).find((c) => c !== undefined);
    segments.push({
      text: chars.slice(from, to).join(''),
      styles,
      url: link?.url ? resolveLink(link.url) : undefined,
      color,
    });
  }
  return segments;
}
