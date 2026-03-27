import type { GitBranch as GitBranchType, GitWorktree, WorktreeCreateOptions } from '@shared/types';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  Crosshair,
  FolderGit2,
  FolderMinus,
  FolderOpen,
  FolderPlus,
  GitBranch,
  PanelLeftClose,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Settings2,
  SquareKanban,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getAncestorIds,
  getDescendantIds,
  type Repository,
  type RepositoryGroup,
  type TabId,
} from '@/App/constants';
import {
  CreateGroupDialog,
  GroupEditDialog,
  GroupTree,
  type GroupTreeRepoRenderProps,
  MoveToGroupSubmenu,
} from '@/components/group';
import { RepositorySettingsDialog } from '@/components/repository/RepositorySettingsDialog';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { NamePathTooltip } from '@/components/ui/name-path-tooltip';
import { toastManager } from '@/components/ui/toast';
import { CreateWorktreeDialog } from '@/components/worktree/CreateWorktreeDialog';
import { WorktreeDeleteDialog } from '@/components/worktree/WorktreeDeleteDialog';
import { WorktreeItemView } from '@/components/worktree/WorktreeItemView';
import { useWorktreeListMultiple } from '@/hooks/useWorktree';
import { useWorktreeDiffStats } from '@/hooks/useWorktreeDiffStats';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';
import { RunningProjectsPopover } from './RunningProjectsPopover';

interface TreeSidebarProps {
  repositories: Repository[];
  selectedRepo: string | null;
  activeWorktree?: GitWorktree | null;
  worktrees?: GitWorktree[];
  branches?: GitBranchType[];
  isLoading?: boolean;
  isCreating?: boolean;
  error?: string | null;
  onSelectRepo: (repoPath: string) => void;
  onSelectWorktree?: (worktree: GitWorktree) => void;
  onAddRepository: () => void;
  onRemoveRepository?: (repoPath: string) => void;
  onCreateWorktree?: (options: WorktreeCreateOptions) => Promise<void>;
  onRemoveWorktree?: (
    worktree: GitWorktree,
    options?: { deleteBranch?: boolean; force?: boolean }
  ) => Promise<void>;
  onMergeWorktree?: (worktree: GitWorktree) => void;
  onReorderWorktrees?: (
    repoPath: string,
    worktreePaths: string[],
    fromIndex: number,
    toIndex: number
  ) => void;
  onRefresh?: () => void;
  onInitGit?: () => Promise<void>;
  onOpenSettings?: () => void;
  collapsed?: boolean;
  onCollapse?: () => void;
  groups: RepositoryGroup[];
  expandedGroupIds: Set<string>;
  onToggleGroupExpand: (groupId: string) => void;
  onExpandAllGroups: (groupId?: string) => void;
  onCollapseAllGroups: (groupId?: string) => void;
  onCreateGroup: (name: string, parentId?: string) => RepositoryGroup;
  onUpdateGroup: (groupId: string, name: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onMoveToGroup?: (repoPath: string, groupId: string | null) => void;
  onMoveGroup: (groupId: string, targetParentId: string | null, order: number) => void;
  onReorderRepo: (
    repoPath: string,
    targetGroupId: string | null,
    targetRepoPath: string,
    position: 'before' | 'after'
  ) => void;
  onSwitchTab?: (tab: TabId) => void;
  onSwitchWorktreeByPath?: (path: string) => Promise<void> | void;
  worktreeOrderMap?: Record<string, Record<string, number>>;
  /** 是否在仓库下内联显示 worktree 列表（tree 模式为 true，columns 模式为 false） */
  showInlineWorktrees?: boolean;
}

export function TreeSidebar({
  repositories,
  selectedRepo,
  activeWorktree,
  worktrees: _worktrees,
  branches = [],
  isLoading: _isLoading,
  isCreating,
  error: _error,
  onSelectRepo,
  onSelectWorktree,
  onAddRepository,
  onRemoveRepository,
  onCreateWorktree,
  onRemoveWorktree,
  onMergeWorktree,
  onReorderWorktrees,
  onRefresh,
  onInitGit,
  onOpenSettings,
  collapsed: _collapsed = false,
  onCollapse,
  groups,
  expandedGroupIds,
  onToggleGroupExpand,
  onExpandAllGroups,
  onCollapseAllGroups,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onMoveToGroup,
  onMoveGroup,
  onReorderRepo,
  onSwitchTab,
  onSwitchWorktreeByPath,
  worktreeOrderMap = {},
  showInlineWorktrees = true,
}: TreeSidebarProps) {
  const { t, tNode } = useI18n();
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRepoList, setExpandedRepoList] = useState<string[]>([]);

