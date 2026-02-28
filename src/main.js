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
