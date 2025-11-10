import { Screenshot } from "./screenshot";
import { onMessage, sendMessage } from "@/src/messaging";
import { Locator, RecordingMode, StepInfo, TestFlow } from "@/src/template";
import { browserController } from "../browserController";


export class Recorder {
    screenshot: Screenshot;
    recordingSteps: StepInfo[];
    chromeManager: browserController;
    recordingMode: RecordingMode;
    originUrl: string;
    testFlow: TestFlow | null = null;
    constructor() {
        this.screenshot = new Screenshot();
        this.recordingSteps = [];
        this.chromeManager = new browserController();
        this.recordingMode = 'window';
        this.originUrl = "about:blank";
        this.testFlow = null;
    }

    async startRecording(tabId: number, mode: string | null = "window", url: string = "about:blank") {
        if (!tabId) return;
        this.clearRecordingSteps()
        // 根据mode判断录制模式
        if (mode === "tab") {
            this.recordingMode = "tab";
            await this.chromeManager.recordingInTab(tabId);
        }

        else if (mode === "window") {
            this.recordingMode = "window";
            await this.chromeManager.recordingInWindow(url);
        }

        else {
            console.warn("Unknown recording mode:", mode);
            return false;
        }

        console.log("[bg-recorder] recorder start:", tabId);
        return true;

    }

    async finishRecording() {
        if (this.recordingMode === "tab") await this.chromeManager.stopRecordingInTab();
        else if (this.recordingMode === "window") await this.chromeManager.stopRecordingInWindow();
        // 构建testFlow
        this.testFlow = this.bulidTestFlow(this.recordingSteps, this.originUrl, this.recordingMode)
        console.log("[bg-recorder] recorder stop");
        return true;
    }

    async recorderStep(tabId: number, stepInfo: StepInfo): Promise<boolean | undefined> {
        if (!stepInfo) return;
        if (!tabId) return;
        stepInfo.tabId = tabId;

        // 处理录制步骤信息
        switch (stepInfo.kind) {
            case 'click':
                if (!stepInfo.locators
                    || stepInfo.locators.length === 0
                    || !stepInfo.locators[0].positionAndSize
                ) {
                    console.warn("stepInfo.locators is null or empty, or positionAndSize is missing.");
                    return;
                }
                // const rectCss = stepInfo.locators[0].positionAndSize;
                // const { x, y, width, height } = rectCss;
                try {
                    const screenshotUrl = await this.screenshot.captureElementRect(tabId, stepInfo.actionInfo.elementRect);
                    stepInfo.actionInfo.screenshotUrl = screenshotUrl;
                    this.recordingSteps.push(stepInfo);
                    break;
                } catch (e) {
                    console.error("captureElementAccurate failed:", e);
                    return;
                }

            case 'input':
                const lastInputAction = this.recordingSteps[this.recordingSteps.length - 1];
                if (lastInputAction.kind === 'input'
                    && lastInputAction.locators.length === stepInfo.locators.length
                    && this.isTheSameElement(lastInputAction.locators[0], stepInfo.locators[0])
                ) {
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

            // keydown只记录特殊按键
            case 'keydown':
                if (stepInfo.actionInfo.key === 'Tab'
                    || stepInfo.actionInfo.key === 'Enter'
                    || stepInfo.actionInfo.key === 'Alt'
                    || stepInfo.actionInfo.key === 'Escape'
                ) {
                    this.recordingSteps.push(stepInfo);
                }
                else {
                    return;
                }
                break;

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

    isTheSameElement(locator1: Locator, locator2: Locator): boolean {
        if (!locator1 || !locator2) return false;

        if (locator1.tag !== locator2.tag) return false;

        if (locator1.id && locator2.id && locator1.id !== locator2.id) return false;

        if (locator1.classes && locator2.classes) {
            if (locator1.classes.length !== locator2.classes.length) return false;

            for (let i = 0; i < locator1.classes.length; i++) {
                if (locator1.classes[i] !== locator2.classes[i]) return false;
            }
        }

        return true;
        // for (let i = 0; i < locators1.length; i++) {
        //     if (locators1[i].tag !== locators2[i].tag) return false;
        //     if (locators1[i].id !== locators2[i].id) return false;
        //     if (locators1[i].classes !== locators2[i].classes) return false;
        // }
        // return true;
    }

    bulidTestFlow(steps: StepInfo[], originUrl: string, mode: RecordingMode): TestFlow {
        const ts = Date.now();
        return {
            name: `testflow-${mode}-${ts}`,
            originUrl,
            steps,
            mode,
            ts,
        }
    }

    // 清理函数
    async clearRecordingSteps() {
        this.recordingSteps = [];
        this.testFlow = null;
    }

    // 下载 TestFlow JSON 文件
    async downloadTestFlow() {
        const json = JSON.stringify(this.testFlow, null, 2);
        
        // 直接使用 data URL，不需要 createObjectURL
        const dataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;

        const downloadId = await chrome.downloads.download({
            url: dataUrl,
            filename: `${this.testFlow?.name}.json`,
            saveAs: true,
        });

        return downloadId;
    }

    // 将 JSON 文件转为 TestFlow 接口
    async fileToInterface(testFlowFile: File): Promise<TestFlow> {
        const text = await testFlowFile.text();
        return JSON.parse(text) as TestFlow;
    }
}

export default Recorder;
const recorder = new Recorder();
export { recorder };
