export interface Locator {
    id: string | null;
    tag: string | null;
    classes: string[];
    text: string | null;
    attributes: Array<{ name: string; value: string }>;
    positionAndSize?: { x: number; y: number; width: number; height: number } | null;
}

export interface StepInfo {
    kind: string | null;               // 操作类型，如 click、input 等
    ts: number;                 // 时间戳
    url: string | null;                // 发生操作时的页面 URL
    locators: Locator[];       // 定位信息，从目标元素开始逐级向上
    actionInfo: any | null;        // 与操作相关的额外信息，如 click 的按钮、坐标等
}

export interface ClickInfo {
    button: number;
    count: number;
    offset: { x: number; y: number };// 相对元素左上角的偏移
    pagePoint: { x: number; y: number };// 相对顶层页面的坐标
    elementRect: { // 元素相对顶层页面的矩形
        x: number;
        y: number;
        width: number;
        height: number
    };
    modifiers: Modifiers;
    screenshotUrl: string | null;  // 截图 URL
}

export interface InputInfo {
    value: string | null;
}

export interface MouseWheelInfo {
    direction: 'up' | 'down' | 'left' | 'right' | 'none';
    deltaX: number,
    deltaY: number,
    scrollX: number,
    scrollY: number,
    modifiers: Modifiers,
}

export interface KeydownInfo {
    key: string;
    code: string;
    location: number;
    repeat: boolean;
    repeatTime: number | null;
    isComposing: boolean;
}

export interface DragInfo {
    startPoint: { 
        x: number | null; 
        y: number | null 
    };
    endPoint: { 
        x: number | null; 
        y: number | null 
    };
    startLocators: Locator[] | null;
    endLocators: Locator[] | null;

}

export interface Modifiers {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
}

export type SystemState =
    | "idle"
    | "recording"
    | "recording-pause"

export type SystemCommand =
    | "start-recording"
    | "stop-recording"
    | "pause-recording" 