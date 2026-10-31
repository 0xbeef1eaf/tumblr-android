import { z } from 'zod';

import { lenientArray, opt } from './util';

export const ApiErrorDetailSchema = z.looseObject({
  title: opt(z.string()),
  code: opt(z.number()),
  detail: opt(z.string()),
});
export type ApiErrorDetail = z.infer<typeof ApiErrorDetailSchema>;

export const MetaSchema = z.looseObject({
  status: z.number(),
  msg: z.string().catch(''),
});

/** `{ meta, response, errors? }` — `response` is validated separately by each endpoint. */
export const EnvelopeSchema = z.looseObject({
  meta: MetaSchema,
  response: z.unknown(),
  errors: opt(lenientArray(ApiErrorDetailSchema)),
});
export type Envelope = z.infer<typeof EnvelopeSchema>;

/** Pagination hints (`_links.next.query_params`) returned by blog posts, dashboard, likes. */
export const LinkSchema = z.looseObject({
  href: z.string(),
  method: opt(z.string()),
  query_params: opt(z.record(z.string(), z.union([z.string(), z.number()]))),
});
export const LinksSchema = z.looseObject({
  next: opt(LinkSchema),
  prev: opt(LinkSchema),
});
export type Links = z.infer<typeof LinksSchema>;
