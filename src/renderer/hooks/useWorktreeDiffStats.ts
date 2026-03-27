import type { GitWorktree } from '@shared/types';
import { useEffect } from 'react';
import { useWorktreeActivityStore } from '@/stores/worktreeActivity';

/**
 * 定时获取有活动会话的 worktree 的 diff 统计信息（每 10 秒刷新一次）
 */
export function useWorktreeDiffStats(worktrees: GitWorktree[]) {
  const fetchDiffStats = useWorktreeActivityStore((s) => s.fetchDiffStats);
  const activities = useWorktreeActivityStore((s) => s.activities);

  useEffect(() => {
    if (worktrees.length === 0) return;

    const activePaths = worktrees
      .filter((wt) => {
        const activity = activities[wt.path];
        return activity && (activity.agentCount > 0 || activity.terminalCount > 0);
      })
      .map((wt) => wt.path);

    if (activePaths.length === 0) return;

    fetchDiffStats(activePaths);
    const interval = setInterval(() => {
      fetchDiffStats(activePaths);
    }, 10000);
    return () => clearInterval(interval);
  }, [worktrees, activities, fetchDiffStats]);
}
