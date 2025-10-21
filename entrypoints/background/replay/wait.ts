/**
 * 等待“新发起的请求”，若捕获到则等它完成/失败或超时
 * @param tabId
 * @param opts.armMs   监听新请求的窗口时间（毫秒）。窗口期内若没有新请求则立刻返回 found:false。默认 300ms
 * @param opts.timeoutMs  捕获到请求后等待该请求完成的超时时间（毫秒）。默认 8000ms
 */
export async function waitOneNewRequestAndFinish(
  tabId: number,
  opts: { armMs?: number; timeoutMs?: number } = {}
): Promise<
  | { found: false }
  | {
      found: true;
      finished: boolean;      // 是否在超时前完成
      method?: string;
      url?: string;
      status?: number;        // 需要监听 responseReceived 才能拿到
      fromDiskCache?: boolean;
      errorText?: string;     // 失败时可能有
    }
> {
  const armMs = opts.armMs ?? 300;
  const timeoutMs = opts.timeoutMs ?? 10000;

  // 1) attach + enable Network（若已经 attach 会直接通过）
  try { await chrome.debugger.attach({ tabId }, "1.3"); } catch (e: any) {
    if (!String(e?.message || e).includes("already attached")) throw e;
  }
  try { await chrome.debugger.sendCommand({ tabId }, "Network.enable"); } catch {}

  // 局部状态
  let capturedId: string | null = null;
  let method: string | undefined;
  let url: string | undefined;
  let status: number | undefined;
  let fromDiskCache: boolean | undefined;
  let finished = false;
  let errorText: string | undefined;

  // 事件回调
  const onEvent = (src: chrome.debugger.Debuggee, methodName: string, params: any) => {
    if (src.tabId !== tabId) return;

    if (methodName === "Network.requestWillBeSent") {
      // 仅捕获“新的第一个”请求
      if (!capturedId) {
        capturedId = params.requestId;
        method = params.request?.method;
        url = params.request?.url;
      }
    } else if (methodName === "Network.responseReceived") {
      if (capturedId && params.requestId === capturedId) {
        status = params.response?.status;
        fromDiskCache = params.response?.fromDiskCache ?? false;
      }
    } else if (methodName === "Network.loadingFinished") {
      if (capturedId && params.requestId === capturedId) {
        finished = true;
      }
    } else if (methodName === "Network.loadingFailed") {
      if (capturedId && params.requestId === capturedId) {
        finished = true;
        errorText = params.errorText;
      }
    }
  };

  chrome.debugger.onEvent.addListener(onEvent);

  try {
    // —— 步骤1：在 arm 窗口内等待“新的请求”出现 —— //
    const gotNew = await new Promise<boolean>((resolve) => {
      if (armMs <= 0) return resolve(false); // 不等待，直接走没捕获
      const t = setTimeout(() => resolve(!!capturedId), armMs);
      // 如果在窗口期内就捕获到了，尽快返回
      const checkInterval = setInterval(() => {
        if (capturedId) { clearTimeout(t); clearInterval(checkInterval); resolve(true); }
      }, 30);
    });

    if (!gotNew) {
      // 未捕获到新请求：直接返回
      return { found: false };
    }

    // —— 步骤2：等待该请求完成或超时 —— //
    const done = await new Promise<boolean>((resolve) => {
      const t = setTimeout(() => resolve(false), timeoutMs);
      const poll = setInterval(() => {
        if (finished) { clearTimeout(t); clearInterval(poll); resolve(true); }
      }, 50);
    });

    return {
      found: true,
      finished: done,
      method,
      url,
      status,
      fromDiskCache,
      errorText,
    };
  } finally {
    chrome.debugger.onEvent.removeListener(onEvent);
    // 是否立刻 detach 由你的外层控制（建议整段回放 attach 一次，结束再 detach）
    // try { await chrome.debugger.detach({ tabId }); } catch {}
  }
}
