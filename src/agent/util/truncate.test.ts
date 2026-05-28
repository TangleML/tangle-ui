import { describe, expect, it } from "vitest";

import type { ContainerState, ExecutionDetails } from "@/agent/toolBridgeApi";

import {
  type ContainerLogInput,
  truncateContainerLog,
  truncateContainerState,
  truncateExecutionDetails,
} from "./truncate";

const LOG_BYTE_BUDGET = 8_192;
const ORCHESTRATION_ERROR_BUDGET = 2_048;
const STRING_FIELD_BUDGET = 2_048;
const MAX_DEBUG_INFO_KEYS = 20;

function makeContainerState(
  overrides: Partial<ContainerState> = {},
): ContainerState {
  return { status: "FAILED", ...overrides };
}

function makeExecutionDetails(
  overrides: Partial<ExecutionDetails> = {},
): ExecutionDetails {
  return {
    id: "exec-1",
    task_spec: {
      componentRef: { name: "noop" },
    } as ExecutionDetails["task_spec"],
    child_task_execution_ids: {},
    ...overrides,
  };
}

describe("truncateContainerLog", () => {
  it("preserves log fields under their byte budget without flagging truncation", () => {
    const result = truncateContainerLog({
      log_text: "hi",
      orchestration_error_message: "oops",
    });

    expect(result.log_text).toBe("hi");
    expect(result.orchestration_error_message).toBe("oops");
    expect(result.truncated).toBeUndefined();
  });

  it("keeps the trailing window of an oversized log_text and flags truncation", () => {
    const oversized = "L".repeat(LOG_BYTE_BUDGET + 5_000);
    const result = truncateContainerLog({ log_text: oversized });

    expect(result.truncated).toBe(true);
    // Trailing window preserved verbatim.
    expect(result.log_text?.endsWith("L".repeat(LOG_BYTE_BUDGET))).toBe(true);
    // Header reports how many chars were dropped from the front.
    expect(result.log_text).toMatch(/truncated 5000 chars/);
  });

  it("applies the smaller orchestration error budget independently", () => {
    const oversized = "X".repeat(ORCHESTRATION_ERROR_BUDGET + 1);
    const result = truncateContainerLog({
      log_text: "fine",
      orchestration_error_message: oversized,
    });

    expect(result.truncated).toBe(true);
    expect(result.log_text).toBe("fine");
    expect(
      result.orchestration_error_message?.endsWith(
        "X".repeat(ORCHESTRATION_ERROR_BUDGET),
      ),
    ).toBe(true);
  });

  it("skips null and undefined fields rather than emitting them as empty strings", () => {
    const input: ContainerLogInput = {
      log_text: null,
      system_error_exception_full: undefined,
      orchestration_error_message: "kept",
    };
    const result = truncateContainerLog(input);

    expect(result).toEqual({ orchestration_error_message: "kept" });
    expect("log_text" in result).toBe(false);
    expect("system_error_exception_full" in result).toBe(false);
  });
});

describe("truncateContainerState", () => {
  it("returns the state unchanged when debug_info is missing", () => {
    const state = makeContainerState({ exit_code: 1 });
    expect(truncateContainerState(state)).toBe(state);
  });

  it("caps debug_info to 20 keys, dropping the rest", () => {
    const debug_info: Record<string, unknown> = {};
    for (let i = 0; i < MAX_DEBUG_INFO_KEYS + 10; i++) {
      debug_info[`k${i}`] = `v${i}`;
    }
    const result = truncateContainerState(makeContainerState({ debug_info }));

    const keys = Object.keys(result.debug_info ?? {});
    expect(keys).toHaveLength(MAX_DEBUG_INFO_KEYS);
    // Insertion order is preserved — the cap drops the tail, not the head.
    expect(keys[0]).toBe("k0");
    expect(keys.at(-1)).toBe(`k${MAX_DEBUG_INFO_KEYS - 1}`);
  });

  it("truncates oversized string values per-key and leaves non-strings untouched", () => {
    const long = "y".repeat(STRING_FIELD_BUDGET + 100);
    const result = truncateContainerState(
      makeContainerState({
        debug_info: { long, short: "ok", count: 7, nested: { a: 1 } },
      }),
    );

    const truncatedLong = result.debug_info?.long;
    expect(typeof truncatedLong).toBe("string");
    if (typeof truncatedLong === "string") {
      expect(truncatedLong.endsWith("y".repeat(STRING_FIELD_BUDGET))).toBe(
        true,
      );
      expect(truncatedLong).toMatch(/truncated 100 chars/);
    }
    expect(result.debug_info?.short).toBe("ok");
    expect(result.debug_info?.count).toBe(7);
    expect(result.debug_info?.nested).toEqual({ a: 1 });
  });
});

describe("truncateExecutionDetails", () => {
  it("collapses non-empty artifact maps to {} so the model knows they exist", () => {
    const details = makeExecutionDetails({
      input_artifacts: { in: { id: "art1" } },
      output_artifacts: { out: { id: "art2" } },
    });

    const result = truncateExecutionDetails(details);
    expect(result.input_artifacts).toEqual({});
    expect(result.output_artifacts).toEqual({});
    // Other fields untouched.
    expect(result.id).toBe(details.id);
    expect(result.task_spec).toBe(details.task_spec);
  });

  it("leaves empty / missing artifact maps as-is", () => {
    const empty = makeExecutionDetails({
      input_artifacts: {},
      output_artifacts: undefined,
    });
    const result = truncateExecutionDetails(empty);

    expect(result.input_artifacts).toEqual({});
    expect(result.output_artifacts).toBeUndefined();
  });
});
