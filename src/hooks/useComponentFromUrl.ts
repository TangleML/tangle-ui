import { useEffect, useState } from "react";

import {
  fetchAndStoreComponentByUrl,
  generateDigest,
  parseComponentData,
} from "@/services/componentService";
import type { ComponentSpec } from "@/utils/componentSpec";
import { getComponentByUrl } from "@/utils/localforage";

const useComponentFromUrl = (url?: string) => {
  const [isLoading, setIsLoading] = useState(true);
  const [componentSpec, setComponentSpec] = useState<ComponentSpec>();
  const [componentText, setComponentText] = useState<string>();
  const [componentDigest, setComponentDigest] = useState<string>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const loadComponent = async () => {
      if (!url) return;

      try {
        setIsLoading(true);
        setError(null);

        const storedComponent = await getComponentByUrl(url);

        if (storedComponent) {
          if (signal.aborted) return;
          // Parse the component data
          const text = storedComponent.data;
          setComponentText(text);

          try {
            // Parse the component spec from the text
            const parsedSpec = parseComponentData(text);
            if (parsedSpec) {
              setComponentSpec(parsedSpec);
              const digest = await generateDigest(text);
              setComponentDigest(digest);
              setIsLoading(false);
              return;
            }
          } catch (err) {
            console.error("Error parsing component from local storage:", err);
            // Fall through to network fetch
          }
        }

        // If component doesn't exist in storage or parsing failed, fetch and store it
        const spec = await fetchAndStoreComponentByUrl(url);
        if (signal.aborted) return;

        if (spec) {
          setComponentSpec(spec);

          // Get the stored component to get the text
          const updatedComponent = await getComponentByUrl(url);
          if (updatedComponent && !signal.aborted) {
            const text = updatedComponent.data;
            setComponentText(text);
            const digest = await generateDigest(text);
            setComponentDigest(digest);
          }
        } else {
          throw new Error("Failed to load component specification");
        }
      } catch (err) {
        if (!signal.aborted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    loadComponent();
    return () => controller.abort();
  }, [url]);

  const componentRef = {
    spec: componentSpec,
    digest: componentDigest,
    text: componentText,
    url: url,
  };

  return { isLoading, error, componentRef };
};

export default useComponentFromUrl;
