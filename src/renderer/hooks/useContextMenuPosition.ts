import { useLayoutEffect, useRef, useState } from 'react';

const VIEWPORT_PADDING = 4;

/**
 * 自动调整右键菜单位置，防止溢出视口边界
 */
export function useContextMenuPosition(x: number, y: number) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjusted, setAdjusted] = useState({ x, y });

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let ax = x;
    let ay = y;

    if (x + rect.width > vw - VIEWPORT_PADDING) {
      ax = vw - rect.width - VIEWPORT_PADDING;
    }
    if (y + rect.height > vh - VIEWPORT_PADDING) {
      ay = vh - rect.height - VIEWPORT_PADDING;
    }
    if (ax < VIEWPORT_PADDING) ax = VIEWPORT_PADDING;
    if (ay < VIEWPORT_PADDING) ay = VIEWPORT_PADDING;

    if (ax !== x || ay !== y) {
      setAdjusted({ x: ax, y: ay });
    } else {
      setAdjusted({ x, y });
    }
  }, [x, y]);

  return { menuRef, position: adjusted };
}

/**
 * 自动调整子菜单位置，防止溢出视口边界
 * 通过 mouseenter 事件在 hover 时调整位置
 */
export function useSubmenuPosition() {
  const submenuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    function adjustPosition() {
      const submenu = submenuRef.current;
      if (!submenu || !trigger) return;

      // 重置为默认位置以获取准确尺寸
      submenu.style.left = '100%';
      submenu.style.right = 'auto';
      submenu.style.top = '0';

      const triggerRect = trigger.getBoundingClientRect();
      const submenuRect = submenu.getBoundingClientRect();
      const vh = window.innerHeight;
      const vw = window.innerWidth;

      // 水平方向：如果右侧放不下，放到左侧
      if (triggerRect.right + submenuRect.width > vw - VIEWPORT_PADDING) {
        submenu.style.left = 'auto';
        submenu.style.right = '100%';
      }

      // 垂直方向：如果底部溢出，向上调整
      if (triggerRect.top + submenuRect.height > vh - VIEWPORT_PADDING) {
        const offset = triggerRect.top + submenuRect.height - vh + VIEWPORT_PADDING;
        submenu.style.top = `-${offset}px`;
      }
    }

    trigger.addEventListener('mouseenter', adjustPosition);
    return () => trigger.removeEventListener('mouseenter', adjustPosition);
  }, []);

  return { submenuRef, triggerRef };
}
