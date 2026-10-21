/**
 * Session-resource tools for the remote editor sub-agent.
 *
 * These mirror the pi host's session-resource extension so a browser sub-agent
 * can see and fetch files Prime or agents on other environments contributed to
 * the Tangent session (e.g. an uploaded `uploads/*.yaml`). They are host
 * capabilities rather than CSOM mutations: each call reaches the main-thread
 * socket client through the proxied `SessionResourceBridge`, scoped to the
 * turn's session.
 */
import { tool } from "@openai/agents";
import type { Resource } from "@tangent/shared/contracts.ts";
import { z } from "zod";

import type { SessionResourceBridge } from "../sessionResourceBridge";

function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function renderResourceList(resources: Resource[]): string {
  if (resources.length === 0) return "(no session resources)";
  return resources
    .map((resource) => `- ${resource.name} (${resource.uri}) [${resource.kind}]`)
    .join("\n");
}

export function createSessionResourceTools(resources: SessionResourceBridge) {
  const listSessionResources = tool({
    name: "list_session_resources",
    description:
      "List the files and resources catalogued in the Tangent session, including those contributed by Prime and agents on other environments. Returns each resource's name and uri.",
    parameters: z.object({}),
    execute: async () => {
      const catalog = await resources.list();
      return `## Session resources\n\n${renderResourceList(catalog)}`;
    },
  });

  const readSessionResource = tool({
    name: "read_session_resource",
    description:
      "Read a Tangent session resource's contents by its uri (e.g. 'uploads/report.yaml'), including content another environment contributed. Returns the decoded text.",
    parameters: z.object({
      uri: z
        .string()
        .describe(
          "Session-root-relative resource uri, e.g. 'uploads/report.yaml'.",
        ),
    }),
    execute: async ({ uri }) => {
      const { content } = await resources.read(uri);
      return decodeBase64Utf8(content);
    },
  });

  const putSessionResource = tool({
    name: "put_session_resource",
    description:
      "Write a file into the Tangent session's uploads/ folder so Prime and other agents (including those on other environments) can fetch it. Binary content must be base64 with encoding 'base64'.",
    parameters: z.object({
      path: z
        .string()
        .describe("Destination path inside the session's uploads/ folder."),
      content: z.string().describe("File contents (text, or base64)."),
      encoding: z
        .enum(["utf8", "base64"])
        .nullable()
        .optional()
        .describe("How content is decoded. Defaults to utf8."),
      name: z
        .string()
        .nullable()
        .optional()
        .describe("Catalog display name; defaults to the path basename."),
      contentType: z
        .string()
        .nullable()
        .optional()
        .describe("MIME type recorded in the catalog meta."),
    }),
    execute: async ({ path, content, encoding, name, contentType }) => {
      const stored = await resources.put({
        kind: "file",
        path,
        content,
        encoding: encoding ?? "utf8",
        ...(name ? { name } : {}),
        ...(contentType ? { meta: { contentType } } : {}),
      });
      return `Added session resource ${stored.uri}`;
    },
  });

  return {
    listSessionResources,
    readSessionResource,
    putSessionResource,
    allTools: [listSessionResources, readSessionResource, putSessionResource],
  };
}
