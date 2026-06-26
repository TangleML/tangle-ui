const SYNONYM_GROUPS = [
  ["gcs", "storage", "bucket"],
  ["train", "fit", "training", "trainer"],
  ["predict", "infer", "inference"],
  ["df", "dataframe", "table"],
  ["csv", "tabular"],
  ["embed", "embedding", "vectorize"],
  ["llm"],
] as const;

const SYNONYM_TOKENS_BY_TOKEN = new Map<string, string[]>();

for (const group of SYNONYM_GROUPS) {
  for (const token of group) {
    SYNONYM_TOKENS_BY_TOKEN.set(token, [...group]);
  }
}

export function expandSynonymTokens(tokens: string[]): string[] {
  const expanded: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    for (const variant of [
      token,
      ...(SYNONYM_TOKENS_BY_TOKEN.get(token) ?? []),
    ]) {
      if (seen.has(variant)) continue;
      seen.add(variant);
      expanded.push(variant);
    }
  }

  return expanded;
}
