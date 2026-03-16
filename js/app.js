import { UI } from './ui.js';
import { VideoPlayer } from './video-player.js';
import { VideoExporter } from './video-export-smart.js';

class DashcamApp {
    constructor() {
        this.mp4 = null;
        this.changePoints = null;
        this.allFrames = null;
        this.seiType = null;
        this.seiFieldsCsv = null;
        this.currentFileName = '';

        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.loading = document.getElementById('loading');
        this.exportCSVButton = document.getElementById('exportCSVButton');
        this.loadNewVideoButton = document.getElementById('loadNewVideoButton');

        this.ui = new UI();
        this.player = null;
        this.exporter = null;

        this.init();
    }

    async init() {
        await this.initProtobuf();
        this.checkFFmpegAvailability();
        this.setupEventListeners();
    }

    async initProtobuf() {
        try {
            if (typeof window.protobuf === 'undefined') {
                throw new Error('protobuf library not loaded');
            }
            
            const protoContent = `syntax = "proto3";

// SEI (Supplemental Enhancement Information) metadata embedded in Tesla dashcam video streams.
message SeiMetadata {
  uint32 version = 1;

  enum Gear {
    GEAR_PARK = 0;
    GEAR_DRIVE = 1;
    GEAR_REVERSE = 2;
    GEAR_NEUTRAL = 3;
  }
  Gear gear_state = 2;

  uint64 frame_seq_no = 3;
  float vehicle_speed_mps = 4;
  float accelerator_pedal_position = 5;
  float steering_wheel_angle = 6;
  bool blinker_on_left = 7;
  bool blinker_on_right = 8;
  bool brake_applied = 9;
  
  enum AutopilotState {
    NONE = 0;
    SELF_DRIVING = 1;
    AUTOSTEER = 2;
    TACC = 3;
  }
  AutopilotState autopilot_state = 10;
  double latitude_deg = 11;
  double longitude_deg = 12;
  double heading_deg = 13;
  double linear_acceleration_mps2_x = 14;
  double linear_acceleration_mps2_y = 15;
  double linear_acceleration_mps2_z = 16;
}`;
            
            const root = window.protobuf.parse(protoContent).root;
            const SeiMetadata = root.lookupType('SeiMetadata');
            const enumFields = {
                gearState: SeiMetadata.lookup('Gear'),
                autopilotState: SeiMetadata.lookup('AutopilotState'),
                gear_state: SeiMetadata.lookup('Gear'),
                autopilot_state: SeiMetadata.lookup('AutopilotState')
            };
            
            this.seiType = SeiMetadata;
            this.seiFieldsCsv = DashcamHelpers.deriveFieldInfo(SeiMetadata, enumFields, { useSnakeCase: true });
        } catch (err) {
            console.error('Failed to initialize protobuf:', err);
            alert('Failed to initialize protobuf: ' + err.message);
        }
    }

    async checkFFmpegAvailability() {
        const statusEl = document.getElementById('webCodecsStatus');
        
        try {
            if (typeof window.electronAPI !== 'undefined') {
                const ffmpegAvailable = await window.electronAPI.checkFfmpeg();
                
                if (ffmpegAvailable) {
                    console.log('FFmpeg available - export ready');
                    statusEl.style.display = 'none';
                } else {
                    console.warn('FFmpeg not available - export will be disabled');
                    statusEl.textContent = '⚠  FFmpeg not installed - export disabled';
                    statusEl.style.background = 'rgba(239, 68, 68, 0.15)';
                    statusEl.style.border = '1px solid rgba(239, 68, 68, 0.3)';
                    statusEl.style.color = '#ef4444';
                    statusEl.style.display = 'block';
                }
            } else {
                statusEl.textContent = '⚠  Please use the desktop application';
                statusEl.style.display = 'block';
            }
        } catch (err) {
            console.error('Error checking FFmpeg:', err);
        }
    }

