/**
 * Skills loader for the in-browser agent.
 *
 * Loads a `SKILL.md` document over HTTP from `${skillsBaseUrl}/${id}/SKILL.md`
 * and persists the content in `agentDb.skills` so subsequent worker sessions
 * start warm. Cache freshness is keyed off `GIT_COMMIT.substring(0, 6)` —
 * skills change only when the app is deployed, so the build SHA prefix is
 * sufficient as a version marker.
 */
import { GIT_COMMIT } from "@/utils/constants";

import { requireSkillsBaseUrl } from "../config";
import { agentDb, type SkillEntry } from "../idb/agentDb";

const SKILLS_VERSION = GIT_COMMIT.substring(0, 6);

export class SkillsLoader {
  readonly #skills = new Map<string, Promise<string>>();

  getSkill(skillId: string): Promise<string> {
    const existing = this.#skills.get(skillId);
    if (existing) return existing;
    const promise = this.#resolve(skillId);
    this.#skills.set(skillId, promise);
    return promise;
  }

  async #resolve(skillId: string): Promise<string> {
    const row = await agentDb.skills.get(skillId);
    if (row && row.version === SKILLS_VERSION) return row.content;
    try {
      const url = `${requireSkillsBaseUrl()}/${skillId}/SKILL.md`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const content = await response.text();
      const entry: SkillEntry = {
        id: skillId,
        version: SKILLS_VERSION,
        content,
      };
      await agentDb.skills.put(entry);
      return content;
    } catch {
      return row?.content ?? "";
    }
  }
}
