// 统一的选择器 / 标记
const UI_SELECTOR = '#rrtool-ui, [data-rec-ignore="1"]';

/**
 * 是否来自我们自己注入的 UI（用于监听器开头过滤）
 */
export function isFromUIEvent(event: Event): boolean {
  const path = event.composedPath?.() ?? [event.target as EventTarget];
  for (const el of path) {
    if (el instanceof HTMLElement && el.matches(UI_SELECTOR)) {
      return true;
    }
  }
  return false;
}

/**
 * 从一个坐标下挑选“不是我们 UI 的元素”
 * 给 highlighter 用
 */
export function pickNonUIElementAt(x: number, y: number): Element | null {
  const stack = document.elementsFromPoint(x, y) as Element[];
  for (const el of stack) {
    if (!el.matches(UI_SELECTOR)) {
      return el;
    }
  }
  return null;
}