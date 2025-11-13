import { ElementRect } from "../../../src/template.js";
import { browserController } from "../browserController.js";
import { sendMessage } from "../../../src/messaging.js";

export class Screenshot {
    browserController: browserController;
    constructor() {
        this.browserController = new browserController();
    }
    // 截取当前可视区
    async captureViewport(tabId: number) {
        const target = { tabId };

        try {
            // 并发拿布局/截图
            const [layout, shot] = await Promise.all([
                chrome.debugger.sendCommand(target, "Page.getLayoutMetrics") as any,
                chrome.debugger.sendCommand(target, "Page.captureScreenshot", {
                    format: "png",
                    fromSurface: true, // 只截可视区域，不传 clip
                }) as any,
            ]);

            const dataUrl = `data:image/png;base64,${shot.data}`;

            // 用 ImageBitmap 拿到位图真实像素（设备像素）
            const bmp = await createImageBitmap(await (await fetch(dataUrl)).blob());
            const imgW = bmp.width, imgH = bmp.height;
            bmp.close?.();

            // 当前 CSS 视口大小（cssVisualViewport 更准确）
            const vw = Math.round(layout.cssVisualViewport.clientWidth);
            const vh = Math.round(layout.cssVisualViewport.clientHeight);

            // 计算 DPR/缩放（避免直接用 window.devicePixelRatio；这里以“图片像素 / CSS 像素”为准）
            const scaleX = imgW / vw;
            const scaleY = imgH / vh;

            return { dataUrl, imgW, imgH, vw, vh, scaleX, scaleY };
        } catch (e) {
            throw new Error(`captureViewport failed: ${e}`);
        }

    }

    // 直接截元素区域
    async captureTargetElement(tabId: number, element: any): Promise<string> {
        // const target = { tabId };
        const { x, y, width, height } = element?.positionAndSize || {};
        const { data } = await chrome.debugger.sendCommand(
            { tabId },
            "Page.captureScreenshot",
            {
                format: "png",
                fromSurface: true,
                // captureBeyondViewport: false,
                clip: { x, y, width, height, scale: 1 },
            }
        ) as any;

        return `data:image/png;base64,${data}`;
    }

    // 按 CSS 矩形裁剪
    async cropByCssRect(
        viewport: { dataUrl: string; imgW: number; imgH: number; scaleX: number; scaleY: number },
        rectCss: { x: number; y: number; width: number; height: number }
    ) {
        // CSS → 设备像素精确换算（用 scaleX/scaleY，而不是硬乘 DPR，兼容缩放）
        const px = (v: number, s: number) => Math.max(0, Math.round(v * s));

        let x = px(rectCss.x, viewport.scaleX);
        let y = px(rectCss.y, viewport.scaleY);
        let w = px(rectCss.width, viewport.scaleX);
        let h = px(rectCss.height, viewport.scaleY);

        // 边界夹取（处理部分越界/负数/小数）
        x = Math.max(0, Math.min(viewport.imgW, x));
        y = Math.max(0, Math.min(viewport.imgH, y));
        w = Math.max(1, Math.min(viewport.imgW - x, w));
        h = Math.max(1, Math.min(viewport.imgH - y, h));

        // x = Math.max(0, x - 1); y = Math.max(0, y - 1);
        // w = Math.min(viewport.imgW - x, w + 2); h = Math.min(viewport.imgH - y, h + 2);

        // 画布裁剪
        const bmp = await createImageBitmap(await (await fetch(viewport.dataUrl)).blob());
        const canvas = new OffscreenCanvas(w, h);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(bmp, x, y, w, h, 0, 0, w, h);
        bmp.close?.();

        const out = await canvas.convertToBlob({ type: "image/png" });
        const buf = await out.arrayBuffer();
        // arrbuf → base64
        let bin = ""; const bytes = new Uint8Array(buf); const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
        return `data:image/png;base64,${btoa(bin)}`;
    }

    // 精确截取元素
    async captureElementAccurate(tabId: number, rectCss: { x: number; y: number; width: number; height: number }) {
        try {
            const vp = await this.captureViewport(tabId);// 先截可视区 + 拿缩放
            const url = await this.cropByCssRect(vp, rectCss);// 再按缩放裁剪
            console.log("captureElementAccurate success");
            return url;
        } catch (error) {
            console.warn("captureElementAccurate failed, try again:", error);
            // 重试一次
            try { await chrome.debugger.attach({ tabId }, "1.3"); } catch (e) { console.error("re-attach failed:", e); }
            const vp = await this.captureViewport(tabId);// 先截可视区 + 拿缩放
            const url = await this.cropByCssRect(vp, rectCss);// 再按缩放裁剪
            return url;
        }

    }

    // 保存图片
    async downloadDataUrl(dataUrl: string) {
        if (!dataUrl) throw new Error("no screenshot");
        await chrome.downloads.download({
            url: dataUrl,
            filename: `fullpage-${new Date().toISOString().replace(/[:.]/g, "-")}.png`,
            saveAs: false,
            conflictAction: "uniquify",
        });
    }

    async captureElementRect(
        tabId: number,
        rect: ElementRect
    ): Promise<string> {
        // 确保已附加调试器

        const { x, y, width, height } = rect;
        // sendMessage("removeHighlighter", {}, tabId);
        const result = await chrome.debugger.sendCommand(
            { tabId },
            "Page.captureScreenshot",
            {
                format: "png",
                fromSurface: true,
                clip: {
                    x,
                    y,
                    width,
                    height,
                    scale: 1,
                },
            },
        ) as { data: string };
        // sendMessage("addHighlighter", {}, tabId);
        return `data:image/png;base64,${result.data}`;
    }

}