/** Trim, drop a leading `#`/`@` and collapse whitespace: `"  #Street  Photo "` → `"Street Photo"`. */
export function normalizeTag(input: string): string {
  return input
    .trim()
    .replace(/^[#@]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}
