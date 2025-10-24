import { onMessage, sendMessage } from "@/src/messaging";

class ChromeManager {
    windowWidth: number;
    windowHeight: number;
    windowPositionLeft: number;
    windowPositionTop: number;
    recordingWindowId: number | null;
    recordingTabId: number | null;
    constructor() {
        this.windowWidth = 1280;// 默认宽度
        this.windowHeight = 800;// 默认高度
        this.windowPositionLeft = 100;// 默认左侧位置
        this.windowPositionTop = 100;// 默认顶部位置
        this.recordingWindowId = null;
        this.recordingTabId = null;
    }

    /**
     * 创建一个新的窗口
     * @param url 初始打开的URL，默认about:blank
     * @param type 窗口类型popup或normal，默认normal
     * @returns 创建的窗口对象
     */
    async createWindow(url: string = "about:blank", type: "popup" | "normal" = "normal"): Promise<chrome.windows.Window | undefined> {
        const win = await chrome.windows.create({
            url,
            type,
            width: this.windowWidth,
            height: this.windowHeight,
            left: this.windowPositionLeft,
            top: this.windowPositionTop
        })
        return win;
    }

    // 声明式注入录制脚本
    async InjectRecorderScript(tabId: number) {
        try {
            await chrome.scripting.registerContentScripts([{
                id: 'recorder',
                js: ['content-scripts/recorder.js'],
                matches: ['<all_urls>'],
                runAt: 'document_start',
                allFrames: false,
            }]);
        } catch (e) {
            console.error("[cm] InjectRecorderScript failed:", e);
        }
    }

    // 保证录制脚本注入
    async ensureInjected(tabId: number) {
        try {
            // ping录制器
            await sendMessage("pingRecorder", {}, tabId);
            return;
        } catch (e) { }
        await this.InjectRecorderScript(tabId);
    }

    // 设置活动标签页的录制监听器为启用
    async addListenerInActiveTab(tabId: number | null) {
        this.recordingTabId = tabId;
        if (this.recordingTabId === null) return;
        const tabs = await chrome.tabs.query({ windowId: this.recordingWindowId! });
        for (const tab of tabs) {
            if (!tab.id) continue;
            await this.ensureInjected(tab.id);
            await this.setRecorder(tab.id, tab.id === this.recordingTabId);
        }
    }

    /**
     * 为窗口添加录制标签页管理器
     * @param windowId 窗口ID
     */
    async addRecordingManager(windowId: number) {
        this.recordingWindowId = windowId;
        const tabs = await chrome.tabs.query({ windowId });
        for (const tab of tabs) {
            if (tab.id) await this.ensureInjected(tab.id);
        }
        const act = tabs.find(t => t.active)?.id ?? null;
        await this.addListenerInActiveTab(act);
    }

    async addChromeListener() {
        chrome.tabs.onActivated.addListener(this.onActivated.bind(this));
        chrome.tabs.onUpdated.addListener(this.onUpdated.bind(this));
        chrome.tabs.onCreated.addListener(this.onCreated.bind(this));
    }


    async onActivated({tabId, windowId}: chrome.tabs.OnActivatedInfo) {
        if (windowId === this.recordingWindowId) {
            await this.addListenerInActiveTab(tabId);
        }
    }

    async onUpdated(tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) {
        if (tab.windowId === this.recordingWindowId 
            && (changeInfo.status === 'complete' || changeInfo.url)) {
            await this.addListenerInActiveTab(tabId).then(() => this.setRecorder(tabId, tabId === this.recordingTabId));
        }
    }

    async onCreated(tab: chrome.tabs.Tab) {
        if (tab.windowId === this.recordingWindowId && tab.id) {
            await this.ensureInjected(tab.id).then(() => {
                if(tab.id) this.setRecorder(tab.id, tab.id === this.recordingTabId)
            });
        }
    }
    // 设置录制器状态
    async setRecorder(tabId: number, enable: boolean) {
        if (enable) {
            await sendMessage("addListener", {}, tabId);
        } else {
            await sendMessage("removeListener", {}, tabId);
        }
    }
}