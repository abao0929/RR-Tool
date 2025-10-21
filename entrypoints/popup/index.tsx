import React from "react";
import { createRoot } from "react-dom/client";
import { onMessage, sendMessage } from "@/src/messaging";
import { Button, Space, ConfigProvider, App as AntdApp } from "antd";

function Inner() {
    const { message } = AntdApp.useApp();

    // const startRecord = async () => {
    //     try {
    //         const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    //         await sendMessage("recorder:start", { tabId: tab.id });
    //         message.success("Recorder started");
    //     } catch (error) {
    //         message.error("Failed to start recorder");
    //         console.error(error);
    //     }
    // }

    // const finishRecord = async () => {
    //     try {
    //         const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    //         await sendMessage("recorder:finish", { tabId: tab.id });
    //         message.success("Recorder finish");
    //     } catch (error) {
    //         message.error("Failed to start recorder");
    //         console.error(error);
    //     }
    // }

    // const replaySteps = async () => {
    //     try {
    //         const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    //         await sendMessage("replayer:start", { tabId: tab.id });
    //         message.success("Replayer started");
    //     } catch (error) {
    //         message.error("Failed to start replayer");
    //         console.error(error);
    //     }
    // }

    const openSidePanel = async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab.id) return;
        await chrome.sidePanel.setOptions({ tabId: tab.id, path: "sidepanel/index.html", enabled: true });
        await chrome.sidePanel.open({ tabId: tab.id });
    }

    return (
        <div style={{ padding: 12 }}>
            <Space direction="vertical" size="large" style={{ width: "100%" }}>
                <div style={{ fontWeight: 700 }}>Demo Popup</div>
                <Space>
                    {/* <Button type="primary" onClick={startRecord}>开始录制</Button> */}
                    {/* <Button onClick={finishRecord}>结束录制</Button> */}
                    {/* <Button onClick={replaySteps}>开始回放</Button> */}
                    <Button onClick={openSidePanel}>打开侧边栏</Button>
                </Space>
            </Space>
        </div>
    )
}

function App() {
    return (
        <ConfigProvider theme={{ token: { borderRadius: 8 } }}>
            <AntdApp>
                <Inner />
            </AntdApp>
        </ConfigProvider>
    )
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);