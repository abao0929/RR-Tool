import React, { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { onMessage, sendMessage } from '@/src/messaging';
import { Button, Space, List, Image, Modal, Collapse, Col, Row, Radio, Input, Badge, Card } from 'antd';
import type { RadioChangeEvent } from 'antd';
import { StepInfo, SystemCommand, SystemState, Modifiers, Locator, RecordingMode } from '@/src/template';
import { FaPlayCircle, FaStopCircle, FaTrash, FaRegFolder, FaKeyboard, FaFileDownload } from 'react-icons/fa';
import { BiCameraMovie } from "react-icons/bi";
import { HiMiniVideoCamera } from "react-icons/hi2";
import { ButtonColorType } from 'antd/es/button';
import type { CheckboxGroupProps } from 'antd/es/checkbox';
import { StepsProvider, useSteps } from './hooks';

const modeOptions: CheckboxGroupProps<RecordingMode>['options'] = [
    { label: 'Tab', value: 'tab' },
    { label: 'Window', value: 'window' },
];

// Record<K, T>生成一个对象映射类型 Partial将K键变为可选
const recorderControl: Partial<Record<
    SystemState, { label: string; icon: React.ReactNode; command: SystemCommand; color: ButtonColorType; disabled: boolean }
>> = {
    'idle': { label: 'idle', icon: <HiMiniVideoCamera />, command: 'start-recording', color: 'green', disabled: false },
    'recording': { label: 'recording', icon: <HiMiniVideoCamera />, command: 'stop-recording', color: 'red', disabled: false },
    'replaying': { label: 'replaying', icon: <HiMiniVideoCamera />, command: 'stop-replaying', color: 'red', disabled: true },
};

const replayControl: Partial<Record<
    SystemState, { label: string; icon: React.ReactNode; command: SystemCommand; color: ButtonColorType; disabled: boolean }
>> = {
    'idle': { label: 'idle', icon: <FaPlayCircle />, command: 'start-replaying', color: 'green', disabled: false },
    'recording': { label: 'recording', icon: <FaPlayCircle />, command: 'stop-recording', color: 'red', disabled: true },
    'replaying': { label: 'replaying', icon: <FaStopCircle />, command: 'stop-replaying', color: 'red', disabled: false },
};

function Header() {
    // spState(Sidepanel State)
    const [spState, setSpState] = useState<SystemState>("idle");
    const [modeValue, setModeValue] = useState<RecordingMode>('window');
    // const [busy, setBusy] = useState<boolean>(false);
    const [replaying, setReplaying] = useState<boolean>(false);
    const [recording, setRecording] = useState<boolean>(false);
    const [url, setUrl] = useState<string>("about:blank");
    // const [tabId, setTabId] = useState<number | null>(null);
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

    const onModeChange = ({ target: { value } }: RadioChangeEvent) => {
        setModeValue(value);
    }

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setUrl(e.target.value);
    }

    const controllerAction = async (command: SystemCommand) => {
        // if (busy) return;
        // setBusy(true);
        switch (command) {
            case 'start-replaying':
                setReplaying(true);
                break;
            case 'stop-replaying':
                setReplaying(false);
                break;
            case 'start-recording':
                setRecording(true);
                clear();
                break;
            case 'stop-recording':
                setRecording(false);
                break;
        }
        try {
            // 把状态消息传回background
            const res = await sendMessage('systemControl', { command, mode: modeValue, url });
            setSpState(res.state);
            // setTabId(res.tabId);
        } finally {
            // setBusy(false);
        }
    }

    const recorderBtn = recorderControl[spState];
    const replayerBtn = replayControl[spState];

    return (
        <div style={{ padding: 8 }}>
            <Row justify="start" align="middle">
                <Col span={2}>
                    <Button
                        shape="circle"
                        variant="link"
                        color={recorderBtn?.color}
                        icon={recorderBtn?.icon}
                        onClick={() => recorderBtn && controllerAction(recorderBtn.command)}
                        disabled={recorderBtn?.disabled}
                    /></Col>
                <Col offset={1} span={2}>
                    <Button
                        shape="circle"
                        variant="link"
                        color={replayerBtn?.color}
                        icon={replayerBtn?.icon}
                        onClick={() => replayerBtn && controllerAction(replayerBtn.command)}
                        disabled={replayerBtn?.disabled}
                    />
                </Col>
                <Col offset={2} span={12}>
                    <Radio.Group
                        style={{
                            flexDirection: 'row',
                        }}
                        options={modeOptions}
                        onChange={onModeChange}
                        value={modeValue}
                        disabled={recorderBtn?.disabled || replayerBtn?.disabled}
                    />
                </Col>
            </Row>
            <Input
                onChange={onInputChange}
                defaultValue='https://'
                disabled={modeValue !== "window" || recorderBtn?.disabled || replayerBtn?.disabled}
            />
        </div>
    )
}

function StepItem(stepInfo: StepInfo) {
    const { kind, actionInfo } = stepInfo;
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showLocators, setShowLocators] = useState<Locator[]>([]);
    const showModal = (locators: Locator[]) => {
        setShowLocators(locators);
        setIsModalOpen(true);
    };
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
                <div>
                    <Image
                        src={actionInfo.screenshotUrl}
                        style={{ maxWidth: 200, height: 40, objectFit: 'cover', borderRadius: 4, marginRight: 8 }}
                    />
                    <FaRegFolder onClick={() => showModal(stepInfo.locators)} />
                </div>


            );
        }
        if (kind === 'input') {
            return (
                <Row justify="start" align="middle">
                    <Col>Value: {String(actionInfo?.value ?? '')}</Col>
                    <Col><FaRegFolder onClick={() => showModal(stepInfo.locators)} /></Col>
                </Row>
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
        if (kind === 'drag') {
            return actionInfo && (
                <div>
                    start X:{actionInfo.startPoint.x} Y:{actionInfo.startPoint.y} <FaRegFolder onClick={() => showModal(actionInfo.startLocators)} /><br />
                    end X:{actionInfo.endPoint.x} Y:{actionInfo.endPoint.y} <FaRegFolder onClick={() => showModal(actionInfo.endLocators)} />
                </div>
            )
        }
        return null;
    };
    const panelStyle: CSSProperties = {
        marginBottom: 24,
        border: 'none',
    };

    // if (!locators || locators.length === 0) return null;

    const items = (locators: Locator[]) => {
        return locators.map((locator, idx) => ({
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
    }
    return (
        <div>
            <Badge.Ribbon text={kind}>
                <Card
                    style={{
                        width: '100%',
                        height: 50,
                        padding: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-start'
                    }}
                >
                    {renderActionInfo()}
                </Card>
            </Badge.Ribbon>

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
                    items={items(showLocators)}
                />
            </Modal>
        </div>
    )
}

function StepList() {
    const { steps, clear } = useSteps();
    return (
        <div style={{ padding: 8 }}>
            {/* 清空按钮，but无background */}
            <Button
                shape='circle'
                variant='text'
                color='default'
                icon={<FaTrash />}
                onClick={clear}
            />
            <Button
                color = 'default'
                onClick ={() => {
                    sendMessage("downloadTestFlow", {});
                }}
                icon={<FaFileDownload />}
            />
            {/* <List
                dataSource={steps}
                renderItem={(item) => (
                    <List.Item>
                        <StepItem {...item} />
                    </List.Item>
                )}
            /> */}
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {steps.map((step, index) => (
                    <StepItem key={index} {...step} />
                ))}
            </Space>
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