    setupEventListeners() {
        this.dropZone.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.loadFile(e.target.files[0]);
            }
        });

        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('dragover');
        });

        document.addEventListener('dragleave', (e) => {
            if (!e.relatedTarget) {
                this.dropZone.classList.remove('dragover');
            }
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                this.loadFile(e.dataTransfer.files[0]);
            }
        });

        this.exportCSVButton.addEventListener('click', () => this.exportCSV());
        this.loadNewVideoButton.addEventListener('click', () => this.resetAndLoadNew());
    }

    detectMetadataChanges(frames, fps) {
        const changePoints = [];
        
        console.log('[APP] Analyzing', frames.length, 'frames for changes...');
        
        for (let i = 0; i < frames.length; i++) {
            const sei = frames[i].sei;
            if (!sei) continue;
            
            const timestamp = i / fps;
            
            if (changePoints.length === 0) {
                console.log('[CHANGE] First frame at', timestamp.toFixed(2) + 's');
                changePoints.push({
                    frameIndex: i,
                    timestamp: timestamp,
                    sei: sei
                });
                continue;
            }
            
            const prevSei = changePoints[changePoints.length - 1].sei;
            
            if (this.hasSignificantChange(prevSei, sei)) {
                changePoints.push({
                    frameIndex: i,
                    timestamp: timestamp,
                    sei: sei
                });
            }
        }
        
        const lastFrame = frames[frames.length - 1];
        if (lastFrame.sei && changePoints.length > 0) {
            const lastTimestamp = (frames.length - 1) / fps;
            const lastChange = changePoints[changePoints.length - 1];
            if (Math.abs(lastChange.timestamp - lastTimestamp) > 0.1) {
                console.log('[CHANGE] Last frame at', lastTimestamp.toFixed(2) + 's');
                changePoints.push({
                    frameIndex: frames.length - 1,
                    timestamp: lastTimestamp,
                    sei: lastFrame.sei
                });
            }
        }
        
        console.log('[APP] Storing', changePoints.length, 'change points instead of', frames.length, 'frames');
        return changePoints;
    }
    
    hasSignificantChange(sei1, sei2) {
        if (!sei1 || !sei2) return true;
        
        const speed1 = this.ui.convertSpeed(sei1.vehicleSpeedMps || 0);
        const speed2 = this.ui.convertSpeed(sei2.vehicleSpeedMps || 0);
        if (Math.abs(speed1 - speed2) >= 1) return true;
        
        const gear1 = sei1.gearState !== undefined ? sei1.gearState : 1;
        const gear2 = sei2.gearState !== undefined ? sei2.gearState : 1;
        if (gear1 !== gear2) return true;
        
        if ((sei1.autopilotState || 0) !== (sei2.autopilotState || 0)) return true;
        
        if (sei1.blinkerOnLeft !== sei2.blinkerOnLeft) return true;
        if (sei1.blinkerOnRight !== sei2.blinkerOnRight) return true;
        
        if (Math.abs((sei1.latitudeDeg || 0) - (sei2.latitudeDeg || 0)) >= 0.001) return true;
        if (Math.abs((sei1.longitudeDeg || 0) - (sei2.longitudeDeg || 0)) >= 0.001) return true;
        
        return false;
    }

    async loadFile(file) {
        if (!file.name.toLowerCase().endsWith('.mp4')) {
            this.ui.showStatus('Please select an MP4 file', 'error');
            return;
        }

        if (!this.seiType) {
            this.ui.showStatus('Protobuf not initialized. Please refresh the page.', 'error');
            return;
        }

        this.currentFileName = file.name.replace(/\.mp4$/i, '');
        this.loading.classList.remove('hidden');
        this.dropZone.classList.add('hidden');
        this.ui.hideOverlay();

        const loadingText = document.getElementById('loadingText');
        const loadingDetail = document.getElementById('loadingDetail');

        try {
            if (file.path && typeof window.electronAPI !== 'undefined') {
                await window.electronAPI.setOriginalVideoPath(file.path);
            }

            loadingText.textContent = 'Reading file...';
            loadingDetail.textContent = (file.size / 1048576).toFixed(1) + ' MB';
            const buffer = await file.arrayBuffer();
            
            loadingText.textContent = 'Parsing MP4 structure...';
            loadingDetail.textContent = '';
            this.mp4 = new DashcamMP4(buffer);
            
            loadingText.textContent = 'Extracting metadata...';
            loadingDetail.textContent = 'This may take a few seconds';
            const allFrames = this.mp4.parseFrames(this.seiType);

            if (allFrames.length === 0) {
                throw new Error('No frames found in video');
            }
            
            let withSei = 0;
            for (let i = 0; i < allFrames.length; i++) {
                if (allFrames[i].sei) withSei++;
            }
            
            if (!withSei) {
                throw new Error('No telemetry found. Need Tesla HW3+ with 2025.44.25+');
            }

            loadingText.textContent = 'Optimizing memory...';
            loadingDetail.textContent = allFrames.length + ' frames analyzed';
            
            const config = this.mp4.getConfig();
            const avgFrameDurationMs = config.durations.reduce((a, b) => a + b, 0) / config.durations.length;
            const fps = 1000 / avgFrameDurationMs;
            
            this.changePoints = this.detectMetadataChanges(allFrames, fps);
            this.allFrames = allFrames;

            loadingText.textContent = 'Loading video player...';
            loadingDetail.textContent = this.changePoints.length + ' data points';

            this.player = new VideoPlayer(this.changePoints, config, this.ui, file);
            await this.player.init();

            loadingText.textContent = 'Initializing export...';
            loadingDetail.textContent = '';
            this.exporter = new VideoExporter(
                this.mp4, 
                this.changePoints,
                config, 
                this.currentFileName,
                this.ui
            );
            this.exporter.init();

            this.exportCSVButton.disabled = false;
            this.loadNewVideoButton.disabled = false;
            this.ui.showOverlay();

            this.ui.showStatus('Video loaded successfully', 'success');
        } catch (err) {
            console.error('Error loading file:', err);
            this.ui.showStatus('Error loading video: ' + err.message, 'error');
            this.resetUI();
        } finally {
            this.loading.classList.add('hidden');
        }
    }

    exportCSV() {
        if (!this.allFrames || !this.seiFieldsCsv) return;

        const messages = this.allFrames.map(f => f.sei).filter(Boolean);
        if (messages.length === 0) {
            this.ui.showStatus('No metadata found to export', 'error');
            return;
        }

        const csv = DashcamHelpers.buildCsv(messages, this.seiFieldsCsv);
        const blob = new Blob([csv], { type: 'text/csv' });
        this.downloadBlob(blob, `${this.currentFileName}_metadata.csv`);
        this.ui.showStatus('CSV exported successfully', 'success');
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }

    resetUI() {
        this.dropZone.classList.remove('hidden');
        this.ui.hideOverlay();
        this.exportCSVButton.disabled = true;
        this.loadNewVideoButton.disabled = true;
        
        if (this.player) {
            this.player.cleanup();
            this.player = null;
        }

        if (this.exporter) {
            this.exporter.cleanup();
            this.exporter = null;
        }

        this.changePoints = null;
        this.allFrames = null;
        this.mp4 = null;
        this.currentFileName = '';
    }
    
    resetAndLoadNew() {
        window.location.reload();
    }
}

window.addEventListener('load', () => {
    new DashcamApp();
});