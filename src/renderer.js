document.addEventListener('DOMContentLoaded', async () => {
    // 1. Navigation Logic
    const navLinks = document.querySelectorAll('.nav-links li');
    const views = document.querySelectorAll('.view-section');

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.forEach(nl => nl.classList.remove('active'));
            views.forEach(v => v.classList.remove('active'));

            link.classList.add('active');
            const target = link.getAttribute('data-tab');
            document.getElementById(`${target}-view`).classList.add('active');

            // Re-normalize views if switching tabs
            if (target === 'projects') {
                const isLoaded = document.getElementById('label-active-project').innerText !== '未加载';
                if (!isLoaded) {
                    document.getElementById('project-list-section').style.display = 'flex';
                    document.getElementById('project-edit-section').style.display = 'none';
                }
            }
        });
    });

    // 2. Load Global Settings
    try {
        const settings = await window.api.readGlobalSettings();
        document.getElementById('setting-api-url').value = settings.apiEndpoint || '';
        document.getElementById('setting-api-key').value = settings.apiKey || '';
        document.getElementById('setting-master-prompt').value = settings.masterPrompt || '';
    } catch (e) {
        console.error("Failed to read global settings on init.", e);
    }

    // 3. Save Settings Action
    document.getElementById('btn-save-settings').addEventListener('click', async () => {
        const url = document.getElementById('setting-api-url').value;
        const key = document.getElementById('setting-api-key').value;
        const prompt = document.getElementById('setting-master-prompt').value;

        const success = await window.api.saveGlobalSettings({
            apiEndpoint: url,
            apiKey: key,
            masterPrompt: prompt
        });

        if (success) {
            const btn = document.getElementById('btn-save-settings');
            const originalText = btn.innerText;
            btn.innerText = "已保存！";
            btn.style.backgroundColor = "#2ecc71";
            setTimeout(() => {
                btn.innerText = originalText;
                btn.style.backgroundColor = "";
            }, 2000);
        }
    });

    // 4. Handle Decompose Action
    const btnDecompose = document.getElementById('btn-decompose');
    const inputScript = document.getElementById('script-input');
    const shotsList = document.getElementById('shots-list');

    btnDecompose.addEventListener('click', async () => {
        const text = inputScript.value.trim();
        if (!text) {
            alert('请输入剧本正文再进行拆解');
            return;
        }

        btnDecompose.innerText = "智能分析拆解中...";
        btnDecompose.disabled = true;

        const result = await window.api.decomposeScript(text);

        btnDecompose.innerText = "一键AI拆解镜号";
        btnDecompose.disabled = false;

        if (!result.success) {
            if (result.error.includes("APINotConfigured")) {
                alert("请先前往「全局设置」配置正确的 Gemini API Key！");
                document.querySelector('[data-tab="settings"]').click();
            } else {
                alert("发生错误: " + result.error);
            }
            return;
        }

        renderShotsList(result.data);
    });

    let currentShotsData = [];

    function renderShotsList(shots) {
        shotsList.innerHTML = '';
        currentShotsData = shots; // Cache structurally
        if (!shots || shots.length === 0) {
            shotsList.innerHTML = '<div class="empty-state">尚未生成任何分镜</div>';
            return;
        }

        shots.forEach((shot, index) => {
            const row = document.createElement('div');
            row.className = 'shot-item';
            row.id = `shot-row-${index}`;
            row.style.cssText = 'background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 16px; margin-bottom: 12px;';
            const defaultPrompt = typeof shot === 'string' ? shot : (shot.prompt || JSON.stringify(shot));
            row.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                     <span style="font-weight: bold; color: var(--accent-color);">镜头 ${index + 1}</span>
                     <div>
                         <select id="ratio-${index}" style="width: 100px; padding: 4px; border-radius: 4px; margin-right: 8px; background: rgba(0,0,0,0.5);"><option value="16:9">16:9</option><option value="9:16">9:16</option></select>
                         <button class="primary-btn btn-execute-single" data-index="${index}" style="padding: 6px 12px; font-size: 12px;">单拍执行</button>
                     </div>
                </div>
                <textarea id="prompt-${index}" style="width: 100%; height: 60px;resize:none; padding: 8px; border-radius: 6px;" placeholder="提示词...">${defaultPrompt}</textarea>
                <div id="status-${index}" style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">状态: 待命</div>
            `;
            shotsList.appendChild(row);
        });

        // Bind execute single
        document.querySelectorAll('.btn-execute-single').forEach(btn => {
            btn.addEventListener('click', (e) => executeShot(parseInt(e.target.getAttribute('data-index'))));
        });
    }

    // Workflow Orchestrator Flags
    let isExecuting = false;
    let globalPollingInterval = null;

    function generateTrackingId() {
        return '#' + Math.random().toString(36).substr(2, 7).toUpperCase();
    }

    async function executeShot(index) {
        if (isExecuting) {
            alert("正在执行其他任务，请稍后...");
            return;
        }

        const promptText = document.getElementById(`prompt-${index}`).value.trim();
        const ratio = document.getElementById(`ratio-${index}`).value;
        const trackingId = generateTrackingId();

        // Disable polling during sensitive operations
        if (globalPollingInterval) clearInterval(globalPollingInterval);

        isExecuting = true;
        const statusEl = document.getElementById(`status-${index}`);
        statusEl.innerHTML = `<span style="color: #f39c12">状态: 注入排期中 [${trackingId}]... 稍安勿躁</span>`;
        document.querySelector(`.btn-execute-single[data-index="${index}"]`).disabled = true;

        // Sent to main which sends to B window
        window.api.sendTaskToB({
            taskId: trackingId,
            shotIndex: index,
            prompt: `[${trackingId}] ${promptText}`,
            ratio: ratio
            // 预留: duration 和 model 从项目配置读取，或这里加上UI扩展
        });

        // Wait for B Window status back to unlock isExecuting, via onTaskUpdate listener below
    }

    // Batch Execution
    const btnBatch = document.getElementById('btn-batch-execute');
    btnBatch.addEventListener('click', async () => {
        if (isExecuting) return;
        if (currentShotsData.length === 0) return;

        if (!confirm(`确定要按顺序静默执行所有 ${currentShotsData.length} 个镜头吗？这将需要较长时间且暂时接管B窗口底板。`)) return;

        // This is a naive batch orchestrator. In reality, we must wait for each shot to finish 'injecting'
        // before starting next. We can orchestrate this by listening for the "success" signals 
        // and chaining the next execution.
        alert("批量执行逻辑已接入调度栈，将依次发往B窗口。（此处暂简化演示，仅启动第一个）");
        executeShot(0);
    });

    // 5. Bind B Window task feedback
    window.api.onTaskUpdate((data) => {
        console.log("Received update from B:", data);
        if (data.status === 'completed' || data.status === 'error') {
            isExecuting = false; // Release the lock

            const idx = data.shotIndex;
            if (idx !== undefined) {
                const statusEl = document.getElementById(`status-${idx}`);
                if (statusEl) {
                    if (data.status === 'error') {
                        statusEl.innerHTML = `<span style="color: #e74c3c">状态: 注入失败 (${data.message})</span>`;
                    } else {
                        statusEl.innerHTML = `<span style="color: #2ecc71">状态: 注入成功 [任务已抛入云端列队等待视频]</span>`;
                    }
                }

                const btn = document.querySelector(`.btn-execute-single[data-index="${idx}"]`);
                if (btn) btn.disabled = false;
            }

            // TODO: Restart global polling if we need to track video completion using the injected `[#TRACKID]`
        }
    });

    // 6. Project Management UI Logic
    const projectListContainer = document.getElementById('project-list-container');
    const modal = document.getElementById('project-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalInput = document.getElementById('modal-input-name');
    const btnModalConfirm = document.getElementById('btn-modal-confirm');
    const btnModalCancel = document.getElementById('btn-modal-cancel');
    const btnShowCreateProject = document.getElementById('btn-show-create-project');

    let isRenameMode = false;
    let currentRenameTarget = '';

    function formatDate(ms) {
        if (!ms) return '未知时间';
        const d = new Date(ms);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    async function loadProjectsList() {
        const projects = await window.api.listProjects();
        projectListContainer.innerHTML = '';

        if (projects.length === 0) {
            projectListContainer.innerHTML = '<div class="empty-state" style="padding:16px;">还未创建任何项目</div>';
            return;
        }

        projects.forEach(p => {
            const row = document.createElement('div');
            row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3); padding: 12px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);';
            row.innerHTML = `
                <div>
                    <div style="font-weight: 600; font-size: 15px; color: var(--text-main); margin-bottom: 4px;">${p.name}</div>
                    <div style="font-size: 12px; color: var(--text-muted);">创建于: ${formatDate(p.createdAt)}</div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="primary-btn btn-load-proj" data-name="${p.name}" style="padding: 6px 12px; font-size: 12px; background: rgba(58, 134, 255, 0.2); color: var(--primary-color);">载入</button>
                    <button class="primary-btn btn-rename-proj" data-name="${p.name}" style="padding: 6px 12px; font-size: 12px; background: rgba(255, 255, 255, 0.1); color: #fff;">改名</button>
                    <button class="primary-btn btn-del-proj" data-name="${p.name}" style="padding: 6px 12px; font-size: 12px; background: rgba(231, 76, 60, 0.2); color: #e74c3c;">删除</button>
                </div>
            `;
            projectListContainer.appendChild(row);
        });

        document.querySelectorAll('.btn-load-proj').forEach(btn => {
            btn.addEventListener('click', (e) => loadProject(e.target.getAttribute('data-name')));
        });
        document.querySelectorAll('.btn-del-proj').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const name = e.target.getAttribute('data-name');
                if (confirm(`确定要永久删除项目 "${name}" 吗？此操作无法撤销。`)) {
                    await window.api.deleteProject(name);
                    loadProjectsList();
                }
            });
        });
        document.querySelectorAll('.btn-rename-proj').forEach(btn => {
            btn.addEventListener('click', (e) => {
                isRenameMode = true;
                currentRenameTarget = e.target.getAttribute('data-name');
                modalTitle.innerText = `重命名项目: ${currentRenameTarget}`;
                modalInput.value = currentRenameTarget;
                modal.style.display = 'flex';
                modalInput.focus();
            });
        });
    }

    function loadProject(name) {
        document.getElementById('label-active-project').innerText = name;

        // Switch section visibility
        document.getElementById('project-list-section').style.display = 'none';
        document.getElementById('project-edit-section').style.display = 'flex';

        // Select project drop-down in studio tab (if applicable)
        const projSelect = document.getElementById('current-project');
        if (projSelect) {
            projSelect.innerHTML = `<option value="${name}">${name}</option>`;
        }
    }

    document.getElementById('btn-back-to-projects').addEventListener('click', () => {
        document.getElementById('project-list-section').style.display = 'flex';
        document.getElementById('project-edit-section').style.display = 'none';
        document.getElementById('label-active-project').innerText = '未加载';
    });

    function hideModal() {
        modal.style.display = 'none';
        modalInput.value = '';
        isRenameMode = false;
        currentRenameTarget = '';
    }

    btnShowCreateProject.addEventListener('click', () => {
        isRenameMode = false;
        modalTitle.innerText = "新建漫剧工程";
        modalInput.value = '';
        modal.style.display = 'flex';
        modalInput.focus();
    });

    btnModalCancel.addEventListener('click', hideModal);

    btnModalConfirm.addEventListener('click', async () => {
        const name = modalInput.value.trim();
        if (!name) return alert('请输入项目名称');

        if (isRenameMode) {
            const ok = await window.api.renameProject(currentRenameTarget, name);
            if (!ok) alert('重命名失败，可能是名称冲突或文件被占用');
        } else {
            const ok = await window.api.createProject(name);
            if (!ok) alert('创建失败，可能是项目已存在');
        }
        hideModal();
        loadProjectsList();
    });

    // 初始化加载
    loadProjectsList();
});
