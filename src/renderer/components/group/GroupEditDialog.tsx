import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { RepositoryGroup } from '@/App/constants';
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
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog';
import { useI18n } from '@/i18n';

interface GroupEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: RepositoryGroup | null;
  repositoryCount: number;
  onUpdate: (groupId: string, name: string) => void;
  onDelete: (groupId: string) => void;
}

export function GroupEditDialog({
  open,
  onOpenChange,
  group,
  repositoryCount,
  onUpdate,
  onDelete,
}: GroupEditDialogProps) {
  const { t, tNode } = useI18n();
  const [name, setName] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (group) {
      setName(group.name);
    }
  }, [group]);

  const handleSave = () => {
    if (group && name.trim()) {
      onUpdate(group.id, name.trim());
      onOpenChange(false);
    }
  };

  const handleDelete = () => {
    if (group) {
      onDelete(group.id);
      setDeleteDialogOpen(false);
      onOpenChange(false);
    }
  };

  if (!group) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogPopup className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('Edit Group')}</DialogTitle>
          </DialogHeader>
          <DialogPanel>
            <div>
              <label className="text-sm font-medium">{t('Group Name')}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
            </div>
          </DialogPanel>
          <DialogFooter variant="bare">
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(true)}
              className="mr-auto flex items-center gap-2 text-sm text-destructive hover:underline"
            >
              <Trash2 className="h-4 w-4" />
              {t('Delete Group')}
            </button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('Cancel')}
            </Button>
            <Button onClick={handleSave} disabled={!name.trim()}>
              {t('Save')}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete Group')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tNode('Are you sure you want to delete group {{name}}?', {
                name: <strong>{group.name}</strong>,
              })}
              {repositoryCount > 0 && (
                <span className="mt-2 block text-muted-foreground">
                  {t('{{count}} repositories in this group will be moved to ungrouped.', {
                    count: repositoryCount,
                  })}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline">{t('Cancel')}</Button>} />
            <Button variant="destructive" onClick={handleDelete}>
              {t('Delete')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}
