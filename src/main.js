const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const storage = require('./storage');

let windowA; // UI Controlling Window
let windowB; // The Target Silent/Visible Execution Window

function createWindowA() {
    windowA = new BrowserWindow({
        width: 1400,
        height: 900,
        title: '豆沙 - AI漫剧制作系统',
        backgroundColor: '#000000',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false // Necessary for loading local preview resources if needed
        }
    });

    windowA.loadFile(path.join(__dirname, 'index.html'));
    // windowA.webContents.openDevTools();
}

function createWindowB() {
    // Session state persists naturally with Electron Default Session, or we can use custom partition
    windowB = new BrowserWindow({
        width: 1280,
        height: 800,
        title: '即梦 - 底层业务挂载窗',
        show: true, // The user requested B window could be visible to scan QR code first
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload-b.js'),
            // Using standard session to cache the login cookies forever
            partition: 'persist:jimengSession'
        }
    });

    // We navigate to the target website directly
    windowB.loadURL('https://jimeng.jianying.com/ai-tool/generate/?type=video', {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    });
}

app.whenReady().then(() => {
    storage.initDirectories();
    createWindowA();
    createWindowB();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindowA();
            createWindowB();
        }
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// IPC Communications handlers
ipcMain.handle('read-global-settings', async () => {
    return storage.readGlobalSettings();
});

ipcMain.handle('save-global-settings', async (event, data) => {
    return storage.saveGlobalSettings(data);
});

// Setup project reading
ipcMain.handle('list-projects', async () => {
    return storage.listProjects();
});

ipcMain.handle('create-project', async (event, name, settings) => {
    return storage.createProject(name, settings);
});

ipcMain.handle('delete-project', async (event, name) => {
    return storage.deleteProject(name);
});

ipcMain.handle('rename-project', async (event, oldName, newName) => {
    return storage.renameProject(oldName, newName);
});

ipcMain.handle('read-project-settings', async (event, name) => {
    return storage.readProjectSettings(name);
});

ipcMain.handle('save-project-settings', async (event, name, settings) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const settingsPath = path.join(storage.projectsDir, name, 'project_settings.json');
        const existing = storage.readProjectSettings(name) || {};
        fs.writeFileSync(settingsPath, JSON.stringify(Object.assign(existing, settings), null, 2), 'utf8');
        return true;
    } catch(e) {
        console.error('save-project-settings error', e);
        return false;
    }
});

ipcMain.handle('read-project-assets', async (event, name) => {
    return storage.readProjectAssets(name);
});

ipcMain.handle('save-project-assets', async (event, name, data) => {
    return storage.saveProjectAssets(name, data);
});

ipcMain.handle('copy-file-to-project', async (event, projectName, sourceFilePath, targetFileName) => {
    try {
        return storage.copyFileToProject(projectName, sourceFilePath, targetFileName);
    } catch (e) {
        console.error("Copy file error", e);
        return null;
    }
});

// New handler: renderer passes raw bytes (ArrayBuffer) so we avoid path trust issues
ipcMain.handle('write-asset-file', async (event, projectName, fileName, arrayBuffer) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const targetDir = path.join(storage.projectsDir, projectName, 'assets_files');
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        const finalPath = path.join(targetDir, fileName);
        fs.writeFileSync(finalPath, Buffer.from(arrayBuffer));
        return `file://${finalPath.replace(/\\/g, '/')}`;
    } catch (e) {
        console.error('write-asset-file error', e);
        return null;
    }
});

ipcMain.handle('read-asset-as-base64', async (event, projectName, fileName) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(storage.projectsDir, projectName, 'assets_files', fileName);
        if (!fs.existsSync(filePath)) return null;
        const buffer = fs.readFileSync(filePath);
        return buffer.toString('base64');
    } catch (e) {
        console.error('read-asset-as-base64 error', e);
        return null;
    }
});

ipcMain.handle('list-episodes', async (event, projectName) => {
    return storage.listEpisodes(projectName);
});

ipcMain.handle('create-episode', async (event, projectName, episodeName) => {
    return storage.createEpisode(projectName, episodeName);
});

ipcMain.handle('delete-episode', async (event, projectName, episodeName) => {
    return storage.deleteEpisode(projectName, episodeName);
});

ipcMain.handle('rename-episode', async (event, projectName, oldName, newName) => {
    return storage.renameEpisode(projectName, oldName, newName);
});

ipcMain.handle('read-episode-data', async (event, projectName, episodeName) => {
    return storage.readEpisodeData(projectName, episodeName);
});

ipcMain.handle('save-episode-data', async (event, projectName, episodeName, data) => {
    return storage.saveEpisodeData(projectName, episodeName, data);
});

const aiService = require('./ai_service');

// Handle proxying commands to B Window
ipcMain.on('send-task-to-b', (event, taskData) => {
    if (windowB) {
        windowB.webContents.send('execute-task', taskData);
    }
});

// Handle AI Decompose
ipcMain.handle('decompose-script', async (event, scriptText) => {
    try {
        return { success: true, data: await aiService.decomposeScript(scriptText) };
    } catch (e) {
        return { success: false, error: e.message || e.toString() };
    }
});

// Handle messages FROM B Window back to A Window
ipcMain.on('task-status-from-b', (event, statusData) => {
    if (windowA) {
        windowA.webContents.send('task-update', statusData);
    }
});
