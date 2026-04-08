import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toastManager } from '@/components/ui/toast';
import { useRepositoryStore } from '@/stores/repository';

function getGitErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Unknown error';
  }

  const message = error.message.trim();

  if (
    message.includes('index.lock') ||
    message.includes('HEAD.lock') ||
    message.includes('cannot lock ref')
  ) {
    return 'Git repository is busy. Finish the Git operation in VS Code and try again.';
  }

  return message || 'Unknown error';
}

export function useGitStatus(workdir: string | null, isActive = true) {
  const setStatus = useRepositoryStore((s) => s.setStatus);

  return useQuery({
    queryKey: ['git', 'status', workdir],
    queryFn: async () => {
      if (!workdir) return null;
      const status = await window.electronAPI.git.getStatus(workdir);
      setStatus(status);
      return status;
    },
    enabled: !!workdir,
    refetchInterval: isActive ? 5000 : false,
    refetchIntervalInBackground: isActive,
    refetchOnWindowFocus: isActive,
  });
}

export function useGitBranches(workdir: string | null) {
  const setBranches = useRepositoryStore((s) => s.setBranches);

  return useQuery({
    queryKey: ['git', 'branches', workdir],
    queryFn: async () => {
      if (!workdir) return [];
      const branches = await window.electronAPI.git.getBranches(workdir);
      setBranches(branches);
      return branches;
    },
    enabled: !!workdir,
  });
}

export function useGitLog(workdir: string | null, maxCount = 50) {
  const setLogs = useRepositoryStore((s) => s.setLogs);

  return useQuery({
    queryKey: ['git', 'log', workdir, maxCount],
    queryFn: async () => {
      if (!workdir) return [];
      const logs = await window.electronAPI.git.getLog(workdir, maxCount);
      setLogs(logs);
      return logs;
    },
    enabled: !!workdir,
  });
}

export function useGitCommit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workdir,
      message,
      files,
    }: {
      workdir: string;
      message: string;
      files?: string[];
    }) => {
      return window.electronAPI.git.commit(workdir, message, files);
    },
    onSuccess: (_, { workdir }) => {
      queryClient.invalidateQueries({ queryKey: ['git', 'status', workdir] });
      queryClient.invalidateQueries({ queryKey: ['git', 'log', workdir] });
    },
  });
}

export function useGitCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workdir, branch }: { workdir: string; branch: string }) => {
      await window.electronAPI.git.checkout(workdir, branch);
    },
    onSuccess: (_, { workdir }) => {
      queryClient.invalidateQueries({ queryKey: ['git', 'status', workdir] });
      queryClient.invalidateQueries({ queryKey: ['git', 'branches', workdir] });
    },
  });
}

export function useGitCreateBranch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workdir,
      name,
      startPoint,
    }: {
      workdir: string;
      name: string;
      startPoint?: string;
    }) => {
      await window.electronAPI.git.createBranch(workdir, name, startPoint);
    },
    onSuccess: (_, { workdir }) => {
      queryClient.invalidateQueries({ queryKey: ['git', 'branches', workdir] });
    },
  });
}

export function useGitPush() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workdir,
      remote,
      branch,
      setUpstream,
    }: {
      workdir: string;
      remote?: string;
      branch?: string;
      setUpstream?: boolean;
    }) => {
      await window.electronAPI.git.push(workdir, remote, branch, setUpstream);
    },
    onSuccess: (_, { workdir }) => {
      queryClient.invalidateQueries({ queryKey: ['git', 'status', workdir] });
    },
    onError: (error) => {
      toastManager.add({
        title: 'Push failed',
        description: getGitErrorMessage(error),
        type: 'error',
        timeout: 5000,
      });
    },
  });
}

export function useGitPull() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workdir,
      remote,
      branch,
    }: {
      workdir: string;
      remote?: string;
      branch?: string;
    }) => {
      await window.electronAPI.git.pull(workdir, remote, branch);
    },
    onSuccess: (_, { workdir }) => {
      queryClient.invalidateQueries({ queryKey: ['git', 'status', workdir] });
      queryClient.invalidateQueries({ queryKey: ['git', 'log', workdir] });
      queryClient.invalidateQueries({ queryKey: ['git', 'log-infinite', workdir] });
    },
    onError: (error) => {
      toastManager.add({
        title: 'Pull failed',
        description: getGitErrorMessage(error),
        type: 'error',
        timeout: 5000,
      });
    },
  });
}

export function useGitDiff(workdir: string | null, staged = false) {
  return useQuery({
    queryKey: ['git', 'diff', workdir, staged],
    queryFn: async () => {
      if (!workdir) return '';
      return window.electronAPI.git.getDiff(workdir, { staged });
    },
    enabled: !!workdir,
  });
}

export function useGitInit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workdir: string) => {
      await window.electronAPI.git.init(workdir);
    },
    onSuccess: (_, workdir) => {
      // Invalidate all git-related queries for this workdir
      queryClient.invalidateQueries({ queryKey: ['git', 'status', workdir] });
      queryClient.invalidateQueries({ queryKey: ['git', 'branches', workdir] });
      queryClient.invalidateQueries({ queryKey: ['worktree', 'list', workdir] });
    },
  });
}
