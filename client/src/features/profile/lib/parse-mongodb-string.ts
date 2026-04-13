/** Same as `src/lib/utils.ts` `parseMongoDBString` — IAM session/history rows are Mongo-extended JSON strings. */
export function parseMongoDBString(text: string): string {
  return text
    .replace(/(?:ISODate|ObjectId)\("([^"]+)"\)/g, '"$1"')
    .replace(/\{\s*"\$date"\s*:\s*"([^"]+)"\s*\}/g, '"$1"')
    .replace(/NumberLong\((\d+)\)/g, "$1");
}
