import { Check, ChevronDown, Pencil, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import { ALL_GROUP_ID, type RepositoryGroup } from '@/App/constants';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

interface GroupSelectorProps {
  groups: RepositoryGroup[];
  activeGroupId: string;
  repositoryCounts: Record<string, number>;
  totalCount: number;
  onSelectGroup: (groupId: string) => void;
  onEditGroup: () => void;
  onAddGroup: () => void;
}

export function GroupSelector({
  groups,
  activeGroupId,
  repositoryCounts,
  totalCount,
  onSelectGroup,
  onEditGroup,
  onAddGroup,
}: GroupSelectorProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeGroup = groups.find((g) => g.id === activeGroupId);
  const isAllSelected = activeGroupId === ALL_GROUP_ID;

  const displayName = isAllSelected ? t('All') : activeGroup?.name || t('All');
  const displayCount = isAllSelected ? totalCount : repositoryCounts[activeGroupId] || 0;

  const handleSelect = (groupId: string) => {
    onSelectGroup(groupId);
    setIsOpen(false);
  };

  return (
    <div className="border-b">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex w-full h-10 cursor-pointer items-center gap-2 px-3 text-sm hover:bg-accent/50 transition-colors"
      >
        <span className="min-w-0 flex-1 truncate text-left font-medium">{displayName}</span>
        <span className="shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs text-muted-foreground">
          {displayCount}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            isOpen && 'rotate-180'
          )}
        />
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            if (!isAllSelected) {
              onEditGroup();
            } else {
              onAddGroup();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              if (!isAllSelected) {
                onEditGroup();
              } else {
                onAddGroup();
              }
            }
          }}
          className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
          title={isAllSelected ? t('New Group') : t('Edit Group')}
        >
          {isAllSelected ? <Plus className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
        </span>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
              onKeyDown={(e) => e.key === 'Escape' && setIsOpen(false)}
              role="presentation"
            />
            <div
              ref={menuRef}
              className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border bg-popover p-1 shadow-lg"
            >
              <button
                type="button"
                onClick={() => handleSelect(ALL_GROUP_ID)}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                  'hover:bg-accent/50'
                )}
              >
                <span className="min-w-0 flex-1 truncate text-left">{t('All')}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{totalCount}</span>
                {isAllSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>

              {groups.length > 0 && <div className="my-1 h-px bg-border" />}

              {groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => handleSelect(group.id)}
                  className={cn(
                    'group/item flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                    'hover:bg-accent/50'
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-left">{group.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {repositoryCounts[group.id] || 0}
                  </span>
                  {activeGroupId === group.id ? (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(false);
                        onSelectGroup(group.id);
                        onEditGroup();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          setIsOpen(false);
                          onSelectGroup(group.id);
                          onEditGroup();
                        }
                      }}
                      className="shrink-0 p-0.5 rounded text-muted-foreground opacity-0 group-hover/item:opacity-100 hover:text-foreground transition-opacity"
                      title={t('Edit Group')}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </span>
                  )}
                </button>
              ))}

              <div className="my-1 h-px bg-border" />

              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onAddGroup();
                }}
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                <span>{t('New Group')}</span>
              </button>
            </div>
          </>
        )}
      </button>
    </div>
  );
}
