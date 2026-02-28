const { contextBridge, ipcRenderer } = require('electron');

console.log("Dousha Injector Ready: Preload B initialized on jimeng.jianying.com");

/**
 * =========================================================
 *  CORE INJECTORS (The Dark Arts / 核心防线穿破器)
 * =========================================================
 */

// 1. React 设值破防器
function injectReactValue(element, newValue) {
    if (!element) return false;
    const lastValue = element.value;
    element.value = newValue;
    const tracker = element._valueTracker; // 刺破 React 保护壳
    if (tracker) tracker.setValue(lastValue);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
}

// 2. 全生命周期鼠标仿真 (点击破防)
function simulateFullClick(element) {
    if (!element) return false;
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    element.click();
    return true;
}

// 3. XPath 高频雷达轮询寻敌
function waitAndClickByXPath(xpath, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const timer = setInterval(() => {
            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            const element = result.singleNodeValue;

            if (element) {
                clearInterval(timer);
                simulateFullClick(element);
                resolve(element);
            } else if (Date.now() - startTime > timeout) {
                clearInterval(timer);
                reject(new Error(`Timeout waiting for XPath: ${xpath}`));
            }
        }, 50);
    });
}

// 4. 并发穿透：图像的双重注入 (The Drop+Paste Combo)
// 这个需要配合主进程将本地图片转换为 DataURL/Buffer 后调用
async function injectImageCombo(element, base64Data, filename = 'image.png', mimeType = 'image/png') {
    if (!element) return false;

    // Convert base64 to File object
    const res = await fetch(`data:${mimeType};base64,${base64Data}`);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: mimeType });

    // Mock DataTransfer
    const dt = new DataTransfer();
    dt.items.add(file);

    // Blast event 1: Drop
    const dropEvent = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt
    });

    // Blast event 2: Paste
    const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt
    });

    // 齐射 (Concurrent Blast)
    element.dispatchEvent(dropEvent);
    element.dispatchEvent(pasteEvent);
    return true;
}


/**
 * =========================================================
 *  WORKFLOW ORCHESTRATOR HANDLERS
 * =========================================================
 */
ipcRenderer.on('execute-task', async (event, taskData) => {
    console.log("B window received task execution order: ", taskData);
    const { taskId, prompt, ratio } = taskData;

    try {
        // 第一步：寻找输入框并灌入提示词
        // 即梦的输入框通常带有一个 placeholder 或特定的类名，这里通常是一个 textarea
        // 注意：实际的 XPath 需要根据即梦的最新 DOM 结构调整，这里提供一个强健的猜测和框架
        const textAreaXPath = `//textarea[@placeholder='输入提示词，描述你想要的画面，或试试右侧的灵感'] | //textarea[contains(@class, 'PromptInput')]`;
        const textArea = document.evaluate(textAreaXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
            || document.querySelector('textarea'); // 退化降级抓取第一个 textarea

        if (!textArea) throw new Error("无法找到提示词输入框");

        // 使用 React 破防器强行注入带有追踪码的提示词
        injectReactValue(textArea, prompt);
        console.log(`[${taskId}] 注入提示词成功`);
        await new Promise(r => setTimeout(r, 500)); // 缓冲时间

        // 第二步：选择视频比例 (16:9 或 9:16)
        // 假设即梦的比例选择是一个下拉框或者几个并排的按钮
        // 这里演示点击展开下拉框，然后轮询点击包含对应比例文本的选项
        // 根据重构指南，使用 XPath 雷达轮询
        try {
            // 假设这是比例选择的触发按钮（比如默认显示16:9的按钮）
            const ratioTriggerXPath = `//div[contains(text(), '比例')]/following-sibling::div//button | //div[contains(@class, 'ratio')]`;
            const ratioTrigger = document.evaluate(ratioTriggerXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

            if (ratioTrigger) {
                simulateFullClick(ratioTrigger); // 展开下拉菜单
                await new Promise(r => setTimeout(r, 200)); // 等待下拉动画

                // 轮询雷达寻找包含比例文本的选项在 Portal(body 末尾) 中出现
                const optionXPath = `//div[contains(@class, 'select-option') and contains(text(), '${ratio}')] | //span[text()='${ratio}']`;
                await waitAndClickByXPath(optionXPath, 3000);
                console.log(`[${taskId}] 设定比例 ${ratio} 成功`);
            } else {
                console.log(`[${taskId}] 警告：未找到比例选择触发器，跳过此步`);
            }
        } catch (e) {
            console.error(`[${taskId}] 设定比例失败:`, e);
            // 这里非致命错误，不阻断执行
        }
        await new Promise(r => setTimeout(r, 500));

        // TODO: 其他参数（模型、时长、参考图上传等）的注入...

        // 第三步：点击“生成”按钮
        // 寻找包含“生成”或“Generate”字样的主要行动按钮
        const generateBtnXPath = `//button[contains(., '生成视频') or contains(., '生成') and not(@disabled)] | //div[contains(@class, 'generate-btn')]`;
        const generateBtn = document.evaluate(generateBtnXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

        if (!generateBtn) throw new Error("无法找到生成按钮（或按钮被禁用）");

        // 实际使用时解除下一行的注释进行真实点击
        simulateFullClick(generateBtn);
        // console.log(`[${taskId}] 点击生成按钮`);

        // 成功回传
        ipcRenderer.send('task-status-from-b', {
            taskId: taskId,
            shotIndex: taskData.shotIndex,
            status: 'completed',
            message: '任务已成功投递到即梦绘制流'
        });

    } catch (e) {
        console.error(`[${taskId}] 队列执行中断:`, e);
        ipcRenderer.send('task-status-from-b', {
            taskId: taskId,
            shotIndex: taskData.shotIndex,
            status: 'error',
            message: e.toString()
        });
    }
});
