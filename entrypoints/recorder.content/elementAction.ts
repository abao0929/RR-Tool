import { ClickInfo, InputInfo, KeydownInfo, MouseWheelInfo, StepInfo, DragInfo } from "../../src/template.js";

export class ElementAction {
    getDropInfo(e: DragEvent): DragInfo | null {
        const endX = e.clientX;
        const endY = e.clientY;
        return {
            startPoint: { x: 0, y: 0 }, // 修复：不能为 null，提供默认值
            endPoint: { x: endX, y: endY },
            startLocators: [], // 修复：应该是空数组而不是 null
            endLocators: [], // 修复：应该是空数组而不是 null
        }
    }

    getDragStartInfo(e: DragEvent): DragInfo | null {
        const startX = e.clientX;
        const startY = e.clientY;
        return {
            startPoint: { x: startX, y: startY },
            endPoint: { x: 0, y: 0 }, // 修复：不能为 null，提供默认值
            startLocators: [], // 修复：应该是空数组而不是 null
            endLocators: [], // 修复：应该是空数组而不是 null
        }
    }

    getKeydownInfo(e: KeyboardEvent): KeydownInfo {
        return {
            key: e.key,
            code: e.code,
            location: e.location,
            repeat: e.repeat,
            repeatTime: 0, // 修复：不能为 null，提供默认值 0
            isComposing: e.isComposing
        }
    }

    getWheelInfo(e: WheelEvent): MouseWheelInfo {
        const deltaX = e.deltaX;
        const deltaY = e.deltaY;
        let direction: 'up' | 'down' | 'left' | 'right' | 'none' = 'none';
        
        // 修复：简化逻辑，避免重复判断
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
            direction = deltaY > 0 ? 'down' : 'up';
        } else if (Math.abs(deltaX) > Math.abs(deltaY)) {
            direction = deltaX > 0 ? 'right' : 'left';
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

    getInputInfo(e: InputEvent): InputInfo {
        const target = e.target as HTMLInputElement;
        return {
            value: target?.value || '' // 修复：提供默认空字符串
        }
    }

    getClickInfo(e: MouseEvent): ClickInfo | null {
        const el = this.getEventElement(e);
        if (!el) return null;

        const offset = this.getOffsetInElement(e, el);
        const pagePoint = this.getPagePointFromEvent(e);
        const elementRect = this.getElementVisiblePageRect(el);

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
            screenshotUrl: null // 这个保持 null 是正确的，后续会被填充
        }
    }

    getOffsetInElement(e: MouseEvent, el: Element) {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        return {
            x: Math.round(Math.max(0, Math.min(r.width, x))),
            y: Math.round(Math.max(0, Math.min(r.height, y))),
        };
    }

    getPagePointFromEvent(e: MouseEvent) {
        let x = e.clientX + (window.scrollX || 0);
        let y = e.clientY + (window.scrollY || 0);

        let win: Window | null = (e.view as Window) || window;
        while (win && win !== win.top) {
            const frameEl = win.frameElement as Element | null;
            if (!frameEl) break;
            const fr = frameEl.getBoundingClientRect();
            const parent: Window = win.parent!;
            x += fr.left + (parent.scrollX || 0);
            y += fr.top + (parent.scrollY || 0);
            win = parent;
        }
        return { x: Math.round(x), y: Math.round(y) };
    }

    getElementVisiblePageRect(el: Element) {
        let win: Window | null = el.ownerDocument?.defaultView ?? null;
        if (!win) return null;

        let r: DOMRect | null = el.getBoundingClientRect();

        r = this.intersectRect(
            r!,
            { left: 0, top: 0, right: win.innerWidth, bottom: win.innerHeight }
        );
        if (!r) return null;

        const topWin = win.top!;

        while (win && win !== win.top) {
            const frameEl = win.frameElement as HTMLElement | null;
            if (!frameEl) break;

            const fr = frameEl.getBoundingClientRect();
            const parentWin: Window = win.parent as Window;

            r = new DOMRect(
                r.left + fr.left,
                r.top + fr.top,
                r.right - r.left,
                r.bottom - r.top,
            );

            r = this.intersectRect(
                r!,
                { left: 0, top: 0, right: parentWin.innerWidth, bottom: parentWin.innerHeight }
            );
            if (!r) return null;

            win = parentWin;
        }

        const pageX = r.left + topWin.scrollX;
        const pageY = r.top + topWin.scrollY;
        const width = r.right - r.left;
        const height = r.bottom - r.top;

        if (width <= 0 || height <= 0) return null;

        return {
            x: Math.round(pageX),
            y: Math.round(pageY),
            width: Math.round(width),
            height: Math.round(height),
        };
    }

    private intersectRect(
        a: DOMRect | { left: number; top: number; right: number; bottom: number },
        b: { left: number; top: number; right: number; bottom: number },
    ): DOMRect | null {
        const left = Math.max(a.left, b.left);
        const top = Math.max(a.top, b.top);
        const right = Math.min(a.right, b.right);
        const bottom = Math.min(a.bottom, b.bottom);
        if (right <= left || bottom <= top) return null;
        return new DOMRect(left, top, right - left, bottom - top);
    }

    getEventElement(e: MouseEvent): Element | null {
        const path = (e.composedPath?.() ?? []) as Array<EventTarget>;
        for (const t of path) if (t instanceof Element) return t;
        return e.target instanceof Element ? e.target : null;
    }
}