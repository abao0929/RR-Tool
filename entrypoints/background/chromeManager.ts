import { onMessage, sendMessage } from "@/src/messaging";

export class ChromeManager {
    windowWidth: number;
    windowHeight: number;
    windowPositionLeft: number;
    windowPositionTop: number;
    recordingWindowId: number | null;
    recordingTabId: number | null;
    recordingTabs: chrome.tabs.Tab[];
    constructor() {
        this.windowWidth = 1280;// 默认宽度
        this.windowHeight = 800;// 默认高度
        this.windowPositionLeft = 100;// 默认左侧位置
        this.windowPositionTop = 100;// 默认顶部位置
        this.recordingWindowId = null;
        this.recordingTabId = null;
        this.recordingTabs = [];
    }

    public async recordingInWindow(startUrl: string = "about:blank") {
        // 创建新窗口
        const win = await this.createWindow(startUrl);
        if (win) this.recordingWindowId = win.id ?? null;
        // 添加窗口监听器
        await this.addChromeListener();
        // 注入录制脚本
        await this.injectRecorderInWindow(this.recordingWindowId);
    }

    public async stopRecordingInWindow() {
        if (!this.recordingWindowId) return;
        await this.closeWindow(this.recordingWindowId);
        this.recordingWindowId = null;
        this.removeChromeListener();
    }

    public async recordingInTab(tabId: number) {
        // 检查脚本注入
        await this.ensureInjected(tabId);
        this.recordingTabId = tabId;
        try { await chrome.debugger.attach({ tabId }, "1.3"); } catch { }
        // 激活监听器
        await this.setRecorder(tabId, true);
        // 添加标签页update监听器
        chrome.tabs.onUpdated.addListener(this.onUpdated.bind(this));
    }

    public async stopRecordingInTab() {
        if (this.recordingTabId === null) return;
        chrome.tabs.onUpdated.removeListener(this.onUpdated.bind(this));
        await this.setRecorder(this.recordingTabId, false);
        await chrome.debugger.detach({ tabId: this.recordingTabId });
        this.recordingTabId = null;
    }

    /**
     * 创建一个新的窗口
     * @param url 初始打开的URL，默认about:blank
     * @param type 窗口类型popup或normal，默认normal
     * @returns 创建的窗口对象
     */
    private async createWindow(url: string = "about:blank", type: "popup" | "normal" = "normal"): Promise<chrome.windows.Window | undefined> {
        const win = await chrome.windows.create({
            url,
            type,
            width: this.windowWidth,
            height: this.windowHeight,
            left: this.windowPositionLeft,
            top: this.windowPositionTop
        })
        console.log("[cm] createWindow:", win);
        return win;
    }

    private async closeWindow(windowId: number) {
        try {
            await chrome.windows.remove(windowId);
            console.log("[cm] closeWindow:", windowId);
        } catch (e) {
            console.error("[cm] closeWindow failed:", e);
        }
    }

    // 新窗口注入Recorder
    private async injectRecorderInWindow(windowId: number | null) {
        if (!windowId) return;
        // 获取窗口的标签页
        this.recordingTabs = await chrome.tabs.query({ windowId });

        // 全部注入
        for (const tab of this.recordingTabs) {
            if (!tab.id || !tab.url) continue;
            // 注入脚本
            await this.ensureInjected(tab.id);
            // 激活监听器
            await this.setRecorder(tab.id, true);
        }
        // await this.registerRecorderScript();
    }

    // 标签页注入Recorder
    private async injectRecorderInTab(tabId: number) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId, allFrames: false },
                files: [
                    "content-scripts/recorder.js",
                ],
            });
        } catch (e) {
            console.error("[cm] executeScript failed:", e);
            return;
        }
    }


    // 检查录制脚本注入
    private async ensureInjected(tabId: number) {
        try {
            // ping录制器
            await sendMessage("pingRecorder", {}, tabId);
            console.log("[cm] recorder already injected in tab:", tabId);
            return;
        } catch (e) { }
        await this.injectRecorderInTab(tabId);
    }

    private async addChromeListener() {
        chrome.tabs.onActivated.addListener(this.onActivated.bind(this));
        chrome.tabs.onUpdated.addListener(this.onUpdated.bind(this));
        chrome.tabs.onCreated.addListener(this.onCreated.bind(this));
        chrome.tabs.onRemoved.addListener(this.onRemoved.bind(this));
    }

    private removeChromeListener() {
        chrome.tabs.onActivated.removeListener(this.onActivated.bind(this));
        chrome.tabs.onUpdated.removeListener(this.onUpdated.bind(this));
        chrome.tabs.onCreated.removeListener(this.onCreated.bind(this));
        chrome.tabs.onRemoved.removeListener(this.onRemoved.bind(this));
    }

    // 活跃
    private async onActivated({ tabId, windowId }: chrome.tabs.OnActivatedInfo) {
        // 发送步骤消息
        console.log("[cm] tab activated:", tabId);
    }

    // 刷新
    private async onUpdated(tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) {
        // 重新注入
        console.log("[cm] tab updated:", tabId);
        if (changeInfo.status === "complete") {
            await this.ensureInjected(tabId);

        }
    }

    // 新建标签页
    private async onCreated(tab: chrome.tabs.Tab) {
        console.log("[cm] tab created:", tab.id);
        // 在新标签页注入
        if (tab.id) await this.injectRecorderInTab(tab.id);
        // 更新RecordingTabs
        if (this.recordingWindowId) await this.updateRecordingTabs();

    }

    private async onRemoved(tabId: number, removeInfo: chrome.tabs.OnRemovedInfo) {
        console.log("[cm] tab removed:", tabId);
        // 更新RecordingTabs
        if (this.recordingWindowId) await this.updateRecordingTabs();
    }

    private async updateRecordingTabs() {
        const tabs = await chrome.tabs.query({ windowId: this.recordingWindowId ?? undefined });
        if (tabs === this.recordingTabs) return;
        else this.recordingTabs = tabs;
    }

    // 设置录制器状态
    private async setRecorder(tabId: number, enable: boolean) {
        try {
            if (enable) {
                await sendMessage("addListener", {}, tabId);
            } else {
                await sendMessage("removeListener", {}, tabId);
            }
        } catch (e) {
            console.error("[cm] setRecorder failed:", enable, e);
        }
    }
}