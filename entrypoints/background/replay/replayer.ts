import { ElementLocator } from "./stepLocator";
import { StepAction } from "./stepAction";
import { Locator } from "@/src/template";
import { StepInfo, TestFlow } from "@/src/template";
import { waitOneNewRequestAndFinish } from "./wait";
import { onMessage, sendMessage } from "@/src/messaging";
import { browserController } from "../browserController";

export class Replayer {
    windowWidth: number;
    windowHeight: number;
    windowPositionLeft: number;
    windowPositionTop: number;

    replayWindowId: number | null = null;
    replayTabs: chrome.tabs.Tab[] = [];
    currentReplayTab: chrome.tabs.Tab | null = null;

    browserCtrl: browserController;
    constructor() {
        this.windowWidth = 1280;// 默认宽度
        this.windowHeight = 800;// 默认高度
        this.windowPositionLeft = 100;// 默认左侧位置
        this.windowPositionTop = 100;// 默认顶部位置
        this.replayWindowId = null;
        this.replayTabs = [];
        this.currentReplayTab = null;
        this.browserCtrl = new browserController();
    }

    // 回放
    async startReplay(testFlow: TestFlow) {
        if (!testFlow) return;
        console.log("[bg-replayer] replay start:", testFlow);
        if (testFlow.mode === "tab") {
            // 在当前tab中回放
            await this.replayStepsInTab(testFlow);
        }
        else if (testFlow.mode === "window") {
            // 创建新窗口回放
            await this.replayStepsInWindow(testFlow);
        }
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
        console.log("[replay] createWindow:", win);
        return win;
    }

    async closeWindow() {
        try {
            
            if (this.replayWindowId) await chrome.windows.remove(this.replayWindowId);
            console.log("[replay] closeWindow:", this.replayWindowId);
        } catch (e) {
            console.error("[replay] closeWindow failed:", e);
        }
    }

    async tryLocate(tabId: number, locators: Locator[]) {
        if (locators.length === 0) return null;
        let parentNodeId: number | undefined;
        await new Promise(resolve => setTimeout(resolve, 100));
        for (let i = locators.length - 1; i >= 0; i--) {
            const el = new ElementLocator(tabId);
            const { matched, nodeIds } = await el.locate(locators[i], parentNodeId);
            if (nodeIds.length === 1) {
                parentNodeId = nodeIds[0];
            }
            // console.log("[bg-replay-locator]step matched", matched)
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        if (parentNodeId === undefined) {
            return null;
        }
        return parentNodeId;
    }

    async replayOneStep(tab: chrome.tabs.Tab, step: StepInfo, index: number) {
        if (!tab) return;
        if (!step) return;

        if (!step.locators || step.locators.length === 0) return;
        let nodeId: number | null = null;
        const stepAction = new StepAction();
        switch (step.kind) {
            case 'click':
                nodeId = await this.tryLocate(tab.id!, step.locators);
                await stepAction.click(tab.id!, nodeId!, step.actionInfo!);
                break;
            case 'input':
                nodeId = await this.tryLocate(tab.id!, step.locators);
                await stepAction.Input(tab.id!, nodeId!, step.actionInfo!);
                break;
        }

        console.log(`[bg-replay]step ${index} finished`)
        // console.log("[bg-replay]replay one step finish");
    }

    async replayStepsInWindow(testFlow: TestFlow) {
        if ( !testFlow || testFlow.steps.length === 0) return;
        // 创建一个回放窗口
        const win = await this.createWindow(testFlow.originUrl);
        if (win) this.replayWindowId = win.id ?? null;
        // 回放
        const steps = testFlow.steps;
        for (const step of steps) {
            console.log("[replay] replaying step:", steps.indexOf(step));
            // 获取当前活跃tabId
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const currentTab = tabs[0] ?? null;
            // 更新replayTabs列表
            this.replayTabs = tabs;
            // 检查&切换tab
            if (step.url && currentTab) {
                const tabMatched = await this.checkTabUrl(step.url, currentTab);
                if (tabMatched && this.currentReplayTab) {
                    await this.replayOneStep(this.currentReplayTab, step, steps.indexOf(step));
                }
            }
        }
        console.log("[replay] replay finish");
        await this.closeWindow();

    }

    async replayStepsInTab(testFlow: TestFlow) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        // 检查tab.url
        if (tab.url !== testFlow.originUrl) {
            throw new Error("tab.Url != testflow.originUrl");
            return;
        }

        const steps = testFlow.steps;

        if (!tab) return;
        if (!tab.id || !steps || steps.length === 0) return;
        try {
            await chrome.debugger.attach({ tabId: tab.id }, "1.3");
        } catch (e) {
            console.error("[bg] attach failed:", e);
        }


        for (const step of steps) {
            try {
                await this.replayOneStep(tab, step, steps.indexOf(step));
            } catch (e) {
                console.error("[bg-replayer]replayOneStep failed", e);
            }
            // 等待
            const res = await waitOneNewRequestAndFinish(tab.id, { armMs: 400, timeoutMs: 10000 });
            if (!res.found) {
                // console.log("窗口期内没有新网络请求，直接返回");
                continue;
            } else if (res.finished) {
                console.log("请求完成:", res.method, res.status, res.url);
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                console.log("等待超时:", res.method, res.url);
                console.warn("回放结束");
                break;
            }
        }

        try {
            await chrome.debugger.detach({ tabId: tab.id });
        } catch (e) {
            console.error("[bg] detach failed:", e);
        }
    }

    async checkTabUrl(targetTabUrl: string, currentTab: chrome.tabs.Tab): Promise<boolean> {
        if (currentTab.url === targetTabUrl) {
            this.currentReplayTab = currentTab;
            return true;
        }
        // 在tabs中查找匹配的tab
        else {
            const tabs = await chrome.tabs.query({ windowId: this.replayWindowId ?? undefined });
            for (let tab of tabs) {
                if (tab.url === targetTabUrl) {
                    // 切换tab
                    await chrome.tabs.update(tab.id!, { active: true });
                    this.currentReplayTab = tab;
                    return true;
                }
            }
            return false;
        }

    }

}

export default Replayer;
const replayer = new Replayer();
export { replayer };