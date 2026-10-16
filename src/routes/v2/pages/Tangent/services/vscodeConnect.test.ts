import { describe, expect, it } from "vitest";

import type { TangentEnvironment } from "./listTangentEnvironments";
import {
  buildCursorConnectUrl,
  buildVscodeConnectUrl,
  isVscodeEnvironment,
} from "./vscodeConnect";

function environment(environmentId: string): TangentEnvironment {
  return { environmentId, scoped: true, toolCount: 0, subagentCount: 0 };
}

describe("isVscodeEnvironment", () => {
  it("matches a VS Code host attached to a session", () => {
    expect(isVscodeEnvironment(environment("s1:vscode-abc123"))).toBe(true);
  });

  it("matches an unscoped VS Code dev host", () => {
    expect(isVscodeEnvironment(environment("vscode-abc123"))).toBe(true);
  });

  it("ignores the browser's own workarea and tab hosts", () => {
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
