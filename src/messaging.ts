import { defineExtensionMessaging } from "@webext-core/messaging";
import { StepInfo } from "./template";
import { SystemState, SystemCommand } from "./template";

export interface ProtocolMap {
  // system:从sidepanel发出的控制消息
  systemControl(data: SystemCommand): { tabId: number | null; state: SystemState };
  
  // recorder
  startRecording(data: {}): { ok: boolean; tabId: number | null; state: string };

  finishRecording(data: {}): { ok: boolean; tabId: number | null; state: string };
  recordingStep(data: StepInfo): {}
  
  destroyListener(data: {}): {};

  getSystemState(data: {}): SystemState;

  // replayer
  "replayer:start": (data: { tabId: number | undefined }) => void | Promise<void>;
  "replayer:finish": (data: { tabId: number | undefined }) => void | Promise<void>;
  "replayer:step": (data: { stepInfo: StepInfo; index: number }) => void | Promise<void>;

  // highlight
  "highlighter:teardown": (data: {}) => void | Promise<void>;

  // ui
  "ui:append": (data: { opType?: string | null; screenshot?: string | null }) => void;
  "ui:teardown": (data: {}) => void;

  // all
  "all:destroy": () => void;

  // sidepanel
  sendStepToSidepanel(data: StepInfo):void;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
