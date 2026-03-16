export class VideoExporter {
    constructor(mp4, changePoints, config, filename, ui) {
        this.mp4 = mp4;
        this.changePoints = changePoints;
        this.config = config;
        this.filename = filename;
        this.ui = ui;

        this.exportCancelled = false;
        this.exportInProgress = false;

        this.exportModal = document.getElementById('exportModal');
        this.progressBar = document.getElementById('progressBar');
        this.progressText = document.getElementById('progressText');
        this.progressDetail = document.getElementById('progressDetail');
        this.cancelButton = document.getElementById('cancelButton');
    }

    init() {
        this.exportVideoFastButton = document.getElementById('exportVideoFastButton');
        this.exportVideoFastButton.disabled = false;
        this.exportVideoFastButton.addEventListener('click', () => this.startVideoExport());
        this.cancelButton.addEventListener('click', () => this.cancelExport());
    }

    async startVideoExport() {
        if (!this.changePoints || !this.mp4) return;

        if (this.exportInProgress) {
            console.warn('[EXPORT] Already in progress');
            return;
        }

        this.exportCancelled = false;
        this.exportInProgress = true;
        this.showModal();
        this.updateProgress(0, 'Preparing export...', 'Using change points');

        try {
            const ffmpegAvailable = await window.electronAPI.checkFfmpeg();
            
            if (!ffmpegAvailable) {
                throw new Error('FFmpeg not available.');
            }

            await this.exportWithSmartOverlay();

        } catch (err) {
            console.error('Export error:', err);
            this.exportInProgress = false;
            this.hideModal();
            this.ui.showStatus('Export failed: ' + err.message, 'error');
        }
    }

    async exportWithSmartOverlay() {
        // keep aspect ratio at 1080p
        const sourceWidth = this.config.width;
        const sourceHeight = this.config.height;
        const targetHeight = 1080;
        const outputWidth = Math.round((sourceWidth / sourceHeight) * targetHeight);
        const outputHeight = targetHeight;
        
        console.log(`[EXPORT] Export: ${outputWidth}x${outputHeight} (from ${sourceWidth}x${sourceHeight})`);
        console.log(`[EXPORT] Using ${this.changePoints.length} change points`);

        if (this.changePoints.length === 0) {
            throw new Error('No metadata found in video');
        }

        const tempDir = await window.electronAPI.createTempDir();

        try {
            this.updateProgress(10, 'Rendering overlays...', `${this.changePoints.length} images to create`);
            
            for (let i = 0; i < this.changePoints.length; i++) {
                if (this.exportCancelled) {
                    await window.electronAPI.cleanupTempDir(tempDir);
                    this.exportInProgress = false;
                    this.hideModal();
                    return;
                }

                const change = this.changePoints[i];
                await this.renderOverlayImage(change, outputWidth, outputHeight, tempDir);

                const progress = 10 + Math.round((i / this.changePoints.length) * 30);
                this.updateProgress(progress, `Rendered: ${i + 1}/${this.changePoints.length}`, `At ${change.timestamp.toFixed(1)}s`);
            }

            const outputPath = await window.electronAPI.getSavePath(`${this.filename}_with_overlay.mp4`);
            
            if (!outputPath) {
                await window.electronAPI.cleanupTempDir(tempDir);
                this.exportInProgress = false;
                this.hideModal();
                return;
            }

            this.updateProgress(45, 'Compositing with FFmpeg...', 'This is the fast part!');

            const originalVideoPath = await window.electronAPI.getOriginalVideoPath();

            window.electronAPI.onFfmpegProgress((percent) => {
                const progress = 45 + Math.round(percent * 0.5);
                this.updateProgress(progress, `Encoding: ${Math.round(percent)}%`, 'Combining overlays with video');
            });

            let result;
            try {
                result = await window.electronAPI.ffmpegOverlayComposite({
                    inputVideo: originalVideoPath,
                    overlayDir: tempDir,
                    changePoints: this.changePoints,
                    outputPath: outputPath,
                    width: outputWidth,
                    height: outputHeight
                });
            } finally {
                window.electronAPI.offFfmpegProgress();
            }

            if (result?.cancelled) {
                await window.electronAPI.cleanupTempDir(tempDir);
                this.exportInProgress = false;
                return;
            }

            this.updateProgress(95, 'Cleaning up...', 'Almost done');
            await window.electronAPI.cleanupTempDir(tempDir);

            this.updateProgress(100, '✓ Export Complete!', '');
            this.exportInProgress = false;
            this.showViewVideoButton(outputPath);

        } catch (err) {
            await window.electronAPI.cleanupTempDir(tempDir);
            throw err;
        }
    }

    async renderOverlayImage(changePoint, width, height, tempDir) {
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d', { alpha: true });

        ctx.clearRect(0, 0, width, height);

        const blinkState = true;
        this.ui.drawOverlayWithBlink(ctx, changePoint.sei, width, height, blinkState);

        const blob = await canvas.convertToBlob({ type: 'image/png' });
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        const filename = `overlay_${changePoint.timestamp.toFixed(3).replace('.', '_')}.png`;
        const filepath = `${tempDir}/${filename}`;
        await window.electronAPI.writeFrame(filepath, buffer);
        
        changePoint.overlayFile = filename;
    }

    showViewVideoButton(outputPath) {
        this.updateProgress(100, '✓ Export Complete!', '');
        
        this.cancelButton.textContent = 'View Video';
        this.cancelButton.classList.remove('secondary');
        this.cancelButton.classList.add('success');
        this.cancelButton.disabled = false;
        
        this.cancelButton.onclick = async () => {
            await window.electronAPI.openVideo(outputPath);
            this.hideModal();
        };
    }

    cancelExport() {
        if (!this.exportInProgress) return;
        this.exportCancelled = true;
        this.exportInProgress = false;
        window.electronAPI?.cancelFfmpeg();
        this.hideModal();
        this.ui.showStatus('Export cancelled', 'error');
    }

    showModal() {
        this.exportModal.classList.add('active');
        this.cancelButton.disabled = false;
    }

    hideModal() {
        this.exportModal.classList.remove('active');
        // reset for next export
        this.cancelButton.textContent = 'Cancel';
        this.cancelButton.classList.remove('success');
        this.cancelButton.classList.add('secondary');
        this.cancelButton.onclick = null;
    }

    updateProgress(percent, text, detail) {
        this.progressBar.style.width = percent + '%';
        this.progressText.textContent = text;
        this.progressDetail.textContent = detail;
    }

    cleanup() {
        this.exportVideoFastButton.disabled = true;
    }
}