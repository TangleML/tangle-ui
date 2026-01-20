interface ConfigFlag {
  name: string;
  description: string;
  default: boolean;
  category: "beta" | "setting";
}

export type ConfigFlags = Record<string, ConfigFlag>;

export type Flag = ConfigFlag & {
  key: string;
  enabled: boolean;
};
