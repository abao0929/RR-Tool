import { sendMessage, onMessage } from "@/src/messaging";
import { Recorder } from "./recorder";
import { Highlighter } from "./highlighter"
import { RecorderUi } from "./ui";

export default defineContentScript({
  registration: "runtime",
  runAt: "document_idle",
  async main(crx) {
    if ((window as any).__rr_recorder_loaded_) return;
    (window as any).__rr_recorder_loaded_ = true;

    console.log("[cs] recorder.content");

    const recorder = new Recorder();
    const highlighter = new Highlighter();
    const ui = new RecorderUi();

    let listenerAdded = false;

    onMessage("pingRecorder", async (msg) => {
      return { ok: true };
    });

    onMessage("addListener", async (msg) => {
      // 如果未启用则添加监听器和高亮
      if (!listenerAdded) {
        listenerAdded = true;
        await recorder.addListener();
        await highlighter.addHighlighter();
        // await ui.addUi();

      }
    });

    onMessage("removeListener", async (msg) => {
      // 如果启用则移除监听器和高亮
      if (listenerAdded) {
        await recorder.removeListener();
        await highlighter.removeHighlighter();
        listenerAdded = false;
        // await ui.removeUi();
      }
    });
  },
});