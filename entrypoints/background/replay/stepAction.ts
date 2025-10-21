import { ClickInfo } from "@/src/template";

export class StepAction {
    async clickElement(tabId: number, nodeId: number, clickInfo: ClickInfo) {
        const t = { tabId };
        await chrome.debugger.sendCommand(t, "DOM.scrollIntoViewIfNeeded", { nodeId }).catch(() => { });

        let pageX: number | undefined;
        let pageY: number | undefined;

        if (clickInfo.pagePoint) {
            pageX = clickInfo.pagePoint.x;
            pageY = clickInfo.pagePoint.y;
        } else if (clickInfo.elementRect) {
            pageX = clickInfo.elementRect.x + (clickInfo.offset?.x ?? 0);
            pageY = clickInfo.elementRect.y + (clickInfo.offset?.y ?? 0);
        } else {
            const { model } = await chrome.debugger.sendCommand(t, "DOM.getBoxModel", { nodeId }) as any;
            const b = model.border as number[]; // [x1,y1, x2,y2, x3,y3, x4,y4] 页面坐标 (CSS px)
            const minX = Math.min(b[0], b[2], b[4], b[6]);
            const minY = Math.min(b[1], b[3], b[5], b[7]);
            pageX = minX + (clickInfo.offset?.x ?? 0);
            pageY = minY + (clickInfo.offset?.y ?? 0);
        }

        const { cssVisualViewport } = await chrome.debugger.sendCommand(t, "Page.getLayoutMetrics") as any;
        let x = Math.round(pageX! - cssVisualViewport.pageX);
        let y = Math.round(pageY! - cssVisualViewport.pageY);

        const vw = Math.round(cssVisualViewport.clientWidth);
        const vh = Math.round(cssVisualViewport.clientHeight);
        x = Math.max(0, Math.min(vw - 1, x));
        y = Math.max(0, Math.min(vh - 1, y));

        const btn = clickInfo.button ?? 0;
        const button: "left" | "right" | "middle" = btn === 2 ? "right" : btn === 1 ? "middle" : "left";
        const buttonsMask = btn === 2 ? 2 : btn === 1 ? 4 : 1; // Left=1, Right=2, Middle=4
        const count = Math.max(1, clickInfo.count ?? 1);

        await chrome.debugger.sendCommand(t, "Input.dispatchMouseEvent", {
            type: "mouseMoved", x, y, pointerType: "mouse",
        });

        for (let n = 1; n <= count; n++) {
            await chrome.debugger.sendCommand(t, "Input.dispatchMouseEvent", {
                type: "mousePressed",
                x, y, button, buttons: buttonsMask, clickCount: n, pointerType: "mouse",
            });
            await chrome.debugger.sendCommand(t, "Input.dispatchMouseEvent", {
                type: "mouseReleased",
                x, y, button, buttons: 0, clickCount: n, pointerType: "mouse",
            });
        }
    }
}