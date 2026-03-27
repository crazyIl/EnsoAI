import type { GitBranch as GitBranchType, GitWorktree, WorktreeCreateOptions } from '@shared/types';
import { FolderOpen, GitBranch, PanelLeftClose, Plus, RefreshCw, Search } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { CreateWorktreeDialog } from '@/components/worktree/CreateWorktreeDialog';
import { WorktreeDeleteDialog } from '@/components/worktree/WorktreeDeleteDialog';
import { WorktreeItemView } from '@/components/worktree/WorktreeItemView';
import { useWorktreeDiffStats } from '@/hooks/useWorktreeDiffStats';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

interface WorktreePanelProps {
  repoPath: string | null;
  worktrees: GitWorktree[];
  activeWorktree: GitWorktree | null;
  branches: GitBranchType[];
  projectName: string;
  isLoading?: boolean;
  isCreating?: boolean;
  error?: string | null;
  onSelectWorktree: (worktree: GitWorktree) => void;
  onCreateWorktree: (options: WorktreeCreateOptions) => Promise<void>;
  onRemoveWorktree: (
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
  onRefresh: () => void;
  onInitGit?: () => Promise<void>;
  width?: number;
  collapsed?: boolean;
  onCollapse?: () => void;
  repositoryCollapsed?: boolean;
  onExpandRepository?: () => void;
}

export function WorktreePanel({
  repoPath,
  worktrees,
  activeWorktree,
  branches,
  projectName,
  isLoading,
  isCreating,
  error,
  onSelectWorktree,
  onCreateWorktree,
  onRemoveWorktree,
  onMergeWorktree,
  onReorderWorktrees,
  onRefresh,
  onInitGit,
  width: _width = 280,
  collapsed: _collapsed = false,
  onCollapse,
  repositoryCollapsed = false,
  onExpandRepository,
}: WorktreePanelProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [worktreeToDelete, setWorktreeToDelete] = useState<GitWorktree | null>(null);

  // Drag reorder
  const draggedIndexRef = useRef<number | null>(null);
  const dragImageRef = useRef<HTMLDivElement | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number, worktree: GitWorktree) => {
      draggedIndexRef.current = index;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));

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

  const handleDragEnd = useCallback(() => {
    if (dragImageRef.current) {
      document.body.removeChild(dragImageRef.current);
      dragImageRef.current = null;
    }
    draggedIndexRef.current = null;
    setDropTargetIndex(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndexRef.current !== null && draggedIndexRef.current !== index) {
      setDropTargetIndex(index);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTargetIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      const fromIndex = draggedIndexRef.current;
      if (repoPath && fromIndex !== null && fromIndex !== toIndex && onReorderWorktrees) {
        onReorderWorktrees(
          repoPath,
          worktrees.map((worktree) => worktree.path),
          fromIndex,
          toIndex
        );
      }
      setDropTargetIndex(null);
    },
    [onReorderWorktrees, repoPath, worktrees]
  );

  // Keep track of original indices for drag reorder when filtering
  const filteredWorktreesWithIndex = worktrees
    .map((wt, index) => ({ worktree: wt, originalIndex: index }))
    .filter(
      ({ worktree: wt }) =>
        wt.branch?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        wt.path.toLowerCase().includes(searchQuery.toLowerCase())
    );

  // Get the main worktree path for git operations
  const mainWorktree = worktrees.find((wt) => wt.isMainWorktree);
  const workdir = mainWorktree?.path || '';

  useWorktreeDiffStats(worktrees);

  return (
    <aside className="flex h-full w-full flex-col border-r bg-background">
      {/* Header with buttons */}
      <div
        className={cn(
          'flex h-12 items-center justify-end gap-1 border-b px-3 drag-region',
          repositoryCollapsed && 'pl-[70px]'
        )}
      >
        {/* Expand repository button when collapsed */}
        {repositoryCollapsed && onExpandRepository && (
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md no-drag text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
            onClick={onExpandRepository}
            title={t('Expand Repository')}
          >
            <FolderOpen className="h-4 w-4" />
          </button>
        )}
        {/* Create worktree button */}
        <CreateWorktreeDialog
          branches={branches}
          projectName={projectName}
          workdir={workdir}
          isLoading={isCreating}
          onSubmit={onCreateWorktree}
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
        {/* Refresh button */}
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-md no-drag text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
          onClick={onRefresh}
          title={t('Refresh')}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        {/* Collapse button */}
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

      {/* Search bar */}
      <div className="px-3 py-2">
        <div className="flex h-8 items-center gap-2 rounded-lg border bg-background px-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('Search worktrees')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          />
        </div>
      </div>

      {/* Worktree List */}
      <div className="flex-1 overflow-auto p-2">
        {error ? (
          <Empty className="border-0">
            <EmptyMedia variant="icon">
              <GitBranch className="h-4.5 w-4.5" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-base">{t('Not a Git repository')}</EmptyTitle>
              <EmptyDescription>
                {t('This directory is not a Git repository. Initialize it to enable Git features.')}
              </EmptyDescription>
            </EmptyHeader>
            <div className="mt-2 flex gap-2">
              <Button onClick={onRefresh} variant="outline" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                {t('Refresh')}
              </Button>
              {onInitGit && (
                <Button onClick={onInitGit} size="sm">
                  <GitBranch className="mr-2 h-4 w-4" />
                  {t('Initialize repository')}
                </Button>
              )}
            </div>
          </Empty>
        ) : isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <WorktreeItemSkeleton key={`skeleton-${i}`} />
            ))}
          </div>
        ) : filteredWorktreesWithIndex.length === 0 ? (
          <Empty className="border-0">
            <EmptyMedia variant="icon">
              <GitBranch className="h-4.5 w-4.5" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-base">
                {searchQuery ? t('No matching worktrees') : t('No worktrees')}
              </EmptyTitle>
              <EmptyDescription>
                {searchQuery
                  ? t('Try a different search term')
                  : t('Create your first worktree to get started')}
              </EmptyDescription>
            </EmptyHeader>
            {!searchQuery && (
              <CreateWorktreeDialog
                branches={branches}
                projectName={projectName}
                workdir={workdir}
                isLoading={isCreating}
                onSubmit={onCreateWorktree}
                trigger={
                  <Button variant="outline" className="mt-2">
                    <Plus className="mr-2 h-4 w-4" />
                    {t('Create Worktree')}
                  </Button>
                }
              />
            )}
          </Empty>
        ) : (
          <div className="space-y-1">
            {filteredWorktreesWithIndex.map(({ worktree, originalIndex }) => (
              <WorktreeItemView
                key={worktree.path}
                worktree={worktree}
                isActive={activeWorktree?.path === worktree.path}
                variant="panel"
                onClick={() => onSelectWorktree(worktree)}
                onDelete={() => setWorktreeToDelete(worktree)}
                onMerge={onMergeWorktree ? () => onMergeWorktree(worktree) : undefined}
                draggable={!searchQuery && !!onReorderWorktrees}
                onDragStart={(e) => handleDragStart(e, originalIndex, worktree)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, originalIndex)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, originalIndex)}
                showDropIndicator={dropTargetIndex === originalIndex}
                dropDirection={
                  dropTargetIndex === originalIndex && draggedIndexRef.current !== null
                    ? draggedIndexRef.current > originalIndex
                      ? 'top'
                      : 'bottom'
                    : null
                }
              />
            ))}
          </div>
        )}
      </div>

      <WorktreeDeleteDialog
        worktree={worktreeToDelete}
        onOpenChange={(open) => {
          if (!open) setWorktreeToDelete(null);
        }}
        onDelete={onRemoveWorktree}
      />
    </aside>
  );
}

function WorktreeItemSkeleton() {
  return (
    <div className="rounded-md border bg-card px-2 py-2">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="mt-2 h-3 w-32 animate-pulse rounded bg-muted" />
    </div>
  );
}
