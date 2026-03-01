import type { AppId } from "@/lib/api/types";

export interface BatchToggleOp {
  id: string;
  app: AppId;
  enabled: boolean;
}

export function buildBatchToggleOps(
  skillIds: string[],
  appIds: AppId[],
  enabled: boolean,
): BatchToggleOp[] {
  const uniqueSkills = Array.from(new Set(skillIds));
  const uniqueApps = Array.from(new Set(appIds));
  const ops: BatchToggleOp[] = [];

  for (const id of uniqueSkills) {
    for (const app of uniqueApps) {
      ops.push({ id, app, enabled });
    }
  }

  return ops;
}
