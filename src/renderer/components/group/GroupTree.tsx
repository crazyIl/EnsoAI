import {
  ChevronDown,
  ChevronRight,
  Copy,
  Folder,
  FolderMinus,
  FolderOpen,
  FolderPlus,
  FolderSymlink,
  Pencil,
  Settings2,
  SquareKanban,
} from 'lucide-react';
import {
  type DragEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  buildGroupTree,
  type GroupTreeNode,
  getDescendantIds,
  getGroupDepth,
  isAncestor,
  MAX_GROUP_DEPTH,
  type RepositoryGroup,
} from '@/App/constants';
import { NamePathTooltip } from '@/components/ui/name-path-tooltip';
import { toastManager } from '@/components/ui/toast';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

interface Repository {
  name: string;
  path: string;
  groupId?: string;
}

interface DragData {
  type: 'repo' | 'group';
  id: string;
}

interface DropIndicator {
  targetId: string;
  position: 'before' | 'after' | 'inside';
}

export interface GroupTreeRepoRenderProps {
  repo: Repository;
  depth: number;
  isSelected: boolean;
  draggable: boolean;
  onDragStart: (e: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onDragOver: (e: DragEvent<HTMLElement>) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent<HTMLElement>) => void;
  onContextMenu: (e: MouseEvent<HTMLElement>) => void;
}

export interface GroupTreeProps {
  groups: RepositoryGroup[];
  repositories: Repository[];
  selectedRepo: string | null;
  expandedIds: Set<string>;
  onToggleExpand: (groupId: string) => void;
  onSelectRepo: (repoPath: string) => void;
  onMoveToGroup: (repoPath: string, groupId: string | null) => void;
  onMoveGroup: (groupId: string, targetParentId: string | null, order: number) => void;
  onReorderRepo: (
    repoPath: string,
    targetGroupId: string | null,
    targetRepoPath: string,
    position: 'before' | 'after'
  ) => void;
  onRemoveRepository?: (repoPath: string) => void;
  onEditGroup: (group: RepositoryGroup) => void;
  onAddGroup: (parentId?: string) => void;
  onRepoSettings?: (repo: Repository) => void;
  searchQuery?: string;
  repoMatchesSearch?: (repo: Repository) => boolean;
  onRepoContextMenu?: (e: MouseEvent<HTMLElement>, repo: Repository) => void;
  renderRepoItem?: (props: GroupTreeRepoRenderProps) => ReactNode;
}

const INDENT_PX = 16;
const DROP_ZONE_HEIGHT = 2;

