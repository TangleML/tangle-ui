const QUERY_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "but",
  "do",
  "for",
  "from",
  "how",
  "i",
  "in",
  "into",
  "me",
  "my",
  "no",
  "of",
  "on",
  "please",
  "that",
  "the",
  "to",
  "want",
  "with",
]);

export function isSearchQueryStopWord(token: string): boolean {
  return QUERY_STOP_WORDS.has(token);
}
