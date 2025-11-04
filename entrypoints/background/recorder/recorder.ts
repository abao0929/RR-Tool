import { Screenshot } from "./screenshot";
import { onMessage, sendMessage } from "@/src/messaging";
import { StepInfo } from "@/src/template";
import { browserController } from "../browserController";

export class Recorder {
    screenshot: Screenshot;
    recordingSteps: StepInfo[];
    chromeManager: browserController;
    recordingMode: 'tab' | 'window' | null;
    constructor() {
        this.screenshot = new Screenshot();
        this.recordingSteps = [];
        this.chromeManager = new browserController();
        this.recordingMode = null;
    }

    async startRecording(tabId: number, mode: string | null = "window") {
        if (!tabId) return;
        this.recordingSteps = [];
        if (mode === "tab") {
            this.recordingMode = "tab";
            await this.chromeManager.recordingInTab(tabId);
        }
        else if (mode === "window") {
            this.recordingMode = "window";
            await this.chromeManager.recordingInWindow("https://www.baidu.com/");
        }
        else {
            console.warn("Unknown recording mode:", mode);
            return false;
        }
        console.log("[bg-recorder] recorder start:", tabId);
        return true;

    }

    async finishRecording() {
        // this.chromeManager.stopRecordingInTab();
        if (this.recordingMode === "tab") await this.chromeManager.stopRecordingInTab();
        else if (this.recordingMode === "window") await this.chromeManager.stopRecordingInWindow();
        this.recordingMode = null;
        console.log("[bg-recorder] recorder stop");
        return true;
    }

    async recorderStep(tabId: number, stepInfo: StepInfo): Promise<boolean | undefined> {
        if (!stepInfo) return;
        if (!tabId) return;
        // 补充信息
        stepInfo.tabId = tabId;
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
                try {
                    const screenshotUrl = await this.screenshot.captureElementAccurate(tabId, { x, y, width, height });
                    stepInfo.actionInfo.screenshotUrl = screenshotUrl;
                    this.recordingSteps.push(stepInfo);
                    break;
                } catch (e) {
                    console.error("captureElementAccurate failed:", e);
                    return;
                }

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

            // keydown暂不处理
            case 'keydown':
                return;
            //     if (this.recordingSteps[this.recordingSteps.length - 1].kind === 'input') return;
            //     const lastKeydownAction = this.recordingSteps[this.recordingSteps.length - 1];
            //     if (lastKeydownAction && lastKeydownAction.kind === 'keydown'
            //         && lastKeydownAction.actionInfo.repeat
            //         && lastKeydownAction.actionInfo.key === stepInfo.actionInfo.key
            //     ) {
            //         stepInfo.actionInfo.repeatTime += stepInfo.ts - lastKeydownAction.ts;
            //         this.recordingSteps.pop();
            //         // this.recordingSteps.push(stepInfo);
            //     }
            //     this.recordingSteps.push(stepInfo);
            //     break;

            case 'dragstart':
                // 存储dragstart事件，等待drop时合并
                // 仅保留最新的dragstart事件
                const lastDragStartStep = this.recordingSteps[this.recordingSteps.length - 1];
                if (lastDragStartStep && lastDragStartStep.kind === 'dragstart') {
                    // 替换旧dragstart事件
                    this.recordingSteps.pop();
                    this.recordingSteps.push(stepInfo);
                }
                else this.recordingSteps.push(stepInfo);
                return;

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
