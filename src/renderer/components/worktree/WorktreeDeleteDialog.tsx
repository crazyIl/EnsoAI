import type { GitWorktree } from '@shared/types';
import { useState } from 'react';
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
import { toastManager } from '@/components/ui/toast';
import { useI18n } from '@/i18n';

interface WorktreeDeleteDialogProps {
  worktree: GitWorktree | null;
  onOpenChange: (open: boolean) => void;
  onDelete: (
    worktree: GitWorktree,
    options: { deleteBranch: boolean; force: boolean }
  ) => Promise<void>;
  /** 删除成功后的回调 */
  onDeleted?: () => void;
}

export function WorktreeDeleteDialog({
  worktree,
  onOpenChange,
  onDelete,
  onDeleted,
}: WorktreeDeleteDialogProps) {
  const { t, tNode } = useI18n();
  const [deleteBranch, setDeleteBranch] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setDeleteBranch(false);
      setForceDelete(false);
    }
    onOpenChange(open);
  };

  return (
    <AlertDialog open={!!worktree} onOpenChange={handleOpenChange}>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('Delete Worktree')}</AlertDialogTitle>
          <AlertDialogDescription>
            {tNode('Are you sure you want to delete worktree {{name}}?', {
              name: <strong>{worktree?.branch}</strong>,
            })}
            {worktree?.prunable ? (
              <span className="mt-2 block text-muted-foreground">
                {t('This directory has already been removed; Git records will be cleaned up.')}
              </span>
            ) : (
              <span className="mt-2 block text-destructive">
                {t(
                  'This will delete the directory and all files inside. This action cannot be undone!'
                )}
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1">
          {worktree?.branch && !worktree?.isMainWorktree && (
            <label className="flex cursor-pointer select-none items-center gap-2 px-6 py-2 text-sm">
              <input
                type="checkbox"
                checked={deleteBranch}
                onChange={(e) => setDeleteBranch(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <span>
                {tNode('Also delete branch {{name}}', {
                  name: <strong>{worktree.branch}</strong>,
                })}
              </span>
            </label>
          )}
          {!worktree?.prunable && (
            <label className="flex cursor-pointer select-none items-center gap-2 px-6 py-2 text-sm">
              <input
                type="checkbox"
                checked={forceDelete}
                onChange={(e) => setForceDelete(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <span className="text-muted-foreground">
                {t('Force delete (ignore uncommitted changes)')}
              </span>
            </label>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogClose
            render={
              <Button variant="outline" disabled={isDeleting}>
                {t('Cancel')}
              </Button>
            }
          />
          <Button
            variant="destructive"
            disabled={isDeleting}
            onClick={async () => {
              if (worktree) {
                setIsDeleting(true);
                try {
                  await onDelete(worktree, { deleteBranch, force: forceDelete });
                  setDeleteBranch(false);
                  setForceDelete(false);
                  onOpenChange(false);
                  onDeleted?.();
                } catch (err) {
                  const message = err instanceof Error ? err.message : String(err);
                  const hasUncommitted = message.includes('modified or untracked');
                  toastManager.add({
                    type: 'error',
                    title: t('Delete failed'),
                    description: hasUncommitted
                      ? t(
                          'This directory contains uncommitted changes. Please check "Force delete".'
                        )
                      : message,
                  });
                } finally {
                  setIsDeleting(false);
                }
              }
            }}
          >
            {isDeleting ? t('Deleting...') : t('Delete')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
