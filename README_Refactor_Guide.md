# 即梦（https://jimeng.jianying.com/ai-tool/generate/?type=video）全自动生图辅助客户端：需求与技术重构总结

本文档旨在为您后续重构整个基于 Electron 的自动化辅助项目提供核心需求梳理与技术要点（“防线穿透术”）的精华总结。经过前面数十轮的攻防与试错，我们摸索出了一套能够稳定控制高度防御性（通常基于 React 且伴随风控检测）的现代 Web 应用的底层方案。

## 1. 业务需求总结

本项目的核心目标是：**在不依赖官方（或昂贵且受限的）API 的前提下，通过 Electron 双窗口架构（控制端 A 窗口 + 浏览器端 B 窗口），以“物理+脚本混合仿真”的极客手段，零接触地全自动操作目标创作网页，完成复杂的批量任务。**

具体拆解为以下流程：
1.  **环境隔离与主控通信**：A 窗口作为本地操作台（选词、选图、触发指令），通过 Node.js 主进程（`main.js`）安全穿梭，将指令通过进程间通信（IPC）秘密下发到挂载了目标网页的 B 窗口的预加载脚本（`preload.js`）中。
2.  **元素精准定位与导航**：在 DOM 结构极度不稳定、类名（Class）动态混淆的网页中，寻找如“灵感”、“视频生成”等关键入口并进入。
3.  **复杂表单与弹窗的交互**：
    *   **深度下拉框**（如比例 `16:9`、时长 `15s`）：不仅要点击看见的输入框，还要在全网页范围（可能挂载在 `document.body` 尾部的 Portal 容器中）捕获瞬间弹出的选项并点击。
4.  **文本的强制注入**：将预设或随机的“提示词”灌入具有极强状态管理的富文本组件（如 Draft.js, Quills, Slate.js）。
5.  **跨越安全结界的文件上传**：将用户本地的硬盘图片，绕开浏览器史诗级的 `<input type="file">` 安全沙箱（拒绝非用户物理触发的赋值），强行塞入网页的图片缓冲区。
6.  *（可选）后续关联引用联动*：处理诸如遇到特定字符（`@`）动态生成组件的场景（注：当前已剔除，但作为技术储备保存）。

---

## 2. 核心挑战与技术要点（The Dark Arts）

现代前端框架（特别是 React）内置了强大的合成事件系统（SyntheticEvent）和虚拟 DOM。它们不再关心浏览器原生的简陋标签状态，而是死死维护自己的内存状态池。
**传统的 `document.getElementById('xx').value = 'xxx'` 和 `element.click()` 对这类网站如同挠痒，会被瞬间重置或直接拦截当作“无风控交互”。**

因此，重构时必须牢记以下被血泪验证的“黑魔法”规则：

### 2.1 文本输入的“React 破防器”

*   **痛点**：直接修改 `.value` 无法唤醒 React 的 `onChange` 钩子，组件内的状态仍然是空的，一失去焦点输入框立马清空。
*   **解法（设值破防器）**：
    必须获取挂载在 DOM 节点上的 React 内部追踪代理（`_valueTracker`），强行重置它的基准值，然后手动向下连发两枪：原生 `input` 和 `change` 事件。
    ```javascript
    const lastValue = element.value;
    element.value = newValue;
    const tracker = element._valueTracker; // 刺破 React 保护壳
    if (tracker) tracker.setValue(lastValue);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    ```

### 2.2 下拉菜单与弹窗的“全生命周期鼠标仿真”与“雷达轮询”

*   **痛点 1（假点击）**：很多自定义下拉框拦截了原生的 `.click()`，它们只认完整的物理鼠标按下再抬起的动作。
*   **解法 1（组合拳）**：
    永远不要只调用 `.click()`，必须给它全套的马杀鸡：
    ```javascript
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    element.click(); // 补刀
    ```

*   **痛点 2（幽灵元素 Portal）**：点击下拉框后，弹出的选项菜单并不在当前 DOM 树的下方，而是被 React 飞跃到了 `<body>` 标签的最后面（Portal 机制），且有几百毫秒的动画延迟。
*   **解法 2（ XPath 轮询雷达）**：
    坚决不使用相对路径，改用 `setInterval` 包裹的 `document.evaluate(XPath, ...)` 进行高频（如 50ms 一次）全网扫街。一旦文字“15s”出现，立刻重拳出击，然后 `clearInterval`。

### 2.3 极致防线穿透：跨窗态图片上传（The Drop+Paste Combo）

这是最艰苦的一役。目标网站的图片上传区不仅校验 `isTrusted`（是否真人操作），还通过组合校验屏蔽了剪贴板和拖拽的单一攻击。
*   **弯路 1**：妄图修改 `<input type="file">.files` —— 被浏览器底层 C++ 报错打死（安全错误）。
*   **弯路 2**：试图用 Electron 原生接管焦点发硬件 `Ctrl+V` —— 会遇到严重的“系统焦点抢占问题”，用户只要在 A 窗口动了一下，B 窗口瞬间失焦，内部 React 立即判定拦截粘贴。强行去要焦点（`focus()`）反而触发风控反爬机制。
*   **终极解法（数据流双击爆破）：无视焦点，静默构造双生子包裹。**
    在 Node.js 中把图片转成 Base64 字符串，塞给网页执行：
    1.  用 Base64 字符串现场捏造出一个合法的 HTML5 `File` 对象。
    2.  将其塞入伪造的剪贴板核心 `DataTransfer`。
    3.  **大招**：对着目标元素（哪怕是 `document.body`）**同时并发**砸去一个 `DragEvent('drop')` 和一个 `ClipboardEvent('paste')`。
    React 前端内部的 Droppable 组件和 Pasteable 文本区在同一微秒被打中，校验逻辑互相穿透发生短路，最终安全机制放行，图片凭空刷入业务流。

### 2.4 富文本的高级提及注入（`document.execCommand`）

*   **场景**：富文本编辑器（ContentEditable）拦截一切，它监听真实的键盘敲击产生内部数据块。
*   **解法**：修改 `.value` 无效，触发键盘代码也无效。唯一能让浏览器以为“真的人按下了空格和文字”并告知底层插件的后门 API：
    ```javascript
    element.focus();
    // 短暂延迟等待光标就位
    document.execCommand('insertText', false, ' @');
    ```
    *(注：出于业务简化当前版本移除了 `@菜单` 调用，但此剑谱务必保留重构库中。)*

---

## 3. 下一步重构建议

基于上述技术要点，您的新重构项目应考虑如下结构拆分：

1.  **内核注射器模块 (Core Injector)**：将上面提到的“React 破防器”、“鼠标马杀鸡组合拳”封装成可复用的底层库，不要散步在业务代码里。
2.  **业务编排器 (Workflow Orchestrator)**：建立一套任务队列系统（Task Queue），比如 `[ "CLICK_INSPIRATION", "FILL_PROMPT", "SET_RATIO_16_9", "UPLOAD_IMAGE_A" ]`，由一个基于 `async/await` 搭配 Promise 化（内部包裹 setInterval 检测）的执行机线性调度。
3.  **鲁棒性视觉探测**：放弃任何对类名（如 `.custom-select-xx31`）的执念，坚定地基于绝对的文本（XPath: `//*[text()='xxx']`）或明确给出的 `aria-label` 来寻找猎物。
