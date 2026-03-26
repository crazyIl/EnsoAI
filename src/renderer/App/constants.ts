// Animation config
export const panelTransition = { type: 'spring' as const, stiffness: 400, damping: 30 };

// Tab types
export type TabId = 'chat' | 'file' | 'terminal' | 'source-control';

// Tab metadata configuration
export interface TabConfig {
  id: TabId;
  icon: React.ElementType;
  labelKey: string;
}

// Default tab order
export const DEFAULT_TAB_ORDER: TabId[] = ['chat', 'file', 'terminal', 'source-control'];

// ========== Repository Group ==========

/** 全部分组 ID（特殊值） */
export const ALL_GROUP_ID = '__all__';

/** 生成分组 ID */
export const generateGroupId = (): string =>
  `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** 最大分组嵌套层级 */
export const MAX_GROUP_DEPTH = 3;

/** 仓库分组 */
export interface RepositoryGroup {
  /** 唯一标识 */
  id: string;
  /** 分组名称 */
  name: string;
  /** 显示顺序（同级内排序） */
  order: number;
  /** 父分组 ID，undefined = 顶级分组 */
  parentId?: string;
}

/** 带子节点的树形分组节点 */
export interface GroupTreeNode extends RepositoryGroup {
  children: GroupTreeNode[];
  depth: number;
}

/** 构建分组树 */
export function buildGroupTree(groups: RepositoryGroup[]): GroupTreeNode[] {
  const sorted = [...groups].sort((a, b) => a.order - b.order);
  const map = new Map<string, GroupTreeNode>();

  for (const g of sorted) {
    map.set(g.id, { ...g, children: [], depth: 0 });
  }

  const roots: GroupTreeNode[] = [];

  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      const parent = map.get(node.parentId)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      node.depth = 0;
      roots.push(node);
    }
  }

  const fixDepth = (nodes: GroupTreeNode[], depth: number) => {
    for (const n of nodes) {
      n.depth = depth;
      fixDepth(n.children, depth + 1);
    }
  };

  fixDepth(roots, 0);
  return roots;
}

/** 获取分组的深度 */
export function getGroupDepth(groupId: string, groups: RepositoryGroup[]): number {
  let depth = 0;
  let current = groups.find((g) => g.id === groupId);
  while (current?.parentId) {
    depth++;
    current = groups.find((g) => g.id === current!.parentId);
  }
  return depth;
}

/** 获取分组的所有后代 ID（包括自身） */
export function getDescendantIds(groupId: string, groups: RepositoryGroup[]): string[] {
  const result = [groupId];
  const children = groups.filter((g) => g.parentId === groupId);
  for (const child of children) {
    result.push(...getDescendantIds(child.id, groups));
  }
  return result;
}

/** 获取分组的所有祖先 ID（不包括自身，从近到远） */
export function getAncestorIds(groupId: string, groups: RepositoryGroup[]): string[] {
  const result: string[] = [];
  let current = groups.find((g) => g.id === groupId);
  while (current?.parentId) {
    result.push(current.parentId);
    current = groups.find((g) => g.id === current!.parentId);
  }
  return result;
}

/** 判断 targetId 是否是 groupId 的祖先 */
export function isAncestor(groupId: string, targetId: string, groups: RepositoryGroup[]): boolean {
  let current = groups.find((g) => g.id === groupId);
  while (current?.parentId) {
    if (current.parentId === targetId) return true;
    current = groups.find((g) => g.id === current!.parentId);
  }
  return false;
}

// Repository type
export interface Repository {
  name: string;
  path: string;
  /** 所属分组 ID，undefined = 仅在「全部」中显示 */
  groupId?: string;
}

// Panel size constraints
export const REPOSITORY_MIN = 200;
export const REPOSITORY_MAX = 400;
export const REPOSITORY_DEFAULT = 240;
export const WORKTREE_MIN = 200;
export const WORKTREE_MAX = 400;
export const WORKTREE_DEFAULT = 280;

// Tree layout constraints
export const TREE_SIDEBAR_MIN = 200;
export const TREE_SIDEBAR_DEFAULT = 280;
