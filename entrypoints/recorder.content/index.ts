import { sendMessage, onMessage } from "@/src/messaging";
import { Recorder } from "./recorder";

export default defineContentScript({
  registration: "runtime",
  runAt: "document_idle",
  async main(crx) {
    console.log("[cs] Add listener");
    const recorder = new Recorder();
    recorder.addListener();
    onMessage("destroyListener", async (msg) => {
      console.log("[cs] Listener removed");
      recorder.removeListener();
    });
  },
});