export interface BetaFlag {
  name: string;
  description: string;
  default: boolean;
}

export type BetaFlags = Record<string, BetaFlag>;

export type Flag = BetaFlag & {
  key: string;
  enabled: boolean;
};
