const MAX_LENGTH = 40;
const MIN_LENGTH = 3;

const LEAD_INS = [
  "hey",
  "hi",
  "ok",
  "okay",
  "so",
  "please",
  "can you",
  "could you",
  "would you",
  "will you",
  "i want to",
  "i want you to",
  "i would like to",
  "i'd like to",
  "i need to",
  "i need you to",
  "let's",
  "lets",
  "help me",
  "help me to",
  "i am trying to",
  "i'm trying to",
];

const firstSentence = (prompt: string) =>
  prompt
    .split(/[\n.!?;]/, 1)[0]
    ?.replace(/\s+/g, " ")
    .trim() ?? "";

const endsAWord = (text: string, at: number) =>
  at >= text.length || !/[\p{L}\p{N}]/u.test(text.charAt(at));

function withoutLeadIn(text: string): string {
  const lowered = text.toLowerCase();
  const matched = LEAD_INS.filter(
    (lead) => lowered.startsWith(lead) && endsAWord(lowered, lead.length),
  ).sort((a, b) => b.length - a.length)[0];

  if (!matched) return text;
  return withoutLeadIn(text.slice(matched.length).replace(/^[\s,:—–-]+/, ""));
}

const JOINERS = new Set([
  "and",
  "but",
  "by",
  "for",
  "from",
  "in",
  "into",
  "on",
  "or",
  "so",
  "that",
  "then",
  "to",
  "using",
  "which",
  "while",
  "with",
]);

const MIN_TRIMMED_LENGTH = 15;
const TAIL_STARTS_AT = 0.6;

/**
 * Cutting at a word boundary still leaves a sentence that stops mid-thought —
 * "Build a churn model for Q3 using the new". Dropping the last phrase along
 * with the word that introduced it gives a title rather than a fragment.
 *
 * Only a phrase in the tail, though. "Build a pipeline that scrapes wikipedia"
 * joins at its fifth character-fifth, and cutting there leaves "Build a
 * pipeline" — every word that said what the pipeline was for, gone.
 */
function withoutDanglingPhrase(text: string): string {
  const words = text.split(" ");
  const joinerAt = words.findLastIndex((word) =>
    JOINERS.has(word.toLowerCase()),
  );
  if (joinerAt <= 0) return text;

  const trimmed = words.slice(0, joinerAt).join(" ");
  const isTail = trimmed.length >= text.length * TAIL_STARTS_AT;
  return isTail && trimmed.length >= MIN_TRIMMED_LENGTH ? trimmed : text;
}

function clamp(text: string): string {
  if (text.length <= MAX_LENGTH) return text;
  // One past the limit, so a word ending exactly on it survives whole.
  const lastSpace = text.slice(0, MAX_LENGTH + 1).lastIndexOf(" ");
  const cut = (
    lastSpace > MIN_LENGTH
      ? text.slice(0, lastSpace)
      : text.slice(0, MAX_LENGTH)
  ).trim();

  return withoutDanglingPhrase(cut);
}

/**
 * A title for whatever a prompt asks for, used to name the project, session and
 * pipeline that prompt brings into being. The agent renames these once it knows
 * what it is actually building; this is what they are called until then, and
 * what they keep if it never gets round to it.
 *
 * The whole prompt is not a name — it is a paragraph, and reads as a mistake in
 * every list it appears in. So this takes the opening clause, drops the address
 * to the agent in front of it, and cuts to a length a tile can show.
 */
export function nameFromPrompt(prompt: string): string | undefined {
  const opening = withoutLeadIn(firstSentence(prompt))
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim();
  if (opening.length < MIN_LENGTH) return undefined;

  const clamped = clamp(opening).replace(/[\s,;:-]+$/, "");
  if (clamped.length < MIN_LENGTH) return undefined;

  return clamped.charAt(0).toUpperCase() + clamped.slice(1);
}
