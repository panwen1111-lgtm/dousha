const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    readGlobalSettings: () => ipcRenderer.invoke('read-global-settings'),
    saveGlobalSettings: (data) => ipcRenderer.invoke('save-global-settings', data),

    listProjects: () => ipcRenderer.invoke('list-projects'),
    createProject: (name, settings) => ipcRenderer.invoke('create-project', name, settings),
    deleteProject: (name) => ipcRenderer.invoke('delete-project', name),
    renameProject: (oldName, newName) => ipcRenderer.invoke('rename-project', oldName, newName),
    readProjectSettings: (name) => ipcRenderer.invoke('read-project-settings', name),

    decomposeScript: (scriptText) => ipcRenderer.invoke('decompose-script', scriptText),

    // B Window Interactions
    sendTaskToB: (taskData) => ipcRenderer.send('send-task-to-b', taskData),
    onTaskUpdate: (callback) => ipcRenderer.on('task-update', (event, data) => callback(data))
});
