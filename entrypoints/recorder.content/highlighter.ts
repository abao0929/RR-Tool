import { ContentScriptContext } from "#imports";
import { pickNonUIElementAt } from "../recorder.content/utils";

export class Highlighter {
    private box: HTMLDivElement | null = null;
    private enabled = false;

    private createBox() {
        this.box = document.createElement("div");
        this.box.id = 'rrtool-highlighter';
        Object.assign(this.box.style, {
            position: 'fixed',
            left: '0px',
            top: '0px',
            width: '0px',
            height: '0px',
            background: 'rgba(255, 140, 197, 0.20)',
            borderRadius: '4px',
            pointerEvents: 'none',
            zIndex: '2147483647',
            transition: 'transform 40ms ease, width 40ms ease, height 40ms ease',
        });
        document.documentElement.appendChild(this.box);
    }

    async addHighlighter() {
        if (this.enabled) return;
        this.enabled = true;
        this.createBox();
        window.addEventListener("mousemove", this.onMove, true);
        console.log("[cs] Highlighter added");
    }

    async removeHighlighter() {
        if (!this.enabled) return;
        this.enabled = false;
        window.removeEventListener("mousemove", this.onMove, true);
        if (this.box && this.box.isConnected) {
            this.box.remove();
        }
        this.box = null;
        console.log("[cs] Highlighter removed");
    }

    private onMove = (e: MouseEvent) => {
        if (!this.enabled || !this.box) return;

        const target = pickNonUIElementAt(e.clientX, e.clientY);
        if (!target) {
            // 没找到就隐藏
            this.box.style.width = '0px';
            this.box.style.height = '0px';
            return;
        }

        const rect = target.getBoundingClientRect();
        this.box.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
        this.box.style.width = rect.width + 'px';
        this.box.style.height = rect.height + 'px';
    };
}