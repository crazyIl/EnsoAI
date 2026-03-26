import type { ReactElement } from 'react';
import { Tooltip, TooltipPopup, TooltipTrigger } from '@/components/ui/tooltip';

interface NamePathTooltipProps {
  name: string;
  path: string;
  children: ReactElement<Record<string, unknown>>;
}

export function NamePathTooltip({ name, path, children }: NamePathTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipPopup className="max-w-md" side="right" align="start" sideOffset={6}>
        <div className="space-y-1.5 text-xs">
          <div className="font-medium text-foreground whitespace-pre-wrap break-all">{name}</div>
          <div className="text-muted-foreground whitespace-pre-wrap break-all">{path}</div>
        </div>
      </TooltipPopup>
    </Tooltip>
  );
}
