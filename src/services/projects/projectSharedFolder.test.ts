import { describe, expect, it } from "vitest";

import {
  readProjectSharedFolderId,
  withProjectSharedFolderId,
} from "./projectSharedFolder";

describe("readProjectSharedFolderId", () => {
  it("reads back the id written onto the metadata", () => {
    expect(
      readProjectSharedFolderId(withProjectSharedFolderId(null, "folder-1")),
    ).toBe("folder-1");
  });

  it.each([null, undefined, {}])("returns undefined for %s", (metadata) => {
    expect(readProjectSharedFolderId(metadata)).toBeUndefined();
  });

  it.each([42, "", "   ", { id: "folder-1" }])(
    "ignores a stored value of %j",
    (value) => {
      expect(
        readProjectSharedFolderId({ tangentSharedFolderId: value }),
      ).toBeUndefined();
    },
  );
});

describe("withProjectSharedFolderId", () => {
  it("keeps every other key on the metadata", () => {
    expect(
      withProjectSharedFolderId(
        { tangentBaseUrl: "http://shell.test", startingPrompt: "hi" },
        "folder-1",
      ),
    ).toEqual({
      tangentBaseUrl: "http://shell.test",
      startingPrompt: "hi",
      tangentSharedFolderId: "folder-1",
    });
  });
});
