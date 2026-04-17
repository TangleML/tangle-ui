import type { QueryClient } from "@tanstack/react-query";

import {
  listApiPublishedComponentsGet,
  publishApiPublishedComponentsPost,
  updateApiPublishedComponentsDigestPut,
} from "@/api/sdk.gen";
import type {
  ComponentReferenceInput,
  HttpValidationError,
} from "@/api/types.gen";
import { hydrateComponentReference } from "@/services/componentService";
import type { ComponentFolder } from "@/types/componentLibrary";
import {
  type ComponentReference,
  type ComponentReferenceWithDigest,
  isDiscoverableComponentReference,
} from "@/utils/componentSpec";
import type { ComponentReferenceWithSpec } from "@/utils/componentStore";
import { TWENTY_FOUR_HOURS_IN_MS } from "@/utils/constants";

import { isValidFilterRequest, type LibraryFilterRequest } from "../types";
import {
  DuplicateComponentError,
  InvalidComponentReferenceError,
  type Library,
  type RemoveComponentOptions,
} from "./types";

function getComponentReferenceInput(component: ComponentReferenceWithSpec) {
  return {
    name: component.name,
    digest: component.digest,
    url: component.url,
    spec: component.spec,
    text: component.text,
  } as ComponentReferenceInput;
}

class BackendValidationError extends Error {
  name = "BackendValidationError";

  constructor(
    message: string,
    readonly validationError: HttpValidationError | undefined,
  ) {
    super(message);
  }
}

class BackendLibraryError extends Error {
  name = "BackendLibraryError";

  constructor(message: string) {
    super(message);
  }
}

export class PublishedComponentsLibrary implements Library {
  #knownDigests: Set<string> = new Set();
  #queryClient: QueryClient;
  #backendUrl: string;

  constructor(queryClient: QueryClient, backendUrl = "") {
    this.#queryClient = queryClient;
    this.#backendUrl = backendUrl;
    // load known digests from storage
    // todo: prefetch components?
  }

  async hasComponent(component: ComponentReference): Promise<boolean> {
    const isDiscoverable = isDiscoverableComponentReference(component);
    if (!isDiscoverable) {
      return false;
    }

    if (this.#knownDigests.has(component.digest)) {
      return true;
    }

    // Fetch the full published list once (shared TanStack Query cache) instead of
    // making N individual GET requests that return 404 for unpublished components.
    const listResult = await this.#queryClient.fetchQuery({
      queryKey: ["publishedComponentsList"],
      queryFn: () => listApiPublishedComponentsGet({}),
      staleTime: TWENTY_FOUR_HOURS_IN_MS,
    });

    if (listResult.response.status !== 200) {
      console.error(listResult.error);
      throw new BackendLibraryError(
        `Unexpected status code: ${listResult.response.status}`,
      );
    }

    if (!listResult.data) {
      throw new BackendLibraryError("No data returned from server");
    }

    // Warm the in-memory cache from the list so subsequent calls skip the fetch.
    (listResult.data.published_components ?? []).forEach((c) =>
      this.#knownDigests.add(c.digest),
    );

    return this.#knownDigests.has(component.digest);
  }

  /**
   * Add a component to the library.
   *
   * @param component - The component to add.
   * @throws {InvalidComponentReferenceError} If the component is invalid.
   * @throws {DuplicateComponentError} If the component already exists.
   */
  async addComponent(component: ComponentReference): Promise<void> {
    if (
      isDiscoverableComponentReference(component) &&
      this.#knownDigests.has(component.digest)
    ) {
      throw new DuplicateComponentError(component);
    }

    const hydratedComponent = await hydrateComponentReference(component);

    if (!hydratedComponent) {
      throw new InvalidComponentReferenceError(component);
    }

    const publishComponentResult = await publishApiPublishedComponentsPost({
      body: getComponentReferenceInput(hydratedComponent),
    }).catch((error) => {
      console.error(error);
      throw error;
    });

    if (publishComponentResult.response.status !== 200) {
      switch (publishComponentResult.response.status) {
        case 422:
          // todo handle returned errors properly
          console.error(publishComponentResult.error);
          throw new BackendValidationError(
            `Invalid component`,
            publishComponentResult.error,
          );
        default:
          // todo handle errors properly
          console.error(publishComponentResult.error);
          throw new BackendLibraryError(
            `Unexpected status code: ${publishComponentResult.response.status}`,
          );
      }
    }

    this.#knownDigests.add(hydratedComponent.digest);
  }

  async removeComponent(
    component: ComponentReference,
    options?: RemoveComponentOptions,
  ): Promise<void> {
    const hydratedComponent = await hydrateComponentReference(component);

    if (!hydratedComponent) {
      throw new InvalidComponentReferenceError(component);
    }

    let supersededByDigest: string | undefined;

    if (options?.supersedeBy) {
      // should it handle adding component or leave it to the caller?
      const hydratedSupersedeBy = await hydrateComponentReference(
        options.supersedeBy,
      );

      if (!hydratedSupersedeBy) {
        throw new InvalidComponentReferenceError(options.supersedeBy);
      }

      await this.addComponent(hydratedSupersedeBy);
      supersededByDigest = hydratedSupersedeBy.digest;
    }

    const deleteComponentResult = await updateApiPublishedComponentsDigestPut({
      path: {
        digest: hydratedComponent.digest,
      },
      query: {
        deprecated: true,
        superseded_by: supersededByDigest,
      },
    });

    if (deleteComponentResult.response.status !== 200) {
      throw new BackendLibraryError(
        `Failed to delete component. Unexpected status code: ${deleteComponentResult.response.status}`,
      );
    }
  }

  async getComponents(filter: LibraryFilterRequest): Promise<ComponentFolder> {
    const listComponentsResult = isValidFilterRequest(filter)
      ? await listApiPublishedComponentsGet({
          query: {
            name_substring: filter.filters?.includes("name")
              ? filter.searchTerm
              : undefined,
            published_by_substring: filter.filters.includes("author")
              ? filter.searchTerm
              : undefined,
            include_deprecated: filter.filters?.includes("deprecated"),
          },
        })
      : await listApiPublishedComponentsGet({});

    if (listComponentsResult.response.status !== 200) {
      throw new BackendLibraryError(
        `Unexpected status code: ${listComponentsResult.response.status}`,
      );
    }

    if (!listComponentsResult.data) {
      throw new BackendLibraryError("No data returned from server");
    }

    const components = (
      listComponentsResult.data.published_components ?? []
    ).map(
      (component) =>
        ({
          digest: component.digest,
          name: component.name,
          url:
            component.url ??
            `${this.#backendUrl}/api/components/${component.digest}`,

          published_by: component.published_by,
          superseded_by: component.superseded_by,
          deprecated: component.deprecated,
        }) as ComponentReferenceWithDigest,
    );

    // warming up the cache
    components.forEach((component) => this.#knownDigests.add(component.digest));

    return {
      name: "Published Components",
      components,
      folders: [],
    };
  }
}
