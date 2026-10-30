import { describe, expect, it } from "vitest";

import type { TangentEnvironment } from "./listTangentEnvironments";
import {
  buildCursorConnectUrl,
  buildVscodeConnectUrl,
  isVscodeEnvironment,
} from "./vscodeConnect";

function environment(
  environmentId: string,
  metadata?: Record<string, string>,
): TangentEnvironment {
  return {
    environmentId,
    scoped: true,
    toolCount: 0,
    subagentCount: 0,
    ...(metadata ? { metadata } : {}),
  };
}

describe("isVscodeEnvironment", () => {
  it("matches a host that reports a VS Code editor", () => {
    expect(
      isVscodeEnvironment(
        environment("s1:vscode-abc123", { editor: "Cursor" }),
      ),
    ).toBe(true);
    expect(
      isVscodeEnvironment(
        environment("s1:vscode-abc123", { editor: "Visual Studio Code" }),
      ),
    ).toBe(true);
  });

  it("ignores a browser host even when its id contains vscode-", () => {
    expect(
      isVscodeEnvironment(environment("s1:vscode-1", { editor: "browser" })),
    ).toBe(false);
  });

  it("ignores hosts that do not report an editor", () => {
    expect(isVscodeEnvironment(environment("s1:workarea"))).toBe(false);
    expect(isVscodeEnvironment(environment("s1:tab-7"))).toBe(false);
    expect(isVscodeEnvironment(environment("tangle-ui-x1y2z3"))).toBe(false);
  });
});

describe("buildVscodeConnectUrl", () => {
  it("builds the extension's connect deep link with an encoded shell url", () => {
    expect(
      buildVscodeConnectUrl({ shellUrl: "https://oasis.example/tangent" }),
    ).toBe(
      "vscode://tangent.tangent-local-agent/connect?url=https%3A%2F%2Foasis.example%2Ftangent",
    );
  });

  it("appends the api url and project so the editor applies them immediately", () => {
    expect(
      buildVscodeConnectUrl({
        shellUrl: "https://oasis.example/tangent",
        apiUrl: "https://api.example",
        projectId: "p1",
        projectName: "My Project",
      }),
    ).toBe(
      "vscode://tangent.tangent-local-agent/connect?url=https%3A%2F%2Foasis.example%2Ftangent&apiUrl=https%3A%2F%2Fapi.example&projectId=p1&projectName=My+Project",
    );
  });
});

describe("buildCursorConnectUrl", () => {
  it("builds the extension's connect deep link under the cursor scheme", () => {
    expect(
      buildCursorConnectUrl({ shellUrl: "https://oasis.example/tangent" }),
    ).toBe(
      "cursor://tangent.tangent-local-agent/connect?url=https%3A%2F%2Foasis.example%2Ftangent",
    );
  });
});
