
# A Better Dashcam Viewer

A desktop application for exporting Tesla dashcam footage with real-time overlay of vehicle telemetry data. Extract and visualize speed, autopilot status, GPS coordinates, turn signals, and more directly from your dashcam videos.


##  Features

-   **Real-time Telemetry Overlay**: Display vehicle data directly on your dashcam footage
    -   Speed (MPH/KPH)
    -   Autopilot/FSD status
    -   Turn signal indicators
    -   GPS coordinates
    -   And more...
-   **Video Export**: Export videos with burned-in overlays at 1080p
    -   Intelligent rendering (only generates overlays when metadata changes)
    -   Much faster than traditional frame-by-frame export
    -   Maintains original video quality
-   **CSV Metadata Export**: Extract all telemetry data to CSV for analysis
-   **Privacy-Focused**: All processing happens locally on your computer - no data uploaded anywhere

## Requirements

### For Using the App

-   **Tesla Vehicle**: HW3+ (Autopilot Computer 3 or newer)
-   **Vehicle Software Version**: 2025.44.25 or higher
-   **Operating System**: Windows 10/11, macOS 10.13+, or Linux

### For Building from Source

-   Node.js 16+
-   npm or yarn

##  Installation

### Option 1: Download Pre-built Release (Recommended)

1.  Go to the [Releases](https://github.com/jake6042/a-better-dashcam-viewer/releases) page
2.  Download the appropriate version for your operating system:
    -   **Windows**: `A-Better-Dashcam-Viewer-Setup-1.0.0.exe` (installer)
    -   **macOS**: `A-Better-Dashcam-Viewer-1.0.0.dmg`
    -   **Linux**: `A-Better-Dashcam-Viewer-1.0.0.AppImage`, `.deb`, or `.rpm`
3.  Install and run the application

### Option 2: Build from Source

bash

```bash
# Clone the repository
git clone https://github.com/jake6042/a-better-dashcam-viewer.git
cd a-better-dashcam-viewer

# Install dependencies
npm install

# Run in development mode
npm start

# Build for production
npm run build
```

##  Usage

1. **Launch the Application**
   
2. **Load a Video**
   - Click the drop zone or drag and drop a Tesla dashcam MP4 file
   - The video must be from a HW3+ vehicle running software 2025.44.25+

3. **Customize Overlay**
   - Use the toggles to show/hide specific overlay elements
   - Switch between MPH and KPH for speed display

4. **Export Options**
   - **Export CSV**: Extract all metadata to a CSV file for analysis
   - **Fast Export**: Create a video with overlays burned in (1080p, maintains aspect ratio)

## How It Works

This application parses Tesla dashcam MP4 files to extract SEI (Supplemental Enhancement Information) metadata embedded in the video stream. The metadata includes:

- Vehicle speed
- Gear state
- Autopilot/FSD status
- Accelerator and brake pedal positions
- Steering wheel angle
- Turn signal states
- GPS coordinates (latitude, longitude, heading)
- Linear acceleration (X, Y, Z axes)

The data is decoded using Protocol Buffers (protobuf) and overlaid on the video in real-time.

### Smart Export Technology

Instead of rendering every frame (which would be slow), the app:
1. Analyzes the metadata to detect when values change
2. Only renders overlay images at change points
3. Uses FFmpeg to composite these overlays with the original video
4. Results in much faster exports while maintaining quality

## Project Structure
```
a-better-dashcam-viewer/
├── main.js                 # Electron main process
├── index.html             # Main UI
├── css/
│   └── styles.css         # Application styles
├── js/
│   ├── app.js             # Main application logic
│   ├── ui.js              # UI handling and overlay rendering
│   ├── video-player.js    # Video preview
│   ├── video-export-smart.js  # Smart export functionality
│   ├── dashcam-mp4.js     # MP4 parser
│   └── protobuf.min.js    # Protocol Buffers library
├── dashcam.proto          # Protobuf definition for SEI metadata
└── package.json
```

## Development

bash

```bash
# Install dependencies
npm install

# Run in development mode with DevTools
npm start

# Build for all platforms
npm run build:all

# Build for specific platforms
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

## Building Releases

The project uses `electron-builder` for packaging. Builds are configured in `package.json`:

-   **Windows**: NSIS installer
-   **macOS**: DMG
-   **Linux**: AppImage, DEB, and RPM

FFmpeg is automatically bundled with the application during the build process.

## Credits

Built using Tesla's open-source dashcam utilities from [github.com/teslamotors/dashcam](https://github.com/teslamotors/dashcam).

**Not affiliated with Tesla, Inc.**

Another shoutout goes to [Rene-Sackers on Github](https://github.com/Rene-Sackers/) for his work on [TeslaCamPlayer](https://github.com/Rene-Sackers/TeslaCamPlayer) and for helping me in the early stages identifying limitations in a browser/Electron environment.

## License

MIT License - See [LICENSE](LICENSE) file for details

## Issues & Support

Found a bug or have a feature request? Please open an issue on the [GitHub Issues](https://github.com/jake6042/a-better-dashcam-viewer/issues) page.

## Support Development

If you find this tool useful, consider [buying me a coffee](https://buymeacoffee.com/jake6042)!

----------
