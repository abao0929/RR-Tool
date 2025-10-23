import { ElementSelector } from "./elementSelector";
import { ElementAction } from "./elementAction";
import { StepInfo, Locator } from "@/src/template";

// export interface Locators {
//     id: string | null;
//     tag: string | null;
//     classes: string[];
//     text: string | null;
//     attributes: Array<{ name: string; value: string }>;
// }

// export interface stepInfo {
//     kind: string | null;               // 操作类型，如 click、input 等
//     ts: number | null;                 // 时间戳
//     url: string | null;                // 发生操作时的页面 URL
//     locators: Locators[] | null;       // 定位信息，从目标元素开始逐级向上
//     actionInfo: any | null;        // 与操作相关的额外信息，如 click 的按钮、坐标等
// }

export class StepBuilder {
    // constructor(private readonly selector = new ElementSelector()) { }
    private readonly action = new ElementAction();     // 复用实例
    private readonly selector = new ElementSelector();  // 复用实例
    private _recording: StepInfo[] = [];

    public buildStep(type: string, event: Event, element?: Element): StepInfo | null {
        let locators: Locator[];
        const lastAction = this._recording[this._recording.length - 1];
        switch (type) {
            case 'click':
                if (!this.isMouseEvent(event)) return null;
                let clickInfo = this.action.getClickInfo(event);
                locators = this.LocatorBuilder(element ?? null);
                return {
                    kind: 'click',
                    ts: Date.now(),
                    url: window.location.href,
                    locators,
                    actionInfo: clickInfo,
                }
            // 未来可支持更多操作类型
            case 'input':
                if (!this.isInputEvent(event)) return null;
                let inputInfo = this.action.getInputInfo(event, lastAction);
                locators = this.LocatorBuilder(element ?? null);
                const newInputStep: StepInfo = {
                    kind: 'input',
                    ts: Date.now(),
                    url: window.location.href,
                    locators,
                    actionInfo: inputInfo,
                }
                if (lastAction && lastAction.kind === 'input') {
                    this._recording.pop();  // 移除上一个输入步骤
                    this._recording.push(newInputStep); // 添加新的输入步骤
                }
                return newInputStep;
            case 'wheel':
                if (!this.isWheelEvent(event)) return null;
                let wheelInfo = this.action.getWheelInfo(event, lastAction);
                locators = this.LocatorBuilder(element ?? null);
                const newWheelStep: StepInfo = {
                    kind: 'wheel',
                    ts: Date.now(),
                    url: window.location.href,
                    locators,
                    actionInfo: wheelInfo,
                }
                return newWheelStep;
            default:
                return null;
        }
    }

    isMouseEvent(event: Event): event is MouseEvent {
        return event instanceof MouseEvent;
    }
    isInputEvent(event: Event): event is InputEvent {
        return event instanceof InputEvent;
    }
    isWheelEvent(event: Event): event is WheelEvent {
        return event instanceof WheelEvent;
    }
    /**
     * 从当前 element 开始，逐级向上收集定位信息，
     * 每一层 push 一条，直到并包含 document.body。
     */
    public LocatorBuilder(start: Element | null): Locator[] {
        const locators: Locator[] = [];
        if (!start) return locators;

        let node: Element | null = start;
        const body = start.ownerDocument?.body ?? document.body;

        while (node) {
            locators.push({
                tag: this.selector.getElementTag(node),
                id: this.selector.getElementId(node),
                classes: this.selector.getElementClasses(node),
                text: this.selector.getElementText(node),
                attributes: this.selector.getElementAttributes(node),
                positionAndSize: this.selector.getElementPositionAndSize(node),
            });

            if (node === body) break;          // 包含 body 后结束
            node = node.parentElement;         // 继续上溯
        }

        return locators;
    }
}