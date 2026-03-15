const { contextBridge, ipcRenderer } = require('electron');

console.log('Dousha Injector Ready: Preload B initialized (v4.9 - Super Resilience)');

/**
 * =========================================================
 *  CORE INJECTORS
 * =========================================================
 */

function injectReactValue(element, newValue) {
    if (!element) return false;
    try {
        const lastValue = element.value || '';
        element.value = newValue;
        // React Bypass
        const tracker = element._valueTracker;
        if (tracker) tracker.setValue(lastValue);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    } catch (e) { return false; }
}

async function injectUniversalText(element, text) {
    if (!element) return false;
    console.log('[v5.1] Universal Inject Sequence Start');
    try {
        element.focus();
        element.click();
        await new Promise(r => setTimeout(r, 200));
        
        if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
            // Standard Input
            element.value = text;
            const tracker = element._valueTracker;
            if (tracker) tracker.setValue('');
        } else {
            // Rich Text / ContentEditable
            element.innerText = text;
        }
        
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('blur', { bubbles: true }));
        
        // Final heavy-duty attempt for React/ProseMirror
        try {
            if (window.getSelection) {
                const range = document.createRange();
                range.selectNodeContents(element);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }
            document.execCommand('insertText', false, text);
        } catch (e) {
            console.warn('[v5.1] execCommand failed:', e.message);
        }
        
        return true;
    } catch (e) { console.error('[v5.1] Error:', e); return false; }
}

function simulateFullClick(element) {
    if (!element) return false;
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
    element.click();
    return true;
}

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
                reject(new Error('Timeout: ' + xpath));
            }
        }, 50);
    });
}

/**
 * =========================================================
 *  ORCHESTRATOR
 * =========================================================
 */
