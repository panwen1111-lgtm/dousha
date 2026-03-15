document.addEventListener('DOMContentLoaded', async () => {
    console.log("Renderer.js Loaded v2.2");
    // 0. Global State Declarations (Top-hoisted for stability)
    let currentShotsData = [];
    let isExecuting = false;
    let globalPollingInterval = null;
    let currentActiveProject = '';
    let currentActiveEpisode = '';
    let currentAssetType = 'protagonist';
    let projectDefaultRatio = '16:9';
    let projectDefaultModel = 'Seedance 2.0 Fast';
    let projectDefaultDuration = '4s';
    let currentAssets = { protagonist: [], supporting: [], scene: [], prop: [] };

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
            row.style.cssText = 'background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 16px; margin-bottom: 12px; transition: transform 0.2s;';
            const defaultPrompt = typeof shot === 'string' ? shot : (shot.prompt != null && shot.prompt !== '' ? shot.prompt : (shot.prompt === '' ? '' : JSON.stringify(shot)));
            
            // Use shot params or project defaults
            const shotModel = shot.model || projectDefaultModel;
            const shotDuration = shot.duration || projectDefaultDuration;
            
            // Build duration options
            let durationOptions = '';
            for(let d=4; d<=15; d++) {
                durationOptions += `<option value="${d}s" ${shotDuration === d+'s' ? 'selected':''}>${d}s</option>`;
            }

            row.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                     <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-weight: bold; color: var(--accent-color);">镜头 ${index + 1}</span>
                        <button class="primary-btn btn-insert-shot" data-index="${index}" style="padding: 2px 6px; font-size: 10px; background: rgba(255,255,255,0.1); border-radius: 4px;">插入下面</button>
                        <button class="primary-btn btn-delete-shot" data-index="${index}" style="padding: 2px 6px; font-size: 10px; background: rgba(231, 76, 60, 0.2); color: #e74c3c; border-radius: 4px;">删除</button>
                     </div>
                     <div style="display:flex; align-items:center;">
<select id="model-${index}" class="shot-param-model" data-index="${index}" style="width: 140px; padding: 4px; border-radius: 4px; margin-right: 8px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); color: #fff;">
                             <option value="Seedance 2.0 Fast" ${shotModel === 'Seedance 2.0 Fast'? 'selected':''}>Seedance 2.0 Fast</option>
                             <option value="Seedance 2.0" ${shotModel === 'Seedance 2.0'? 'selected':''}>Seedance 2.0</option>
                             <option value="视频 3.5 Pro" ${shotModel === '视频 3.5 Pro'? 'selected':''}>视频 3.5 Pro</option>
                             <option value="视频 3.0 Pro" ${shotModel === '视频 3.0 Pro'? 'selected':''}>视频 3.0 Pro</option>
                             <option value="视频 3.0 Fast" ${shotModel === '视频 3.0 Fast'? 'selected':''}>视频 3.0 Fast</option>
                             <option value="视频 3.0" ${shotModel === '视频 3.0'? 'selected':''}>视频 3.0</option>
                          </select>
                         <select id="duration-${index}" class="shot-param-duration" data-index="${index}" style="width: 60px; padding: 4px; border-radius: 4px; margin-right: 8px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); color: #fff;">
                            ${durationOptions}
                         </select>
                         <button class="primary-btn btn-execute-single" data-index="${index}" style="padding: 6px 12px; font-size: 12px;">执行</button>
                     </div>
                </div>
                <textarea id="prompt-${index}" class="shot-prompt-input" data-index="${index}" style="width: 100%; height: 60px;resize:none; padding: 8px; border-radius: 6px; background: rgba(0,0,0,0.2); color: #fff; border: 1px dashed rgba(255,255,255,0.1);" placeholder="提示词...">${defaultPrompt}</textarea>
                <div id="status-${index}" style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">状态: 待命 [v2.2]</div>
            `;
            shotsList.appendChild(row);
        });

        // Event bindings for dynamic row elements
        document.querySelectorAll('.btn-execute-single').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                const index = parseInt(target.getAttribute('data-index'));
                console.log(`Action: Clicked Execute for Shot ${index}`);
                executeShot(index);
            });
        });
        document.querySelectorAll('.btn-insert-shot').forEach(btn => {
            btn.addEventListener('click', (e) => insertShotObj(parseInt(e.target.getAttribute('data-index')) + 1));
        });
        document.querySelectorAll('.btn-delete-shot').forEach(btn => {
            btn.addEventListener('click', (e) => deleteShotObj(parseInt(e.target.getAttribute('data-index'))));
        });
        document.querySelectorAll('.shot-prompt-input, .shot-param-model, .shot-param-duration').forEach(el => {
            el.addEventListener('change', autoSaveEpisodeData);
            if(el.classList.contains('shot-prompt-input')) {
                // Debounce validation on type
                el.addEventListener('input', () => {
                   clearTimeout(el.valTimeout);
                   el.valTimeout = setTimeout(validateAssets, 800);
                });
            }
        });
        
        validateAssets(); // Validate on full render
    }

    // Shot manipulators
    function insertShotObj(atIndex) {
        currentShotsData.splice(atIndex, 0, { prompt: "", model: projectDefaultModel, duration: projectDefaultDuration });
        autoSaveEpisodeData();
        renderShotsList(currentShotsData);
    }
    document.getElementById('btn-add-shot').addEventListener('click', () => {
        if(!currentActiveEpisode) return alert("请先载入集");
        insertShotObj(currentShotsData.length);
    });

    function deleteShotObj(index) {
        if(!confirm(`移除镜头 ${index+1} 吗?`)) return;
        currentShotsData.splice(index, 1);
        autoSaveEpisodeData();
        renderShotsList(currentShotsData);
    }

    function generateTrackingId() {
        return '#' + Math.random().toString(36).substr(2, 7).toUpperCase();
    }

    async function executeShot(index) {
        try {
            console.log(`[ExecuteShot] Starting index ${index}`);
            if (isExecuting) {
                alert("正在执行其他任务，请稍后...");
                return;
            }

            const promptEl = document.getElementById(`prompt-${index}`);
            const modelEl = document.getElementById(`model-${index}`);
            const durationEl = document.getElementById(`duration-${index}`);
            const statusEl = document.getElementById(`status-${index}`);

            if (!promptEl || !modelEl || !durationEl || !statusEl) {
                const msg = `CRITICAL: DOM Elements missing for shot ${index}`;
                console.error(msg);
                alert(msg);
                return;
            }

            const promptText = promptEl.value.trim();
            const duration = durationEl.value;
            const trackingId = generateTrackingId();

            const model = modelEl.value;
            console.log(`[ExecuteShot] Params: id=${trackingId}, prompt=${promptText.substring(0,20)}, model=${model}, dur=${duration}`);

            // Disable polling during sensitive operations
            if (globalPollingInterval) clearInterval(globalPollingInterval);

            isExecuting = true;
            statusEl.innerHTML = `<span style="color: #f39c12">状态: 注入排期中 [${trackingId}]... 稍安勿躁</span>`;
            
            const execBtn = document.querySelector(`.btn-execute-single[data-index="${index}"]`);
            if (execBtn) execBtn.disabled = true;

            // --- Asset Extraction Logic ---
            const assetDataList = [];
            const atRegex = /@([^ \n\.,!?:;，。！？：；]+)/g;
            let match;
            while ((match = atRegex.exec(promptText)) !== null) {
                const assetName = match[1].trim();
                // Lookup in currentAssets (all categories)
                let foundAsset = null;
                for (let cat in currentAssets) {
                    foundAsset = currentAssets[cat].find(a => a.name === assetName);
                    if (foundAsset) break;
                }

                if (foundAsset) {
                    console.log(`[ExecuteShot] Found asset mention: @${assetName}, fetching base64...`);
                    // Extract filename from path (file:///.../filename.png)
                    const fileName = foundAsset.path.split('/').pop();
                    const b64 = await window.api.readAssetAsBase64(currentActiveProject, fileName);
                    if (b64) {
                        assetDataList.push({ name: assetName, base64: b64 });
                    }
                }
            }

            // Sent to main which sends to B window
            window.api.sendTaskToB({
                taskId: trackingId,
                shotIndex: index,
                prompt: promptText, // Prefix removed
                ratio: projectDefaultRatio,
                model: model,
                duration: duration,
                assets: assetDataList // New: pass the 64-bit image data
            });
            console.log(`[ExecuteShot] IPC Sent to B (with ${assetDataList.length} assets)`);
        } catch (err) {
            console.error("[ExecuteShot] Fatal Error:", err);
            alert("执行逻辑崩溃: " + err.message);
            isExecuting = false;
        }
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

    // 5. Studio View (Episode Orchestration) Logic
    // (Variables moved to top)

    // UI Bindings for Episode Studio
    const breadcrumb = document.getElementById('studio-breadcrumb');
    const noEpNotice = document.getElementById('studio-no-episode');
    const epTag = document.getElementById('studio-ep-tag');
    const scriptInput = document.getElementById('script-input');

    // Script Modal Bindings
    document.getElementById('btn-open-script-modal')?.addEventListener('click', () => {
        document.getElementById('subview-script-modal').style.display = 'flex';
        scriptInput.focus();
    });
    document.getElementById('btn-close-script-modal')?.addEventListener('click', () => {
        document.getElementById('subview-script-modal').style.display = 'none';
        autoSaveEpisodeData();
    });

    async function loadEpisodeStudio(projName, epName) {
        currentActiveProject = projName;
        currentActiveEpisode = epName;

        // Hide notice block, show contextual bredcrumbs
        noEpNotice.style.display = 'none';
        breadcrumb.innerText = `${projName} / ${epName}`;
        epTag.innerText = epName;

        // Sync Global Project Props & Assets (Cached)
        const pSettings = await window.api.readProjectSettings(projName);
        if(pSettings) {
             projectDefaultRatio = pSettings.ratio || '16:9';
             projectDefaultModel = pSettings.model || 'Seedance 2.0 Fast';
             projectDefaultDuration = pSettings.duration || '4s';
        }
        currentAssets = await window.api.readProjectAssets(projName);

        // Fetch Episode Struct
        const epData = await window.api.readEpisodeData(projName, epName);
        scriptInput.value = epData.script || '';
        
        // Render Shots
        renderShotsList(epData.shots || []);
        
        document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-links li').forEach(nl => nl.classList.remove('active'));
        document.getElementById('studio-view').classList.add('active');
    }

    // Studio Back Button Logic
    document.getElementById('btn-back-from-studio')?.addEventListener('click', () => {
        document.getElementById('studio-view').classList.remove('active');
        document.getElementById('projects-view').classList.add('active');
        // Update sidebar visual active state back to projects
        document.querySelectorAll('.nav-links li').forEach(nl => {
            if (nl.getAttribute('data-tab') === 'projects') nl.classList.add('active');
        });
    });

    async function autoSaveEpisodeData() {
        if(!currentActiveProject || !currentActiveEpisode) return;
        
        // Scrape current UI states into memory
        const scriptVal = scriptInput.value;
        const newShots = [];
        for(let i=0; i<currentShotsData.length; i++) {
            const promptEl = document.getElementById(`prompt-${i}`);
            const modelEl = document.getElementById(`model-${i}`);
            const durationEl = document.getElementById(`duration-${i}`);
            if(promptEl && modelEl && durationEl) {
                newShots.push({
                    prompt: promptEl.value,
                    model: modelEl.value,
                    duration: durationEl.value
                });
            } else {
                newShots.push(currentShotsData[i]); // Keep old if fail to scrape
            }
        }
        currentShotsData = newShots;

        // Persist
        await window.api.saveEpisodeData(currentActiveProject, currentActiveEpisode, {
             script: scriptVal,
             shots: currentShotsData
        });
    }

    const btnSaveScript = document.getElementById('btn-save-script');
    if(btnSaveScript) {
        btnSaveScript.addEventListener('click', async () => {
            if(!currentActiveEpisode) return alert("请先进入具体的集创作台");
            await autoSaveEpisodeData();
            btnSaveScript.innerText = "已保存";
            setTimeout(() => btnSaveScript.innerText = "保存剧本", 1500);
        });
    }

    // Asset Validation Logic
    const assetValidationBar = document.getElementById('asset-validation-bar');
    const assetValidationMsg = document.getElementById('asset-validation-msg');
    const episodeAssetsView = document.getElementById('episode-assets-view');

    function validateAssets() {
        if(!currentActiveProject || !currentActiveEpisode) return;

        // Flatten all registered asset names from currentAssets globally
        const registeredAssets = new Set();
        if(currentAssets) {
            ['protagonist', 'supporting', 'scene', 'prop'].forEach(cat => {
                 if(currentAssets[cat]) {
                     currentAssets[cat].forEach(a => registeredAssets.add(a.name));
                 }
            });
        }

        // Find all @mentions in prompts
        const citedAssets = new Set();
        const missingAssets = new Set();
        const atRegex = /@([^ \n\.,!?:;，。！？：；]+)/g;

        currentShotsData.forEach((shot, index) => {
             const pText = document.getElementById(`prompt-${index}`)?.value || shot.prompt || "";
             let match;
             while ((match = atRegex.exec(pText)) !== null) {
                 const assetName = match[1];
                 citedAssets.add(assetName);
                 if(!registeredAssets.has(assetName)) {
                     missingAssets.add(assetName);
                     // Highlight row UI
                     const row = document.getElementById(`shot-row-${index}`);
                     if(row) row.style.borderColor = 'rgba(231, 76, 60, 0.8)';
                 } else {
                     const row = document.getElementById(`shot-row-${index}`);
                     if(row) row.style.borderColor = 'rgba(255,255,255,0.05)';
                 }
             }
        });

        // Update Views
        if(citedAssets.size > 0) {
            episodeAssetsView.innerHTML = Array.from(citedAssets).map(name => {
                const isMissing = missingAssets.has(name);
                return `<span style="padding: 2px 6px; background: ${isMissing ? 'rgba(231,76,60,0.2)' : 'rgba(58,134,255,0.2)'}; color: ${isMissing ? '#e74c3c' : '#3498db'}; border-radius: 4px; border: 1px solid ${isMissing ? 'var(--alert-color)' : 'var(--primary-color)'}; display: inline-block; margin: 2px;">@${name} ${isMissing? '(未收录)':''}</span>`;
            }).join(' ');
        } else {
            episodeAssetsView.innerHTML = "暂无资产引用 (@资产名)";
        }

        if(missingAssets.size > 0) {
            assetValidationBar.style.display = 'block';
            assetValidationMsg.innerText = `发现未登记在项目库的资产: ${Array.from(missingAssets).join(', ')}，可能会导致执行生成失败。请去项目资产库补入并确保重名！`;
        } else {
            assetValidationBar.style.display = 'none';
        }
    }
    
    document.getElementById('btn-validate-assets')?.addEventListener('click', () => {
        validateAssets();
        alert("页面镜头资产探测完毕！红框高亮的镜头包含未登记缺失资产。");
    });

    // 6. Project Management UI Logic
    const projectListContainer = document.getElementById('project-list-container');
    const modalInput = document.getElementById('modal-input-name');
    const btnModalConfirm = document.getElementById('btn-modal-confirm');
    const btnModalCancel = document.getElementById('btn-modal-cancel');
    const btnShowCreateProject = document.getElementById('btn-show-create-project');

    let isRenameMode = false;
    let isCreateEpisodeMode = false;
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
            row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3); padding: 12px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: background 0.2s;';
            row.addEventListener('mouseover', () => row.style.background = 'rgba(255,255,255,0.05)');
            row.addEventListener('mouseout', () => row.style.background = 'rgba(0,0,0,0.3)');
            row.innerHTML = `
                <div style="flex:1;" class="proj-row-click" data-name="${p.name}">
                    <div style="font-weight: 600; font-size: 15px; color: var(--text-main); margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                        <span class="btn-rename-proj" data-name="${p.name}" style="cursor: pointer; opacity: 0.6; font-size: 14px; transition: opacity 0.2s;" title="重命名项目">✏️</span>
                        ${p.name}
                    </div>
                    <div style="font-size: 12px; color: var(--text-muted);">创建于: ${formatDate(p.createdAt)}</div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="primary-btn btn-del-proj" data-name="${p.name}" style="padding: 6px 12px; font-size: 12px; background: rgba(231, 76, 60, 0.2); color: #e74c3c;">删除</button>
                </div>
            `;
            projectListContainer.appendChild(row);
        });

        document.querySelectorAll('.proj-row-click').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Ignore click if clicking on the edit icon
                if (e.target.classList.contains('btn-rename-proj')) return;
                loadProject(e.currentTarget.getAttribute('data-name'));
            });
        });
        document.querySelectorAll('.btn-del-proj').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const name = e.target.getAttribute('data-name');
                if (confirm(`确定要永久删除项目 "${name}" 吗？此操作无法撤销。`)) {
                    await window.api.deleteProject(name);
                    if(currentActiveProject === name) {
                        document.getElementById('btn-back-to-projects').click();
                    }
                    loadProjectsList();
                }
            });
        });
        document.querySelectorAll('.btn-rename-proj').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                isRenameMode = true;
                isCreateEpisodeMode = false;
                currentRenameTarget = e.target.getAttribute('data-name');
                document.getElementById('modal-title').innerText = `重命名项目: ${currentRenameTarget}`;
                document.getElementById('modal-input-name').value = currentRenameTarget;
                document.getElementById('project-modal').style.display = 'flex';
                document.getElementById('modal-input-name').focus();
            });
        });
    }

    async function loadEpisodesList(projName) {
        const episodesContainer = document.getElementById('episodes-list-container');
        episodesContainer.innerHTML = '';
        const episodes = await window.api.listEpisodes(projName);
        
        if (episodes.length === 0) {
            episodesContainer.innerHTML = '<div style="color:var(--text-muted); padding: 12px; font-size: 13px;">本项目暂无任何集档案，请右上角新建。</div>';
            return;
        }

        episodes.forEach((ep) => {
            const row = document.createElement('div');
            row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.4); padding: 12px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: background 0.2s;';
            row.addEventListener('mouseover', () => row.style.background = 'rgba(255,255,255,0.08)');
            row.addEventListener('mouseout', () => row.style.background = 'rgba(0,0,0,0.4)');
            row.innerHTML = `
                <div style="flex:1;" class="ep-row-click" data-ep="${ep.name}">
                    <div style="font-weight: 600; font-size: 15px; color: var(--primary-color); margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                        <span class="btn-rename-episode" data-ep="${ep.name}" style="cursor: pointer; opacity: 0.6; font-size: 14px; transition: opacity 0.2s; color: #fff;" title="重命名集">✏️</span>
                        ${ep.name}
                    </div>
                    <div style="font-size: 12px; color: var(--text-muted);">创建于: ${formatDate(ep.createdAt)}</div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="primary-btn btn-delete-episode" data-ep="${ep.name}" style="padding: 6px 12px; font-size: 12px; background: rgba(231, 76, 60, 0.2); color: #e74c3c;">删除</button>
                </div>
            `;
            episodesContainer.appendChild(row);
        });

        episodesContainer.querySelectorAll('.ep-row-click').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if(e.target.classList.contains('btn-rename-episode')) return;
                const epName = e.currentTarget.getAttribute('data-ep');
                loadEpisodeStudio(currentActiveProject, epName);
            });
        });

        episodesContainer.querySelectorAll('.btn-rename-episode').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                isRenameMode = true;
                isCreateEpisodeMode = true; // reusing modal for ep rename
                currentRenameTarget = e.target.getAttribute('data-ep');
                document.getElementById('modal-title').innerText = `重命名集: ${currentRenameTarget}`;
                document.getElementById('modal-input-name').value = currentRenameTarget;
                document.getElementById('project-modal').style.display = 'flex';
                document.getElementById('modal-input-name').focus();
            });
        });

        episodesContainer.querySelectorAll('.btn-delete-episode').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const epName = e.target.getAttribute('data-ep');
                if(confirm(`确定删除集 "${epName}" ？相关联的所有脚本和镜头配置将清除。`)) {
                    await window.api.deleteEpisode(currentActiveProject, epName);
                    loadEpisodesList(currentActiveProject);
                }
            });
        });
    }

    async function loadProject(name) {
        currentActiveProject = name;
        document.getElementById('label-active-project').innerText = name;

        // Load parameter settings
        const settings = await window.api.readProjectSettings(name);
        if (settings) {
            if(settings.ratio) document.getElementById('proj-default-ratio').value = settings.ratio;
            if(settings.model) document.getElementById('proj-default-model').value = settings.model;
            if(settings.duration) document.getElementById('proj-default-duration').value = settings.duration;
        }

        // Load structure
        loadEpisodesList(name);

        // Load Assets
        currentAssets = await window.api.readProjectAssets(name);
        // Ensure all types exist for backward compatibility
        ['protagonist', 'supporting', 'scene', 'prop'].forEach(t => {
            if (!currentAssets[t]) currentAssets[t] = [];
        });

        // Render current selected tab type assets
        try { renderAssets(); } catch (e) { }

        // Switch section visibility
        document.getElementById('project-list-section').style.display = 'none';
        document.getElementById('project-edit-section').style.display = 'flex';

        // Select project drop-down in studio tab (if applicable)
        const projSelect = document.getElementById('current-project');
        if (projSelect) {
            projSelect.innerHTML = `<option value="${name}">${name}</option>`;
        }
    }

    // Subview Navigations
    const subSettings = document.getElementById('subview-proj-settings');
    const subAssets = document.getElementById('subview-proj-assets');

    document.getElementById('btn-open-proj-settings').addEventListener('click', async () => {
        // Pre-fill from current project settings
        if(currentActiveProject) {
            const pSettings = await window.api.readProjectSettings(currentActiveProject);
            if(pSettings) {
                document.getElementById('proj-default-ratio').value = pSettings.ratio || '16:9';
                document.getElementById('proj-default-model').value = pSettings.model || 'Seedance 2.0 Fast';
                document.getElementById('proj-default-duration').value = pSettings.duration || '5s';
            }
        }
        subSettings.style.display = 'flex';
    });
    document.getElementById('btn-close-proj-settings').addEventListener('click', () => subSettings.style.display = 'none');
    // Click on the backdrop to close
    subSettings.addEventListener('click', (e) => { if(e.target === subSettings) subSettings.style.display = 'none'; });
    
    // Save button in the settings modal
    document.getElementById('btn-save-proj-settings')?.addEventListener('click', async () => {
        if(!currentActiveProject) return;
        const ratio = document.getElementById('proj-default-ratio').value;
        const model = document.getElementById('proj-default-model').value;
        const duration = document.getElementById('proj-default-duration').value;
        const existing = await window.api.readProjectSettings(currentActiveProject);
        const updated = Object.assign(existing || {}, { ratio, model, duration });
        // Save via project settings IPC (reuse save-project-settings if available, else create-project)
        const success = await window.api.saveProjectSettings(currentActiveProject, updated).catch(() => false);
        const btn = document.getElementById('btn-save-proj-settings');
        if (btn) { btn.innerText = '已保存'; setTimeout(() => { btn.innerText = '保存设置'; subSettings.style.display = 'none'; }, 1200); }
    });
    
    document.getElementById('btn-open-proj-assets').addEventListener('click', async () => {
        // Load Assets dynamically here to ensure freshness 
        if(currentActiveProject) {
            currentAssets = await window.api.readProjectAssets(currentActiveProject);
            ['protagonist', 'supporting', 'scene', 'prop'].forEach(t => { if(!currentAssets[t]) currentAssets[t] = []; });
            try { renderAssets(); } catch(e){}
        }
        subAssets.style.display = 'flex';
    });
    document.getElementById('btn-close-proj-assets').addEventListener('click', () => subAssets.style.display = 'none');

    document.getElementById('btn-show-create-episode').addEventListener('click', () => {
        isRenameMode = false;
        isCreateEpisodeMode = true;
        document.getElementById('modal-title').innerText = `在项目 "${currentActiveProject}" 中新建集`;
        document.getElementById('modal-input-name').value = '';
        document.getElementById('project-modal').style.display = 'flex';
        document.getElementById('modal-input-name').focus();
    });

    document.getElementById('btn-back-to-projects').addEventListener('click', () => {
        document.getElementById('project-list-section').style.display = 'flex';
        document.getElementById('project-edit-section').style.display = 'none';
        
        // Hide subviews implicitly 
        subSettings.style.display = 'none';
        subAssets.style.display = 'none';
        
        currentActiveProject = '';
        document.getElementById('label-active-project').innerText = '未加载';
    });

    function hideModal() {
        document.getElementById('project-modal').style.display = 'none';
        modalInput.value = '';
        isRenameMode = false;
        isCreateEpisodeMode = false;
        currentRenameTarget = '';
    }

    btnShowCreateProject.addEventListener('click', () => {
        isRenameMode = false;
        isCreateEpisodeMode = false;
        document.getElementById('modal-title').innerText = "新建漫剧工程";
        document.getElementById('modal-input-name').value = '';
        document.getElementById('project-modal').style.display = 'flex';
        document.getElementById('modal-input-name').focus();
    });

    btnModalCancel.addEventListener('click', hideModal);

    btnModalConfirm.addEventListener('click', async () => {
        const name = modalInput.value.trim();
        if (!name) return alert('请输入名称');

        if (isCreateEpisodeMode) {
             if (isRenameMode) {
                 const ok = await window.api.renameEpisode(currentActiveProject, currentRenameTarget, name);
                 if(!ok) alert('重命名集失败，可能是重名了或被占用');
             } else {
                 const ok = await window.api.createEpisode(currentActiveProject, name);
                 if(!ok) alert('创建集失败，可能是重名了');
             }
             hideModal();
             if(currentActiveProject) loadEpisodesList(currentActiveProject);
             return;
        }

        if (isRenameMode) {
            // EPERM workaround for Windows: DOM elements holding file:// locks
            if (currentActiveProject === currentRenameTarget) {
                // Unload the active project visually to release locks
                currentActiveProject = '';
                document.getElementById('label-active-project').innerText = '未加载';
                document.getElementById('project-list-section').style.display = 'flex';
                document.getElementById('project-edit-section').style.display = 'none';
                document.getElementById('assets-grid').innerHTML = '';
                document.getElementById('shots-list').innerHTML = '';
                // force garbage collection of media elements technically
                const audios = document.querySelectorAll('audio');
                audios.forEach(a => { a.pause(); a.removeAttribute('src'); a.load(); });
            }

            const ok = await window.api.renameProject(currentRenameTarget, name);
            if (!ok) alert('重命名失败，可能是名称冲突或文件仍被后台占用');
        } else {
            const ok = await window.api.createProject(name);
            if (!ok) alert('创建失败，可能是项目已存在');
        }
        hideModal();
        loadProjectsList();
    });

    // 7. Asset Management Logic

    // Tab switching
    document.querySelectorAll('.tab-asset').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-asset').forEach(b => {
                b.classList.remove('active');
                b.style.background = 'rgba(255,255,255,0.1)';
                b.style.borderColor = 'transparent';
            });
            e.target.classList.add('active');
            e.target.style.background = 'rgba(58, 134, 255, 0.2)';
            e.target.style.borderColor = 'var(--primary-color)';

            currentAssetType = e.target.getAttribute('data-type');
            try {
                renderAssets();
            } catch (err) {
                alert("渲染资产分类报错:" + err.message);
            }
        });
    });

    const dropzone = document.getElementById('asset-dropzone');
    const assetUploadInput = document.getElementById('asset-upload-input');
    const audioUploadInput = document.getElementById('audio-upload-input');

    // Triggers
    dropzone.addEventListener('click', () => assetUploadInput.click());

    // Drag & Drop
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--primary-color)';
        dropzone.style.background = 'rgba(58, 134, 255, 0.1)';
    });
    dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = 'rgba(255,255,255,0.2)';
        dropzone.style.background = 'rgba(0,0,0,0.2)';
    });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'rgba(255,255,255,0.2)';
        dropzone.style.background = 'rgba(0,0,0,0.2)';
        if (e.dataTransfer.files.length > 0) {
            handleAssetUpload(e.dataTransfer.files);
        }
    });

    assetUploadInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleAssetUpload(e.target.files);
        }
    });

    async function handleAssetUpload(files) {
        const projName = document.getElementById('label-active-project').innerText;
        if (projName === '未加载') return alert('请先载入一个项目');

        let updatedCount = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith('image/')) continue;

            // Use FileReader to get raw bytes — works around Electron sandbox path restrictions
            const arrayBuffer = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = () => reject(new Error('文件读取失败'));
                reader.readAsArrayBuffer(file);
            });

            // Build a unique filename preserving extension
            const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '.png';
            const uniqueFileName = `${Date.now()}_${i}${ext}`;

            const savedPath = await window.api.writeAssetFile(projName, uniqueFileName, arrayBuffer);

            if (savedPath) {
                const displayName = file.name.replace(/\.[^/.]+$/, '');
                currentAssets[currentAssetType].push({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                    name: displayName,
                    path: savedPath,
                    audio: null
                });
                updatedCount++;
            } else {
                console.error('主进程写入失败：', file.name);
            }
        }

        if (updatedCount > 0) {
            await window.api.saveProjectAssets(projName, currentAssets);
            renderAssets();
        } else {
            alert('没有成功上传任何图片。请确认选择的是图片格式文件（PNG/JPG/WebP 等）');
        }
        assetUploadInput.value = '';
    }

    // Audio Binding Logic
    let pendingAudioAssetId = null;
    audioUploadInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0 && pendingAudioAssetId) {
            const file = e.target.files[0];
            if (!file.type.startsWith('audio/')) {
                alert('请选择音频文件 (MP3/WAV/AAC 等)');
                audioUploadInput.value = '';
                pendingAudioAssetId = null;
                return;
            }
            const projName = document.getElementById('label-active-project').innerText;

            // Read as ArrayBuffer and write via main process (same approach as image upload)
            const arrayBuffer = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = ev => resolve(ev.target.result);
                reader.onerror = () => reject(new Error('音频读取失败'));
                reader.readAsArrayBuffer(file);
            });

            const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '.mp3';
            // Store audio in the project's assets_files directory with audio_ prefix
            const audioFileName = `audio_${Date.now()}${ext}`;
            const savedAudioPath = await window.api.writeAssetFile(projName, audioFileName, arrayBuffer);

            if (savedAudioPath) {
                // Find asset and bind, storing both path and display name
                let found = false;
                for (let type in currentAssets) {
                    let asset = currentAssets[type].find(a => a.id === pendingAudioAssetId);
                    if (asset) {
                        asset.audio = { path: savedAudioPath, name: file.name };
                        found = true;
                        break;
                    }
                }
                if (found) {
                    await window.api.saveProjectAssets(projName, currentAssets);
                    renderAssets();
                }
            } else {
                alert('音色文件保存失败，请重试');
            }
        }
        audioUploadInput.value = '';
        pendingAudioAssetId = null;
    });

    function renderAssets() {
        const grid = document.getElementById('assets-grid');
        grid.innerHTML = '';
        const list = currentAssets[currentAssetType] || [];

        if (list.length === 0) {
            grid.innerHTML = '<div style="color:var(--text-muted); padding: 12px; font-size: 13px;">当前分类暂无资产</div>';
            return;
        }

        const typeColorMap = {
            protagonist: 'var(--primary-color)',
            supporting: '#f1c40f',
            scene: '#2ecc71',
            prop: '#9b59b6'
        };
        const typeNameMap = {
            protagonist: '主角',
            supporting: '配角',
            scene: '场景',
            prop: '道具'
        };

        list.forEach(asset => {
            const card = document.createElement('div');
            card.style.cssText = 'background: rgba(0,0,0,0.4); border-radius: 8px; padding: 8px; text-align: center; display: flex; flex-direction: column; position: relative; border: 1px solid rgba(255,255,255,0.05);';

            // Only protagonist and supporting can have audio
            const showAudio = (currentAssetType === 'protagonist' || currentAssetType === 'supporting');
            
            // Audio display: show name of bound audio if available
            let audioHtml = '';
            if (showAudio) {
                if (asset.audio) {
                    const audioName = typeof asset.audio === 'object' ? asset.audio.name : asset.audio.split('/').pop();
                    const shortAudioName = audioName.length > 14 ? audioName.slice(0, 12) + '…' : audioName;
                    audioHtml = `
                        <div style="font-size: 11px; color: #2ecc71; background: rgba(46,204,113,0.1); padding: 5px 6px; border-radius: 4px; text-align: left; display: flex; align-items: center; gap: 4px; margin-top: 4px;" title="${audioName}">
                            <span>🎤</span>
                            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px;">${shortAudioName}</span>
                        </div>
                        <button class="primary-btn btn-unbind-audio" data-id="${asset.id}" style="font-size: 10px; padding: 4px; background: rgba(231, 76, 60, 0.2); color: #e74c3c; border: 1px solid rgba(231, 76, 60, 0.3); margin-top: 3px;">解除音色</button>`;
                } else {
                    audioHtml = `<button class="primary-btn btn-bind-audio" data-id="${asset.id}" style="font-size: 10px; padding: 4px; background: transparent; border: 1px dashed var(--primary-color); color: var(--primary-color); margin-top: 4px;">+ 绑定配音音色</button>`;
                }
            }

            card.innerHTML = `
                <div style="height: 100px; background: #222; border-radius: 4px; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative;">
                    <img src="${asset.path}" style="width: 100%; height: 100%; object-fit: cover;" />
                    <button class="btn-delete-asset" data-id="${asset.id}" style="position: absolute; top:4px; right:4px; background: rgba(231, 76, 60, 0.8); border:none; color:white; border-radius: 4px; padding: 2px 6px; font-size: 10px; cursor: pointer; opacity: 0.7; transition: opacity 0.2s;">X</button>
                </div>
                <div style="font-size: 13px; font-weight: 500; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; outline: none; border-bottom: 1px dashed rgba(255,255,255,0.2);" contenteditable="true" class="asset-name-editor" data-id="${asset.id}" title="点击可直接编辑名称">${asset.name}</div>
                <span style="font-size: 11px; color: ${typeColorMap[currentAssetType]}; margin-bottom: 4px; font-weight: 600;">[${typeNameMap[currentAssetType]}]</span>
                <div style="margin-top: auto; display:flex; flex-direction: column;">${audioHtml}</div>
            `;
            grid.appendChild(card);
        });

        // Delete events
        grid.querySelectorAll('.btn-delete-asset').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                currentAssets[currentAssetType] = currentAssets[currentAssetType].filter(a => a.id !== id);
                await window.api.saveProjectAssets(document.getElementById('label-active-project').innerText, currentAssets);
                renderAssets();
            });
        });

        // Audio Bind events
        grid.querySelectorAll('.btn-bind-audio').forEach(btn => {
            btn.addEventListener('click', (e) => {
                pendingAudioAssetId = e.target.getAttribute('data-id');
                audioUploadInput.click();
            });
        });

        // Audio Unbind events
        grid.querySelectorAll('.btn-unbind-audio').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                let asset = currentAssets[currentAssetType].find(a => a.id === id);
                if (asset) {
                    asset.audio = null;
                    await window.api.saveProjectAssets(document.getElementById('label-active-project').innerText, currentAssets);
                    renderAssets();
                }
            });
        });

        // Name edit events
        grid.querySelectorAll('.asset-name-editor').forEach(el => {
            el.addEventListener('blur', async (e) => {
                const id = e.target.getAttribute('data-id');
                const newName = e.target.innerText.trim();
                let asset = currentAssets[currentAssetType].find(a => a.id === id);
                if (asset && newName) {
                    asset.name = newName;
                    await window.api.saveProjectAssets(document.getElementById('label-active-project').innerText, currentAssets);
                }
            });
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    el.blur();
                }
            });
        });
    }

    // 初始化加载
    loadProjectsList();
});
