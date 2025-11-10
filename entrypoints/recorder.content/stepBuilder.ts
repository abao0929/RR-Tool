import { ElementSelector } from "./elementSelector";
import { ElementAction } from "./elementAction";
import { StepInfo, Locator } from "@/src/template";

export class StepBuilder {
    private readonly action = new ElementAction();     // 复用实例
    private readonly selector = new ElementSelector();  // 复用实例

    public buildStep(type: string, event: Event, element?: Element): StepInfo | null {
        let locators: Locator[];
        switch (type) {
            case 'click':
                if (!this.isMouseEvent(event)) return null;
                let clickInfo = this.action.getClickInfo(event);
                locators = this.LocatorBuilder(element ?? null);
                return {
                    kind: 'click',
                    ts: Date.now(),
                    tabId: null,
                    url: window.location.href,
                    locators,
                    actionInfo: clickInfo,
                }
            // 未来可支持更多操作类型
            case 'input':
                if (!this.isInputEvent(event)) return null;
                let inputInfo = this.action.getInputInfo(event);
                locators = this.LocatorBuilder(element ?? null);
                const newInputStep: StepInfo = {
                    kind: 'input',
                    ts: Date.now(),
                    tabId: null,
                    url: window.location.href,
                    locators,
                    actionInfo: inputInfo,
                }

                return newInputStep;
            case 'wheel':
                if (!this.isWheelEvent(event)) return null;
                let wheelInfo = this.action.getWheelInfo(event);
                locators = this.LocatorBuilder(element ?? null);
                const newWheelStep: StepInfo = {
                    kind: 'wheel',
                    ts: Date.now(),
                    tabId: null,
                    url: window.location.href,
                    locators,
                    actionInfo: wheelInfo,

                }
                return newWheelStep;

            case 'keydown':
                if (!this.isKeydownEvent(event)) return null;
                let keydownInfo = this.action.getKeydownInfo(event);
                locators = [];
                const newKeydownStep: StepInfo = {
                    kind: 'keydown',
                    ts: Date.now(),
                    tabId: null,
                    url: window.location.href,
                    locators,
                    actionInfo: keydownInfo,

                }
                return newKeydownStep;

            case 'dragstart':
                if (!this.isDragStartEvent(event)) return null;
                let dragStartInfo = this.action.getDragStartInfo(event);
                locators = [];
                const startLocators = this.LocatorBuilder(element ?? null);
                if(dragStartInfo) dragStartInfo.startLocators = startLocators;
                const newDragStartStep: StepInfo = {
                    kind: 'dragstart',
                    ts: Date.now(),
                    tabId: null,
                    url: window.location.href,
                    locators,
                    actionInfo: dragStartInfo,

                }
                return newDragStartStep;

            case 'drop':
                if (!this.isDropEvent(event)) return null;
                let dropInfo = this.action.getDropInfo(event);
                locators = [];
                const endLocators = this.LocatorBuilder(element ?? null);
                if(dropInfo) dropInfo.endLocators = endLocators;
                const newDropStep: StepInfo = {
                    kind: 'drop',
                    ts: Date.now(),
                    tabId: null,
                    url: window.location.href,
                    locators,
                    actionInfo: dropInfo,
                }
                return newDropStep;
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
    isKeydownEvent(event: Event): event is KeyboardEvent {
        return event instanceof KeyboardEvent;
    }
    isDragStartEvent(event: Event): event is DragEvent {
        return event instanceof DragEvent && event.type === 'dragstart';
    }
    isDropEvent(event: Event): event is DragEvent {
        return event instanceof DragEvent && event.type === 'drop';
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