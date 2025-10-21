// utils（可放 recorder.content.ts 顶部）
const UI_SEL = '[data-rr-ui]';

export function isFromUIEvent(e: Event): boolean {
  const path = (e.composedPath?.() ?? []) as EventTarget[];
  return path.some(t => t instanceof Element && t.closest(UI_SEL));
}

export function pickNonUIElementAt(x: number, y: number): Element | null {
  // 优先 elementsFromPoint（能拿到堆栈）
  if (document.elementsFromPoint) {
    const stack = document.elementsFromPoint(x, y) as Element[];
    return stack.find(el => !el.closest(UI_SEL)) ?? null;
  }
  // 兜底：临时隐藏 UI 再取底下元素
  const ui = document.querySelector(UI_SEL) as HTMLElement | null;
  const prev = ui?.style.visibility;
  if (ui) ui.style.visibility = "hidden";
  const hit = document.elementFromPoint(x, y);
  if (ui) ui.style.visibility = prev ?? "";
  return hit instanceof Element && !hit.closest(UI_SEL) ? hit : null;
}