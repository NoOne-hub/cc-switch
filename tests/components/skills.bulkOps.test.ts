import { describe, expect, it } from "vitest";
import { buildBatchToggleOps } from "@/components/skills/bulkOps";

describe("buildBatchToggleOps", () => {
  it("builds cross-product operations for selected skills and apps", () => {
    const ops = buildBatchToggleOps(["s1", "s2"], ["claude", "codex"], true);
    expect(ops).toHaveLength(4);
    expect(ops[0]).toEqual({ id: "s1", app: "claude", enabled: true });
    expect(ops[3]).toEqual({ id: "s2", app: "codex", enabled: true });
  });

  it("deduplicates repeated skills/apps", () => {
    const ops = buildBatchToggleOps(
      ["s1", "s1", "s2"],
      ["claude", "claude"],
      false,
    );
    expect(ops).toEqual([
      { id: "s1", app: "claude", enabled: false },
      { id: "s2", app: "claude", enabled: false },
    ]);
  });
});
