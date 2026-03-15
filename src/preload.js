const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    readGlobalSettings: () => ipcRenderer.invoke('read-global-settings'),
    saveGlobalSettings: (data) => ipcRenderer.invoke('save-global-settings', data),

    listProjects: () => ipcRenderer.invoke('list-projects'),
    createProject: (name, settings) => ipcRenderer.invoke('create-project', name, settings),
    deleteProject: (name) => ipcRenderer.invoke('delete-project', name),
    renameProject: (oldName, newName) => ipcRenderer.invoke('rename-project', oldName, newName),
    readProjectSettings: (name) => ipcRenderer.invoke('read-project-settings', name),
    saveProjectSettings: (name, settings) => ipcRenderer.invoke('save-project-settings', name, settings),

    readProjectAssets: (name) => ipcRenderer.invoke('read-project-assets', name),
    saveProjectAssets: (name, data) => ipcRenderer.invoke('save-project-assets', name, data),
    copyFileToProject: (projectName, sourceFilePath, targetFileName) => ipcRenderer.invoke('copy-file-to-project', projectName, sourceFilePath, targetFileName),
    writeAssetFile: (projectName, fileName, arrayBuffer) => ipcRenderer.invoke('write-asset-file', projectName, fileName, arrayBuffer),
    readAssetAsBase64: (projectName, fileName) => ipcRenderer.invoke('read-asset-as-base64', projectName, fileName),

    listEpisodes: (projectName) => ipcRenderer.invoke('list-episodes', projectName),
    createEpisode: (projectName, episodeName) => ipcRenderer.invoke('create-episode', projectName, episodeName),
    deleteEpisode: (projectName, episodeName) => ipcRenderer.invoke('delete-episode', projectName, episodeName),
    renameEpisode: (projectName, oldName, newName) => ipcRenderer.invoke('rename-episode', projectName, oldName, newName),
    readEpisodeData: (projectName, episodeName) => ipcRenderer.invoke('read-episode-data', projectName, episodeName),
    saveEpisodeData: (projectName, episodeName, data) => ipcRenderer.invoke('save-episode-data', projectName, episodeName, data),

    decomposeScript: (scriptText) => ipcRenderer.invoke('decompose-script', scriptText),

    // B Window Interactions
    sendTaskToB: (taskData) => ipcRenderer.send('send-task-to-b', taskData),
    onTaskUpdate: (callback) => ipcRenderer.on('task-update', (event, data) => callback(data))
});
