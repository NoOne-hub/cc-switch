import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Trash2, ExternalLink, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  useInstalledSkills,
  useToggleSkillApp,
  useUninstallSkill,
  useScanUnmanagedSkills,
  useImportSkillsFromApps,
  useInstallSkillsFromZip,
  type InstalledSkill,
} from "@/hooks/useSkills";
import type { AppId } from "@/lib/api/types";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { settingsApi, skillsApi } from "@/lib/api";
import { toast } from "sonner";
import { MCP_SKILLS_APP_IDS } from "@/config/appConfig";
import { AppCountBar } from "@/components/common/AppCountBar";
import { AppToggleGroup } from "@/components/common/AppToggleGroup";
import { ListItemRow } from "@/components/common/ListItemRow";
import { buildBatchToggleOps } from "@/components/skills/bulkOps";

interface UnifiedSkillsPanelProps {
  onOpenDiscovery: () => void;
  currentApp: AppId;
}

export interface UnifiedSkillsPanelHandle {
  openDiscovery: () => void;
  openImport: () => void;
  openInstallFromZip: () => void;
  openInstallFromGithub: () => void;
  openInstallFromLocal: () => void;
}

const UnifiedSkillsPanel = React.forwardRef<
  UnifiedSkillsPanelHandle,
  UnifiedSkillsPanelProps
