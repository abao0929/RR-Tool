// useSteps.tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { StepInfo } from '@/src/template';
import { onMessage } from '@/src/messaging';

type UpsertPayload = { stepIndex: number; stepInfo: StepInfo };

type StepsAPI = {
  steps: StepInfo[];
  /** 追加或替换最后一个：当 stepIndex === steps.length-1 替换，否则若 stepIndex >= steps.length 追加 */
  upsertByIndex: (idx: number, info: StepInfo) => void;
  /** 清空 */
  clear: () => void;
  /** 手动设置（保留稳定引用场景） */
  set: (next: StepInfo[]) => void;
  /** 拿一个只读快照（在非 React 场景有用） */
  getSnapshot: () => StepInfo[];
};

// // ---- 全局 actions 委托（可在非 React 模块中调用） ----
// let _delegate: StepsAPI | null = null;

// export const stepsActions = {
//   upsertByIndex(idx: number, info: StepInfo) { _delegate?.upsertByIndex(idx, info); },
//   clear() { _delegate?.clear(); },
//   getSnapshot(): StepInfo[] { return _delegate?.getSnapshot() ?? []; },
// };

const Ctx = createContext<StepsAPI | null>(null);

export function StepsProvider({ children }: { children: React.ReactNode }) {
  const [steps, setSteps] = useState<StepInfo[]>([]);
  const snapshotRef = useRef(steps);
  snapshotRef.current = steps;

  const upsertByIndex = useCallback((stepIndex: number, stepInfo: StepInfo) => {
    setSteps(prev => {
      const last = prev.length - 1;
      if (last >= 0 && stepIndex === last) {
        const next = prev.slice();
        next[last] = stepInfo;
        return next;
      }
      if (stepIndex >= prev.length) {
        return [...prev, stepInfo];
      }
      return prev; // 其它情况：按你原意先忽略
    });
  }, []);

  const clear = useCallback(() => setSteps([]), []);
  const set = useCallback((next: StepInfo[]) => setSteps(next), []);
  const getSnapshot = useCallback(() => snapshotRef.current, []);

  // 订阅来自 background 的步骤推送
  useEffect(() => {
    const off = onMessage('sendStepToSidepanel', (msg) => {
      const { stepIndex, stepInfo } = msg.data as UpsertPayload;
      upsertByIndex(stepIndex, stepInfo);
    });
    return () => { if (typeof off === 'function') off(); };
  }, [upsertByIndex]);

  const api = useMemo<StepsAPI>(() => ({ steps, upsertByIndex, clear, set, getSnapshot }), [steps, upsertByIndex, clear, set, getSnapshot]);

//   // 安装全局委托
//   useEffect(() => {
//     _delegate = api;
//     return () => { if (_delegate === api) _delegate = null; };
//   }, [api]);

  return React.createElement(Ctx.Provider, { value: api }, children);
}

export function useSteps() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSteps must be used within <StepsProvider>');
  return ctx;
}
