export class ElementSelector {

    getElementId(el: Element | null): string | null {
        return el?.id ?? null;
    }

    getElementTag(el: Element | null): string | null {
        if (!el) return null;
        // 用 localName，便于生成 CSS 选择器
        return el.localName || el.tagName.toLowerCase();
    }

    getElementClasses(element: Element | null): string[] {
        if (!element || !element.classList) return [];
        return Array.from(element.classList);
    }

    getElementText(element: Element | null): string | null {
        if (!element || !(element instanceof HTMLElement)) return null;
        const text = element.innerText?.trim() || "";
        const elementText = text.split('\n')[0].trim();
        return elementText ? elementText : null;
    }

    getElementAttributes(
        el: Element | null | undefined
    ): Array<{ name: string; value: string }> {
        if (!el) return [];

        const out: Array<{ name: string; value: string }> = [];
        for (const attr of Array.from(el.attributes)) {
            const n = attr.name.toLowerCase();
            if (n === "id" || n === "class") continue; // 排除 id / class
            out.push({ name: attr.name, value: String(attr.value ?? "") });
        }
        return out;
    }

    getElementPositionAndSize(el: Element | null): { x: number; y: number; width: number; height: number } | null {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
            x: Math.round(r.left + window.scrollX),
            y: Math.round(r.top + window.scrollY),
            width: Math.round(r.width),
            height: Math.round(r.height)
        };
    }

}
