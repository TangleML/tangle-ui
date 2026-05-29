#!/usr/bin/env node
/**
 * Codemod: ban-classname-on-primitives (pure-Node version).
 *
 * Rewrites the most mechanical className → semantic-prop conversions on the
 * Tangle UI primitives. Operates on src/routes/v2/ by default.
 *
 * Conservative by design — only rewrites cases where the className contains
 * exactly the recognized cluster signature (no other classes).
 *
 * Usage:
 *   node scripts/codemods/ban-classname-on-primitives.mjs          # apply
 *   node scripts/codemods/ban-classname-on-primitives.mjs --dry    # preview
 *   node scripts/codemods/ban-classname-on-primitives.mjs src/routes/v2/pages/Editor
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const TONE_BY_COLOR_CLASS = {
  "text-muted-foreground": "subdued",
  "text-foreground": "strong",
  "text-destructive": "critical",
  "text-warning": "warning",
  "text-success": "success",
  "text-info": "info",
  "text-amber-400": "warning",
  "text-amber-500": "warning",
  "text-amber-600": "warning",
  "text-amber-700": "warning",
  "text-red-500": "critical",
  "text-red-600": "critical",
  "text-red-700": "critical",
  "text-green-500": "success",
  "text-green-600": "success",
  "text-blue-500": "info",
  "text-blue-600": "info",
  "text-gray-300": "weak",
  "text-gray-400": "weak",
  "text-gray-500": "subdued",
  "text-gray-600": "subdued",
  "text-gray-700": "subdued",
  "text-slate-300": "weak",
  "text-slate-500": "subdued",
  "text-slate-700": "subdued",
  "text-slate-800": "strong",
  "text-slate-900": "strong",
  "text-stone-400": "subdued",
  "text-stone-500": "subdued",
};

/** @type {Array<{name: string, pattern: RegExp, rewrite: (m: RegExpExecArray) => string|null}>} */
const RULES = [
  {
    name: "Icon: className='shrink-0' → (default, drop attribute)",
    pattern: /<Icon\b([^/>]*?)\sclassName="shrink-0"([^/>]*?)(\/?)>/g,
    rewrite: (m) => `<Icon${m[1]}${m[2]}${m[3]}>`,
  },
  {
    name: "Icon: className='<color>' → tone=...",
    pattern: /<Icon\b([^/>]*?)\sclassName="([\w-]+)"([^/>]*?)(\/?)>/g,
    rewrite: (m) => {
      const tone = TONE_BY_COLOR_CLASS[m[2]];
      if (!tone) return null;
      return `<Icon${m[1]} tone="${tone}"${m[3]}${m[4]}>`;
    },
  },
  {
    name: "Icon: className='shrink-0 <color>' / '<color> shrink-0' → tone=...",
    pattern:
      /<Icon\b([^/>]*?)\sclassName="((?:shrink-0\s+[\w-]+)|(?:[\w-]+\s+shrink-0))"([^/>]*?)(\/?)>/g,
    rewrite: (m) => {
      const parts = m[2].split(/\s+/);
      const color = parts.find((p) => p !== "shrink-0");
      if (!color) return null;
      const tone = TONE_BY_COLOR_CLASS[color];
      if (!tone) return null;
      return `<Icon${m[1]} tone="${tone}"${m[3]}${m[4]}>`;
    },
  },
  {
    name: "Icon: className='rotate-90|rotate-180|-rotate-90' → rotate=...",
    pattern:
      /<Icon\b([^/>]*?)\sclassName="(-?rotate-(?:90|180))"([^/>]*?)(\/?)>/g,
    rewrite: (m) => {
      const ROTATE_BY_CLASS = {
        "rotate-90": "90",
        "rotate-180": "180",
        "-rotate-90": "-90",
      };
      const value = ROTATE_BY_CLASS[m[2]];
      if (!value) return null;
      return `<Icon${m[1]} rotate="${value}"${m[3]}${m[4]}>`;
    },
  },
  {
    name: "Text/Paragraph: className='truncate' → truncate",
    pattern:
      /<(Text|Paragraph)\b([^/>]*?)\sclassName="truncate"([^/>]*?)(\/?)>/g,
    rewrite: (m) => `<${m[1]}${m[2]} truncate${m[3]}${m[4]}>`,
  },
  {
    name: "Text/Paragraph: className='italic' → italic",
    pattern: /<(Text|Paragraph)\b([^/>]*?)\sclassName="italic"([^/>]*?)(\/?)>/g,
    rewrite: (m) => `<${m[1]}${m[2]} italic${m[3]}${m[4]}>`,
  },
  {
    name: "Text/Paragraph: className='text-center' → align='center'",
    pattern:
      /<(Text|Paragraph)\b([^/>]*?)\sclassName="text-center"([^/>]*?)(\/?)>/g,
    rewrite: (m) => `<${m[1]}${m[2]} align="center"${m[3]}${m[4]}>`,
  },
  {
    name: "Text/Paragraph: className='<color>' → tone=...",
    pattern:
      /<(Text|Paragraph)\b([^/>]*?)\sclassName="([\w-]+)"([^/>]*?)(\/?)>/g,
    rewrite: (m) => {
      const tone = TONE_BY_COLOR_CLASS[m[3]];
      if (!tone) return null;
      return `<${m[1]}${m[2]} tone="${tone}"${m[4]}${m[5]}>`;
    },
  },
  {
    name: "Text/Paragraph: className='font-mono' → font='mono'",
    pattern:
      /<(Text|Paragraph)\b([^/>]*?)\sclassName="font-mono!?"([^/>]*?)(\/?)>/g,
    rewrite: (m) => `<${m[1]}${m[2]} font="mono"${m[3]}${m[4]}>`,
  },
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git" || entry.startsWith(".")) {
      continue;
    }
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

function applyRules(content, stats) {
  let out = content;
  for (const rule of RULES) {
    out = out.replace(rule.pattern, (matchedText, ...rest) => {
      const groups = rest.slice(0, -2).map((g) => g ?? "");
      const fakeExec = [matchedText, ...groups];
      const replacement = rule.rewrite(fakeExec);
      if (replacement == null) return matchedText;
      stats.replacements[rule.name] = (stats.replacements[rule.name] ?? 0) + 1;
      return replacement;
    });
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const positional = args.filter((a) => !a.startsWith("--"));
  const targetRel = positional[0] ?? "src/routes/v2";
  const target = resolve(process.cwd(), targetRel);

  const files = walk(target);
  const stats = { files: files.length, filesChanged: 0, replacements: {} };

  for (const file of files) {
    const before = readFileSync(file, "utf8");
    const after = applyRules(before, stats);
    if (after !== before) {
      stats.filesChanged += 1;
      if (!dry) writeFileSync(file, after, "utf8");
    }
  }

  const summaryLines = Object.entries(stats.replacements)
    .sort((a, b) => b[1] - a[1])
    .map(([name, n]) => `  ${String(n).padStart(4)} × ${name}`);

  console.log(
    [
      `[${dry ? "dry" : "applied"}] ban-classname-on-primitives`,
      `target: ${target}`,
      `files scanned:  ${stats.files}`,
      `files changed:  ${stats.filesChanged}`,
      `replacements by rule:`,
      ...(summaryLines.length ? summaryLines : ["  (none)"]),
    ].join("\n"),
  );
}

main();
