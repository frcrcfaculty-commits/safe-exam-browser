const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
}

let mainWindow = null;
let isExamActive = false;
const isDev = process.argv.includes('--dev');

// Server URL - configure for your environment
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';

// Device registration file
const userDataPath = app.getPath('userData');
const deviceFilePath = path.join(userDataPath, 'device.json');

function getDeviceId() {
    try {
        if (fs.existsSync(deviceFilePath)) {
            const data = JSON.parse(fs.readFileSync(deviceFilePath, 'utf8'));
            return data.deviceId;
        }
    } catch (e) {
        console.error('Error reading device file:', e);
    }
    return null;
}

function saveDeviceId(deviceId) {
    fs.writeFileSync(deviceFilePath, JSON.stringify({ deviceId }));
}

function createWindow() {
    const windowOptions = {
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: isDev,
            spellcheck: false
        }
    };

    // In exam mode, use kiosk settings
    if (isExamActive) {
        Object.assign(windowOptions, {
            fullscreen: true,
            frame: false,
            kiosk: true,
            alwaysOnTop: true,
            closable: false,
            minimizable: false,
            maximizable: false,
            resizable: false,
            skipTaskbar: true
        });
    }

    mainWindow = new BrowserWindow(windowOptions);

    // Load the renderer
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Block navigation
    mainWindow.webContents.on('will-navigate', (e, url) => {
        if (isExamActive && !url.startsWith('file://')) {
            e.preventDefault();
        }
    });

    // Block new windows
    mainWindow.webContents.setWindowOpenHandler(() => {
        return { action: 'deny' };
    });

    // Block keyboard shortcuts during exam
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (!isExamActive) return;

        const blockedKeys = ['F12', 'F5', 'F11', 'Escape'];
        const blockedCombos = [
            { ctrl: true, key: 'r' },
            { ctrl: true, key: 'u' },
            { ctrl: true, key: 'p' },
            { ctrl: true, key: 's' },
            { ctrl: true, key: 'n' },
            { ctrl: true, key: 't' },
            { ctrl: true, key: 'w' },
            { ctrl: true, shift: true, key: 'i' },
            { ctrl: true, shift: true, key: 'j' },
            { alt: true, key: 'F4' }
        ];

        if (blockedKeys.includes(input.key)) {
            event.preventDefault();
            mainWindow.webContents.send('blocked-shortcut', { key: input.key });
            return;
        }

        for (const combo of blockedCombos) {
            if ((combo.ctrl && !input.control) || (!combo.ctrl && input.control)) continue;
            if ((combo.shift && !input.shift) || (!combo.shift && input.shift)) continue;
            if ((combo.alt && !input.alt) || (!combo.alt && input.alt)) continue;
            if (combo.key.toLowerCase() === input.key.toLowerCase()) {
                event.preventDefault();
                mainWindow.webContents.send('blocked-shortcut', { key: `${input.control ? 'Ctrl+' : ''}${input.shift ? 'Shift+' : ''}${input.alt ? 'Alt+' : ''}${input.key}` });
                return;
            }
        }
    });

    // Open DevTools in development
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Block global shortcuts during exam
function registerGlobalShortcuts() {
    if (!isExamActive) return;

    const shortcuts = [
        'Alt+Tab', 'Alt+F4', 'CommandOrControl+Escape',
        'CommandOrControl+Shift+Escape', 'Super', 'PrintScreen'
    ];

    shortcuts.forEach(shortcut => {
        try {
            globalShortcut.register(shortcut, () => {
                console.log(`Blocked: ${shortcut}`);
                if (mainWindow) {
                    mainWindow.webContents.send('blocked-shortcut', { key: shortcut });
                }
            });
        } catch (e) {
            console.log(`Could not register ${shortcut}:`, e.message);
        }
    });
}

function unregisterGlobalShortcuts() {
    globalShortcut.unregisterAll();
}

// IPC Handlers
ipcMain.handle('get-server-url', () => SERVER_URL);
ipcMain.handle('get-device-id', () => getDeviceId());
ipcMain.handle('save-device-id', (event, deviceId) => {
    saveDeviceId(deviceId);
    return true;
});

ipcMain.handle('start-exam-mode', () => {
    isExamActive = true;
    registerGlobalShortcuts();

    // Recreate window in kiosk mode
    if (mainWindow) {
        mainWindow.setKiosk(true);
        mainWindow.setAlwaysOnTop(true);
        mainWindow.setClosable(false);
        mainWindow.setMinimizable(false);
        mainWindow.setFullScreen(true);
    }

    return true;
});

ipcMain.handle('end-exam-mode', () => {
    isExamActive = false;
    unregisterGlobalShortcuts();

    // Restore normal window
    if (mainWindow) {
        mainWindow.setKiosk(false);
        mainWindow.setAlwaysOnTop(false);
        mainWindow.setClosable(true);
        mainWindow.setMinimizable(true);
        mainWindow.setFullScreen(false);
    }

    return true;
});

ipcMain.handle('get-hostname', () => {
    const os = require('os');
    return os.hostname();
});

// App lifecycle
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('will-quit', () => {
    unregisterGlobalShortcuts();
});

// Prevent closing during exam
app.on('before-quit', (e) => {
    if (isExamActive) {
        e.preventDefault();
    }
});
