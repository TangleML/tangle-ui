import { Box, Text } from "ink";
import { useState } from "react";

import type { TuiConfig } from "../config.ts";
import { INSTANCE_PRESETS, normalizeInstanceUrl } from "../instances.ts";
import { SelectList } from "./SelectList.tsx";
import { TextInput } from "./TextInput.tsx";

interface MenuItem {
  key: string;
  label: string;
  apiUrl?: string;
}

const CUSTOM_KEY = "__custom__";

const MENU_ITEMS: MenuItem[] = [
  ...INSTANCE_PRESETS.map((preset) => ({
    key: preset.apiUrl,
    label: `${preset.label}  (${preset.apiUrl})`,
    apiUrl: preset.apiUrl,
  })),
  { key: CUSTOM_KEY, label: "Custom URL…" },
];

interface ConnectScreenProps {
  onConnected: (config: TuiConfig) => void;
}

export function ConnectScreen({ onConnected }: ConnectScreenProps) {
  const [mode, setMode] = useState<"menu" | "custom">("menu");
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);

  function connect(apiUrl: string): void {
    try {
      const normalized = normalizeInstanceUrl(apiUrl);
      onConnected({ apiUrl: normalized, uiUrl: normalized });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Text bold color="magenta">
        Tangent TUI
      </Text>
      <Text dimColor>Connect to a Tangle instance.</Text>
      <Box marginTop={1} flexDirection="column">
        {mode === "menu" ? (
          <SelectList
            items={MENU_ITEMS}
            getKey={(item) => item.key}
            getLabel={(item) => item.label}
            onSelect={(item) => {
              setError(null);
              if (item.apiUrl) connect(item.apiUrl);
              else setMode("custom");
            }}
          />
        ) : (
          <Box flexDirection="column">
            <Text>Enter the instance URL (e.g. https://oasis.shopify.io):</Text>
            <TextInput
              value={custom}
              onChange={setCustom}
              onSubmit={(value) => connect(value)}
              placeholder="https://..."
            />
          </Box>
        )}
      </Box>
      {error ? (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      ) : null}
      <Box marginTop={1}>
        <Text dimColor>
          ↑/↓ to move · Enter to select · you may be asked to sign in via Okta
          in your browser
        </Text>
      </Box>
    </Box>
  );
}
