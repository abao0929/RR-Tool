import React, { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { onMessage, sendMessage } from '@/src/messaging';
import { Button, Space, List, Image, Modal, Collapse, Col, Row } from 'antd';
import type { CollapseProps } from 'antd';
import { StepInfo, SystemCommand, SystemState, Modifiers } from '@/src/template';
import { FaPlayCircle, FaStopCircle, FaTrash, FaRegFolder, FaKeyboard } from 'react-icons/fa';
import { ButtonColorType } from 'antd/es/button';
import { StepsProvider, useSteps } from './hooks';

// Record<K, T>生成一个对象映射类型 Partial将K键变为可选
const primaryByState: Partial<Record<
    SystemState, { label: string; icon: React.ReactNode; command: SystemCommand; color: ButtonColorType }
>> = {
    'idle': { label: 'idle', icon: <FaPlayCircle />, command: 'start-recording', color: 'green' },
    'recording': { label: 'recording', icon: <FaStopCircle />, command: 'stop-recording', color: 'red' },
};

function Header() {
    // spState(Sidepanel State)
    const [spState, setSpState] = useState<SystemState>("idle");
    const [busy, setBusy] = useState<Boolean>(false);
    const [tabId, setTabId] = useState<number | null>(null);
    const { clear } = useSteps();

    useEffect(() => {
        (async () => {
            try {
                const res = await sendMessage("getSystemState", {});
                setSpState(res);
            } catch (e) {
                console.log("getSystemState failed:", e);
            }
        })()
    })

    
    const primaryBtnAction = async (command: SystemCommand) => {
        if (busy) return;
        setBusy(true);
        if (command === 'start-recording') {
            clear();
        }
        try {
            // 把状态消息传回background
            const res = await sendMessage('systemControl', command);
            setSpState(res.state);
            setTabId(res.tabId);
        } finally {
            setBusy(false);
        }
    }

    const recorderBtn = primaryByState[spState];

    return (
        <div style={{ padding: 12 }}>
            <Button
                shape="circle"
                variant="text"
                // size="small"
                color={recorderBtn?.color}
                icon={recorderBtn?.icon}
                onClick={() => recorderBtn && primaryBtnAction(recorderBtn.command)}
            />

        </div>
    )
}

function StepListItem({ kind, actionInfo, locators }: StepInfo) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const showModal = () => setIsModalOpen(true);
    const handleOk = () => setIsModalOpen(false);
    const handleCancel = () => setIsModalOpen(false);
    const modifierIcon = (modifiers: Modifiers) => {
        const { ctrl, shift, alt } = modifiers;
        return (
            <>
                {ctrl && <span><FaKeyboard />Ctrl</span>}
                {shift && <span><FaKeyboard />Shift</span>}
                {alt && <span><FaKeyboard />Alt</span>}
            </>
        );
    }
    const renderActionInfo = () => {
        // console.log('kind:', kind, 'actionInfo:', actionInfo);
        if (kind === 'click') {
            return actionInfo?.screenshotUrl && (
                <Image
                    src={actionInfo.screenshotUrl}
                    style={{ maxWidth: 200, height: 40, objectFit: 'cover', borderRadius: 4, marginRight: 8 }}
                />
            );
        }
        if (kind === 'input') {
            return (
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    Value: {String(actionInfo?.value ?? '')}
                </div>
            );
        }
        if (kind === 'wheel') {
            return actionInfo && (
                <div>
                    方向: {actionInfo.direction}, X偏移: {actionInfo.deltaX}, Y偏移: {actionInfo.deltaY}  {modifierIcon(actionInfo.modifiers)}
                </div>
            );
        }
        if (kind === 'keydown') {
            return actionInfo && (
                <div>
                    <FaKeyboard />{actionInfo.key}
                </div>
            );
        }
        return null;
    };
    const panelStyle: CSSProperties = {
        marginBottom: 24,
        border: 'none',
    };

    // if (!locators || locators.length === 0) return null;

    const items = locators.map((locator, idx) => ({
        key: String(idx),
        label: `parent-${idx}`,
        children: (
            <div>
                {locator.id && <div><b>ID:</b> {locator.id}</div>}
                {locator.tag && <div><b>tag:</b> {locator.tag}</div>}
                {locator.classes && locator.classes.length > 0 && (
                    <div>
                        {locator.classes.map((className, i) => (
                            <li key={i}><b>class-{i}</b>: {className}</li>
                        ))}
                    </div>
                )}
                {locator.text && <div><b>text:</b> {locator.text}</div>}
                {locator.attributes && locator.attributes.length > 0 && (
                    <div>
                        {locator.attributes.map((attr, i) => (
                            <li key={i}><b>{attr.name}</b>: {attr.value}</li>
                        ))}
                    </div>
                )}
                {locator.positionAndSize && (
                    <div>
                        <div>
                            <b>Position:</b>
                            {`x: ${locator.positionAndSize.x}, y: ${locator.positionAndSize.y}`}
                        </div>
                        <div>
                            <b>Size:</b>
                            {`width: ${locator.positionAndSize.width}, height: ${locator.positionAndSize.height}`}
                        </div>
                    </div>

                )}
            </div>
        ),
        style: panelStyle,
    }));
    return (
        <>
            <Row style={{ padding: 2, width: '100%', height: 40 }}>
                <Col span={2} onClick={showModal}><FaRegFolder /></Col>
                <Col span={4}>{kind}</Col>
                <Col span={18}>{renderActionInfo()}</Col>
            </Row>
            <Modal
                title="Basic Modal"
                closable={{ 'aria-label': 'Custom Close Button' }}
                open={isModalOpen}
                onOk={handleOk}
                onCancel={handleCancel}
                width={300}
            >
                <Collapse
                    bordered={false}
                    defaultActiveKey={['0']}
                    // expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
                    items={items}
                />
            </Modal>
        </>
    )
}

function StepList() {
    const { steps, clear } = useSteps();
    return (
        <div>
            <Button
                shape='circle'
                variant='text'
                color='default'
                icon={<FaTrash />}
                onClick={clear}
            />
            <List
                dataSource={steps}
                renderItem={(item) => (
                    <List.Item>
                        <StepListItem {...item} />
                    </List.Item>
                )}
            />
        </div>
    )
}

function App() {
    return (
        <div>
            <Header />
            <StepList />
        </div>
    )
}

createRoot(document.getElementById('root')!).render(
    <StepsProvider>
        <App />
    </StepsProvider>
);