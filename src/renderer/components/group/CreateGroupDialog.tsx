import { useState } from 'react';
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

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => void;
}

export function CreateGroupDialog({ open, onOpenChange, onSubmit }: CreateGroupDialogProps) {
  const { t } = useI18n();
  const [name, setName] = useState('');

  const handleSubmit = () => {
    if (name.trim()) {
      onSubmit(name.trim());
      setName('');
      onOpenChange(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setName('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('New Group')}</DialogTitle>
        </DialogHeader>
        <DialogPanel>
          <div>
            <label className="text-sm font-medium">{t('Group Name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder={t('e.g. Work Projects')}
              className="mt-2 h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>
        </DialogPanel>
        <DialogFooter variant="bare">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            {t('Create')}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
