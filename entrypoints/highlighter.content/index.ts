// entrypoints/highlight.content.ts
// import { defineContentScript } from "wxt/sandbox";
import { pickNonUIElementAt } from "../recorder.content/utils";
import { onMessage } from "@/src/messaging";

export default defineContentScript({
    registration: "runtime",        // 按需注入
    runAt: "document_idle",
    async main(ctx) {
        console.log("[cs] highlighter.content");
        let active = true;
        // 覆盖层（不影响页面交互）
        const box = document.createElement("div");
        Object.assign(box.style, {
            position: "fixed",
            zIndex: "2147483647",
            pointerEvents: "none",
            border: "2px solid #ff0000ff",
            boxSizing: "border-box",
            left: "0", top: "0", width: "0", height: "0",
            display: "none",
        } as CSSStyleDeclaration);
        document.documentElement.appendChild(box);

        // 仅在鼠标移动时更新
        const onMove = (e: Event) => {
            const pointerEvent = e as PointerEvent;
            const el = pickNonUIElementAt(pointerEvent.clientX, pointerEvent.clientY);
            if (!el) { box.style.display = "none"; return; }

            const r = el.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) { box.style.display = "none"; return; }

            box.style.display = "block";
            box.style.transform = `translate(${Math.round(r.left)}px, ${Math.round(r.top)}px)`;
            box.style.width = `${Math.round(r.width)}px`;
            box.style.height = `${Math.round(r.height)}px`;
        };

        // 绑定（捕获阶段更稳），卸载时自动清理
        ctx.addEventListener(document, "pointermove", onMove, { capture: true });
        ctx.onInvalidated(() => box.remove());

        // const onRuntimeMsg = (msg: any) => {
        //     if (msg?.type === "highlight:teardown") {
        //         active = false;
        //         try {
        //             document.removeEventListener("pointermove", onMove, true);
        //             // document.removeEventListener("click", onClick as (e: Event) => void, true);
        //         } catch { }
        //         box.remove();
        //     }
        // };
        // chrome.runtime.onMessage.addListener(onRuntimeMsg);

        onMessage("highlighter:teardown", () => {
            active = false;
            try {
                document.removeEventListener("pointermove", onMove, true);
                // document.removeEventListener("click", onClick as (e: Event) => void, true);
            } catch { }
            box.remove();
        });
    },
});