>(({ onOpenDiscovery, currentApp }, ref) => {
  const { t } = useTranslation();
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(
    new Set(),
  );
  const [batchTargetApps, setBatchTargetApps] = useState<Set<AppId>>(
    new Set(MCP_SKILLS_APP_IDS),
  );
  const [batchBusy, setBatchBusy] = useState(false);

  const { data: skills, isLoading, refetch: refetchInstalled } =
    useInstalledSkills();
  const toggleAppMutation = useToggleSkillApp();
  const uninstallMutation = useUninstallSkill();
  const { data: unmanagedSkills, refetch: scanUnmanaged } =
    useScanUnmanagedSkills();
  const importMutation = useImportSkillsFromApps();
  const installFromZipMutation = useInstallSkillsFromZip();

  const normalizedSkills = useMemo(() => {
    if (!skills) return [] as InstalledSkill[];
    return skills.map((skill) => ({
      ...skill,
      apps: {
        claude: Boolean((skill as any)?.apps?.claude),
        codex: Boolean((skill as any)?.apps?.codex),
        gemini: Boolean((skill as any)?.apps?.gemini),
        opencode: Boolean((skill as any)?.apps?.opencode),
        openclaw: Boolean((skill as any)?.apps?.openclaw),
      },
    }));
  }, [skills]);

  const enabledCounts = useMemo(() => {
    const counts = { claude: 0, codex: 0, gemini: 0, opencode: 0, openclaw: 0 };
    if (!normalizedSkills) return counts;
    normalizedSkills.forEach((skill) => {
      for (const app of MCP_SKILLS_APP_IDS) {
        if (skill.apps[app]) counts[app]++;
      }
    });
    return counts;
  }, [normalizedSkills]);
  const selectedCount = selectedSkillIds.size;

  const handleToggleApp = async (id: string, app: AppId, enabled: boolean) => {
    try {
      await toggleAppMutation.mutateAsync({ id, app, enabled });
    } catch (error) {
      toast.error(t("common.error"), { description: String(error) });
    }
  };

  const toggleSkillSelection = (id: string, selected: boolean) => {
    setSelectedSkillIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!normalizedSkills || normalizedSkills.length === 0) return;
    setSelectedSkillIds(new Set(normalizedSkills.map((s) => s.id)));
  };

  const handleClearSelection = () => {
    setSelectedSkillIds(new Set());
  };

  const toggleBatchTargetApp = (app: AppId, enabled: boolean) => {
    setBatchTargetApps((prev) => {
      const next = new Set(prev);
      if (enabled) {
        next.add(app);
      } else {
        next.delete(app);
      }
      return next;
    });
  };

  const handleBatchToggle = async (enabled: boolean) => {
    if (selectedSkillIds.size === 0 || batchTargetApps.size === 0) return;
    const ops = buildBatchToggleOps(
      Array.from(selectedSkillIds),
      Array.from(batchTargetApps),
      enabled,
    );

    setBatchBusy(true);
    try {
      const results = await Promise.allSettled(
        ops.map((op) => skillsApi.toggleApp(op.id, op.app, op.enabled)),
      );
      const successCount = results.filter((r) => r.status === "fulfilled").length;
      const failedCount = results.length - successCount;

      if (failedCount === 0) {
        toast.success(
          t("skills.batchToggleSuccess", {
            defaultValue: "批量操作成功：{{count}} 项",
            count: successCount,
          }),
          { closeButton: true },
        );
      } else {
        toast.warning(
          t("skills.batchTogglePartial", {
            defaultValue: "批量操作完成：成功 {{ok}}，失败 {{fail}}",
            ok: successCount,
            fail: failedCount,
          }),
          { closeButton: true },
        );
      }

      await refetchInstalled();
    } catch (error) {
      toast.error(t("common.error"), { description: String(error) });
    } finally {
      setBatchBusy(false);
    }
  };

  const handleUninstall = (skill: InstalledSkill) => {
    setConfirmDialog({
      isOpen: true,
      title: t("skills.uninstall"),
      message: t("skills.uninstallConfirm", { name: skill.name }),
      onConfirm: async () => {
        try {
          await uninstallMutation.mutateAsync(skill.id);
          setConfirmDialog(null);
          toast.success(t("skills.uninstallSuccess", { name: skill.name }), {
            closeButton: true,
          });
        } catch (error) {
          toast.error(t("common.error"), { description: String(error) });
        }
      },
    });
  };

  const handleBatchUninstall = () => {
    if (!normalizedSkills || selectedSkillIds.size === 0) return;
    const selected = normalizedSkills.filter((s) => selectedSkillIds.has(s.id));

    setConfirmDialog({
      isOpen: true,
      title: t("skills.batchUninstall", { defaultValue: "批量卸载" }),
      message: t("skills.batchUninstallConfirm", {
        defaultValue: "确认卸载已选中的 {{count}} 个 Skills？",
        count: selected.length,
      }),
      onConfirm: async () => {
        setBatchBusy(true);
        try {
          const results = await Promise.allSettled(
            selected.map((s) => uninstallMutation.mutateAsync(s.id)),
          );
          const successCount = results.filter((r) => r.status === "fulfilled").length;
          const failedCount = results.length - successCount;

          setConfirmDialog(null);
          setSelectedSkillIds(new Set());

          if (failedCount === 0) {
            toast.success(
              t("skills.batchUninstallSuccess", {
                defaultValue: "批量卸载成功：{{count}} 个",
                count: successCount,
              }),
              { closeButton: true },
            );
          } else {
            toast.warning(
              t("skills.batchUninstallPartial", {
                defaultValue: "批量卸载完成：成功 {{ok}}，失败 {{fail}}",
                ok: successCount,
                fail: failedCount,
              }),
              { closeButton: true },
            );
          }
        } catch (error) {
          toast.error(t("common.error"), { description: String(error) });
        } finally {
          setBatchBusy(false);
        }
      },
    });
  };

  const handleOpenImport = async () => {
    try {
      const result = await scanUnmanaged();
      if (!result.data || result.data.length === 0) {
        toast.success(t("skills.noUnmanagedFound"), { closeButton: true });
        return;
      }
      setImportDialogOpen(true);
    } catch (error) {
      toast.error(t("common.error"), { description: String(error) });
    }
  };

  const handleImport = async (directories: string[]) => {
    try {
      const imported = await importMutation.mutateAsync(directories);
      setImportDialogOpen(false);
      toast.success(t("skills.importSuccess", { count: imported.length }), {
        closeButton: true,
      });
    } catch (error) {
      toast.error(t("common.error"), { description: String(error) });
    }
  };

  const handleInstallFromZip = async () => {
    try {
      const filePath = await skillsApi.openZipFileDialog();
      if (!filePath) return;

      const installed = await installFromZipMutation.mutateAsync({
        filePath,
        currentApp,
      });

      if (installed.length === 0) {
        toast.info(t("skills.installFromZip.noSkillsFound"), {
          closeButton: true,
        });
      } else if (installed.length === 1) {
        toast.success(
          t("skills.installFromZip.successSingle", { name: installed[0].name }),
          { closeButton: true },
        );
      } else {
        toast.success(
          t("skills.installFromZip.successMultiple", {
            count: installed.length,
          }),
          { closeButton: true },
        );
      }
    } catch (error) {
      toast.error(t("skills.installFailed"), { description: String(error) });
    }
  };

  const handleInstallFromGithub = async () => {
    const url = window.prompt(
      t("skills.installFromGithub.input", {
        defaultValue: "请输入 GitHub Skill 链接",
      }),
    );
    if (!url || !url.trim()) return;

    try {
      const installed = await skillsApi.installFromGithubUrl(url.trim(), currentApp);
      toast.success(
        t("skills.installFromGithub.success", {
          count: installed.length,
          defaultValue: "已从 GitHub 导入 {{count}} 个 Skill",
        }),
        { closeButton: true },
      );
      await refetchInstalled();
    } catch (error) {
      toast.error(
        t("skills.installFromGithub.failed", {
          defaultValue: "GitHub 导入失败",
        }),
        { description: String(error) },
      );
    }
  };

  const handleInstallFromLocal = async () => {
    try {
      const dir = await settingsApi.selectConfigDirectory();
      if (!dir) return;

      const installed = await skillsApi.installFromLocalPath(dir, currentApp);
      toast.success(
        t("skills.installFromLocal.success", {
          count: installed.length,
          defaultValue: "已从本地导入 {{count}} 个 Skill",
        }),
        { closeButton: true },
      );
      await refetchInstalled();
    } catch (error) {
      toast.error(
        t("skills.installFromLocal.failed", {
          defaultValue: "本地导入失败",
        }),
        { description: String(error) },
      );
    }
  };

  React.useImperativeHandle(ref, () => ({
    openDiscovery: onOpenDiscovery,
    openImport: handleOpenImport,
    openInstallFromZip: handleInstallFromZip,
    openInstallFromGithub: handleInstallFromGithub,
    openInstallFromLocal: handleInstallFromLocal,
  }));

  const batchTargetState = useMemo(
    () => ({
      claude: batchTargetApps.has("claude"),
      codex: batchTargetApps.has("codex"),
      gemini: batchTargetApps.has("gemini"),
      opencode: batchTargetApps.has("opencode"),
      openclaw: false,
    }),
    [batchTargetApps],
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className="px-6 flex flex-col h-[calc(100vh-8rem)] overflow-hidden">
        <AppCountBar
          totalLabel={t("skills.installed", { count: skills?.length || 0 })}
          counts={enabledCounts}
          appIds={MCP_SKILLS_APP_IDS}
        />

      <div className="flex-shrink-0 mb-3 rounded-xl border border-border-default bg-background/60 p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            disabled={!normalizedSkills || normalizedSkills.length === 0 || batchBusy}
          >
            <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
            {t("skills.selectAll", { defaultValue: "全选" })}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearSelection}
            disabled={selectedCount === 0 || batchBusy}
          >
            <Square className="w-3.5 h-3.5 mr-1.5" />
            {t("skills.clearSelection", { defaultValue: "清空选择" })}
          </Button>
          <span className="text-xs text-muted-foreground ml-1">
            {t("skills.selectedCount", {
              defaultValue: "已选 {{count}} 项",
              count: selectedCount,
            })}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground">
            {t("skills.batchTargetApps", { defaultValue: "批量目标客户端" })}
          </span>
          <AppToggleGroup
            apps={batchTargetState}
            onToggle={toggleBatchTargetApp}
            appIds={MCP_SKILLS_APP_IDS}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBatchToggle(true)}
            disabled={selectedCount === 0 || batchTargetApps.size === 0 || batchBusy}
          >
            {t("skills.batchEnable", { defaultValue: "批量启用" })}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleBatchToggle(false)}
            disabled={selectedCount === 0 || batchTargetApps.size === 0 || batchBusy}
          >
            {t("skills.batchDisable", { defaultValue: "批量禁用" })}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 hover:text-red-700"
            onClick={handleBatchUninstall}
            disabled={selectedCount === 0 || batchBusy}
          >
            {t("skills.batchUninstall", { defaultValue: "批量卸载" })}
          </Button>
        </div>
      </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden pb-24">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              {t("skills.loading")}
            </div>
          ) : !normalizedSkills || normalizedSkills.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                <Sparkles size={24} className="text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                {t("skills.noInstalled")}
              </h3>
              <p className="text-muted-foreground text-sm">
                {t("skills.noInstalledDescription")}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border-default overflow-hidden">
              {normalizedSkills.map((skill, index) => (
                <InstalledSkillListItem
                  key={skill.id}
                  skill={skill}
                  onToggleApp={handleToggleApp}
                  onUninstall={() => handleUninstall(skill)}
                  selected={selectedSkillIds.has(skill.id)}
                  onSelectChange={(selected) =>
                    toggleSkillSelection(skill.id, selected)
                  }
                  isLast={index === normalizedSkills.length - 1}
                />
              ))}
            </div>
          )}
        </div>

        {confirmDialog && (
          <ConfirmDialog
            isOpen={confirmDialog.isOpen}
            title={confirmDialog.title}
            message={confirmDialog.message}
            onConfirm={confirmDialog.onConfirm}
            onCancel={() => setConfirmDialog(null)}
          />
        )}

        {importDialogOpen && unmanagedSkills && (
          <ImportSkillsDialog
            skills={unmanagedSkills}
            onImport={handleImport}
            onClose={() => setImportDialogOpen(false)}
          />
        )}
      </div>
    </TooltipProvider>
  );
});

