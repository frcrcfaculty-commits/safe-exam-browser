const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
    // Server communication
    getServerUrl: () => ipcRenderer.invoke('get-server-url'),
    getDeviceId: () => ipcRenderer.invoke('get-device-id'),
    saveDeviceId: (deviceId) => ipcRenderer.invoke('save-device-id', deviceId),
    getHostname: () => ipcRenderer.invoke('get-hostname'),

    // Exam mode control
    startExamMode: () => ipcRenderer.invoke('start-exam-mode'),
    endExamMode: () => ipcRenderer.invoke('end-exam-mode'),

    // Event listeners
    onBlockedShortcut: (callback) => {
        ipcRenderer.on('blocked-shortcut', (event, data) => callback(data));
    }
});

// Disable clipboard operations when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    // Block copy/cut/paste
    document.addEventListener('copy', (e) => {
        if (window.__examActive) {
            e.preventDefault();
            window.__logEvent?.('clipboard_blocked', { action: 'copy' });
        }
    });

    document.addEventListener('cut', (e) => {
        if (window.__examActive) {
            e.preventDefault();
            window.__logEvent?.('clipboard_blocked', { action: 'cut' });
        }
    });

    document.addEventListener('paste', (e) => {
        if (window.__examActive) {
            e.preventDefault();
            window.__logEvent?.('clipboard_blocked', { action: 'paste' });
        }
    });

    // Block context menu
    document.addEventListener('contextmenu', (e) => {
        if (window.__examActive) {
            e.preventDefault();
            window.__logEvent?.('context_menu_blocked', {});
        }
    });

    // Block text selection during exam
    document.addEventListener('selectstart', (e) => {
        if (window.__examActive && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
        }
    });

    // Block drag
    document.addEventListener('dragstart', (e) => {
        if (window.__examActive) {
            e.preventDefault();
        }
    });
});
