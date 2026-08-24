import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { translateLiteral } from "@/lib/i18n";

const translatedBySharedUi = [
  "src/app/agents/page.tsx",
  "src/app/customers/page.tsx",
  "src/app/properties/page.tsx",
  "src/app/projects/page.tsx",
  "src/app/follow-ups/page.tsx",
  "src/app/matches/page.tsx",
  "src/app/settings/page.tsx",
  "src/app/import-center/page.tsx",
  "src/app/agents/[id]/dashboard/page.tsx",
];

describe("Turkish UI translation audit", () => {
  it.each(translatedBySharedUi)("has a Turkish translation for every Persian literal in %s", (relativePath) => {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
    const literals = [
      ...Array.from(source.matchAll(/"([^"\r\n]*[\u0600-\u06ff][^"\r\n]*)"/g), (match) => match[1]),
      ...Array.from(source.matchAll(/'([^'\r\n]*[\u0600-\u06ff][^'\r\n]*)'/g), (match) => match[1]),
      ...Array.from(source.matchAll(/`([^`\r\n]*[\u0600-\u06ff][^`\r\n]*)`/g), (match) => match[1]),
    ]
      .filter((value) => !value.includes("${"));
    const missing = Array.from(new Set(literals.filter((value) => /[\u0600-\u06ff]/.test(translateLiteral(value, "tr")))));
    expect(missing, `Missing Turkish translations:\n${missing.join("\n")}`).toEqual([]);
  });
});
