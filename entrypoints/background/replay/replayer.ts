import { ElementLocator } from "./stepLocator";
import { StepAction } from "./stepAction";
import { Locator } from "@/src/template";
import { StepInfo } from "@/src/template";
import { waitOneNewRequestAndFinish } from "./wait";
import { onMessage, sendMessage } from "@/src/messaging";

export class Replayer {
    constructor() {
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

    async replayOneStep(tabId: number, step: StepInfo) {
        if (!tabId) return;
        if (!step) return;

        if (!step.locators || step.locators.length === 0) return;
        const nodeId = await this.tryLocate(tabId, step.locators);
        const stepAction = new StepAction();
        if (step.kind === 'click') {
            await stepAction.clickElement(tabId, nodeId!, step.actionInfo!);
        }
        console.log("[bg-replay]replay one step finish");
    }

    async replaySteps(tabId: number, steps: StepInfo[]) {
        if (!tabId || !steps || steps.length === 0) return;
        try {
            await chrome.debugger.attach({ tabId }, "1.3");
        } catch (e) {
            console.error("[bg] attach failed:", e);
        }


        for (const step of steps) {
            try {
                await this.replayOneStep(tabId, step);
            } catch (e) {
                console.error("[bg-replayer]replayOneStep failed", e);
            }
            // 等待
            const res = await waitOneNewRequestAndFinish(tabId, { armMs: 400, timeoutMs: 10000 });
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
            await chrome.debugger.detach({ tabId });
        } catch (e) {
            console.error("[bg] detach failed:", e);
        }
    }


}

export default Replayer;
const replayer = new Replayer();
export { replayer };