import { defineExtensionMessaging } from "@webext-core/messaging";
import { StepInfo } from "./template";
import { SystemState, SystemCommand, RecordingMode } from "./template";

export interface ProtocolMap {
  // system:从sidepanel发出的控制消息
  systemControl(data: { command: SystemCommand; mode: RecordingMode; url?: string }): { tabId: number | null; state: SystemState };

  // 开始录制
  startRecording(data: {}): { ok: boolean; tabId: number | null; state: string };

  // 停止录制
  finishRecording(data: {}): { ok: boolean; tabId: number | null; state: string };

  // 录制步骤
  recordingStep(data: StepInfo): {};

  // keepalive
  pingRecorder(data: {}): { ok: boolean };

  // 激活/注销监听器
  addListener(data: {}): {};
  removeListener(data: {}): {};

  // system
  getSystemState(data: {}): SystemState;
  
  // sidepanel
  sendStepToSidepanel(data: { stepInfo: StepInfo; stepIndex: number }): number;

  
  tabChangeStep(data: StepInfo): {};

  clearSteps(data: {}): {};
  downloadTestFlow(data: {}): {};


  // replayer

  // highlighter
  "highlighter:teardown": (data: {}) => void | Promise<void>;

  // ui
  "ui:append": (data: { opType?: string | null; screenshot?: string | null }) => void;
  "ui:teardown": (data: {}) => void;

  // all
  "all:destroy": () => void;


}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
