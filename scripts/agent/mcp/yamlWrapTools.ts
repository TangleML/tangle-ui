/**
 * Tool for converting Python functions into Tangle component YAML specs
 * using the oasis-cli.
 *
 * Generated specs are stored in the session's `wrappedComponents` map so that
 * `add_task` can reference them by key without the model needing to pass the
 * full implementation payload.
 */
import { tool } from "@langchain/core/tools";
import { execSync } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { load as loadYaml } from "js-yaml";
import { tmpdir } from "os";
import { join } from "path";
import { z } from "zod";

import type { ComponentSpec } from "@/utils/componentSpec";

import type { AgentSession } from "../session";

// ---------------------------------------------------------------------------
// oasis-cli conversion
// ---------------------------------------------------------------------------

async function convertPythonToYaml(
  pythonCode: string,
  functionName: string,
): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "tangle-ai-"));
  const pyPath = join(tempDir, `${functionName}.py`);
  const yamlPath = join(tempDir, `${functionName}.component.yaml`);

  try {
    await writeFile(pyPath, pythonCode, "utf-8");

    const cmd = [
      `PYTHONPATH=${tempDir}`,
      "uvx",
      "--refresh",
      "--from",
      "git+https://github.com/Cloud-Pipelines/oasis-cli.git@stable",
      "oasis",
      "components",
      "regenerate",
      "python-function-component",
      `--output-component-yaml-path`,
      `"${yamlPath}"`,
      `--module-path="${pyPath}"`,
      `--function-name`,
      `"${functionName}"`,
    ].join(" ");

    execSync(cmd, { timeout: 60_000, stdio: "pipe" });

    return await readFile(yamlPath, "utf-8");
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Tool factory — creates tools bound to a specific session
// ---------------------------------------------------------------------------

export function createYamlWrapTools(session: AgentSession) {
  const wrapPythonToYaml = tool(
    async ({
      pythonCode,
      functionName,
    }: {
      pythonCode?: string;
      functionName?: string;
    }) => {
      if (!pythonCode || !functionName) {
        return JSON.stringify({
          success: false,
          error:
            "Both 'pythonCode' and 'functionName' are required. Please provide the full Python source code and the function name.",
        });
      }

      try {
        const yaml = await convertPythonToYaml(pythonCode, functionName);
        const parsed = loadYaml(yaml) as ComponentSpec;

        session.wrappedComponents.set(functionName, { yaml, parsed });

        return JSON.stringify({
          success: true,
          componentKey: functionName,
          name: parsed.name,
          description: parsed.description,
          inputs: parsed.inputs?.map((i) => ({
            name: i.name,
            type: i.type,
          })),
          outputs: parsed.outputs?.map((o) => ({
            name: o.name,
            type: o.type,
          })),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return JSON.stringify({ success: false, error: message });
      }
    },
    {
      name: "wrap_python_to_yaml",
      description:
        "Convert a Python function into a Tangle component YAML specification using oasis-cli. " +
        "Returns a `componentKey` that you pass to `add_task` — do NOT manually reconstruct the implementation. " +
        "The function must have type hints and a docstring.",
      schema: z.object({
        pythonCode: z
          .string()
          .optional()
          .describe(
            "Complete Python function source code with type hints and docstring. All imports must be inside the function body.",
          ),
        functionName: z
          .string()
          .optional()
          .describe("Name of the Python function to convert"),
      }),
    },
  );

  return [wrapPythonToYaml];
}
