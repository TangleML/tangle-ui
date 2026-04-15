/**
 * Tool for testing Python component functions in a temporary subprocess.
 */
import { tool } from "@langchain/core/tools";
import { execSync } from "child_process";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { z } from "zod";

export const testPythonComponent = tool(
  async ({
    pythonCode,
    functionName,
    testCode,
  }: {
    pythonCode: string;
    functionName: string;
    testCode: string;
  }) => {
    const tempDir = await mkdtemp(join(tmpdir(), "tangle-pytest-"));

    try {
      const modulePath = join(tempDir, `${functionName}.py`);
      await writeFile(modulePath, pythonCode, "utf-8");

      const testScript = `
import sys
sys.path.insert(0, "${tempDir}")
from ${functionName} import ${functionName}

${testCode}
`;
      const testPath = join(tempDir, "test_runner.py");
      await writeFile(testPath, testScript, "utf-8");

      try {
        const stdout = execSync(`python3 "${testPath}"`, {
          timeout: 30_000,
          stdio: "pipe",
          cwd: tempDir,
        }).toString();

        return JSON.stringify({
          success: true,
          exitCode: 0,
          stdout,
          stderr: "",
        });
      } catch (execError: unknown) {
        const err = execError as {
          status?: number;
          stdout?: Buffer;
          stderr?: Buffer;
        };
        return JSON.stringify({
          success: false,
          exitCode: err.status ?? 1,
          stdout: err.stdout?.toString() ?? "",
          stderr: err.stderr?.toString() ?? "",
        });
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  },
  {
    name: "test_python_component",
    description:
      "Run a Python component function with test code to verify it works. Executes in an isolated temp directory.",
    schema: z.object({
      pythonCode: z
        .string()
        .describe("The full Python source of the component function"),
      functionName: z.string().describe("Name of the function to test"),
      testCode: z
        .string()
        .describe(
          "Python test code that calls the function and asserts results. The function is already imported.",
        ),
    }),
  },
);

export const pythonTestTools = [testPythonComponent];