  const [createGroupDialogOpen, setCreateGroupDialogOpen] = useState(false);
  const [createGroupParentId, setCreateGroupParentId] = useState<string | undefined>();
  const [editGroupDialogOpen, setEditGroupDialogOpen] = useState(false);
  const [editGroupTarget, setEditGroupTarget] = useState<RepositoryGroup | null>(null);

  const editGroupRepoCount = useMemo(() => {
    if (!editGroupTarget) return 0;
    const ids = getDescendantIds(editGroupTarget.id, groups);
    return repositories.filter((repo) => repo.groupId && ids.includes(repo.groupId)).length;
  }, [editGroupTarget, groups, repositories]);

  const hasGroups = groups.length > 0;

  // Convert list to set for fast lookups
  const expandedRepos = useMemo(() => new Set(expandedRepoList), [expandedRepoList]);

  const handleLocate = useCallback(() => {
    if (!selectedRepo) return;
    const repo = repositories.find((r) => r.path === selectedRepo);
    if (!repo) return;

    // 展开所有祖先分组
    if (repo.groupId) {
      const ancestorIds = [repo.groupId, ...getAncestorIds(repo.groupId, groups)];
      for (const id of ancestorIds) {
        if (!expandedGroupIds.has(id)) {
          onToggleGroupExpand(id);
        }
      }
    }

    if (showInlineWorktrees && activeWorktree) {
      // tree 模式：展开仓库并滚动到 worktree
      if (!expandedRepos.has(selectedRepo)) {
        setExpandedRepoList((prev) => [...prev, selectedRepo]);
      }
      requestAnimationFrame(() => {
        const container = treeContainerRef.current;
        if (!container) return;
        const el = container.querySelector(
          `[data-worktree-path="${CSS.escape(activeWorktree.path)}"]`
        );
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    } else {
      // columns 模式：滚动到仓库
      requestAnimationFrame(() => {
        const container = treeContainerRef.current;
        if (!container) return;
        const el = container.querySelector(`[data-repo-path="${CSS.escape(selectedRepo)}"]`);
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    }
  }, [
    selectedRepo,
    activeWorktree,
    repositories,
    groups,
    expandedGroupIds,
    onToggleGroupExpand,
    expandedRepos,
    showInlineWorktrees,
  ]);

  // Fetch worktrees for expanded repos only
  const {
    worktreesMap,
    errorsMap,
    loadingMap,
    refetchAll: refetchExpandedWorktrees,
  } = useWorktreeListMultiple(expandedRepoList);

  // Repository context menu
  const [repoMenuOpen, setRepoMenuOpen] = useState(false);
  const [repoMenuPosition, setRepoMenuPosition] = useState({ x: 0, y: 0 });
  const [repoMenuTarget, setRepoMenuTarget] = useState<Repository | null>(null);
  const [repoToRemove, setRepoToRemove] = useState<Repository | null>(null);

  // Repository settings dialog
  const [repoSettingsOpen, setRepoSettingsOpen] = useState(false);
  const [repoSettingsTarget, setRepoSettingsTarget] = useState<Repository | null>(null);

  // Create worktree dialog (triggered from context menu)
  const [createWorktreeDialogOpen, setCreateWorktreeDialogOpen] = useState(false);
  const [pendingCreateWorktree, setPendingCreateWorktree] = useState(false);
  const [waitingForBranchRefresh, setWaitingForBranchRefresh] = useState(false);

  // Wait for repo switch before triggering branch refresh
  useEffect(() => {
    if (pendingCreateWorktree && selectedRepo === repoMenuTarget?.path) {
      setPendingCreateWorktree(false);
      // Trigger refresh to get branches and worktree list for the new repo
      onRefresh?.();
      refetchExpandedWorktrees();
      setWaitingForBranchRefresh(true);
    }
  }, [selectedRepo, pendingCreateWorktree, repoMenuTarget, onRefresh, refetchExpandedWorktrees]);

  // Wait for branches to update before opening dialog
  useEffect(() => {
    if (waitingForBranchRefresh && branches.length >= 0) {
      // Small delay to ensure branches state is fully updated
      const timer = setTimeout(() => {
        setCreateWorktreeDialogOpen(true);
        setWaitingForBranchRefresh(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [branches, waitingForBranchRefresh]);

  // Worktree delete dialog
  const [worktreeToDelete, setWorktreeToDelete] = useState<GitWorktree | null>(null);
  // Drag reorder for worktrees
  const draggedWorktreeIndexRef = useRef<number | null>(null);
  const draggedWorktreeRepoPathRef = useRef<string | null>(null);
  const dragImageRef = useRef<HTMLDivElement | null>(null);
  const [dropWorktreeTarget, setDropWorktreeTarget] = useState<{
    repoPath: string;
    index: number;
  } | null>(null);

  // Get the main worktree path for git operations (from selected repo's worktrees)
  const selectedRepoWorktrees = selectedRepo ? worktreesMap[selectedRepo] || [] : [];
  const mainWorktree = selectedRepoWorktrees.find((wt) => wt.isMainWorktree);
  const workdir = mainWorktree?.path || selectedRepo || '';

  // Fetch diff stats for all expanded worktrees
  const allExpandedWorktrees = useMemo(() => Object.values(worktreesMap).flat(), [worktreesMap]);
  useWorktreeDiffStats(allExpandedWorktrees);

  // Auto-expand selected repo (only when selectedRepo changes externally, not from tree click)
  const prevSelectedRepoRef = useRef<string | null>(null);
  const skipAutoExpandRef = useRef(false);
  useEffect(() => {
    if (selectedRepo && selectedRepo !== prevSelectedRepoRef.current) {
      // Skip auto-expand if user explicitly clicked the tree
      if (!skipAutoExpandRef.current && !expandedRepos.has(selectedRepo)) {
        setExpandedRepoList((prev) => [...prev, selectedRepo]);
      }
      skipAutoExpandRef.current = false;
    }
    prevSelectedRepoRef.current = selectedRepo;
  }, [selectedRepo, expandedRepos]);

  const toggleRepoExpanded = useCallback((repoPath: string) => {
    setExpandedRepoList((prev) => {
      if (prev.includes(repoPath)) {
        return prev.filter((p) => p !== repoPath);
      }
      return [...prev, repoPath];
    });
  }, []);

  // Worktree drag handlers
  const handleWorktreeDragStart = useCallback(
    (e: React.DragEvent, repoPath: string, index: number, worktree: GitWorktree) => {
      draggedWorktreeRepoPathRef.current = repoPath;
      draggedWorktreeIndexRef.current = index;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', `worktree:${index}`);

      const dragImage = document.createElement('div');
      dragImage.textContent = worktree.branch || worktree.path.split(/[\\/]/).pop() || '';
      dragImage.style.cssText = `
        position: fixed;
        top: -9999px;
        left: -9999px;
        padding: 8px 12px;
        background-color: var(--accent);
        color: var(--accent-foreground);
        font-size: 14px;
        font-weight: 500;
        border-radius: 8px;
        white-space: nowrap;
        pointer-events: none;
      `;
      document.body.appendChild(dragImage);
      dragImageRef.current = dragImage;
      e.dataTransfer.setDragImage(dragImage, dragImage.offsetWidth / 2, dragImage.offsetHeight / 2);
    },
    []
  );

  const handleWorktreeDragEnd = useCallback(() => {
    if (dragImageRef.current) {
      document.body.removeChild(dragImageRef.current);
      dragImageRef.current = null;
    }
    draggedWorktreeRepoPathRef.current = null;
    draggedWorktreeIndexRef.current = null;
    setDropWorktreeTarget(null);
  }, []);

  const handleWorktreeDragOver = useCallback(
    (e: React.DragEvent, repoPath: string, index: number) => {
      if (draggedWorktreeRepoPathRef.current !== repoPath) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (draggedWorktreeIndexRef.current !== null && draggedWorktreeIndexRef.current !== index) {
        setDropWorktreeTarget({ repoPath, index });
      }
    },
    []
  );

  const handleWorktreeDrop = useCallback(
    (e: React.DragEvent, repoPath: string, worktreePaths: string[], toIndex: number) => {
      if (draggedWorktreeRepoPathRef.current !== repoPath) return;
      e.preventDefault();
      const fromIndex = draggedWorktreeIndexRef.current;
      if (fromIndex !== null && fromIndex !== toIndex && onReorderWorktrees) {
        onReorderWorktrees(repoPath, worktreePaths, fromIndex, toIndex);
      }
      setDropWorktreeTarget(null);
    },
    [onReorderWorktrees]
  );

  // Repository context menu
  const handleRepoContextMenu = (e: React.MouseEvent, repo: Repository) => {
    e.preventDefault();
    setRepoMenuPosition({ x: e.clientX, y: e.clientY });
    setRepoMenuTarget(repo);
    setRepoMenuOpen(true);
  };

  const handleRemoveRepoClick = () => {
    if (repoMenuTarget) {
      setRepoToRemove(repoMenuTarget);
    }
    setRepoMenuOpen(false);
  };

  const handleConfirmRemoveRepo = () => {
    if (repoToRemove && onRemoveRepository) {
      onRemoveRepository(repoToRemove.path);
    }
    setRepoToRemove(null);
  };

  const handleAddGroup = useCallback((parentId?: string) => {
    setCreateGroupParentId(parentId);
    setCreateGroupDialogOpen(true);
  }, []);

  const handleEditGroup = useCallback((group: RepositoryGroup) => {
    setEditGroupTarget(group);
    setEditGroupDialogOpen(true);
  }, []);

  const handleCreateGroupSubmit = useCallback(
    (name: string) => {
      onCreateGroup(name, createGroupParentId);
    },
    [createGroupParentId, onCreateGroup]
  );

  // Filter worktrees for a specific repo
  const getFilteredWorktrees = useCallback(
    (repoPath: string) => {
      const repoOrder = worktreeOrderMap[repoPath] || {};
      const repoWorktrees = [...(worktreesMap[repoPath] || [])].sort((a, b) => {
        const orderA = repoOrder[a.path] ?? Number.MAX_SAFE_INTEGER;
        const orderB = repoOrder[b.path] ?? Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
      });
      if (!searchQuery) return repoWorktrees;
      const query = searchQuery.toLowerCase();
      return repoWorktrees.filter(
        (wt) => wt.branch?.toLowerCase().includes(query) || wt.path.toLowerCase().includes(query)
      );
    },
    [searchQuery, worktreeOrderMap, worktreesMap]
  );

  const repoMatchesSearch = useCallback(
    (repo: Repository) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      if (repo.name.toLowerCase().includes(query)) return true;
      const repoWorktrees = worktreesMap[repo.path] || [];
      return repoWorktrees.some(
        (wt) => wt.branch?.toLowerCase().includes(query) || wt.path.toLowerCase().includes(query)
      );
    },
    [searchQuery, worktreesMap]
  );

  const hasSearchResults = useMemo(() => {
    if (!searchQuery) return repositories.length > 0 || groups.length > 0;
    const query = searchQuery.toLowerCase();
    return (
      groups.some((group) => group.name.toLowerCase().includes(query)) ||
      repositories.some((repo) => repoMatchesSearch(repo))
    );
  }, [groups, repoMatchesSearch, repositories, searchQuery]);

  const renderRepoItem = useCallback(
    ({
      repo,
      depth,
      isSelected,
      draggable,
      onDragStart,
      onDragEnd,
      onDragOver,
      onDragLeave,
      onDrop,
      onContextMenu,
    }: GroupTreeRepoRenderProps) => {
      const isExpanded = showInlineWorktrees && expandedRepos.has(repo.path);
      const repoWorktrees = showInlineWorktrees ? getFilteredWorktrees(repo.path) : [];
      const worktreePaths = repoWorktrees.map((worktree) => worktree.path);
      const repoError = showInlineWorktrees ? errorsMap[repo.path] : undefined;
      const repoLoading = showInlineWorktrees
        ? (loadingMap[repo.path] ?? (isExpanded && !worktreesMap[repo.path]))
        : false;

      const handleRepoClick = () => {
        if (showInlineWorktrees) {
          toggleRepoExpanded(repo.path);
        } else {
          onSelectRepo(repo.path);
        }
      };

      return (
        <div data-repo-path={repo.path}>
          <NamePathTooltip name={repo.name} path={repo.path}>
            <div
              role="button"
              tabIndex={0}
              draggable={draggable}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onContextMenu={onContextMenu}
              onClick={handleRepoClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleRepoClick();
                }
              }}
              className={cn(
                'group/repo flex h-7 w-full items-center gap-1.5 rounded-md px-1.5 text-left text-sm transition-colors',
                isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
              )}
              style={{ paddingLeft: depth * 16 + 4 }}
            >
              {showInlineWorktrees && (
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {isExpanded ? (
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5',
                        isSelected ? 'text-accent-foreground/80' : 'text-muted-foreground'
                      )}
                    />
                  ) : (
                    <ChevronRight
                      className={cn(
                        'h-3.5 w-3.5',
                        isSelected ? 'text-accent-foreground/80' : 'text-muted-foreground'
                      )}
                    />
                  )}
                </span>
              )}
              <SquareKanban
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  isSelected ? 'text-accent-foreground' : 'text-sky-500'
                )}
              />
              <span className="min-w-0 flex-1 truncate">{repo.name}</span>
              <button
                type="button"
                className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/repo:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setRepoSettingsTarget(repo);
                  setRepoSettingsOpen(true);
                }}
                title={t('Repository Settings')}
              >
                <Settings2 className="h-3 w-3" />
              </button>
            </div>
          </NamePathTooltip>

          {showInlineWorktrees && (
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="mt-1 space-y-0.5 overflow-hidden"
                  style={{ marginLeft: depth * 16 + 16 }}
                >
                  {repoError ? (
                    <div className="flex flex-col items-center gap-1.5 px-2 py-2 text-xs text-muted-foreground">
                      <span className="text-destructive">{t('Not a Git repository')}</span>
                      {onInitGit && isSelected && (
                        <Button
                          onClick={async () => {
                            await onInitGit();
                            refetchExpandedWorktrees();
                          }}
                          size="sm"
                          variant="ghost"
                          className="h-6 w-fit text-xs"
                        >
                          <GitBranch className="mr-1 h-3 w-3" />
                          {t('Init')}
                        </Button>
                      )}
                    </div>
                  ) : repoLoading ? (
                    <div className="space-y-1">
                      {[0, 1].map((index) => (
                        <div
                          key={`${repo.path}-skeleton-${index}`}
                          className="h-8 animate-pulse rounded-lg bg-muted"
                        />
                      ))}
                    </div>
                  ) : repoWorktrees.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground">
                      {searchQuery
                        ? t('No matching worktrees')
                        : t('No worktrees. Create one to get started.')}
                    </div>
                  ) : (
                    repoWorktrees.map((worktree, wtIndex) => (
                      <WorktreeItemView
                        key={worktree.path}
                        worktree={worktree}
                        variant="tree"
                        isActive={activeWorktree?.path === worktree.path}
                        onClick={() => {
                          if (!isSelected) {
                            onSelectRepo(repo.path);
                          }
                          onSelectWorktree?.(worktree);
                        }}
                        onDelete={() => setWorktreeToDelete(worktree)}
                        onMerge={onMergeWorktree ? () => onMergeWorktree(worktree) : undefined}
                        draggable={!searchQuery && !!onReorderWorktrees}
                        onDragStart={(e) =>
                          handleWorktreeDragStart(e, repo.path, wtIndex, worktree)
                        }
                        onDragEnd={handleWorktreeDragEnd}
                        onDragOver={(e) => handleWorktreeDragOver(e, repo.path, wtIndex)}
                        onDrop={(e) => handleWorktreeDrop(e, repo.path, worktreePaths, wtIndex)}
                        showDropIndicator={
                          dropWorktreeTarget?.repoPath === repo.path &&
                          dropWorktreeTarget.index === wtIndex
                        }
                        dropDirection={
                          dropWorktreeTarget?.repoPath === repo.path &&
                          dropWorktreeTarget.index === wtIndex &&
                          draggedWorktreeIndexRef.current !== null
                            ? draggedWorktreeIndexRef.current > wtIndex
                              ? 'top'
                              : 'bottom'
                            : null
                        }
                      />
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      );
    },
    [
      activeWorktree?.path,
      dropWorktreeTarget,
      errorsMap,
      expandedRepos,
      getFilteredWorktrees,
      handleWorktreeDragEnd,
      handleWorktreeDragOver,
      handleWorktreeDragStart,
      handleWorktreeDrop,
      loadingMap,
      onInitGit,
      onMergeWorktree,
      onReorderWorktrees,
      onSelectRepo,
      onSelectWorktree,
      refetchExpandedWorktrees,
      searchQuery,
      showInlineWorktrees,
      t,
      toggleRepoExpanded,
      worktreesMap,
    ]
  );

  return (
    <aside className="flex h-full w-full flex-col border-r bg-background">
      {/* Header */}
      <div className="flex h-12 items-center justify-end gap-1 border-b px-3 drag-region">
        {showInlineWorktrees ? (
          <div className="flex items-center gap-1">
            {/* Create worktree button */}
            {selectedRepo && onCreateWorktree && (
              <CreateWorktreeDialog
                branches={branches}
                projectName={selectedRepo?.split('/').pop() || ''}
                workdir={workdir}
                isLoading={isCreating}
                onSubmit={async (options) => {
                  await onCreateWorktree(options);
                  refetchExpandedWorktrees();
                }}
                trigger={
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-md no-drag text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                    title={t('New Worktree')}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                }
              />
            )}
            {/* Refresh button */}
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md no-drag text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
              onClick={() => {
                onRefresh?.();
                refetchExpandedWorktrees();
              }}
              title={t('Refresh')}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <RunningProjectsPopover
              onSelectWorktreeByPath={onSwitchWorktreeByPath || (() => {})}
              onSwitchTab={onSwitchTab}
            />
            {onCollapse && (
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md no-drag text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                onClick={onCollapse}
                title={t('Collapse')}
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <>
            {onSwitchWorktreeByPath && (
              <RunningProjectsPopover
                onSelectWorktreeByPath={onSwitchWorktreeByPath}
                onSwitchTab={onSwitchTab}
              />
            )}
            {onCollapse && (
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground no-drag"
                onClick={onCollapse}
                title={t('Collapse')}
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
          </>
        )}
      </div>

      <div className="px-3 py-2">
        <div className="flex h-8 items-center gap-2 rounded-lg border bg-background px-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            placeholder={showInlineWorktrees ? t('Search') : t('Search repositories')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          />
        </div>
      </div>

      <div className="flex h-8 items-center justify-end gap-0.5 border-b px-2">
        {showInlineWorktrees
          ? activeWorktree && (
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                onClick={handleLocate}
                title={t('Locate Current Worktree')}
              >
                <Crosshair className="h-3.5 w-3.5" />
              </button>
            )
          : selectedRepo && (
              <button
                type="button"
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                onClick={handleLocate}
                title={t('Locate Current Repository')}
              >
                <Crosshair className="h-3.5 w-3.5" />
              </button>
            )}
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          onClick={() => handleAddGroup()}
          title={t('New Group')}
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
        {hasGroups && (
          <>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
              onClick={() => onExpandAllGroups()}
              title={t('Expand All')}
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
              onClick={() => onCollapseAllGroups()}
              title={t('Collapse All')}
            >
              <ChevronsDownUp className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Tree List */}
      <div ref={treeContainerRef} className="flex-1 overflow-auto p-2">
        {repositories.length === 0 && groups.length === 0 ? (
          <Empty className="border-0">
            <EmptyMedia variant="icon">
              <FolderGit2 className="h-4.5 w-4.5" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-base">{t('Add Repository')}</EmptyTitle>
              <EmptyDescription>
                {t('Add a Git repository from a local folder to get started')}
              </EmptyDescription>
            </EmptyHeader>
            <Button onClick={onAddRepository} variant="outline" className="mt-2">
              <Plus className="mr-2 h-4 w-4" />
              {t('Add Repository')}
            </Button>
          </Empty>
        ) : searchQuery && !hasSearchResults ? (
          <Empty className="border-0">
            <EmptyMedia variant="icon">
              <Search className="h-4.5 w-4.5" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-base">{t('No matching results')}</EmptyTitle>
              <EmptyDescription>{t('Try a different search term')}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <GroupTree
            groups={groups}
            repositories={repositories}
            selectedRepo={selectedRepo}
            expandedIds={expandedGroupIds}
            onToggleExpand={onToggleGroupExpand}
            onSelectRepo={onSelectRepo}
            onMoveToGroup={onMoveToGroup || (() => {})}
            onMoveGroup={onMoveGroup}
            onReorderRepo={onReorderRepo}
            onRemoveRepository={
              onRemoveRepository
                ? (path) => {
                    const repo = repositories.find((item) => item.path === path);
                    if (repo) {
                      setRepoToRemove(repo);
                    }
                  }
                : undefined
            }
            onEditGroup={handleEditGroup}
            onAddGroup={handleAddGroup}
            onRepoSettings={(repo) => {
              setRepoSettingsTarget(repo);
              setRepoSettingsOpen(true);
            }}
            searchQuery={searchQuery}
            repoMatchesSearch={repoMatchesSearch}
            onRepoContextMenu={handleRepoContextMenu}
            renderRepoItem={renderRepoItem}
          />
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t p-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-8 flex-1 items-center justify-start gap-2 rounded-md px-3 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
            onClick={onAddRepository}
          >
            <Plus className="h-4 w-4" />
            {t('Add Repository')}
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
            onClick={onOpenSettings}
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Repository Context Menu */}
      {repoMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setRepoMenuOpen(false)}
            onKeyDown={(e) => e.key === 'Escape' && setRepoMenuOpen(false)}
            onContextMenu={(e) => {
              e.preventDefault();
              setRepoMenuOpen(false);
            }}
            role="presentation"
          />
          <div
            className="fixed z-50 min-w-32 rounded-lg border bg-popover p-1 shadow-lg"
            style={{ left: repoMenuPosition.x, top: repoMenuPosition.y }}
          >
            {/* New Worktree button (tree mode only) */}
            {showInlineWorktrees && onCreateWorktree && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                onClick={() => {
                  setRepoMenuOpen(false);
                  // Switch to the right-clicked repo first, then wait for state update
                  if (repoMenuTarget && repoMenuTarget.path !== selectedRepo) {
                    onSelectRepo(repoMenuTarget.path);
                    setPendingCreateWorktree(true);
                  } else {
                    // Already on target repo, trigger refresh and open dialog
                    onRefresh?.();
                    refetchExpandedWorktrees();
                    setCreateWorktreeDialogOpen(true);
                  }
                }}
              >
                <Plus className="h-4 w-4" />
                {t('New Worktree')}
              </button>
            )}

            {/* Repository Settings */}
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              onClick={() => {
                setRepoMenuOpen(false);
                if (repoMenuTarget) {
                  setRepoSettingsTarget(repoMenuTarget);
                  setRepoSettingsOpen(true);
                }
              }}
            >
              <Settings2 className="h-4 w-4" />
              {t('Repository Settings')}
            </button>

            {/* Open Folder */}
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              onClick={() => {
                setRepoMenuOpen(false);
                if (repoMenuTarget) {
                  window.electronAPI.shell.openPath(repoMenuTarget.path);
                }
              }}
            >
              <FolderOpen className="h-4 w-4" />
              {t('Open folder')}
            </button>

            {/* Copy Repository Name */}
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              onClick={async () => {
                setRepoMenuOpen(false);
                if (!repoMenuTarget) return;
                try {
                  await navigator.clipboard.writeText(repoMenuTarget.name);
                  toastManager.add({
                    title: t('Copied'),
                    description: t('Repository name copied to clipboard'),
                    type: 'success',
                    timeout: 2000,
                  });
                } catch {
                  toastManager.add({
                    title: t('Failed to copy content'),
                    type: 'error',
                    timeout: 2000,
                  });
                }
              }}
            >
              <Copy className="h-4 w-4" />
              {t('Copy Repository Name')}
            </button>

            {onMoveToGroup && groups.length > 0 && (
              <MoveToGroupSubmenu
                groups={groups}
                currentGroupId={repoMenuTarget?.groupId}
                onMove={(groupId) => {
                  if (repoMenuTarget) {
                    onMoveToGroup(repoMenuTarget.path, groupId);
                  }
                }}
                onClose={() => setRepoMenuOpen(false)}
              />
            )}

            {/* Separator */}
            <div className="my-1 h-px bg-border" />

            {/* Remove repository button */}
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-accent"
              onClick={handleRemoveRepoClick}
            >
              <FolderMinus className="h-4 w-4" />
              {t('Remove repository')}
            </button>
          </div>
        </>
      )}

      {/* Remove repository confirmation dialog */}
      <AlertDialog
        open={!!repoToRemove}
        onOpenChange={(open) => {
          if (!open) {
            setRepoToRemove(null);
          }
        }}
      >
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Remove repository')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tNode('Are you sure you want to remove {{name}} from the workspace?', {
                name: <strong>{repoToRemove?.name}</strong>,
              })}
              <span className="block mt-2 text-muted-foreground">
                {t('This will only remove it from the app and will not delete local files.')}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline">{t('Cancel')}</Button>} />
            <Button variant="destructive" onClick={handleConfirmRemoveRepo}>
              {t('Remove')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>

      {/* Delete worktree confirmation dialog */}
      {onRemoveWorktree && (
        <WorktreeDeleteDialog
          worktree={worktreeToDelete}
          onOpenChange={(open) => {
            if (!open) setWorktreeToDelete(null);
          }}
          onDelete={onRemoveWorktree}
          onDeleted={refetchExpandedWorktrees}
        />
      )}

      {/* Create Worktree Dialog (triggered from context menu) */}
      <CreateWorktreeDialog
        open={createWorktreeDialogOpen}
        onOpenChange={setCreateWorktreeDialogOpen}
        branches={branches}
        projectName={selectedRepo?.split('/').pop() || ''}
        workdir={workdir}
        isLoading={isCreating}
        onSubmit={async (options) => {
          await onCreateWorktree?.(options);
          refetchExpandedWorktrees();
        }}
      />

      {/* Repository Settings Dialog */}
      {repoSettingsTarget && (
        <RepositorySettingsDialog
          open={repoSettingsOpen}
          onOpenChange={setRepoSettingsOpen}
          repoPath={repoSettingsTarget.path}
          repoName={repoSettingsTarget.name}
        />
      )}

      <CreateGroupDialog
        open={createGroupDialogOpen}
        onOpenChange={setCreateGroupDialogOpen}
        onSubmit={handleCreateGroupSubmit}
      />

      <GroupEditDialog
        open={editGroupDialogOpen}
        onOpenChange={setEditGroupDialogOpen}
        group={editGroupTarget}
        repositoryCount={editGroupRepoCount}
        onUpdate={onUpdateGroup}
        onDelete={onDeleteGroup}
      />
    </aside>
  );
}
