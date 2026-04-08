import { ChevronRight, Folder, FolderSymlink } from 'lucide-react';
import { buildGroupTree, type GroupTreeNode, type RepositoryGroup } from '@/App/constants';
import { useSubmenuPosition } from '@/hooks/useContextMenuPosition';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

interface MoveToGroupSubmenuProps {
  groups: RepositoryGroup[];
  currentGroupId?: string;
  onMove: (groupId: string | null) => void;
  onClose: () => void;
}

export function MoveToGroupSubmenu({
  groups,
  currentGroupId,
  onMove,
  onClose,
}: MoveToGroupSubmenuProps) {
  const { t } = useI18n();
  const { submenuRef, triggerRef } = useSubmenuPosition();

  if (groups.length === 0) return null;

  const tree = buildGroupTree(groups);

  return (
    <div ref={triggerRef} className="relative group/submenu">
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
      >
        <FolderSymlink className="h-4 w-4" />
        {t('Move to Group')}
        <ChevronRight className="ml-auto h-3.5 w-3.5" />
      </button>
      <div
        ref={submenuRef}
        className="invisible absolute left-full top-0 z-50 min-w-36 rounded-lg border bg-popover p-1 opacity-0 shadow-lg transition-all group-hover/submenu:visible group-hover/submenu:opacity-100"
      >
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          onClick={() => {
            onClose();
            onMove(null);
          }}
        >
          <span className="text-muted-foreground">{t('No Group')}</span>
        </button>
        {tree.length > 0 && <div className="my-1 h-px bg-border" />}
        {tree.map((node) => (
          <MoveToGroupMenuItem
            key={node.id}
            node={node}
            currentGroupId={currentGroupId}
            onSelect={(groupId) => {
              onClose();
              onMove(groupId);
            }}
            depth={0}
          />
        ))}
      </div>
    </div>
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