UnifiedSkillsPanel.displayName = "UnifiedSkillsPanel";

interface InstalledSkillListItemProps {
  skill: InstalledSkill;
  onToggleApp: (id: string, app: AppId, enabled: boolean) => void;
  onUninstall: () => void;
  selected: boolean;
  onSelectChange: (selected: boolean) => void;
  isLast?: boolean;
}

const InstalledSkillListItem: React.FC<InstalledSkillListItemProps> = ({
  skill,
  onToggleApp,
  onUninstall,
  selected,
  onSelectChange,
  isLast,
}) => {
  const { t } = useTranslation();

  const openDocs = async () => {
    if (!skill.readmeUrl) return;
    try {
      await settingsApi.openExternal(skill.readmeUrl);
    } catch {
      // ignore
    }
  };

  const sourceLabel = useMemo(() => {
    if (skill.repoOwner && skill.repoName) {
      return `${skill.repoOwner}/${skill.repoName}`;
    }
    return t("skills.local");
  }, [skill.repoOwner, skill.repoName, t]);

  return (
    <ListItemRow isLast={isLast}>
      <div className="flex-shrink-0">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelectChange(e.target.checked)}
          className="h-4 w-4"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-sm text-foreground truncate">
            {skill.name}
          </span>
          {skill.readmeUrl && (
            <button
              type="button"
              onClick={openDocs}
              className="text-muted-foreground/60 hover:text-foreground flex-shrink-0"
            >
              <ExternalLink size={12} />
            </button>
          )}
          <span className="text-xs text-muted-foreground/50 flex-shrink-0">
            {sourceLabel}
          </span>
        </div>
        {skill.description && (
          <p
            className="text-xs text-muted-foreground truncate"
            title={skill.description}
          >
            {skill.description}
          </p>
        )}
      </div>

      <AppToggleGroup
        apps={skill.apps}
        onToggle={(app, enabled) => onToggleApp(skill.id, app, enabled)}
        appIds={MCP_SKILLS_APP_IDS}
      />

      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 hover:text-red-500 hover:bg-red-100 dark:hover:text-red-400 dark:hover:bg-red-500/10"
          onClick={onUninstall}
          title={t("skills.uninstall")}
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </ListItemRow>
  );
};

