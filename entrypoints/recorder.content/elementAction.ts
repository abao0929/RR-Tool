import { ClickInfo, InputInfo, KeydownInfo, MouseWheelInfo, StepInfo } from "../../src/template.js";

export class ElementAction {
    getKeydownInfo(e: KeyboardEvent): KeydownInfo {
        return {
            key: e.key,
            code: e.code,
            location: e.location,
            repeat: e.repeat,
            repeatTime: null,
            isComposing: e.isComposing
        }
    }

    getWheelInfo(e: WheelEvent): MouseWheelInfo {
        const deltaX = e.deltaX;
        const deltaY = e.deltaY;
        let direction: 'up' | 'down' | 'left' | 'right' | 'none' = 'none';
        if (deltaX === 0) {
            if (deltaY > 0) {
                direction = 'down';
            }
            if (deltaY < 0){
                direction = 'up';
            }
        }
        if (deltaY === 0) {
            if (deltaX > 0) {
                direction = 'right';
            }
            if (deltaX < 0) {
                direction = 'left'
            }
        }
        return {
            direction,
            deltaX,
            deltaY,
            scrollX: window.scrollX,
            scrollY: window.scrollY,
            modifiers: {
                shift: e.shiftKey,
                ctrl: e.ctrlKey,
                alt: e.altKey,
                meta: e.metaKey,
            }
        };
    }

    getInputInfo(e: InputEvent): InputInfo{
        const target = e.target as HTMLInputElement;
        return {
            value: target?.value
        }
    }

    getClickInfo(e: MouseEvent): ClickInfo | null {
        const el = this.getEventElement(e);
        if (!el) return null;

        const offset = this.getOffsetInElement(e, el);
        const pagePoint = this.getPagePointFromEvent(e);
        const elementRect = this.getElementPageRect(el);

        return {
            button: e.button,
            count: e.detail,
            offset,
            pagePoint,
            elementRect,
            modifiers: {
                shift: e.shiftKey,
                ctrl: e.ctrlKey,
                alt: e.altKey,
                meta: e.metaKey,
            },
            screenshotUrl: null
        }
    }

    getOffsetInElement(e: MouseEvent, el: Element) {
        const r = el.getBoundingClientRect();           // 视口坐标
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        return {
            x: Math.round(Math.max(0, Math.min(r.width, x))),
            y: Math.round(Math.max(0, Math.min(r.height, y))),
        };
    }

    // 点击点相对“顶层页面”的坐标（跨 iframe 累加）
    getPagePointFromEvent(e: MouseEvent) {
        // 先从“当前文档”视角：client + 本文档滚动
        let x = e.clientX + (window.scrollX || 0);
        let y = e.clientY + (window.scrollY || 0);

        // 逐层把 iframe 偏移与父文档滚动加上，直到顶层
        let win: Window | null = (e.view as Window) || window;
        while (win && win !== win.top) {
            const frameEl = win.frameElement as Element | null;
            if (!frameEl) break;
            const fr = frameEl.getBoundingClientRect();   // 在父文档【视口】中的位置
            const parent: Window = win.parent!;
            x += fr.left + (parent.scrollX || 0);
            y += fr.top + (parent.scrollY || 0);
            win = parent;
        }
        return { x: Math.round(x), y: Math.round(y) };
    }

    // 元素相对“顶层页面”的矩形（跨 iframe 累加）
    getElementPageRect(el: Element) {
        // 本文档：先视口 → 页面
        const r0 = el.getBoundingClientRect();
        let x = r0.left + (el.ownerDocument?.defaultView?.scrollX || 0);
        let y = r0.top + (el.ownerDocument?.defaultView?.scrollY || 0);
        const w = Math.round(r0.width);
        const h = Math.round(r0.height);

        // 逐层累加到顶层
        let win: Window | null = el.ownerDocument?.defaultView ?? null;
        while (win && win !== win.top) {
            const frameEl = win.frameElement as Element | null;
            if (!frameEl) break;
            const fr = frameEl.getBoundingClientRect();
            const parent = win.parent!;
            x += fr.left + (parent.scrollX || 0);
            y += fr.top + (parent.scrollY || 0);
            win = parent;
        }
        return { x: Math.round(x), y: Math.round(y), width: w, height: h };
    }

    getEventElement(e: MouseEvent): Element | null {
        const path = (e.composedPath?.() ?? []) as Array<EventTarget>;
        for (const t of path) if (t instanceof Element) return t;
        return e.target instanceof Element ? e.target : null;
    }
}