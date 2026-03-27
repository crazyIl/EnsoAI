import type { GitWorktree } from '@shared/types';
import { Copy, FolderOpen, GitBranch, GitMerge, Sparkles, Terminal, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NamePathTooltip } from '@/components/ui/name-path-tooltip';
import { toastManager } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { useWorktreeActivityStore } from '@/stores/worktreeActivity';

export interface WorktreeItemViewProps {
  worktree: GitWorktree;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
  onMerge?: () => void;
  /** 'panel' 用于三栏第二列（卡片式），'tree' 用于树状内联（紧凑式） */
  variant?: 'panel' | 'tree';
  // Drag reorder props
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  showDropIndicator?: boolean;
  dropDirection?: 'top' | 'bottom' | null;
}

export function WorktreeItemView({
  worktree,
  isActive,
  onClick,
  onDelete,
  onMerge,
  variant = 'panel',
  draggable,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  showDropIndicator,
  dropDirection,
}: WorktreeItemViewProps) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const isMain =
    worktree.isMainWorktree || worktree.branch === 'main' || worktree.branch === 'master';
  const branchDisplay = worktree.branch || t('Detached');
  const isPrunable = worktree.prunable;
  const isTree = variant === 'tree';

  // Subscribe to activity store
  const activities = useWorktreeActivityStore((s) => s.activities);
  const diffStatsMap = useWorktreeActivityStore((s) => s.diffStats);
  const activity = activities[worktree.path] || { agentCount: 0, terminalCount: 0 };
  const diffStats = diffStatsMap[worktree.path] || { insertions: 0, deletions: 0 };
  const closeAgentSessions = useWorktreeActivityStore((s) => s.closeAgentSessions);
  const closeTerminalSessions = useWorktreeActivityStore((s) => s.closeTerminalSessions);
  const hasActivity = activity.agentCount > 0 || activity.terminalCount > 0;
  const hasDiffStats = diffStats.insertions > 0 || diffStats.deletions > 0;

  const handleCopyPath = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(worktree.path);
      toastManager.add({
        title: t('Copied'),
        description: t('Path copied to clipboard'),
        type: 'success',
        timeout: 2000,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toastManager.add({
        title: t('Copy failed'),
        description: message || t('Failed to copy content'),
        type: 'error',
        timeout: 3000,
      });
    }
  }, [t, worktree.path]);

  const handleCopyBranch = useCallback(async () => {
    if (!worktree.branch) return;
    try {
      await navigator.clipboard.writeText(worktree.branch);
      toastManager.add({
        title: t('Copied'),
        description: t('Branch name copied to clipboard'),
        type: 'success',
        timeout: 2000,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toastManager.add({
        title: t('Copy failed'),
        description: message || t('Failed to copy content'),
        type: 'error',
        timeout: 3000,
      });
    }
  }, [t, worktree.branch]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setMenuOpen(true);
  };

  // Adjust menu position if it overflows viewport
  useEffect(() => {
    if (menuOpen && menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      let { x, y } = menuPosition;

      if (y + rect.height > viewportHeight - 8) {
        y = Math.max(8, viewportHeight - rect.height - 8);
      }

      if (x + rect.width > viewportWidth - 8) {
        x = Math.max(8, viewportWidth - rect.width - 8);
      }

      if (x !== menuPosition.x || y !== menuPosition.y) {
        setMenuPosition({ x, y });
      }
    }
  }, [menuOpen, menuPosition]);

  return (
    <>
      <div className="relative" data-worktree-path={worktree.path}>
        {/* Drop indicator - top */}
        {showDropIndicator && dropDirection === 'top' && (
          <div className="pointer-events-none absolute left-2 right-2 top-0 z-10 h-0.5 rounded-full bg-primary" />
        )}
        <NamePathTooltip name={branchDisplay} path={worktree.path}>
          <button
            type="button"
            draggable={draggable}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={onClick}
            onContextMenu={handleContextMenu}
            className={cn(
              'flex w-full text-left transition-colors text-sm',
              isPrunable && 'opacity-50',
              isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
              isTree
                ? 'items-center gap-2 rounded-lg py-1.5 pl-5 pr-2'
                : 'flex-col items-start gap-1 rounded-md px-2 py-2'
            )}
          >
            {isTree ? (
              // Tree variant: single row with inline activity
              <>
                <GitBranch
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    isPrunable
                      ? 'text-destructive'
                      : isActive
                        ? 'text-accent-foreground'
                        : 'text-muted-foreground'
                  )}
                />
                <span className={cn('min-w-0 flex-1 truncate', isPrunable && 'line-through')}>
                  {branchDisplay}
                </span>
                {isPrunable ? (
                  <span className="shrink-0 rounded bg-destructive/20 px-1 py-0.5 text-[9px] font-medium uppercase text-destructive">
                    {t('Deleted')}
                  </span>
                ) : isMain ? (
                  <span className="shrink-0 rounded bg-emerald-500/20 px-1 py-0.5 text-[9px] font-medium uppercase text-emerald-600 dark:text-emerald-400">
                    {t('Main')}
                  </span>
                ) : null}
                {hasActivity && (
                  <div className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground">
                    {activity.agentCount > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Sparkles className="h-3 w-3" />
                        {activity.agentCount}
                      </span>
                    )}
                    {activity.terminalCount > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Terminal className="h-3 w-3" />
                        {activity.terminalCount}
                      </span>
                    )}
                    {hasDiffStats && (
                      <span className="flex items-center gap-0.5">
                        {diffStats.insertions > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            +{diffStats.insertions}
                          </span>
                        )}
                        {diffStats.deletions > 0 && (
                          <span className="text-red-600 dark:text-red-400">
                            -{diffStats.deletions}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                )}
              </>
            ) : (
              // Panel variant: two rows with activity details below
              <>
                <div className="flex w-full items-center gap-2">
                  <GitBranch
                    className={cn(
                      'h-4 w-4 shrink-0',
                      isPrunable
                        ? 'text-destructive'
                        : isActive
                          ? 'text-accent-foreground'
                          : 'text-muted-foreground'
                    )}
                  />
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate font-medium',
                      isPrunable && 'line-through'
                    )}
                  >
                    {branchDisplay}
                  </span>
                  {isPrunable ? (
                    <span className="shrink-0 rounded bg-destructive/20 px-1.5 py-0.5 text-[10px] font-medium uppercase text-destructive">
                      {t('Deleted')}
                    </span>
                  ) : isMain ? (
                    <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium uppercase text-emerald-600 dark:text-emerald-400">
                      {t('Main')}
                    </span>
                  ) : null}
                  {hasActivity && (
                    <span
                      className="ml-auto h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500"
                      title={t('Active sessions')}
                    />
                  )}
                </div>
                {hasActivity && (
                  <div
                    className={cn(
                      'flex items-center gap-3 pl-6 text-xs',
                      isActive ? 'text-accent-foreground/70' : 'text-muted-foreground'
                    )}
                  >
                    {activity.agentCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        {activity.agentCount}
                      </span>
                    )}
                    {activity.terminalCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Terminal className="h-3 w-3" />
                        {activity.terminalCount}
                      </span>
                    )}
                    {hasDiffStats && (
                      <span className="flex items-center gap-1.5">
                        {diffStats.insertions > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            +{diffStats.insertions}
                          </span>
                        )}
                        {diffStats.deletions > 0 && (
                          <span className="text-red-600 dark:text-red-400">
                            -{diffStats.deletions}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </button>
        </NamePathTooltip>
        {/* Drop indicator - bottom */}
        {showDropIndicator && dropDirection === 'bottom' && (
          <div className="pointer-events-none absolute bottom-0 left-2 right-2 z-10 h-0.5 rounded-full bg-primary" />
        )}
      </div>

      {/* Context Menu */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setMenuOpen(false)}
            onKeyDown={(e) => e.key === 'Escape' && setMenuOpen(false)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenuOpen(false);
            }}
            role="presentation"
          />
          <div
            ref={menuRef}
            className="fixed z-50 min-w-40 rounded-lg border bg-popover p-1 shadow-lg"
            style={{ left: menuPosition.x, top: menuPosition.y }}
          >
            {/* Close All Sessions */}
            {activity.agentCount > 0 && activity.terminalCount > 0 && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent/50"
                onClick={() => {
                  setMenuOpen(false);
                  closeAgentSessions(worktree.path);
                  closeTerminalSessions(worktree.path);
                }}
              >
                <X className="h-4 w-4" />
                {t('Close All Sessions')}
              </button>
            )}

            {/* Close Agent Sessions */}
            {activity.agentCount > 0 && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent/50"
                onClick={() => {
                  setMenuOpen(false);
                  closeAgentSessions(worktree.path);
                }}
              >
                <X className="h-4 w-4" />
                <Sparkles className="h-4 w-4" />
                {t('Close Agent Sessions')}
              </button>
            )}

            {/* Close Terminal Sessions */}
            {activity.terminalCount > 0 && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent/50"
                onClick={() => {
                  setMenuOpen(false);
                  closeTerminalSessions(worktree.path);
                }}
              >
                <X className="h-4 w-4" />
                <Terminal className="h-4 w-4" />
                {t('Close Terminal Sessions')}
              </button>
            )}

            {/* Separator if there are activity options */}
            {hasActivity && <div className="my-1 h-px bg-border" />}

            {/* Open Folder */}
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent/50"
              onClick={() => {
                setMenuOpen(false);
                window.electronAPI.shell.openPath(worktree.path);
              }}
            >
              <FolderOpen className="h-4 w-4" />
              {t('Open folder')}
            </button>

            {/* Copy Path */}
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent/50"
              onClick={() => {
                setMenuOpen(false);
                handleCopyPath();
              }}
            >
              <Copy className="h-4 w-4" />
              {t('Copy Path')}
            </button>

            {/* Copy Branch Name */}
            {worktree.branch && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent/50"
                onClick={() => {
                  setMenuOpen(false);
                  handleCopyBranch();
                }}
              >
                <GitBranch className="h-4 w-4" />
                {t('Copy Branch Name')}
              </button>
            )}

            {/* Merge to Branch */}
            {onMerge && !isMain && !isPrunable && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent/50"
                onClick={() => {
                  setMenuOpen(false);
                  onMerge();
                }}
              >
                <GitMerge className="h-4 w-4" />
                {t('Merge to Branch...')}
              </button>
            )}

            {/* Separator before delete */}
            <div className="my-1 h-px bg-border" />

            {/* Delete Worktree */}
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-red-600 hover:bg-accent/50 dark:text-red-400',
                isMain && 'pointer-events-none opacity-50'
              )}
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
              disabled={isMain}
            >
              <Trash2 className="h-4 w-4" />
              {isPrunable ? t('Clean up records') : t('Delete')}
            </button>
          </div>
        </>
      )}
    </>
  );
}