interface ImportSkillsDialogProps {
  skills: Array<{
    directory: string;
    name: string;
    description?: string;
    foundIn: string[];
    path: string;
  }>;
  onImport: (directories: string[]) => void;
  onClose: () => void;
}

const ImportSkillsDialog: React.FC<ImportSkillsDialogProps> = ({
  skills,
  onImport,
  onClose,
}) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(
    new Set(skills.map((s) => s.directory)),
  );

  const toggleSelect = (directory: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(directory)) {
      newSelected.delete(directory);
    } else {
      newSelected.add(directory);
    }
    setSelected(newSelected);
  };

  const handleImport = () => {
    onImport(Array.from(selected));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl max-h-[80vh] flex flex-col">
        <h2 className="text-lg font-semibold mb-2">{t("skills.import")}</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("skills.importDescription")}
        </p>

        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {skills.map((skill) => (
            <label
              key={skill.directory}
              className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.has(skill.directory)}
                onChange={() => toggleSelect(skill.directory)}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{skill.name}</div>
                {skill.description && (
                  <div className="text-sm text-muted-foreground line-clamp-1">
                    {skill.description}
                  </div>
                )}
                <div
                  className="text-xs text-muted-foreground/50 mt-1 truncate"
                  title={skill.path}
                >
                  {skill.path}
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleImport} disabled={selected.size === 0}>
            {t("skills.importSelected", { count: selected.size })}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UnifiedSkillsPanel;
