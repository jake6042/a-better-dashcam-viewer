const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { spawn } = require('child_process');

let ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

if (ffmpegPath.includes('app.asar')) {
    ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
}

console.log('[FFMPEG] Path:', ffmpegPath);

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1600,
        height: 1000,
        minWidth: 1200,
        minHeight: 700,
        backgroundColor: '#000000',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: true
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
        show: false
    });

    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open Video...',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => {
                        mainWindow.webContents.send('trigger-file-open');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Exit',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'About A Better Dashcam Viewer',
                            message: 'A Better Dashcam Viewer v1.0.0',
                            detail: 'Desktop application for viewing and exporting Tesla dashcam footage with overlay.\n\nBuilt using Tesla open-source utilities.',
                            buttons: ['OK']
                        });
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

ipcMain.handle('check-ffmpeg', async () => {
    try {
        const fsSync = require('fs');
        if (!fsSync.existsSync(ffmpegPath)) {
            console.error('[FFMPEG] Not found at:', ffmpegPath);
            return false;
        }
        console.log('[FFMPEG] Found at:', ffmpegPath);
        return true;
    } catch (err) {
        console.error('[FFMPEG] Check failed:', err);
        return false;
    }
});

ipcMain.handle('create-temp-dir', async () => {
    const tempDir = path.join(os.tmpdir(), `dashcam-export-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
});

ipcMain.handle('write-frame', async (event, framePath, buffer) => {
    await fs.writeFile(framePath, buffer);
});

ipcMain.handle('get-save-path', async (event, defaultName) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Video',
        defaultPath: defaultName,
        filters: [{ name: 'MP4 Video', extensions: ['mp4'] }]
    });
    return result.canceled ? null : result.filePath;
});

ipcMain.handle('cleanup-temp-dir', async (event, tempDir) => {
    try {
        await fs.rm(tempDir, { recursive: true, force: true });
    } catch (err) {
        console.error('Cleanup failed:', err);
    }
});

let originalVideoPath = null;
let currentFfmpegProcess = null;
let ffmpegCancelledByUser = false;

ipcMain.handle('set-original-video-path', async (event, filepath) => {
    originalVideoPath = filepath;
});

ipcMain.handle('get-original-video-path', async () => {
    return originalVideoPath;
});

ipcMain.handle('ffmpeg-overlay-composite', async (event, { inputVideo, overlayDir, changePoints, outputPath, width, height }) => {
    return new Promise((resolve, reject) => {
        console.log(`[FFMPEG] Smart overlay: ${changePoints.length} overlay images`);
        console.log(`[FFMPEG] Original video: ${inputVideo}`);
        console.log(`[FFMPEG] Output: ${outputPath}`);

        const ffmpegArgs = [
            '-i', inputVideo
        ];

        for (const change of changePoints) {
            const overlayPath = path.join(overlayDir, change.overlayFile);
            ffmpegArgs.push('-i', overlayPath);
        }

        let filterComplex = `[0:v]scale=${width}:${height}[scaled]`;
        let currentInput = 'scaled';
        
        for (let i = 0; i < changePoints.length; i++) {
            filterComplex += ';';
            
            const change = changePoints[i];
            const nextChange = changePoints[i + 1];
            
            const startTime = change.timestamp;
            const endTime = nextChange ? nextChange.timestamp : 999999;
            
            const overlayInput = `${i + 1}:v`;
            const outputLabel = i === changePoints.length - 1 ? 'out' : `v${i + 1}`;
            
            filterComplex += `[${currentInput}][${overlayInput}]overlay=0:0:enable='between(t,${startTime},${endTime})'[${outputLabel}]`;
            
            if (i < changePoints.length - 1) {
                currentInput = `v${i + 1}`;
            }
        }

        ffmpegArgs.push(
            '-filter_complex', filterComplex,
            '-map', '[out]',
            '-c:v', 'libx264',
            '-preset', 'medium',
            '-crf', '23',
            '-pix_fmt', 'yuv420p',
            '-y',
            outputPath
        );

        console.log('[FFMPEG] Command:', ffmpegPath, ffmpegArgs.join(' '));

        ffmpegCancelledByUser = false;
        const ffmpeg = spawn(ffmpegPath, ffmpegArgs);
        currentFfmpegProcess = ffmpeg;
        let stderr = '';
        let totalDuration = null;
        
        ffmpeg.stderr.on('data', (data) => {
            const chunk = data.toString();
            stderr += chunk;
            
            if (!totalDuration) {
                const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
                if (durationMatch) {
                    const hours = parseInt(durationMatch[1]);
                    const minutes = parseInt(durationMatch[2]);
                    const seconds = parseFloat(durationMatch[3]);
                    totalDuration = hours * 3600 + minutes * 60 + seconds;
                    console.log(`[FFMPEG] Detected video duration: ${totalDuration.toFixed(2)}s`);
                }
            }
            
            if (totalDuration) {
                let timeMatch = chunk.match(/time=\s*(\d+):(\d+):(\d+\.\d+)/);
                let currentTime = 0;
                
                if (timeMatch) {
                    const hours = parseInt(timeMatch[1]);
                    const minutes = parseInt(timeMatch[2]);
                    const seconds = parseFloat(timeMatch[3]);
                    currentTime = hours * 3600 + minutes * 60 + seconds;
                } else {
                    timeMatch = chunk.match(/time=\s*(\d+\.\d+)/);
                    if (timeMatch) {
                        currentTime = parseFloat(timeMatch[1]);
                    }
                }
                
                if (currentTime > 0) {
                    const percent = Math.min((currentTime / totalDuration) * 100, 100);
                    console.log(`[FFMPEG] Progress: ${currentTime.toFixed(1)}s / ${totalDuration.toFixed(1)}s (${percent.toFixed(1)}%)`);
                    if (!event.sender.isDestroyed()) {
                        event.sender.send('ffmpeg-progress', percent);
                    }
                }
            }
        });
        
        ffmpeg.on('close', (code) => {
            currentFfmpegProcess = null;
            if (code === 0) {
                console.log('[FFMPEG] Success!');
                resolve({ cancelled: false });
            } else if (ffmpegCancelledByUser) {
                console.log('[FFMPEG] Cancelled by user.');
                ffmpegCancelledByUser = false;
                resolve({ cancelled: true });
            } else {
                console.error('[FFMPEG] Failed with code:', code);
                console.error('[FFMPEG] stderr:', stderr);
                reject(new Error(`FFmpeg exited with code ${code}`));
            }
        });

        ffmpeg.on('error', (err) => {
            currentFfmpegProcess = null;
            console.error('[FFMPEG] Spawn error:', err);
            if (err.code === 'ENOENT') {
                reject(new Error(`FFmpeg not found at: ${ffmpegPath}\n\nThis usually means the app wasn't built correctly. Try rebuilding with: npm run build`));
            } else {
                reject(err);
            }
        });
    });
});

ipcMain.handle('cancel-ffmpeg', () => {
    if (currentFfmpegProcess) {
        ffmpegCancelledByUser = true;
        currentFfmpegProcess.kill();
    }
});

ipcMain.handle('open-video', async (event, videoPath) => {
    await shell.openPath(videoPath);
});

ipcMain.handle('open-external', async (event, url) => {
    await shell.openExternal(url);
});

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});