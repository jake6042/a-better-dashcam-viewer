export class VideoPlayer {
    constructor(changePoints, config, ui, file) {
        this.changePoints = changePoints;
        this.config = config;
        this.ui = ui;
        this.file = file;

        this.videoElement = document.getElementById('videoPlayer');
        this.frameInfo = document.getElementById('frameInfo');
        
        this.animationFrameId = null;
        this.isPlaying = false;
        this.lastSyncTime = -1;
    }

    async init() {
        console.log('[PLAYER] Initializing with', this.changePoints.length, 'change points');
        
        await this.loadVideo();
        this.setupCustomControls();
        this.setupOverlaySync();
        this.positionOverlay();
        
        this.resizeHandler = () => this.positionOverlay();
        window.addEventListener('resize', this.resizeHandler);
        
        this.videoElement.addEventListener('loadedmetadata', () => this.positionOverlay());
        this.videoElement.addEventListener('loadeddata', () => this.positionOverlay());
        this.videoElement.addEventListener('canplay', () => this.positionOverlay());
        this.videoElement.addEventListener('canplaythrough', () => this.positionOverlay());
        
        const duration = this.videoElement.duration || 60;
        this.frameInfo.textContent = `Video loaded: ${this.changePoints.length} data points (~${Math.round(duration)} seconds)`;
        
        this.videoElement.classList.add('active');
        
        requestAnimationFrame(() => {
            this.positionOverlay();
            setTimeout(() => this.positionOverlay(), 50);
            setTimeout(() => this.positionOverlay(), 150);
            setTimeout(() => this.positionOverlay(), 300);
        });
        
        console.log('[PLAYER] Initialized');
    }

    setupCustomControls() {
        const controls = document.getElementById('customControls');
        const playPauseBtn = document.getElementById('playPauseBtn');
        const playIcon = document.getElementById('playIcon');
        const pauseIcon = document.getElementById('pauseIcon');
        const seekBar = document.getElementById('seekBar');
        const currentTimeEl = document.getElementById('currentTime');
        const durationEl = document.getElementById('duration');
        
        controls.classList.add('active');
        
        const formatTime = (seconds) => {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };
        
        const togglePlayPause = () => {
            if (this.videoElement.paused) {
                this.videoElement.play();
                playIcon.style.display = 'none';
                pauseIcon.style.display = 'block';
            } else {
                this.videoElement.pause();
                playIcon.style.display = 'block';
                pauseIcon.style.display = 'none';
            }
        };
        
        playPauseBtn.addEventListener('click', togglePlayPause);
        this.videoElement.addEventListener('click', togglePlayPause);
        
        this.videoElement.addEventListener('timeupdate', () => {
            if (!seekBar.dataset.seeking) {
                const percent = (this.videoElement.currentTime / this.videoElement.duration) * 100;
                seekBar.value = percent || 0;
                currentTimeEl.textContent = formatTime(this.videoElement.currentTime);
            }
        });
        
        const updateDuration = () => {
            if (this.videoElement.duration && !isNaN(this.videoElement.duration) && isFinite(this.videoElement.duration)) {
                durationEl.textContent = formatTime(this.videoElement.duration);
            }
        };
        
        this.videoElement.addEventListener('loadedmetadata', updateDuration);
        this.videoElement.addEventListener('durationchange', updateDuration);
        this.videoElement.addEventListener('canplay', updateDuration);
        updateDuration();
        
        seekBar.addEventListener('input', (e) => {
            seekBar.dataset.seeking = 'true';
            const time = (e.target.value / 100) * this.videoElement.duration;
            currentTimeEl.textContent = formatTime(time);
        });
        
        seekBar.addEventListener('change', (e) => {
            const time = (e.target.value / 100) * this.videoElement.duration;
            this.videoElement.currentTime = time;
            delete seekBar.dataset.seeking;
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && e.target === document.body) {
                e.preventDefault();
                playPauseBtn.click();
            }
        });
        
        this.videoElement.addEventListener('play', () => {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        });
        
        this.videoElement.addEventListener('pause', () => {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        });
    }

    getSeiAtTime(time) {
        if (!this.changePoints || this.changePoints.length === 0) return null;
        
        if (time < this.changePoints[0].timestamp) {
            return this.changePoints[0].sei;
        }
        
        if (time >= this.changePoints[this.changePoints.length - 1].timestamp) {
            return this.changePoints[this.changePoints.length - 1].sei;
        }
        
        let left = 0;
        let right = this.changePoints.length - 1;
        
        while (left < right - 1) {
            const mid = (left + right) >> 1;
            if (this.changePoints[mid].timestamp <= time) {
                left = mid;
            } else {
                right = mid;
            }
        }
        
        return this.changePoints[left].sei;
    }

    async loadVideo() {
        console.log('[PLAYER] Loading video into HTML5 element...');
        
        return new Promise((resolve, reject) => {
            this.videoURL = URL.createObjectURL(this.file);
            this.videoElement.src = this.videoURL;
            
            // Wait for video to be ready
            this.videoElement.addEventListener('canplay', () => {
                console.log('[PLAYER] Video ready to play');
                resolve();
            }, { once: true });
            
            this.videoElement.addEventListener('error', (e) => {
                console.error('[PLAYER] Video load error:', e);
                reject(new Error('Failed to load video'));
            }, { once: true });
            
            // Load the video
            this.videoElement.load();
        });
    }

    setupOverlaySync() {
        console.log('[PLAYER] Setting up overlay sync...');
        
        let lastUpdate = 0;
        
        const sync = () => {
            const now = performance.now();
            
            if (now - lastUpdate > 50) {
                const time = this.videoElement.currentTime;
                
                if (Math.abs(time - this.lastSyncTime) > 0.03) {
                    const sei = this.getSeiAtTime(time);
                    if (sei) {
                        this.ui.updateOverlay(sei);
                    }
                    this.lastSyncTime = time;
                }
                lastUpdate = now;
            }
            
            this.animationFrameId = requestAnimationFrame(sync);
        };
        
        sync();
        
        this.videoElement.addEventListener('seeked', () => {
            const sei = this.getSeiAtTime(this.videoElement.currentTime);
            if (sei) {
                this.ui.updateOverlay(sei);
            }
        });
        
        const firstSei = this.changePoints[0]?.sei;
        if (firstSei) {
            this.ui.updateOverlay(firstSei);
        }
    }

    positionOverlay() {
        const videoRect = this.videoElement.getBoundingClientRect();
        const overlay = document.getElementById('overlay');
        
        if (overlay && videoRect.width > 0 && videoRect.height > 0) {
            const videoWidth = this.videoElement.videoWidth;
            const videoHeight = this.videoElement.videoHeight;
            
            if (videoWidth === 0 || videoHeight === 0) {
                return;
            }
            
            const containerWidth = videoRect.width;
            const containerHeight = videoRect.height;
            const videoAspect = videoWidth / videoHeight;
            const containerAspect = containerWidth / containerHeight;
            
            let renderedWidth, renderedHeight, offsetX, offsetY;
            
            if (containerAspect > videoAspect) {
                renderedHeight = containerHeight;
                renderedWidth = renderedHeight * videoAspect;
                offsetX = (containerWidth - renderedWidth) / 2;
                offsetY = 0;
            } else {
                renderedWidth = containerWidth;
                renderedHeight = renderedWidth / videoAspect;
                offsetX = 0;
                offsetY = (containerHeight - renderedHeight) / 2;
            }
            
            const scaleX = renderedWidth / videoWidth;
            const scaleY = renderedHeight / videoHeight;
            const scale = Math.min(scaleX, scaleY);
            
            // Calculate UI scale factor based on video height (baseline: 1080p)
            // This ensures UI elements scale proportionally with video resolution
            const uiScaleFactor = videoHeight / 1080;
            
            overlay.style.width = `${videoWidth}px`;
            overlay.style.height = `${videoHeight}px`;
            overlay.style.left = `${videoRect.left + offsetX}px`;
            overlay.style.top = `${videoRect.top + offsetY}px`;
            overlay.style.position = 'fixed';
            overlay.style.transform = `scale(${scale})`;
            overlay.style.transformOrigin = 'top left';
            overlay.style.setProperty('--ui-scale', uiScaleFactor);
        }
    }

    cleanup() {
        console.log('[PLAYER] Cleaning up...');
        
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }
        
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        this.videoElement.pause();
        this.videoElement.src = '';
        if (this.videoURL) {
            URL.revokeObjectURL(this.videoURL);
            this.videoURL = null;
        }
        this.videoElement.classList.remove('active');
        
        this.changePoints = null;
        
        const overlay = document.getElementById('overlay');
        if (overlay) {
            overlay.style.width = '';
            overlay.style.height = '';
            overlay.style.left = '';
            overlay.style.top = '';
            overlay.style.position = 'absolute';
            overlay.style.transform = '';
            overlay.style.transformOrigin = '';
            overlay.style.removeProperty('--ui-scale');
        }
    }
}