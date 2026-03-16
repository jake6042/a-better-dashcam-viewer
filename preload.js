const { contextBridge, ipcRenderer } = require('electron');

// Module-level callbacks — avoids returning functions through contextBridge,
// which is unreliable in Electron 28 and can cause exposeInMainWorld to fail.
let _ffmpegProgressCb = null;
let _triggerFileOpenCb = null;

ipcRenderer.on('ffmpeg-progress', (_event, percent) => {
    if (_ffmpegProgressCb) _ffmpegProgressCb(percent);
});

ipcRenderer.on('trigger-file-open', () => {
    if (_triggerFileOpenCb) _triggerFileOpenCb();
});

contextBridge.exposeInMainWorld('electronAPI', {
    checkFfmpeg: () =>
        ipcRenderer.invoke('check-ffmpeg'),

    setOriginalVideoPath: (filepath) =>
        ipcRenderer.invoke('set-original-video-path', filepath),

    getOriginalVideoPath: () =>
        ipcRenderer.invoke('get-original-video-path'),

    createTempDir: () =>
        ipcRenderer.invoke('create-temp-dir'),

    writeFrame: (filepath, buffer) =>
        ipcRenderer.invoke('write-frame', filepath, buffer),

    getSavePath: (filename) =>
        ipcRenderer.invoke('get-save-path', filename),

    cleanupTempDir: (tempDir) =>
        ipcRenderer.invoke('cleanup-temp-dir', tempDir),

    ffmpegOverlayComposite: (args) =>
        ipcRenderer.invoke('ffmpeg-overlay-composite', args),

    cancelFfmpeg: () =>
        ipcRenderer.invoke('cancel-ffmpeg'),

    openVideo: (videoPath) =>
        ipcRenderer.invoke('open-video', videoPath),

    openExternal: (url) =>
        ipcRenderer.invoke('open-external', url),

    onFfmpegProgress: (cb) => { _ffmpegProgressCb = cb; },
    offFfmpegProgress: () => { _ffmpegProgressCb = null; },

    onTriggerFileOpen: (cb) => { _triggerFileOpenCb = cb; },
    offTriggerFileOpen: () => { _triggerFileOpenCb = null; },
});
