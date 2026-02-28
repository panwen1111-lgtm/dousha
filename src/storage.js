const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const dataDir = path.join(rootDir, 'data');
const projectsDir = path.join(dataDir, 'projects');
const globalSettingsFile = path.join(dataDir, 'global_settings.json');

const DEFAULT_GLOBAL_SETTINGS = {
    apiKey: '',
    apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', // Default gemini proxy/api endpoint if any
    masterPrompt: `请将以下提供的剧本文字拆解成逐个连续的镜头画面，每个画面必须详细描述视觉场景。
返回格式必须是合法的 JSON 数组，例如：
[
  {"prompt": "外景，阴天，一个穿着黑色风衣的男人孤独地站在废弃的站台上，长镜头。"},
  {"prompt": "特写，男人手里的怀表，表针停在12点。"}
]
只返回JSON数组，不要输出Markdown包装语或多余文本。`,
};

function initDirectories() {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(projectsDir)) {
        fs.mkdirSync(projectsDir, { recursive: true });
    }
    if (!fs.existsSync(globalSettingsFile)) {
        fs.writeFileSync(globalSettingsFile, JSON.stringify(DEFAULT_GLOBAL_SETTINGS, null, 2), 'utf8');
    }
}

function readGlobalSettings() {
    try {
        const data = fs.readFileSync(globalSettingsFile, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return DEFAULT_GLOBAL_SETTINGS;
    }
}

function saveGlobalSettings(data) {
    fs.writeFileSync(globalSettingsFile, JSON.stringify(data, null, 2), 'utf8');
    return true;
}

function listProjects() {
    try {
        const dirs = fs.readdirSync(projectsDir, { withFileTypes: true });
        const projects = [];
        for (const dirent of dirs) {
            if (dirent.isDirectory()) {
                const settings = readProjectSettings(dirent.name);
                projects.push({
                    name: dirent.name,
                    createdAt: settings ? settings.createdAt : null
                });
            }
        }
        // 按创建时间倒序
        projects.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return projects;
    } catch (e) {
        return [];
    }
}

function createProject(name, settings) {
    const projPath = path.join(projectsDir, name);
    if (!fs.existsSync(projPath)) {
        fs.mkdirSync(projPath, { recursive: true });
        // Set default project settings
        const defaultSettings = settings || {
            ratio: '16:9',
            model: 'Seedance 2.0 Fast',
            duration: '4s',
            createdAt: Date.now()
        };
        fs.writeFileSync(path.join(projPath, 'project_settings.json'), JSON.stringify(defaultSettings, null, 2), 'utf8');
        return true;
    }
    return false;
}

function deleteProject(name) {
    const projPath = path.join(projectsDir, name);
    if (fs.existsSync(projPath)) {
        fs.rmSync(projPath, { recursive: true, force: true });
        return true;
    }
    return false;
}

function renameProject(oldName, newName) {
    const oldPath = path.join(projectsDir, oldName);
    const newPath = path.join(projectsDir, newName);
    if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
        fs.renameSync(oldPath, newPath);
        return true;
    }
    return false;
}

function readProjectSettings(name) {
    const projPath = path.join(projectsDir, name);
    const settingsPath = path.join(projPath, 'project_settings.json');
    try {
        if (fs.existsSync(settingsPath)) {
            return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        }
    } catch (e) { }
    return null;
}


module.exports = {
    initDirectories,
    readGlobalSettings,
    saveGlobalSettings,
    listProjects,
    createProject,
    deleteProject,
    renameProject,
    readProjectSettings,
    projectsDir
};
