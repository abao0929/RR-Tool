import { Screenshot } from "./screenshot";
import { onMessage, sendMessage } from "@/src/messaging";
import { StepInfo } from "@/src/template";

export class Recorder {
    screenshot: Screenshot;
    recordingSteps: StepInfo[];
    constructor() {
        this.screenshot = new Screenshot();
        this.recordingSteps = [];
    }

    handlers = {
        onUpdated(tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) {
            console.log("tab updated:", tabId);
        },

        onCreated(tab: chrome.tabs.Tab) {
            console.log("tab created:", tab.id);
        }
    }

    async attachChromeListener() {
        chrome.tabs.onUpdated.addListener(this.handlers.onUpdated);
        chrome.tabs.onCreated.addListener(this.handlers.onCreated);
    }

    async detachChromeListener() {
        chrome.tabs.onUpdated.removeListener(this.handlers.onUpdated);
        chrome.tabs.onCreated.removeListener(this.handlers.onCreated);
    }

    async startRecording(tabId: number) {
        if (!tabId) return;
        this.recordingSteps = [];
        await this.attachChromeListener()
        try { await chrome.debugger.attach({ tabId }, "1.3"); } catch { }
        try {
            await chrome.scripting.executeScript({
                target: { tabId, allFrames: false },
                files: [
                    "content-scripts/recorder.js",
                    "content-scripts/highlighter.js",
                    // "content-scripts/ui.js",
                ],
            });
        } catch (e) {
            console.error("executeScript failed:", e);
            return;
        }
        console.log("[bg-recorder] recorder start:", tabId);

    }

    async finishRecording(tabId: number) {
        if (!tabId) return;
        console.log("[bg-recorder] recorder finished:", tabId);
        if (tabId == null) return { ok: true };
        await sendMessage("destroyListener", {}, tabId);
        await sendMessage("highlighter:teardown", {}, tabId);
        try {
            await chrome.debugger.detach({ tabId });
        } catch (e) {
            console.error("detach failed:", e);
        }
        this.detachChromeListener();
        return { ok: true };
    }

    async recorderStep(tabId: number, stepInfo: StepInfo): Promise<boolean | undefined> {
        if (!stepInfo) return;
        if (!tabId) return;
        // this.recordingSteps.push(stepInfo);
        switch (stepInfo.kind) {
            case 'click':
                if (!stepInfo.locators || stepInfo.locators.length === 0 || !stepInfo.locators[0].positionAndSize) {
                    console.warn("stepInfo.locators is null or empty, or positionAndSize is missing.");
                    // await sendMessage("recorder:step", { stepInfo, url: null });
                    return;
                }
                const rectCss = stepInfo.locators[0].positionAndSize;
                const { x, y, width, height } = rectCss;
                const screenshotUrl = await this.screenshot.captureElementAccurate(tabId, { x, y, width, height });
                stepInfo.actionInfo.screenshotUrl = screenshotUrl;
                this.recordingSteps.push(stepInfo);
                break;

            case 'input':
                const lastInputAction = this.recordingSteps[this.recordingSteps.length - 1];
                if (lastInputAction && lastInputAction.kind === 'input') {
                    this.recordingSteps.pop();
                    // this.recordingSteps.push(stepInfo);
                }
                this.recordingSteps.push(stepInfo);
                break;

            case 'wheel':
                if (stepInfo.actionInfo.direction === 'none') return;
                const lastWheelAction = this.recordingSteps[this.recordingSteps.length - 1];
                // 满足：1、上一个事件为wheel 2、上一个事件与当前事件方向相同 3、上一个事件与当前事件修饰符相同
                if (lastWheelAction
                    && lastWheelAction.kind === 'wheel'
                    && lastWheelAction.actionInfo.direction === stepInfo.actionInfo.direction
                    // && lastWheelAction.actionInfo.modifiers === stepInfo.actionInfo.modifiers
                ) {
                    // 合并滚动距离
                    stepInfo.actionInfo.deltaX += lastWheelAction.actionInfo.deltaX;
                    stepInfo.actionInfo.deltaY += lastWheelAction.actionInfo.deltaY;
                    this.recordingSteps.pop();
                    // this.recordingSteps.push(stepInfo);
                }
                this.recordingSteps.push(stepInfo);
                break;

            case 'keydown':
                if (this.recordingSteps[this.recordingSteps.length - 1].kind === 'input') return;
                const lastKeydownAction = this.recordingSteps[this.recordingSteps.length - 1];
                if (lastKeydownAction && lastKeydownAction.kind === 'keydown'
                    && lastKeydownAction.actionInfo.repeat
                    && lastKeydownAction.actionInfo.key === stepInfo.actionInfo.key
                ) {
                    stepInfo.actionInfo.repeatTime += stepInfo.ts - lastKeydownAction.ts;
                    this.recordingSteps.pop();
                    // this.recordingSteps.push(stepInfo);
                }
                this.recordingSteps.push(stepInfo);
                break;

            case 'dragstart':
                const lastDragStartStep = this.recordingSteps[this.recordingSteps.length - 1];
                if (lastDragStartStep && lastDragStartStep.kind === 'dragstart') {
                    // 替换旧dragstart事件
                    this.recordingSteps.pop();
                    this.recordingSteps.push(stepInfo);
                }
                else this.recordingSteps.push(stepInfo);
                break;

            case 'drop':
                if (this.recordingSteps[this.recordingSteps.length - 1].kind !== 'dragstart') {
                    console.warn("drop without dragstart");
                    return;
                }
                const dragstartStep = this.recordingSteps[this.recordingSteps.length - 1];
                if (dragstartStep) {
                    stepInfo.kind = 'drag';
                    stepInfo.actionInfo.startPoint = dragstartStep.actionInfo.startPoint;
                    stepInfo.actionInfo.startLocators = dragstartStep.actionInfo.startLocators;
                    this.recordingSteps.pop();
                }
                this.recordingSteps.push(stepInfo);
                break;

            default:
                break;
        }
        // this.recordingSteps.push(stepInfo);
        const stepIndex = this.recordingSteps.length - 1;
        console.log("[bg] recorder step:", stepInfo, stepIndex);
        const sidepanelStepsLength = await sendMessage("sendStepToSidepanel", { stepInfo, stepIndex });
        if (sidepanelStepsLength !== this.recordingSteps.length) {
            console.warn("sidepanel steps length mismatch:", sidepanelStepsLength, this.recordingSteps.length);
        }
        return;
    }
}

export default Recorder;
const recorder = new Recorder();
export { recorder };
