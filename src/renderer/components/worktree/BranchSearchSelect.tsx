import type { GitBranch as GitBranchType } from '@shared/types';
import { ChevronsUpDownIcon, GitBranch, Search } from 'lucide-react';
import * as React from 'react';
import {
  Combobox,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxSeparator,
  ComboboxTrigger,
} from '@/components/ui/combobox';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

const getBranchDisplayName = (name: string) => {
  return name.startsWith('remotes/') ? name.replace('remotes/', '') : name;
};

type BranchItem = {
  id: string;
  label: string;
  searchLabel: string;
  value: string;
  current: boolean;
  isRemote: boolean;
  isDefault: boolean;
};

type BranchGroup = {
  value: 'local' | 'remote';
  label: string;
  items: BranchItem[];
};

interface BranchSearchSelectProps {
  branches: GitBranchType[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  includeRemote?: boolean;
  excludedBranchNames?: string[];
  showDefaultBadge?: boolean;
}

const sortBranchesByRecentActivity = (a: GitBranchType, b: GitBranchType) => {
  const activityDiff = (b.lastCommitAt || 0) - (a.lastCommitAt || 0);
  if (activityDiff !== 0) {
    return activityDiff;
  }
  if (a.current !== b.current) {
    return a.current ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
};

export function BranchSearchSelect({
  branches,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  includeRemote = true,
  excludedBranchNames = [],
  showDefaultBadge = false,
}: BranchSearchSelectProps) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');

  const excludedSet = React.useMemo(() => new Set(excludedBranchNames), [excludedBranchNames]);

  const branchItems = React.useMemo((): BranchItem[] => {
    return [...branches]
      .filter((branch) => (includeRemote ? true : !branch.name.startsWith('remotes/')))
      .filter((branch) => !excludedSet.has(branch.name))
      .sort(sortBranchesByRecentActivity)
      .map((branch) => {
        const displayName = getBranchDisplayName(branch.name);
        return {
          id: branch.name,
          label: displayName,
          searchLabel: [branch.name, displayName, branch.current ? t('Current') : '']
            .join(' ')
            .trim()
            .toLowerCase(),
          value: branch.name,
          current: branch.current,
          isRemote: branch.name.startsWith('remotes/'),
          isDefault:
            branch.name === 'main' || branch.name === 'master' || branch.name === 'develop',
        };
      });
  }, [branches, includeRemote, excludedSet, t]);

  const filteredItems = React.useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return branchItems;
    }
    return branchItems.filter((item) => item.searchLabel.includes(query));
  }, [branchItems, searchValue]);

  const branchGroups = React.useMemo((): BranchGroup[] => {
    const localItems = filteredItems.filter((item) => !item.isRemote);
    const remoteItems = filteredItems.filter((item) => item.isRemote);
    const groups: BranchGroup[] = [];

    if (localItems.length > 0) {
      groups.push({ value: 'local', label: t('Local branches'), items: localItems });
    }
    if (remoteItems.length > 0) {
      groups.push({ value: 'remote', label: t('Remote branches'), items: remoteItems });
    }

    return groups;
  }, [filteredItems, t]);

  const selectedItem = React.useMemo(() => {
    return branchItems.find((item) => item.value === value) || null;
  }, [branchItems, value]);

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    setSearchValue('');
  }, []);

  const handleValueChange = React.useCallback(
    (item: BranchItem | null) => {
      if (!item) {
        return;
      }
      onValueChange(item.value);
      setSearchValue('');
    },
    [onValueChange]
  );

  return (
    <Combobox<BranchItem>
      items={branchGroups}
      value={selectedItem}
      onValueChange={handleValueChange}
      inputValue={searchValue}
      onInputValueChange={(nextValue) => setSearchValue(String(nextValue))}
      open={open}
      onOpenChange={handleOpenChange}
    >
      <ComboboxTrigger
        type="button"
        className={cn(
          'relative inline-flex min-h-9 w-full min-w-36 select-none items-center justify-between gap-2 rounded-lg border border-input bg-background bg-clip-padding px-[calc(--spacing(3)-1px)] text-left text-base shadow-xs outline-none ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-data-disabled:not-focus-visible:not-aria-invalid:not-data-pressed:before:shadow-[0_1px_--theme(--color-black/4%)] pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 focus-visible:border-ring focus-visible:ring-[3px] data-disabled:pointer-events-none data-disabled:opacity-64 sm:min-h-8 sm:text-sm dark:bg-input/32 dark:not-in-data-[slot=group]:bg-clip-border dark:not-data-disabled:not-focus-visible:not-aria-invalid:not-data-pressed:before:shadow-[0_-1px_--theme(--color-white/8%)]',
          open && 'border-ring ring-[3px]'
        )}
      >
        <GitBranch className="h-4 w-4 shrink-0 opacity-80" />
        <span className={cn('min-w-0 flex-1 truncate', !selectedItem && 'text-muted-foreground')}>
          {selectedItem ? selectedItem.label : placeholder}
        </span>
        <ChevronsUpDownIcon className="h-4 w-4 shrink-0 opacity-80" />
      </ComboboxTrigger>
      <ComboboxPopup>
        <div className="border-b p-2">
          <ComboboxInput
            autoFocus
            placeholder={searchPlaceholder}
            startAddon={<Search className="h-4 w-4" />}
            showTrigger={false}
          />
        </div>
        <ComboboxEmpty>{t('No branches found')}</ComboboxEmpty>
        <ComboboxList>
          {(group: BranchGroup) => (
            <React.Fragment key={group.value}>
              <ComboboxGroup items={group.items}>
                <ComboboxGroupLabel>{group.label}</ComboboxGroupLabel>
                <ComboboxCollection>
                  {(item: BranchItem) => (
                    <ComboboxItem key={item.id} value={item}>
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate">{item.label}</span>
                        {item.current && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {t('Current')}
                          </span>
                        )}
                        {showDefaultBadge && item.isDefault && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {t('Default')}
                          </span>
                        )}
                      </div>
                    </ComboboxItem>
                  )}
                </ComboboxCollection>
              </ComboboxGroup>
              {group.value === 'local' && branchGroups.length > 1 && <ComboboxSeparator />}
            </React.Fragment>
          )}
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}
