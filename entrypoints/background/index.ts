import { browser } from "wxt/browser";
import { onMessage, sendMessage } from "@/src/messaging";
import { replayer } from "./replay/replayer";
import { recorder } from "./recorder/recorder";
import { StepInfo, SystemState } from "@/src/template";


export default defineBackground(() => {
    console.log("[sw] background ready");

    // background全局状态 background state
    let bkState: SystemState = "idle";
    let recordingTabId: number | null = null;

    onMessage("getSystemState", async (msg) => {
        return bkState;
    })

    // 消息接收端：from sidepanel控制
    onMessage("systemControl", async (msg) => {

        switch (msg.data.command) {
            case "start-recording":
                // 更新recordingTabId
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                recordingTabId = tab?.id ?? null;
                // 注入脚本，开始录制
                if (recordingTabId) recorder.startRecording(recordingTabId, msg.data.mode, msg.data.url);
                //更新state状态为：录制中
                bkState = 'recording';
                break;

            case "stop-recording":
                // 结束录制
                if (recordingTabId) recorder.finishRecording();
                // 更新state状态为：空闲
                bkState = 'idle';
                break;

            // case "pause-recording":
            //     if (recordingTabId) recorder.finishRecording(recordingTabId);
            //     bkState = 'recording-pause';
            //     break;

        }
        return { tabId: recordingTabId, state: bkState };
    });

    onMessage("recordingStep", async (msg) => {
        const stepInfo = msg.data;
        const tabId = msg.sender.tab?.id ?? null;
        // console.log("[bg] recorder step:", msg.data);
        if (!stepInfo) {
            console.error("stepInfo is missing");
            return;
        }
        recorder.recorderStep(tabId, stepInfo);
    });

    onMessage("clearSteps", async () => {
        recorder.clearRecordingSteps();
    })

    onMessage("downloadTestFlow", async () => {
        recorder.downloadTestFlow();
    })
});