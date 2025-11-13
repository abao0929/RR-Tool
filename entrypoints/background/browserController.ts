import { onMessage, sendMessage } from "@/src/messaging";

export class browserController {

    windowWidth: number;
    windowHeight: number;
    windowPositionLeft: number;
    windowPositionTop: number;

    recordingWindowId: number | null;
    recordingTabId: number | null;
    recordingTabs: chrome.tabs.Tab[];
    
    attachedTabs: Set<number> = new Set();
    constructor() {
        this.windowWidth = 1280;// 默认宽度
        this.windowHeight = 800;// 默认高度
        this.windowPositionLeft = 100;// 默认左侧位置
        this.windowPositionTop = 100;// 默认顶部位置

        this.recordingWindowId = null;
        this.recordingTabId = null;
        this.recordingTabs = [];

        this.attachedTabs = new Set();
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
        // 记录录制TabId
        this.recordingTabId = tabId;
        await chrome.debugger.attach({ tabId }, "1.3");
        // 激活监听器
        await this.setRecorder(tabId, true);
        // 添加标签页update监听器
        chrome.tabs.onUpdated.addListener(this.onUpdated);
    }

    public async stopRecordingInTab() {
        if (this.recordingTabId === null) return;
        chrome.tabs.onUpdated.removeListener(this.onUpdated);
        await this.setRecorder(this.recordingTabId, false);
        await chrome.debugger.detach({ tabId: this.recordingTabId });
        // 清理recordingTabId
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
        console.log("[cm] createWindow:", win);
        return win;
    }

    async closeWindow(windowId: number) {
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
        console.log("[cm] injectRecorderInWindow tabs:", this.recordingTabs);
        this.recordingTabId = this.recordingTabs[0]?.id ?? null;
        // 全部注入
        for (const tab of this.recordingTabs) {
            if (!tab.id || !tab.url) continue;
            // 注入脚本
            await this.ensureInjected(tab.id);
            // 激活监听器
            await this.attachDebugger(tab.id);
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
        } catch (e) { 
            console.log("[cm] recorder not injected yet in tab:", tabId);
            await this.injectRecorderInTab(tabId);
        }
        
    }

    private async addChromeListener() {
        chrome.tabs.onActivated.addListener(this.onActivated);
        chrome.tabs.onUpdated.addListener(this.onUpdated);
        chrome.tabs.onCreated.addListener(this.onCreated);
        chrome.tabs.onRemoved.addListener(this.onRemoved);
        chrome.webNavigation.onCreatedNavigationTarget.addListener(this.onCreatedNavigationTarget);
    }

    private removeChromeListener() {
        chrome.tabs.onActivated.removeListener(this.onActivated);
        chrome.tabs.onUpdated.removeListener(this.onUpdated);
        chrome.tabs.onCreated.removeListener(this.onCreated);
        chrome.tabs.onRemoved.removeListener(this.onRemoved);
        chrome.webNavigation.onCreatedNavigationTarget.removeListener(this.onCreatedNavigationTarget);
    }

    private onCreatedNavigationTarget = async (details: chrome.webNavigation.WebNavigationSourceCallbackDetails) => {
        console.log("[cm] navigation target created:", details);
    }

    // 活跃
    private onActivated = async ({ tabId, windowId, }: chrome.tabs.OnActivatedInfo) => {
        // 发送标签页切换的步骤消息
        console.log("[cm] tab activated:", tabId);
        // 更新recordingTabId
        this.recordingTabId = tabId;
        // 检查注入
        await this.ensureInjected(tabId);
        // 设置录制器
        await this.setRecorder(tabId, true);
    }

    // 刷新
    private onUpdated = async (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => {
        // 重新注入
        console.log("[cm] tab updated:", tabId);
        if (tab.url?.startsWith("chrome://")) {
            console.log("[cm] updated chrome tab:", tab.url);
            return;
        }
        else if (tab.windowId === this.recordingWindowId
            && tabId === this.recordingTabId
        ) {
            if (changeInfo.status === "loading"){
                await this.ensureInjected(tabId);
                await this.attachDebugger(tabId);
                await this.setRecorder(tabId, true);
            }
        }
    }

    // 新建标签页
    private onCreated = async (tab: chrome.tabs.Tab) => {
        console.log("[cm] tab created:", tab.id);
        
        // 如果是 chrome:// 开头的 URL
        if (tab.url?.startsWith("chrome://")){  // !tab.url || (!tab.url.startsWith("https://") && !tab.url.startsWith("http://"))
            console.log("[cm] create new chrome tab:", tab.url);
            return;
        }
        // 在新标签页注入录制器
        else if (tab.windowId === this.recordingWindowId && tab.id) {
            await this.ensureInjected(tab.id);
            await this.attachDebugger(tab.id);
            await this.setRecorder(tab.id, true);
        }

        // 更新RecordingTabs
        if (this.recordingWindowId) await this.updateRecordingTabs();

    }

    private onRemoved = async (tabId: number, removeInfo: chrome.tabs.OnRemovedInfo) => {
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
            // console.error("[cm] setRecorder failed:", enable, e);
        }
    }

    private async attachDebugger(tabId: number) {
        try {
            await chrome.debugger.attach({ tabId }, "1.3");
            console.log("[cm] attachDebugger success:", tabId);
            return true;
        } catch (e) {
            console.warn("[cm] attachDebugger failed:", e);
            return false;
        }
    }

    async ensureDebuggerAttached(tabId: number) {
        if (this.attachedTabs.has(tabId)) return;
        try {
            await chrome.debugger.attach({ tabId }, "1.3");
            this.attachedTabs.add(tabId);
        } catch (e) {
            // 已经被别的调试器占用/无法附加时会报错
            console.warn("[bg] attach fail", tabId, e);
            throw e;
        }
    }
}