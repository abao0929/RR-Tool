import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { onMessage, sendMessage } from "@/src/messaging";
import { StyleProvider } from "@ant-design/cssinjs";
import { ConfigProvider, Button, Modal, App as AntdApp, message } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import css from "./ui.css?inline";

function App() {
  const [open, setOpen] = React.useState(false);
  const { message: msgApi } = AntdApp.useApp();

  const onClose = async () => {
    try{
      await sendMessage("all:destroy");
    } catch {}
  }
  return (
    <div className="rr-rect">
      <Button type="primary" onClick={() => setOpen(true)}>打开 Modal</Button>
      <Button onClick={() => msgApi.success("Hello from Shadow DOM!")}>Message</Button>
      <Modal open={open} onCancel={() => setOpen(false)} onOk={() => setOpen(false)}>
        来自 Shadow DOM 的 antd Modal
      </Modal>
      <Button className="rr-close" type="default" size="small" icon={<CloseOutlined />} onClick={onClose} />
    </div>
  );
}

export default defineContentScript({
  registration: "runtime",
  runAt: "document_idle",
  main() {
    console.log("[cs-ui]")

    const host = document.createElement("div");
    host.setAttribute("data-rr-ui", "");
    host.style.all = "initial";
    host.style.position = "fixed";
    host.style.left = "50%";
    host.style.bottom = "24px";
    host.style.transform = "translateX(-50%)";
    host.style.zIndex = "2147483647"; // 置顶
    host.style.pointerEvents = "auto";
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: "open" });


    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    shadow.adoptedStyleSheets = [sheet];


    const mount = document.createElement("div");
    shadow.appendChild(mount);
    const root = createRoot(mount);
    root.render(
      <StyleProvider container={shadow} hashPriority="high">
        <ConfigProvider getPopupContainer={() => mount} theme={{ token: { zIndexPopupBase: 2147483647 } }}>
          <AntdApp>
            <App />
          </AntdApp>
        </ConfigProvider>
      </StyleProvider>
    );

    const teardown = () => {
      try { root.unmount(); } catch { }
      try { host.remove(); } catch { }
    }

    onMessage("ui:teardown", () => {
      teardown();
    });

    return () => {
      teardown();
    }
  }
});
