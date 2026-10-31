/** Curated starter tags (DESIGN §3.1). */
export const STARTER_TAGS = [
  'photography',
  'illustration',
  'architecture',
  'gif',
  'nature',
  'fashion',
  'art',
  'design',
  'cats',
  'space',
] as const;

export type StarterTag = (typeof STARTER_TAGS)[number];
