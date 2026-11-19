import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";
import type { StoredLibrary } from "@/providers/ComponentLibraryProvider/libraries/storage";
import type { Library } from "@/providers/ComponentLibraryProvider/libraries/types";

import { ConnectedLibrariesSection } from "./ConnectedLibrariesSection";

vi.mock("@/components/shared/Settings/useFlags", () => ({
  useFlagValue: vi.fn(),
}));

vi.mock("@/providers/ComponentLibraryProvider", () => ({
  useComponentLibrary: vi.fn(),
}));

vi.mock("@/components/shared/GitHubLibrary/ManageLibrariesDialog", () => ({
  ManageLibrariesDialog: () => <button>Manage libraries</button>,
}));

vi.mock("../components/FolderItem", () => ({
  LibraryFolderItem: ({ library }: { library: { libraryId: string } }) => (
    <div data-testid="library-folder-item">{library.libraryId}</div>
  ),
}));

const getComponentLibrary = vi.fn<(id: string) => Library>();

function storedLibrary(id: string): StoredLibrary {
  return { id, name: id, type: "github", knownDigests: [] };
}

const given = ({
  flag,
  libraries,
}: {
  flag: boolean;
  libraries: StoredLibrary[] | undefined;
}) => {
  vi.mocked(useFlagValue).mockReturnValue(flag);
  vi.mocked(useComponentLibrary).mockReturnValue({
    getComponentLibrary,
    existingComponentLibraries: libraries,
  } as unknown as ReturnType<typeof useComponentLibrary>);
};

describe("ConnectedLibrariesSection", () => {
  beforeEach(() => {
    getComponentLibrary.mockImplementation(
      (id: string) => ({ libraryId: id }) as unknown as Library,
    );
  });
  afterEach(() => vi.resetAllMocks());

  it("renders nothing when the github-component-library flag is off", () => {
    given({
      flag: false,
      libraries: [storedLibrary("library-a"), storedLibrary("library-b")],
    });

    const { container } = render(<ConnectedLibrariesSection />);

    expect(container).toBeEmptyDOMElement();
    expect(useFlagValue).toHaveBeenCalledWith("github-component-library");
  });

  it("shows the header, the manage dialog and the empty state when no libraries are connected", () => {
    given({ flag: true, libraries: [] });

    render(<ConnectedLibrariesSection />);

    expect(screen.getByText("Connected libraries")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Manage libraries" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No libraries connected")).toBeInTheDocument();
    expect(screen.queryByTestId("library-folder-item")).not.toBeInTheDocument();
  });

  it("renders one library folder per connected library, in order", () => {
    given({
      flag: true,
      libraries: [storedLibrary("library-a"), storedLibrary("library-b")],
    });

    render(<ConnectedLibrariesSection />);

    expect(
      screen.queryByText("No libraries connected"),
    ).not.toBeInTheDocument();
    expect(
      screen
        .getAllByTestId("library-folder-item")
        .map((item) => item.textContent),
    ).toEqual(["library-a", "library-b"]);
    expect(getComponentLibrary).toHaveBeenCalledWith("library-a");
    expect(getComponentLibrary).toHaveBeenCalledWith("library-b");
  });
});
