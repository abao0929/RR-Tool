import { sendMessage, onMessage } from "@/src/messaging";
import { Recorder } from "./recorder";
import { Highlighter } from "./highlighter"
import { RecorderUi } from "./ui";

export default defineContentScript({
  registration: "runtime",
  runAt: "document_idle",
  async main(crx) {
    console.log("[cs] recorder.content");

    const recorder = new Recorder();
    const highlighter = new Highlighter();
    const ui = new RecorderUi();

    let isActive = false;

    onMessage("pingRecorder", async (msg) => {
      return { ok: true };
    });

    onMessage("addListener", async (msg) => {
      // 如果未启用则添加监听器和高亮
      if (!isActive) {
        isActive = true;
        await recorder.addListener();
        await highlighter.addHighlighter();
        // await ui.addUi();

      }
    });

    onMessage("removeListener", async (msg) => {
      // 如果启用则移除监听器和高亮
      if (isActive) {
        isActive = false;
        await recorder.removeListener();
        await highlighter.removeHighlighter();
        // await ui.removeUi();
      }
    });
  },
});