export function GroupTree({
  groups,
  repositories,
  selectedRepo,
  expandedIds,
  onToggleExpand,
  onSelectRepo,
  onMoveToGroup,
  onMoveGroup,
  onReorderRepo,
  onRemoveRepository,
  onEditGroup,
  onAddGroup,
  onRepoSettings,
  searchQuery,
  repoMatchesSearch,
  onRepoContextMenu,
  renderRepoItem,
}: GroupTreeProps) {
  const { t } = useI18n();

  const dragDataRef = useRef<DragData | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  const dragImageRef = useRef<HTMLDivElement | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'group' | 'repo' | 'empty';
    group?: RepositoryGroup;
    repo?: Repository;
  } | null>(null);

  const tree = useMemo(() => buildGroupTree(groups), [groups]);

  const reposByGroup = useMemo(() => {
    const map = new Map<string, Repository[]>();
    map.set('__ungrouped__', []);
    for (const group of groups) {
      map.set(group.id, []);
    }
    for (const repo of repositories) {
      const key = repo.groupId || '__ungrouped__';
      const arr = map.get(key);
      if (arr) arr.push(repo);
      else map.get('__ungrouped__')!.push(repo);
    }
    return map;
  }, [groups, repositories]);

  const matchesSearch = useCallback(
    (name: string) => {
      if (!searchQuery) return true;
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    },
    [searchQuery]
  );

  const matchesRepo = useCallback(
    (repo: Repository) => {
      if (repoMatchesSearch) return repoMatchesSearch(repo);
      return matchesSearch(repo.name);
    },
    [matchesSearch, repoMatchesSearch]
  );

  const groupHasMatch = useCallback(
    (node: GroupTreeNode): boolean => {
      if (!searchQuery) return true;
      const repos = reposByGroup.get(node.id) || [];
      if (repos.some((repo) => matchesRepo(repo))) return true;
      if (matchesSearch(node.name)) return true;
      return node.children.some((child) => groupHasMatch(child));
    },
    [matchesRepo, matchesSearch, reposByGroup, searchQuery]
  );

  const handleDragStart = useCallback((e: React.DragEvent, data: DragData, label: string) => {
    dragDataRef.current = data;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(data));

    const dragImage = document.createElement('div');
    dragImage.textContent = label;
    dragImage.style.cssText = `
        position: fixed; top: -9999px; left: -9999px;
        padding: 6px 12px; background: var(--accent); color: var(--accent-foreground);
        font-size: 13px; font-weight: 500; border-radius: 6px;
        white-space: nowrap; pointer-events: none;
      `;
    document.body.appendChild(dragImage);
    dragImageRef.current = dragImage;
    e.dataTransfer.setDragImage(dragImage, dragImage.offsetWidth / 2, dragImage.offsetHeight / 2);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragImageRef.current) {
      document.body.removeChild(dragImageRef.current);
      dragImageRef.current = null;
    }
    dragDataRef.current = null;
    setDropIndicator(null);
  }, []);

  const handleGroupDragOver = useCallback(
    (e: React.DragEvent, groupId: string, depth: number) => {
      e.preventDefault();
      e.stopPropagation();
      const drag = dragDataRef.current;
      if (!drag) return;

      if (drag.type === 'repo') {
        e.dataTransfer.dropEffect = 'move';
        setDropIndicator({ targetId: groupId, position: 'inside' });
        return;
      }

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const y = e.clientY - rect.top;
      const h = rect.height;

      if (drag.type === 'group' && drag.id === groupId) {
        setDropIndicator(null);
        return;
      }
      if (drag.type === 'group' && isAncestor(groupId, drag.id, groups)) {
        setDropIndicator(null);
        return;
      }

      if (y < h * 0.25) {
        e.dataTransfer.dropEffect = 'move';
        setDropIndicator({ targetId: groupId, position: 'before' });
      } else if (y > h * 0.75) {
        e.dataTransfer.dropEffect = 'move';
        setDropIndicator({ targetId: groupId, position: 'after' });
      } else {
        const targetDepth = depth;
        if (drag.type === 'group') {
          const dragMaxDepth = getMaxSubtreeDepth(drag.id, groups);
          if (targetDepth + 1 + dragMaxDepth > MAX_GROUP_DEPTH) {
            setDropIndicator(null);
            return;
          }
        }
        e.dataTransfer.dropEffect = 'move';
        setDropIndicator({ targetId: groupId, position: 'inside' });
      }
    },
    [groups]
  );

  const handleRepoDragOver = useCallback((e: React.DragEvent, repoPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    const drag = dragDataRef.current;
    if (!drag) {
      setDropIndicator(null);
      return;
    }
    if (drag.type === 'group') {
      setDropIndicator(null);
      return;
    }
    if (drag.type === 'repo' && drag.id === repoPath) {
      setDropIndicator(null);
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;

    e.dataTransfer.dropEffect = 'move';
    setDropIndicator({
      targetId: repoPath,
      position: y < rect.height / 2 ? 'before' : 'after',
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const drag = dragDataRef.current;
      const indicator = dropIndicator;
      if (!drag || !indicator) return;

      if (drag.type === 'repo') {
        if (indicator.position === 'inside') {
          onMoveToGroup(drag.id, indicator.targetId);
        } else {
          const targetRepo = repositories.find((r) => r.path === indicator.targetId);
          const targetGroup = groups.find((g) => g.id === indicator.targetId);
          const groupId = targetGroup ? targetGroup.parentId || null : targetRepo?.groupId || null;
          if (targetRepo) {
            onReorderRepo(drag.id, groupId, targetRepo.path, indicator.position);
          } else {
            onMoveToGroup(drag.id, groupId);
          }
        }
      } else if (drag.type === 'group') {
        if (indicator.position === 'inside') {
          const siblings = groups.filter((g) => g.parentId === indicator.targetId);
          onMoveGroup(drag.id, indicator.targetId, siblings.length);
        } else {
          const targetGroup = groups.find((g) => g.id === indicator.targetId);
          const parentId = targetGroup?.parentId || null;
          const siblings = groups.filter(
            (g) => (g.parentId || null) === parentId && g.id !== drag.id
          );
          const targetIndex = siblings.findIndex((g) => g.id === indicator.targetId);
          const order = indicator.position === 'after' ? targetIndex + 1 : Math.max(0, targetIndex);
          onMoveGroup(drag.id, parentId, order);
        }
      }

      setDropIndicator(null);
      dragDataRef.current = null;
    },
    [dropIndicator, groups, repositories, onMoveToGroup, onMoveGroup, onReorderRepo]
  );

  const handleRootDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const drag = dragDataRef.current;
    if (!drag) return;
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleRootDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const drag = dragDataRef.current;
      if (!drag) return;

      if (drag.type === 'repo') {
        onMoveToGroup(drag.id, null);
      } else if (drag.type === 'group') {
        const rootGroups = groups.filter((g) => !g.parentId);
        onMoveGroup(drag.id, null, rootGroups.length);
      }
      setDropIndicator(null);
      dragDataRef.current = null;
    },
    [groups, onMoveToGroup, onMoveGroup]
  );

  const handleContextMenu = useCallback(
    (
      e: React.MouseEvent,
      type: 'group' | 'repo' | 'empty',
      data?: RepositoryGroup | Repository
    ) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        type,
        group: type === 'group' ? (data as RepositoryGroup) : undefined,
        repo: type === 'repo' ? (data as Repository) : undefined,
      });
    },
    []
  );

  const renderDropIndicator = (targetId: string, position: 'before' | 'after', depth: number) => {
    if (
      !dropIndicator ||
      dropIndicator.targetId !== targetId ||
      dropIndicator.position !== position
    ) {
      return null;
    }

    return (
      <div
        className="absolute left-0 right-0 z-10"
        style={{
          height: DROP_ZONE_HEIGHT,
          [position === 'before' ? 'top' : 'bottom']: -1,
          marginLeft: (depth + 1) * INDENT_PX,
          marginRight: 8,
        }}
      >
        <div className="h-full rounded-full bg-primary" />
      </div>
    );
  };

  const renderRepoNode = (repo: Repository, depth: number) => {
    const isSelected = selectedRepo === repo.path;
    const repoItemProps: GroupTreeRepoRenderProps = {
      repo,
      depth,
      isSelected,
      draggable: !searchQuery,
      onDragStart: (e) => handleDragStart(e, { type: 'repo', id: repo.path }, repo.name),
      onDragEnd: handleDragEnd,
      onDragOver: (e) => handleRepoDragOver(e, repo.path),
      onDragLeave: () => setDropIndicator(null),
      onDrop: handleDrop,
      onContextMenu: (e) => {
        if (onRepoContextMenu) {
          onRepoContextMenu(e, repo);
          return;
        }
        handleContextMenu(e, 'repo', repo);
      },
    };

    return (
      <div key={repo.path} className="relative" data-repo-path={repo.path}>
        {renderDropIndicator(repo.path, 'before', depth)}
        {renderRepoItem ? (
          renderRepoItem(repoItemProps)
        ) : (
          <NamePathTooltip name={repo.name} path={repo.path}>
            <div
              draggable={repoItemProps.draggable}
              onDragStart={repoItemProps.onDragStart}
              onDragEnd={repoItemProps.onDragEnd}
              onDragOver={repoItemProps.onDragOver}
              onDragLeave={repoItemProps.onDragLeave}
              onDrop={repoItemProps.onDrop}
              onClick={() => onSelectRepo(repo.path)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectRepo(repo.path);
                }
              }}
              onContextMenu={repoItemProps.onContextMenu}
              role="button"
              tabIndex={0}
              className={cn(
                'group/repo flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-sm transition-colors',
                isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
              )}
              style={{ paddingLeft: depth * INDENT_PX + 4 }}
            >
              <span className="w-4 shrink-0" />
              <SquareKanban
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  isSelected ? 'text-accent-foreground' : 'text-sky-500'
                )}
              />
              <span className="min-w-0 flex-1 truncate">{repo.name}</span>
              {onRepoSettings && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRepoSettings(repo);
                  }}
                  className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/repo:opacity-100"
                  title={t('Repository Settings')}
                >
                  <Settings2 className="h-3 w-3" />
                </button>
              )}
            </div>
          </NamePathTooltip>
        )}
        {renderDropIndicator(repo.path, 'after', depth)}
      </div>
    );
  };

  const renderGroupNode = (node: GroupTreeNode) => {
    if (searchQuery && !groupHasMatch(node)) return null;

    const isExpanded = expandedIds.has(node.id);
    const showChildren = isExpanded || !!searchQuery;
    const repos = reposByGroup.get(node.id) || [];
    const repoCount = getDescendantRepoCount(node.id, groups, repositories);
    const isInsideTarget =
      dropIndicator?.targetId === node.id && dropIndicator?.position === 'inside';
    const FolderIcon = showChildren ? FolderOpen : Folder;

    return (
      <div key={node.id}>
        <div className="relative">
          {renderDropIndicator(node.id, 'before', node.depth)}
          <div
            draggable={!searchQuery}
            onDragStart={(e) => handleDragStart(e, { type: 'group', id: node.id }, node.name)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleGroupDragOver(e, node.id, node.depth)}
            onDragLeave={() => setDropIndicator(null)}
            onDrop={handleDrop}
            onContextMenu={(e) => handleContextMenu(e, 'group', node)}
            onClick={() => onToggleExpand(node.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggleExpand(node.id);
              }
            }}
            role="button"
            tabIndex={0}
            className={cn(
              'group/node flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-sm transition-colors',
              'hover:bg-accent/50',
              isInsideTarget && 'ring-2 ring-primary ring-inset bg-primary/10'
            )}
            style={{ paddingLeft: node.depth * INDENT_PX + 4 }}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </span>
            <FolderIcon className="h-4 w-4 shrink-0 text-amber-500" />
            <span className="min-w-0 flex-1 truncate font-medium">{node.name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditGroup(node);
              }}
              className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/node:opacity-100"
              title={t('Edit Group')}
            >
              <Pencil className="h-3 w-3" />
            </button>
            {node.depth < MAX_GROUP_DEPTH - 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddGroup(node.id);
                }}
                className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/node:opacity-100"
                title={t('New Subgroup')}
              >
                <FolderPlus className="h-3 w-3" />
              </button>
            )}
            <span className="min-w-[1.25rem] shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              {repoCount}
            </span>
          </div>
          {renderDropIndicator(node.id, 'after', node.depth)}
        </div>

        {showChildren && (
          <div>
            {node.children.map((child) => renderGroupNode(child))}
            {repos
              .filter((repo) => matchesRepo(repo))
              .map((repo) => renderRepoNode(repo, node.depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const ungroupedRepos = (reposByGroup.get('__ungrouped__') || []).filter((repo) =>
    matchesRepo(repo)
  );

  return (
    <div
      className="flex-1 overflow-auto"
      onDragOver={handleRootDragOver}
      onDrop={handleRootDrop}
      onContextMenu={(e) => {
        if (e.target === e.currentTarget) {
          handleContextMenu(e, 'empty');
        }
      }}
    >
      <div className="space-y-0.5 p-1.5">
        {tree.map((node) => renderGroupNode(node))}
        {ungroupedRepos.length > 0 && tree.length > 0 && (
          <div className="mx-2 my-1.5 h-px bg-border" />
        )}
        {ungroupedRepos.map((repo) => renderRepoNode(repo, 0))}
      </div>

      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setContextMenu(null)}
            onKeyDown={(e) => e.key === 'Escape' && setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
            role="presentation"
          />
          <div
            className="fixed z-50 min-w-40 rounded-lg border bg-popover p-1 shadow-lg"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {contextMenu.type === 'group' && contextMenu.group && (
              <GroupContextMenu
                group={contextMenu.group}
                groups={groups}
                onEdit={() => {
                  onEditGroup(contextMenu.group!);
                  setContextMenu(null);
                }}
                onAddSubgroup={() => {
                  onAddGroup(contextMenu.group!.id);
                  setContextMenu(null);
                }}
                onMoveToRoot={() => {
                  onMoveGroup(
                    contextMenu.group!.id,
                    null,
                    groups.filter((g) => !g.parentId).length
                  );
                  setContextMenu(null);
                }}
                onClose={() => setContextMenu(null)}
              />
            )}
            {contextMenu.type === 'repo' && contextMenu.repo && (
              <RepoContextMenu
                repo={contextMenu.repo}
                groups={groups}
                onMoveToGroup={(groupId) => {
                  onMoveToGroup(contextMenu.repo!.path, groupId);
                  setContextMenu(null);
                }}
                onRemove={
                  onRemoveRepository
                    ? () => {
                        onRemoveRepository(contextMenu.repo!.path);
                        setContextMenu(null);
                      }
                    : undefined
                }
                onSettings={
                  onRepoSettings
                    ? () => {
                        onRepoSettings(contextMenu.repo!);
                        setContextMenu(null);
                      }
                    : undefined
                }
                onClose={() => setContextMenu(null)}
              />
            )}
            {contextMenu.type === 'empty' && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                onClick={() => {
                  onAddGroup();
                  setContextMenu(null);
                }}
              >
                <FolderPlus className="h-4 w-4" />
                {t('New Group')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function GroupContextMenu({
  group,
  groups,
  onEdit,
  onAddSubgroup,
  onMoveToRoot,
}: {
  group: RepositoryGroup;
  groups: RepositoryGroup[];
  onEdit: () => void;
  onAddSubgroup: () => void;
  onMoveToRoot: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const depth = getGroupDepth(group.id, groups);

  return (
    <>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
        onClick={onEdit}
      >
        <Pencil className="h-4 w-4" />
        {t('Edit Group')}
      </button>
      {depth < MAX_GROUP_DEPTH - 1 && (
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          onClick={onAddSubgroup}
        >
          <FolderPlus className="h-4 w-4" />
          {t('New Subgroup')}
        </button>
      )}
      {group.parentId && (
        <>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            onClick={onMoveToRoot}
          >
            <FolderSymlink className="h-4 w-4" />
            {t('Move to Root')}
          </button>
        </>
      )}
    </>
  );
}

function RepoContextMenu({
  repo,
  groups,
  onMoveToGroup,
  onRemove,
  onSettings,
}: {
  repo: Repository;
  groups: RepositoryGroup[];
  onMoveToGroup: (groupId: string | null) => void;
  onRemove?: () => void;
  onSettings?: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();

  return (
    <>
      <div className="relative group/submenu">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
        >
          <FolderSymlink className="h-4 w-4" />
          {t('Move to Group')}
          <ChevronRight className="ml-auto h-3.5 w-3.5" />
        </button>
        <div className="invisible absolute left-full top-0 z-50 min-w-36 rounded-lg border bg-popover p-1 opacity-0 shadow-lg transition-all group-hover/submenu:visible group-hover/submenu:opacity-100">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            onClick={() => onMoveToGroup(null)}
          >
            <span className="text-muted-foreground">{t('No Group')}</span>
          </button>
          {groups.length > 0 && <div className="my-1 h-px bg-border" />}
          {buildGroupTree(groups).map((node) => (
            <MoveToGroupMenuItem
              key={node.id}
              node={node}
              currentGroupId={repo.groupId}
              onSelect={onMoveToGroup}
              depth={0}
            />
          ))}
        </div>
      </div>

      {/* Open Folder */}
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
        onClick={() => {
          window.electronAPI.shell.openPath(repo.path);
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
          try {
            await navigator.clipboard.writeText(repo.name);
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

      {onSettings && (
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          onClick={onSettings}
        >
          <Settings2 className="h-4 w-4" />
          {t('Repository Settings')}
        </button>
      )}

      {onRemove && (
        <>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
            onClick={onRemove}
          >
            <FolderMinus className="h-4 w-4" />
            {t('Remove repository')}
          </button>
        </>
      )}
    </>
  );
}

function MoveToGroupMenuItem({
  node,
  currentGroupId,
  onSelect,
  depth,
}: {
  node: GroupTreeNode;
  currentGroupId?: string;
  onSelect: (groupId: string) => void;
  depth: number;
}) {
  const isCurrent = currentGroupId === node.id;

  return (
    <>
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm hover:bg-accent',
          isCurrent && 'font-medium text-primary'
        )}
        style={{ paddingLeft: depth * 12 + 8 }}
        onClick={() => onSelect(node.id)}
      >
        <Folder className="h-3.5 w-3.5 text-amber-500" />
        <span className="truncate">{node.name}</span>
      </button>
      {node.children.map((child) => (
        <MoveToGroupMenuItem
          key={child.id}
          node={child}
          currentGroupId={currentGroupId}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </>
  );
}

function getMaxSubtreeDepth(groupId: string, groups: RepositoryGroup[]): number {
  const children = groups.filter((g) => g.parentId === groupId);
  if (children.length === 0) return 0;
  return 1 + Math.max(...children.map((c) => getMaxSubtreeDepth(c.id, groups)));
}

function getDescendantRepoCount(
  groupId: string,
  groups: RepositoryGroup[],
  repos: Repository[]
): number {
  const ids = getDescendantIds(groupId, groups);
  return repos.filter((r) => r.groupId && ids.includes(r.groupId)).length;
}
