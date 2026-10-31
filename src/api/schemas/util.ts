import { z } from 'zod';

/**
 * Array that never fails: non-arrays (missing, null, wrong type) become `[]` and elements
 * that do not match `item` are dropped. Used for every collection in API responses so a
 * single odd element can never reject a whole post or page.
 */
export function lenientArray<T extends z.ZodType>(item: T) {
  return z
    .array(z.unknown())
    .catch([])
    .transform((values) =>
      values.flatMap((value) => {
        const parsed = item.safeParse(value);
        return parsed.success ? [parsed.data as z.output<T>] : [];
      }),
    );
}

/** Optional field that degrades to `undefined` instead of failing on a wrong type. */
export function opt<T extends z.ZodType>(schema: T) {
  return schema.optional().catch(undefined);
}

/** Numbers sometimes arrive as numeric strings; accept both. */
export const looseNumber = z.union([
  z.number(),
  z
    .string()
    .regex(/^-?\d+(\.\d+)?$/)
    .transform(Number),
]);

/** IDs must stay strings (64-bit). Accept numbers only as a last resort. */
export const idString = z.union([z.string().min(1), z.number().transform((n) => String(n))]);
