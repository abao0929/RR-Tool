// useSteps.tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { StepInfo } from '@/src/template';
import { onMessage } from '@/src/messaging';

type UpsertPayload = { stepIndex: number; stepInfo: StepInfo };

type StepsAPI = {
  steps: StepInfo[];

  upsertByIndex: (idx: number, info: StepInfo) => void;
  // 清空
  clear: () => void;

  set: (next: StepInfo[]) => void;

  getSnapshot: () => StepInfo[];
};

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
      return prev;
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
      return steps.length;
    });
    return () => { if (typeof off === 'function') off(); };
  }, [upsertByIndex]);

  const api = useMemo<StepsAPI>(() => ({ steps, upsertByIndex, clear, set, getSnapshot }), [steps, upsertByIndex, clear, set, getSnapshot]);

  return React.createElement(Ctx.Provider, { value: api }, children);
}

export function useSteps() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSteps must be used within <StepsProvider>');
  return ctx;
}
