import { ContentScriptContext } from "#imports";
import { pickNonUIElementAt } from "../recorder.content/utils";

export class Highlighter {
    private box: HTMLDivElement;

    constructor() {
        this.box = document.createElement("div");
        const s = this.box.style;
        s.position = "fixed";
        s.zIndex = "2147483647";
        s.pointerEvents = "none";
        s.border = "2px solid #ff0000";
        s.boxSizing = "border-box";
        s.left = "0";
        s.top = "0";
        s.width = "0";
        s.height = "0";
        s.display = "none";
        document.documentElement.appendChild(this.box);
    }

    async addHighlighter() {
        document.addEventListener("pointermove", this.onMove, true);
    }

    async removeHighlighter() {
        document.removeEventListener("pointermove", this.onMove, true);
        this.box.remove();
    }

    onMove = (e: Event) => {
        const pointerEvent = e as PointerEvent;
        const el = pickNonUIElementAt(pointerEvent.clientX, pointerEvent.clientY);
        if (!el) { this.box.style.display = "none"; return; }

        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) { this.box.style.display = "none"; return; }

        this.box.style.display = "block";
        this.box.style.transform = `translate(${Math.round(r.left)}px, ${Math.round(r.top)}px)`;
        this.box.style.width = `${Math.round(r.width)}px`;
        this.box.style.height = `${Math.round(r.height)}px`;
    }
}