ipcRenderer.on('execute-task', async (event, taskData) => {
    const { taskId, prompt, ratio, model, duration, assets } = taskData;
    console.log('[' + taskId + '] v4.9 START (Super Resilience)');
    try {
        const toolbarElements = () => document.querySelectorAll('.toolbar-select-h345g7, div[class*="toolbar-select"], .toolbar-button-FhFnQ_');
        
        // 0. Creation Type (Conditional Sync v5.2)
        const typeTrigger = Array.from(toolbarElements()).find(el => el.innerText.includes('生成') && (el.innerText.includes('视频') || el.innerText.includes('图片') || el.innerText.includes('Agent')));
        if (typeTrigger && !typeTrigger.innerText.includes('视频生成')) {
            console.log('['+taskId+'] Creation Type mismatch. Forcing -> 视频生成');
            simulateFullClick(typeTrigger); await new Promise(r => setTimeout(r, 1000));
            await waitAndClickByXPath("//li[contains(., '视频生成')]", 3000).catch(()=>{});
            await new Promise(r => setTimeout(r, 1500)); // Page might re-render significantly
        }

        // 1. Model (Now First)
        if (model) {
            const modelTrigger = Array.from(toolbarElements()).find(el => {
                const t = el.innerText.trim();
                return (t.includes('视频') || t.includes('Seedance') || t.includes('Fast') || t.includes('Pro')) && !t.includes('参考');
            });
            if (modelTrigger && !modelTrigger.innerText.includes(model)) {
                console.log('['+taskId+'] Setting Model -> ' + model);
                simulateFullClick(modelTrigger); await new Promise(r => setTimeout(r, 1000));
                const modelXPath = "//*[contains(@class,'lv-select-popup')]//*[contains(text(), '" + model + "')] | //li[contains(., '" + model + "')]";
                await waitAndClickByXPath(modelXPath, 3000).catch(()=>{});
                await new Promise(r => setTimeout(r, 800));
            }
        }

        // 2. Mode (Now Second)
        const modeTrigger = Array.from(toolbarElements()).find(el => {
            const t = el.innerText;
            return (t.includes('参考') || t.includes('帧')) && !t.includes('视频') && !t.includes('Seedance');
        });
        
        if (modeTrigger) {
            console.log('['+taskId+'] Mode Sector Found:', modeTrigger.innerText.trim());
            // Force click if NOT '全能参考'
            if (!modeTrigger.innerText.includes('全能参考')) {
                console.log('['+taskId+'] Forcing switch to 全能参考');
                simulateFullClick(modeTrigger); await new Promise(r => setTimeout(r, 1000));
                // Double-Pass Option Target
                const modeXPath = "//*[contains(@class,'lv-select-popup')]//*[contains(text(), '全能参考')] | //li[contains(., '全能参考')]";
                await waitAndClickByXPath(modeXPath, 3000).catch(()=>{
                    console.error('['+taskId+'] Mode option click failed');
                });
                await new Promise(r => setTimeout(r, 1200)); 
            }
        }

        // 3. Ratio
        const ratioTrigger = document.querySelector('.toolbar-button-FhFnQ_');
        if (ratioTrigger && !ratioTrigger.innerText.includes(ratio)) {
            simulateFullClick(ratioTrigger); await new Promise(r => setTimeout(r, 1000));
            const ratioXPath = "//*[contains(@class,'lv-select-popup')]//*[contains(text(), '" + ratio + "')] | //li[contains(., '" + ratio + "')]";
            await waitAndClickByXPath(ratioXPath, 2000).catch(()=>{});
            await new Promise(r => setTimeout(r, 600));
        }

        // 4. Duration
        if (duration) {
            const durTrigger = Array.from(toolbarElements()).find(el => el.innerText.trim().match(/^\d+s$/));
            if (durTrigger && !durTrigger.innerText.includes(duration)) {
                simulateFullClick(durTrigger); await new Promise(r => setTimeout(r, 1000));
                const durXPath = "//*[contains(@class,'lv-select-popup')]//*[contains(text(), '" + duration + "')] | //li[contains(., '" + duration + "')]";
                await waitAndClickByXPath(durXPath, 2000).catch(()=>{});
                await new Promise(r => setTimeout(r, 600));
            }
        }

        // 5. Prompt (Hybrid Detection)
        const promptEl = document.querySelector('textarea.prompt-textarea-l5tJNE') || 
                       document.querySelector('.tiptap.ProseMirror') || 
                       document.querySelector('textarea');
        
        if (promptEl) { 
            console.log('[' + taskId + '] Injecting Prompt into:', promptEl.tagName, promptEl.className);
            await injectUniversalText(promptEl, prompt); 
        } else {
            console.error('[' + taskId + '] No prompt element found!');
        }

        // 6. Assets
        if (assets && assets.length > 0) {
            for (const asset of assets) {
                // Asset Blast
                try {
                    const b64 = asset.base64.includes('base64,') ? asset.base64.split('base64,')[1] : asset.base64;
                    const byteCharacters = atob(b64);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) { byteNumbers[i] = byteCharacters.charCodeAt(i); }
                    const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' });
                    const file = new File([blob], asset.name + '.png', { type: 'image/png' });
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    const target = document.querySelector('.reference-upload-h7tmnr') || document.body;
                    target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
                    target.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
                    await new Promise(r => setTimeout(r, 1200)); 
                } catch (e) { }
            }
        }

        // 7. FINAL EXECUTION
        await new Promise(r => setTimeout(r, 1000)); 
        const genBtn = document.querySelector('button.submit-button-KJTUYS') || document.querySelector('button[class*="submit"]');
        if (genBtn && !genBtn.disabled) {
            console.log('[' + taskId + '] Triggering Final Submission...');
            simulateFullClick(genBtn);
        }

        ipcRenderer.send('task-status-from-b', { taskId, status: 'completed', message: 'Ready' });
    } catch (e) {
        ipcRenderer.send('task-status-from-b', { taskId, status: 'error', message: e.message });
    }
});