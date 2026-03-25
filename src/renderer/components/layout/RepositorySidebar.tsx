import {
  ChevronsDownUp,
  ChevronsUpDown,
  FolderGit2,
  FolderPlus,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { getDescendantIds, type RepositoryGroup, type TabId } from '@/App/constants';
import { CreateGroupDialog, GroupEditDialog, GroupTree } from '@/components/group';
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
import { useI18n } from '@/i18n';
import { RunningProjectsPopover } from './RunningProjectsPopover';

interface Repository {
  name: string;
  path: string;
  groupId?: string;
}

interface RepositorySidebarProps {
  repositories: Repository[];
  selectedRepo: string | null;
  onSelectRepo: (repoPath: string) => void;
  onAddRepository: () => void;
  onRemoveRepository?: (repoPath: string) => void;
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
  onMoveToGroup: (repoPath: string, groupId: string | null) => void;
  onMoveGroup: (groupId: string, targetParentId: string | null, order: number) => void;
  onReorderRepo: (
    repoPath: string,
    targetGroupId: string | null,
    targetRepoPath: string,
    position: 'before' | 'after'
  ) => void;
  onSwitchTab?: (tab: TabId) => void;
  onSwitchWorktreeByPath?: (path: string) => Promise<void> | void;
}

export function RepositorySidebar({
  repositories,
  selectedRepo,
  onSelectRepo,
  onAddRepository,
  onRemoveRepository,
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
}: RepositorySidebarProps) {
  const { t, tNode } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [repoToRemove, setRepoToRemove] = useState<Repository | null>(null);
  const [repoSettingsOpen, setRepoSettingsOpen] = useState(false);
  const [repoSettingsTarget, setRepoSettingsTarget] = useState<Repository | null>(null);
  const [createGroupDialogOpen, setCreateGroupDialogOpen] = useState(false);
  const [createGroupParentId, setCreateGroupParentId] = useState<string | undefined>();
  const [editGroupDialogOpen, setEditGroupDialogOpen] = useState(false);
  const [editGroupTarget, setEditGroupTarget] = useState<RepositoryGroup | null>(null);

  const editGroupRepoCount = useMemo(() => {
    if (!editGroupTarget) return 0;
    const ids = getDescendantIds(editGroupTarget.id, groups);
    return repositories.filter((r) => r.groupId && ids.includes(r.groupId)).length;
  }, [editGroupTarget, groups, repositories]);

  const handleConfirmRemove = () => {
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
    [onCreateGroup, createGroupParentId]
  );

  const hasGroups = groups.length > 0;

  return (
    <aside className="flex h-full w-full flex-col border-r bg-background">
      <div className="drag-region flex h-12 items-center justify-end gap-1 border-b px-3">
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
      </div>

      <div className="px-3 py-2">
        <div className="flex h-8 items-center gap-2 rounded-lg border bg-background px-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('Search repositories')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          />
        </div>
      </div>

      <div className="flex h-8 items-center justify-end gap-0.5 border-b px-2">
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

      {repositories.length === 0 && groups.length === 0 ? (
        <div className="flex-1 overflow-auto p-2">
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
        </div>
      ) : (
        <GroupTree
          groups={groups}
          repositories={repositories}
          selectedRepo={selectedRepo}
          expandedIds={expandedGroupIds}
          onToggleExpand={onToggleGroupExpand}
          onSelectRepo={onSelectRepo}
          onDeleteGroup={onDeleteGroup}
          onMoveToGroup={onMoveToGroup}
          onMoveGroup={onMoveGroup}
          onReorderRepo={onReorderRepo}
          onRemoveRepository={
            onRemoveRepository
              ? (path) => {
                  const repo = repositories.find((r) => r.path === path);
                  if (repo) setRepoToRemove(repo);
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
        />
      )}

      <div className="shrink-0 border-t p-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-8 flex-1 items-center justify-start gap-2 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
            onClick={onAddRepository}
          >
            <Plus className="h-4 w-4" />
            {t('Add Repository')}
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
            onClick={onOpenSettings}
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      <AlertDialog
        open={!!repoToRemove}
        onOpenChange={(open) => {
          if (!open) setRepoToRemove(null);
        }}
      >
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Remove repository')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tNode('Are you sure you want to remove {{name}} from the workspace?', {
                name: <strong>{repoToRemove?.name}</strong>,
              })}
              <span className="mt-2 block text-muted-foreground">
                {t('This will only remove it from the app and will not delete local files.')}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline">{t('Cancel')}</Button>} />
            <Button variant="destructive" onClick={handleConfirmRemove}>
              {t('Remove')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>

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
