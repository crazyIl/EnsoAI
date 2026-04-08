import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function useGitRepositoryWatcher(workdir: string | null) {
  const queryClient = useQueryClient();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!workdir) return;
    let disposed = false;
    let unsubscribe: (() => void) | null = null;
    let resolvedGitDir: string | null = null;

    void (async () => {
      try {
        resolvedGitDir = normalizePath(await window.electronAPI.git.getDir(workdir));
        if (disposed || !resolvedGitDir) return;

        await window.electronAPI.file.watchStart(resolvedGitDir);
        if (disposed) {
          void window.electronAPI.file.watchStop(resolvedGitDir);
          return;
        }

        unsubscribe = window.electronAPI.file.onChange((event) => {
          const eventPath = normalizePath(event.path);
          if (eventPath !== resolvedGitDir && !eventPath.startsWith(`${resolvedGitDir}/`)) {
            return;
          }

          if (timerRef.current) {
            window.clearTimeout(timerRef.current);
          }

          // Batch bursty git events such as index updates and ref rewrites.
          timerRef.current = window.setTimeout(() => {
            void queryClient.invalidateQueries({ queryKey: ['git', 'status', workdir] });
            void queryClient.invalidateQueries({ queryKey: ['git', 'file-changes', workdir] });
            void queryClient.invalidateQueries({ queryKey: ['git', 'log', workdir] });
            void queryClient.invalidateQueries({ queryKey: ['git', 'log-infinite', workdir] });
            void queryClient.invalidateQueries({ queryKey: ['git', 'branches', workdir] });
            timerRef.current = null;
          }, 200);
        });
      } catch {
        // Ignore watcher setup failures and fall back to polling/refetch on action.
      }
    })();

    return () => {
      disposed = true;
      unsubscribe?.();
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (resolvedGitDir) {
        void window.electronAPI.file.watchStop(resolvedGitDir);
      }
    };
  }, [workdir, queryClient]);
}
