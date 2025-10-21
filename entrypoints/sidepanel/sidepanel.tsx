import React, { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { onMessage, sendMessage } from '@/src/messaging';
import { Button, Space, List, Image, Modal, Collapse, Col, Row } from 'antd';
import type { CollapseProps } from 'antd';
import { StepInfo, SystemCommand, SystemState } from '@/src/template';
import { FaPlayCircle, FaStopCircle, FaTrash, FaRegFolder } from 'react-icons/fa';
import { ButtonColorType } from 'antd/es/button';

// type RecEvent = 'START' | 'PAUSE' | 'RESUME' | 'STOP' | 'RETRY' | 'RESET';

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

    // 把状态消息传回background
    const backToBackground = async (command: SystemCommand) => {
        if (busy) return;
        setBusy(true);
        try {
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
                onClick={() => recorderBtn && backToBackground(recorderBtn.command)}
            />

        </div>
    )
}

function StepListItem({ kind, screenshotUrl, locators }: StepInfo) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const showModal = () => {
        setIsModalOpen(true);
    }
    const handleOk = () => {
        setIsModalOpen(false);
    };
    const handleCancel = () => {
        setIsModalOpen(false);
    };
    const panelStyle: CSSProperties = {
        marginBottom: 24,
        // height: 40,
        border: 'none',
    };

    if (!locators || locators.length === 0) return null;

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
                <Col span={4} onClick={showModal}><FaRegFolder /></Col>
                <Col span={4}>{kind}</Col>
                <Col span={16}>{screenshotUrl && (
                    <Image
                        src={screenshotUrl}
                        // alt="screenshot"
                        style={{ maxWidth: 200, height: 40, objectFit: 'cover', borderRadius: 4, marginRight: 8 }}
                    />
                )}
                </Col>
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
    const [steps, setSteps] = useState<StepInfo[]>([]);

    useEffect(() => {
        (async () => {
            onMessage("sendStepToSidepanel", async (msg) => {
                // console.log("sidepanel receive step:", msg.data.stepInfo);
                setSteps((prev) => [...prev, msg.data]);
            })
        })();
    }, []);

    const cleanStepList = async () => {
        setSteps([]);
        return;
    }

    return (
        <div>
            <Button
                shape='circle'
                variant='text'
                color='default'
                icon={<FaTrash />}
                onClick={() => cleanStepList()}
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

createRoot(document.getElementById('root')!).render(<App />);