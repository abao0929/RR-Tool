import { sendMessage, onMessage } from "@/src/messaging";
import { Recorder } from "./recorder";
import { Highlighter } from "./highlighter"

export default defineContentScript({
  registration: "runtime",
  runAt: "document_idle",
  async main(crx) {
    console.log("[cs] recorder.content");

    const recorder = new Recorder();
    const highlighter = new Highlighter();

    let isActive = false;

    onMessage("pingRecorder", async (msg) => {
      return { ok: true };
    });

    onMessage("addListener", async (msg) => {
      // 如果未启用则添加监听器和高亮
      if (!isActive) {
        isActive = true;
        recorder.addListener();
        highlighter.addHighlighter();
        
      }
    });

    onMessage("removeListener", async (msg) => {
      // 如果启用则移除监听器和高亮
      if (isActive) {
        isActive = false;
        recorder.removeListener();
        highlighter.removeHighlighter();
      }
    });
  },
});