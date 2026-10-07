import { describe, expect, it } from "vitest";

import { addRow, rowsFromUsers, usersFromRows } from "./accessUsers";

describe("accessUsers", () => {
  it("round-trips users through rows, sorted by email", () => {
    const users = {
      "sam@example.com": { permissions: ["edit"] },
      "ada@example.com": { permissions: ["run:cancel", "run:annotate"] },
    };

    const rows = rowsFromUsers(users);

    expect(rows.map((row) => row.email)).toEqual([
      "ada@example.com",
      "sam@example.com",
    ]);
    expect(usersFromRows(rows)).toEqual(users);
  });

  it("normalizes and replaces an existing email when adding", () => {
    const rows = addRow(
      [{ email: "sam@example.com", permissions: ["operate"] }],
      " Sam@Example.com ",
      "manage",
    );

    expect(rows).toEqual([
      { email: "sam@example.com", permissions: ["manage"] },
    ]);
  });

  it("ignores a blank email", () => {
    expect(addRow([], "  ", "edit")).toEqual([]);
  });
});
