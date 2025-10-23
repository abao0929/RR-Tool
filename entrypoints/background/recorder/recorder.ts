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

    async startRecording(tabId: number) {
        if (!tabId) return;
        this.recordingSteps = [];
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
        return { ok: true };
    }

    async recorderStep(tabId: number, stepInfo: StepInfo): Promise<boolean | undefined> {
        if (!stepInfo) return;
        if (!tabId) return;
        // this.recordingSteps.push(stepInfo);
        if (!stepInfo.locators || stepInfo.locators.length === 0 || !stepInfo.locators[0].positionAndSize) {
            console.warn("stepInfo.locators is null or empty, or positionAndSize is missing.");
            // await sendMessage("recorder:step", { stepInfo, url: null });
            return;
        }
        switch (stepInfo.kind) {
            case 'click':
                const rectCss = stepInfo.locators[0].positionAndSize;
                const { x, y, width, height } = rectCss;
                const screenshotUrl = await this.screenshot.captureElementAccurate(tabId, { x, y, width, height });
                stepInfo.actionInfo.screenshotUrl = screenshotUrl;
                this.recordingSteps.push(stepInfo);
                break;
            case 'input':
                const lastInputAction = this.recordingSteps[this.recordingSteps.length-1];
                if (lastInputAction && lastInputAction.kind === 'input') {
                    this.recordingSteps.pop();
                    this.recordingSteps.push(stepInfo);
                }
                else this.recordingSteps.push(stepInfo);
                break;
            case 'wheel':

                break;
        }
        // if (stepInfo.kind === 'click') {
        //     const rectCss = stepInfo.locators[0].positionAndSize;
        //     const { x, y, width, height } = rectCss;
        //     const screenshotUrl = await this.screenshot.captureElementAccurate(tabId, { x, y, width, height });
        //     stepInfo.screenshotUrl = screenshotUrl;
        // }
        const stepIndex = this.recordingSteps.length - 1;
        console.log("[bg] recorder step:", stepInfo.kind, stepIndex);
        await sendMessage("sendStepToSidepanel", { stepInfo, stepIndex });
        return;
    }
}

export default Recorder;
const recorder = new Recorder();
export { recorder };
