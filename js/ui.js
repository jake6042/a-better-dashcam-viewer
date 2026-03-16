export class UI {
    constructor() {
        // Overlay elements
        this.overlay = document.getElementById('overlay');
        this.gearDisplay = document.getElementById('gearDisplay');
        this.speedDisplay = document.getElementById('speedDisplay');
        this.speedValue = document.getElementById('speedValue');
        this.speedUnitElement = document.getElementById('speedUnit');
        this.autopilotStatus = document.getElementById('autopilotStatus');
        this.autopilotText = document.getElementById('autopilotText');
        this.blinkerLeft = document.getElementById('blinkerLeft');
        this.blinkerRight = document.getElementById('blinkerRight');
        this.gpsDisplay = document.getElementById('gpsDisplay');
        this.locationText = document.getElementById('locationText');
        this.statusMessage = document.getElementById('statusMessage');
        this.statusText = document.getElementById('statusText');
        this.overlayToggles = document.getElementById('overlayToggles');
        this.toggleGear = document.getElementById('toggleGear');
        this.toggleSpeed = document.getElementById('toggleSpeed');
        this.toggleAutopilot = document.getElementById('toggleAutopilot');
        this.toggleBlinkers = document.getElementById('toggleBlinkers');
        this.toggleLocation = document.getElementById('toggleLocation');
        this.speedUnitMPH = document.getElementById('speedUnitMPH');
        this.speedUnitKPH = document.getElementById('speedUnitKPH');

        this.overlayVisibility = {
            gear: true,
            speed: true,
            autopilot: true,
            blinkers: true,
            location: true
        };
        
        this.speedUnit = 'mph';
        this.lastSei = null;
        this.setupToggleListeners();
        this.updateCapsuleBorders();
    }

    setupToggleListeners() {
        const infoCapsule = document.getElementById('infoCapsule');
        
        this.toggleGear.addEventListener('change', (e) => {
            this.overlayVisibility.gear = e.target.checked;
            this.gearDisplay.style.display = e.target.checked ? 'flex' : 'none';
            this.updateCapsuleBorders();
        });

        this.toggleSpeed.addEventListener('change', (e) => {
            this.overlayVisibility.speed = e.target.checked;
            this.speedDisplay.style.display = e.target.checked ? 'flex' : 'none';
            this.updateCapsuleBorders();
        });

        this.toggleAutopilot.addEventListener('change', (e) => {
            this.overlayVisibility.autopilot = e.target.checked;
            this.autopilotStatus.style.display = e.target.checked ? 'block' : 'none';
            this.updateCapsuleBorders();
        });

        this.toggleBlinkers.addEventListener('change', (e) => {
            this.overlayVisibility.blinkers = e.target.checked;
        });

        this.toggleLocation.addEventListener('change', (e) => {
            this.overlayVisibility.location = e.target.checked;
            this.gpsDisplay.style.display = e.target.checked ? 'flex' : 'none';
        });
        
        this.speedUnitMPH.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.speedUnit = 'mph';
                this.speedUnitElement.textContent = 'mph';
                if (this.lastSei) this.updateOverlay(this.lastSei);
            }
        });
        
        this.speedUnitKPH.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.speedUnit = 'kph';
                this.speedUnitElement.textContent = 'km/h';
                if (this.lastSei) this.updateOverlay(this.lastSei);
            }
        });
    }
    
    updateCapsuleBorders() {
        const infoCapsule = document.getElementById('infoCapsule');
        if (!infoCapsule) return;
        
        infoCapsule.classList.remove('has-gear', 'has-speed', 'has-autopilot');
        
        if (this.overlayVisibility.gear) infoCapsule.classList.add('has-gear');
        if (this.overlayVisibility.speed) infoCapsule.classList.add('has-speed');
        if (this.overlayVisibility.autopilot) infoCapsule.classList.add('has-autopilot');
    }
    
    convertSpeed(mps) {
        if (this.speedUnit === 'kph') {
            return Math.round(mps * 3.6);
        }
        return Math.round(mps * 2.237);
    }
    
    getSpeedUnitLabel() {
        return this.speedUnit === 'kph' ? 'km/h' : 'mph';
    }

    updateOverlay(sei) {
        this.lastSei = sei;
        if (!sei) {
            this.speedValue.textContent = '0';
            this.autopilotStatus.classList.remove('fsd', 'autosteer', 'tacc');
            this.autopilotText.textContent = 'MANUAL';
            this.blinkerLeft.classList.remove('active');
            this.blinkerRight.classList.remove('active');
            this.locationText.textContent = '--';
            document.querySelectorAll('.gear').forEach(g => g.classList.remove('active'));
            return;
        }

        const gearState = sei.gearState !== undefined ? sei.gearState : 1;
        document.querySelectorAll('.gear').forEach(gear => {
            const gearValue = parseInt(gear.getAttribute('data-gear'));
            if (gearState === gearValue) {
                gear.classList.add('active');
            } else {
                gear.classList.remove('active');
            }
        });

        const speed = this.convertSpeed(sei.vehicleSpeedMps || 0);
        this.speedValue.textContent = speed;

        this.autopilotStatus.classList.remove('fsd', 'autosteer', 'tacc');
        
        const apState = sei.autopilotState || 0;
        if (apState === 0) {
            this.autopilotText.textContent = 'MANUAL';
        } else {
            const apNames = ['', 'FSD', 'AUTOSTEER', 'TACC'];
            const apText = apNames[apState] || 'ACTIVE';
            this.autopilotText.textContent = apText;
            
            if (apState === 1) {
                this.autopilotStatus.classList.add('fsd');
            } else if (apState === 2) {
                this.autopilotStatus.classList.add('autosteer');
            } else if (apState === 3) {
                this.autopilotStatus.classList.add('tacc');
            }
        }

        if (sei.blinkerOnLeft && this.overlayVisibility.blinkers) {
            this.blinkerLeft.classList.add('active');
        } else {
            this.blinkerLeft.classList.remove('active');
        }

        if (sei.blinkerOnRight && this.overlayVisibility.blinkers) {
            this.blinkerRight.classList.add('active');
        } else {
            this.blinkerRight.classList.remove('active');
        }

        if (sei.latitudeDeg !== 0 || sei.longitudeDeg !== 0) {
            this.locationText.textContent = `${sei.latitudeDeg.toFixed(4)}°, ${sei.longitudeDeg.toFixed(4)}°`;
        } else {
            this.locationText.textContent = '--';
        }
    }

    drawOverlayWithBlink(ctx, sei, width, height, blinkState) {
        const padding = 24 * (height / 1080);
        
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.textBaseline = 'middle';
        
        const centerY = padding + 50 * (height / 1080);
        
        const capsuleScale = height / 1080;
        const gearLetters = ['P', 'R', 'N', 'D'];
        const gearValues = [0, 2, 3, 1];
        const gearState = sei?.gearState !== undefined ? sei.gearState : 1;
        
        ctx.font = `400 ${18 * capsuleScale}px -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif`;
        
        let actualGearWidth = 0;
        const letterSpacing = 10 * capsuleScale;
        for (let i = 0; i < gearLetters.length; i++) {
            actualGearWidth += ctx.measureText(gearLetters[i]).width;
            if (i < gearLetters.length - 1) {
                actualGearWidth += letterSpacing;
            }
        }
        const gearWidth = actualGearWidth;
        const gearDividerGap = 40 * capsuleScale;
        
        const speedValue = this.convertSpeed(sei?.vehicleSpeedMps || 0);
        ctx.font = `200 ${56 * capsuleScale}px -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif`;
        const speedTextWidth = ctx.measureText(speedValue.toString()).width;
        const speedWidth = Math.max(speedTextWidth + 40 * capsuleScale, 120 * capsuleScale);
        const speedDividerGap = 40 * capsuleScale;
        
        const apState = sei?.autopilotState || 0;
        const apNames = ['', 'FSD', 'AUTOSTEER', 'TACC'];
        const apText = apState !== 0 ? apNames[apState] || 'ACTIVE' : 'MANUAL';
        
        ctx.font = `500 ${14 * capsuleScale}px -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif`;
        
        const allApTexts = ['MANUAL', 'FSD', 'AUTOSTEER', 'TACC', 'ACTIVE'];
        let maxApTextWidth = 0;
        for (const text of allApTexts) {
            const textWidth = ctx.measureText(text).width;
            if (textWidth > maxApTextWidth) {
                maxApTextWidth = textWidth;
            }
        }
        const apMaxWidth = maxApTextWidth + 40 * capsuleScale;
        
        const leftSectionWidth = gearWidth;
        const rightSectionWidth = apMaxWidth;
        const balancedSectionWidth = Math.max(leftSectionWidth, rightSectionWidth);
        
        let capsuleContentWidth = 0;
        
        if (this.overlayVisibility.gear) {
            capsuleContentWidth += balancedSectionWidth;
            if (this.overlayVisibility.speed || this.overlayVisibility.autopilot) {
                capsuleContentWidth += gearDividerGap;
            }
        }
        
        if (this.overlayVisibility.speed) {
            capsuleContentWidth += speedWidth;
            if (this.overlayVisibility.autopilot) {
                capsuleContentWidth += speedDividerGap;
            }
        }
        
        if (this.overlayVisibility.autopilot) {
            capsuleContentWidth += balancedSectionWidth;
        }
        
        const capsulePadding = 40 * capsuleScale;
        const capsuleWidth = capsuleContentWidth + capsulePadding * 2;
        const capsuleHeight = 100 * capsuleScale;
        
        const capsuleX = width / 2 - capsuleWidth / 2;
        const capsuleY = centerY - capsuleHeight / 2;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, capsuleX, capsuleY, capsuleWidth, capsuleHeight, capsuleHeight / 2);
        
        let contentX = capsuleX + capsulePadding;
        
        if (this.overlayVisibility.gear) {
            ctx.font = `200 ${18 * capsuleScale}px -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif`;
            const letterSpacing = 10 * capsuleScale;
            
            const gearStartX = contentX + (balancedSectionWidth - gearWidth) / 2;
            let gearX = gearStartX;
            
            for (let i = 0; i < gearLetters.length; i++) {
                const letter = gearLetters[i];
                const value = gearValues[i];
                
                if (gearState === value) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
                    ctx.font = `400 ${18 * capsuleScale}px -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif`;
                } else {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                    ctx.font = `200 ${18 * capsuleScale}px -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif`;
                }
                
                ctx.textAlign = 'left';
                ctx.fillText(letter, gearX, centerY);
                gearX += ctx.measureText(letter).width + letterSpacing;
            }
            
            contentX += balancedSectionWidth;
            
            if (this.overlayVisibility.speed || this.overlayVisibility.autopilot) {
                contentX += 20 * capsuleScale;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(contentX, capsuleY + 20 * capsuleScale);
                ctx.lineTo(contentX, capsuleY + capsuleHeight - 20 * capsuleScale);
                ctx.stroke();
                contentX += 20 * capsuleScale;
            }
        }
        
        if (this.overlayVisibility.speed) {
            ctx.font = `200 ${56 * capsuleScale}px -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif`;
            const actualSpeedTextWidth = ctx.measureText(speedValue.toString()).width;
            
            const speedSectionCenterX = contentX + speedWidth / 2;
            
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.fillText(speedValue, speedSectionCenterX - actualSpeedTextWidth / 2, centerY - 8 * capsuleScale);
            
            ctx.font = `300 ${13 * capsuleScale}px -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.textAlign = 'center';
            ctx.fillText(this.getSpeedUnitLabel(), speedSectionCenterX, centerY + 25 * capsuleScale);
            
            contentX += speedWidth;
            
            if (this.overlayVisibility.autopilot) {
                contentX += 20 * capsuleScale;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(contentX, capsuleY + 20 * capsuleScale);
                ctx.lineTo(contentX, capsuleY + capsuleHeight - 20 * capsuleScale);
                ctx.stroke();
                contentX += 20 * capsuleScale;
            }
        }
        
        if (this.overlayVisibility.autopilot) {
            ctx.font = `500 ${14 * capsuleScale}px -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif`;
            ctx.textAlign = 'center';
            
            if (apState === 1) {
                ctx.fillStyle = '#00FF7F';
            } else if (apState === 2) {
                ctx.fillStyle = '#4A9EFF';
            } else if (apState === 3) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            }
            
            const apCenterX = contentX + balancedSectionWidth / 2;
            ctx.fillText(apText, apCenterX, centerY);
        }
        
        if (this.overlayVisibility.blinkers) {
            const signalSize = 28 * capsuleScale;
            const signalGap = 32 * capsuleScale;
            
            const leftActive = sei?.blinkerOnLeft;
            if (leftActive && blinkState) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                this.drawChevron(ctx, capsuleX - signalGap - signalSize / 2, centerY, signalSize, 'left');
            }
            
            const rightActive = sei?.blinkerOnRight;
            if (rightActive && blinkState) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                this.drawChevron(ctx, capsuleX + capsuleWidth + signalGap + signalSize / 2, centerY, signalSize, 'right');
            }
        }
        
        if (this.overlayVisibility.location && (sei?.latitudeDeg !== 0 || sei?.longitudeDeg !== 0)) {
            const locText = `${sei.latitudeDeg.toFixed(4)}°, ${sei.longitudeDeg.toFixed(4)}°`;
            
            ctx.font = `300 ${12 * capsuleScale}px -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif`;
            const locTextWidth = ctx.measureText(locText).width;
            
            const boxPadding = 16 * capsuleScale;
            const boxWidth = locTextWidth + boxPadding * 2;
            const boxHeight = 50 * capsuleScale;
            const gpsX = width - padding - boxWidth;
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
            ctx.lineWidth = 1;
            this.roundRect(ctx, gpsX, centerY - boxHeight / 2, boxWidth, boxHeight, 16 * capsuleScale);
            
            ctx.font = `500 ${10 * capsuleScale}px -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif`;
            ctx.textAlign = 'right';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fillText('GPS', gpsX + boxWidth - boxPadding, centerY - 8 * capsuleScale);
            
            ctx.font = `300 ${12 * capsuleScale}px -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.fillText(locText, gpsX + boxWidth - boxPadding, centerY + 10 * capsuleScale);
        }
        
        ctx.restore();
    }

    drawChevron(ctx, x, y, size, direction) {
        ctx.save();
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = size * 0.15;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        const offset = size * 0.3;
        
        ctx.beginPath();
        if (direction === 'left') {
            ctx.moveTo(x + offset, y - offset);
            ctx.lineTo(x, y);
            ctx.lineTo(x + offset, y + offset);
        } else {
            ctx.moveTo(x - offset, y - offset);
            ctx.lineTo(x, y);
            ctx.lineTo(x - offset, y + offset);
        }
        ctx.stroke();
        ctx.restore();
    }

    drawOverlay(ctx, sei, width, height) {
        this.drawOverlayWithBlink(ctx, sei, width, height, true);
    }

    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.arcTo(x + width, y, x + width, y + radius, radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
        ctx.lineTo(x + radius, y + height);
        ctx.arcTo(x, y + height, x, y + height - radius, radius);
        ctx.lineTo(x, y + radius);
        ctx.arcTo(x, y, x + radius, y, radius);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    showStatus(message, type) {
        this.statusText.textContent = message;
        this.statusMessage.className = 'status-message ' + type;
        this.statusMessage.classList.add('show');
        
        setTimeout(() => {
            this.statusMessage.classList.remove('show');
        }, 3000);
    }

    showOverlay() {
        this.overlay.style.opacity = '1';
        this.overlayToggles.classList.add('visible');
    }

    hideOverlay() {
        this.overlay.style.opacity = '0';
        this.overlayToggles.classList.remove('visible');
    }
}