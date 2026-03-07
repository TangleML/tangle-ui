import type { ComponentType } from "react";

export enum QueryParamType {
  String = "string",
  Json = "json",
}

export enum ReplacementType {
  String = "string",
  Number = "number",
  Boolean = "boolean",
}

export enum BlockType {
  TextBlock = "TextBlock",
  LinkBlock = "LinkBlock",
}

export type QueryParam =
  | { type: QueryParamType.String; value: string }
  | { type: QueryParamType.Json; value: Record<string, unknown> };

export interface TextBlockProperties {
  text?: string;
  tone?: "default" | "subdued" | "warning" | "critical";
  wrap?: boolean;
  isVisible?: boolean;
}

export interface LinkBlockProperties {
  title?: string;
  urlTemplate: string;
  queryParams?: Record<string, QueryParam>;
}

interface ReplacementDescriptor {
  type: ReplacementType;
  required: boolean;
  default?: string | number | boolean;
}

interface BlockDescriptorBase {
  id: string;
  blockType: BlockType;
  /**
   * Key = placeholder name (e.g., "podName", "startTime"), NOT block ID.
   * Declares which {placeholder} tokens appear in this block's properties.
   */
  replacements?: Record<string, ReplacementDescriptor>;
}

export interface TextBlockDescriptor extends BlockDescriptorBase {
  blockType: BlockType.TextBlock;
  properties: TextBlockProperties;
}

export interface LinkBlockDescriptor extends BlockDescriptorBase {
  blockType: BlockType.LinkBlock;
  properties: LinkBlockProperties;
}

export type BlockDescriptor = TextBlockDescriptor | LinkBlockDescriptor;

export interface SectionDescriptor {
  id: string;
  title: string;
  blocks: BlockDescriptor[];
}

export interface ComposerSchema {
  metadata: Record<string, unknown>;
  sections: SectionDescriptor[];
}

/**
 * Per-block, flat key-value map of resolved replacement values.
 * Key = replacement/placeholder name (e.g., "podName", "startTime").
 * Value = the resolved value to substitute into {placeholder} tokens.
 */
export type BlockHydrationReplacements = Record<
  string,
  string | number | boolean
>;

export type BlockValidationResult =
  | { ok: true; values: BlockHydrationReplacements }
  | { ok: false; blockId: string; missing: string[] };

export interface SchemaValidationResult {
  ok: boolean;
  warnings: string[];
}

export type BlockRegistry = {
  [BlockType.TextBlock]: ComponentType<TextBlockProperties>;
  [BlockType.LinkBlock]: ComponentType<LinkBlockProperties>;
};
