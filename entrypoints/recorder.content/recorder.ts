import { StepBuilder } from "./stepBuilder";
import { sendMessage, onMessage } from "@/src/messaging";
import { StepInfo } from "@/src/template";
import { isFromUIEvent } from "./utils";

export class Recorder {
    stepBuilder: StepBuilder;
    constructor() {
        this.stepBuilder = new StepBuilder();
    }

    getEventElement(e: Event): Element | null {
        const path = (e as any).composedPath?.() as EventTarget[] | undefined;
        if (path) {
            const hit = path.find((n): n is Element => n instanceof Element);
            if (hit) return hit;
        }
        return e.target instanceof Element ? e.target : null;
    }

    onClick = async (e: Event) => {
        if (isFromUIEvent(e)) return;
        const element = this.getEventElement(e);
        if (!element) return null;
        // const lastAction = _recording[_recording.length - 1];
        const step = this.stepBuilder.buildStep('click', e, element);
        if (!step) return null;
        console.log("click step:", step);
        // _recording.push(step);
        await sendMessage("recordingStep", step);
    };

    onInput = async (e: Event) => {
      if (isFromUIEvent(e)) return;
      const element = this.getEventElement(e);
      if (!element) return null;
      // const lastAction = _recording[_recording.length - 1];
      const step = this.stepBuilder.buildStep('input', e, element);
      if (!step) return null;
      console.log("input step:", step);
      // _recording.push(step);
      await sendMessage("recordingStep", step);
    };

    onWheel = async (e: WheelEvent) => {
        if (isFromUIEvent(e)) return;
        const element = this.getEventElement(e);
        if (!element) return null;
        const step = this.stepBuilder.buildStep('wheel', e, element);
        if (!step) return null;
        console.log("wheel step:", step);
        await sendMessage("recordingStep", step);
    }

    onKeydown = async (e: KeyboardEvent) => {
        if (isFromUIEvent(e)) return;
        const element = this.getEventElement(e);
        if (!element) return null;
        const step = this.stepBuilder.buildStep('keydown', e, element);
        if (!step) return null;
        console.log("keydown step:", step);
        await sendMessage("recordingStep", step);
    }

    addListener() {
        window.addEventListener("click", this.onClick, true);
        window.addEventListener("input", this.onInput, true);
        window.addEventListener("wheel", this.onWheel, true);
        window.addEventListener("keydown", this.onKeydown, true);
    }

    removeListener() {
        window.removeEventListener("click", this.onClick, true);
        window.removeEventListener("input", this.onInput, true);
        window.removeEventListener("wheel", this.onWheel, true);
        window.removeEventListener("keydown", this.onKeydown, true);
    }
}