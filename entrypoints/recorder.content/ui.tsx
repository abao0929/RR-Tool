import { pickNonUIElementAt } from "../recorder.content/utils";
import React, { useState } from "react";
import { createRoot, Root } from "react-dom/client";
import { FaGripVertical } from 'react-icons/fa';
import { Button } from "antd";

export class RecorderUi {
    private box: HTMLDivElement | null = null;
    private root: Root | null = null;

    private createUiBox() {
        this.box = document.createElement("div");
        this.box.id = "rrtool-ui";
        this.box.dataset.recIgnore = "1"; // 标记为忽略元素
        // this.box.style.all = "initial";
        // this.box.style.position = "fixed";
        // this.box.style.zIndex = "2147483647";
        this.box.style.width = "150px";
        this.box.style.height = "15px";
        // this.box.style.right = "10px";
        // this.box.style.bottom = "10px";

        document.documentElement.appendChild(this.box);

        this.root = createRoot(this.box);
    }

    private UiBody() {

        const onClick = () => {
            console.log("RRTool UI clicked");
        }

        return (
            <div
                id = "rrtool-ui"
                data-rec-ignore="1"
                style={{
                    position: "fixed",
                    top: 0,
                    left: "50%",
                    transform: "translateX(-50%)",
                    backgroundColor: "rgba(115, 197, 255, 0.5)",
                    // padding: "5px 10px",
                    // borderRadius: "0 0 8px 8px",
                    height: "30px",
                    width: "200px",
                    display: "flex",
                    alignItems: "center",
                }}
                >
                {/* <button onClick={onClick}>Click me</button> */}
                <button
                    id="rrtool-ui"
                    data-rec-ignore="1"
                    // size="small"
                    // type="link"
                    // ghost
                    onClick={onClick}
                ><FaGripVertical /></button>
                {/* <Button
                    data-rec-ignore="1"
                    size="small"
                    type="link"
                    ghost

                /> */}
            </div>
        )
    }

    addUi() {
        // if (!this.box || !document.contains(this.box)) {
        //     this.createUiBox();
        // }

        if (this.root) {
            this.root.render(<this.UiBody />);
        }

        console.log("[cs] Recorder Ui added");
    }

    removeUi() {
        if (this.root) {
            this.root.unmount();
            this.root = null;
        }


        if (this.box) {
            this.box.remove();
            this.box = null;
        }
        
        console.log("[cs] Recorder Ui removed");
    }

}
