# Chrome Element Screenshot Extension

A powerful Chrome browser extension that allows you to easily capture screenshots of specific elements on web pages. Supports both regular screenshots and long screenshots for various web elements.

[中文說明 / Chinese Documentation](./README-zh.md)

## ✨ Features

- 🎯 **Precise Element Selection** - Smart detection of web element boundaries
- 📜 **Long Screenshot Support** - Automatic handling of scrollable content and large elements
- 🖼️ **Multiple Format Support** - PNG/JPEG formats with adjustable quality
- ⚡ **Quick Operations** - Keyboard shortcuts and intuitive interface
- 🔧 **Customizable Settings** - File naming, quality adjustment, and more
- 💾 **Automatic Download** - Screenshots are automatically saved after capture

## 🚀 Quick Start

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/CatRaiden/chrome-element-screenshot.git
cd chrome-element-screenshot

# 2. Install dependencies
npm install

# 3. Build the extension
npm run build

# 4. Load into Chrome
# - Open chrome://extensions/
# - Enable "Developer mode"
# - Click "Load unpacked"
# - Select the project root directory
```

### Basic Usage

1. **Start Screenshot Mode**
   - Click the extension icon 📷 in the browser toolbar
   - Click the "Start Screenshot" button
   - Or press `Enter` for quick activation

2. **Select Element**
   - Move your mouse over the element you want to capture
   - The element will be highlighted
   - Click the element to take the screenshot

3. **Complete Screenshot**
   - The system automatically processes the screenshot
   - Files are downloaded to the default download folder
   - Press `ESC` to exit screenshot mode

## 📋 Supported Screenshot Types

### Regular Element Screenshots
- Buttons, images, text blocks
- Tables, form elements
- Elements with CSS effects (shadows, transforms, etc.)

### Long Screenshots
- Scrollable container elements
- Large elements that extend beyond the viewport
- Long articles, chat logs, long tables

### Complex Elements
- iframe content
- Fixed positioned elements
- High z-index layered elements

## ⚙️ Settings Options

### Quick Settings (Popup Window)
- **Image Format**: PNG (lossless) / JPEG (lossy)
- **Image Quality**: 10%-100% adjustable
- **Quick Actions**: One-click screenshot activation

### Detailed Settings (Settings Page)
- **File Naming Template**: Custom filename format
- **Auto Download**: Enable/disable automatic download
- **Progress Display**: Show long screenshot processing progress
- **Highlight Color**: Customize element selection highlight color

### File Naming Variables
- `{timestamp}` - Full timestamp
- `{date}` - Date (YYYY-MM-DD)
- `{time}` - Time (HH-MM-SS)

**Examples:**
- `screenshot-{timestamp}` → `screenshot-2024-01-15T10-30-45.png`
- `element-{date}_{time}` → `element-2024-01-15_10-30-45.png`

## ⌨️ Keyboard Shortcuts

| Key | Function |
|-----|----------|
| `Enter` | Start screenshot mode |
| `ESC` | Exit screenshot mode |
| `F1` | Show help (in popup window) |

## 🔧 Development

### Project Structure

```
chrome-element-screenshot/
├── src/
│   ├── background/     # Background scripts
│   ├── content/        # Content scripts
│   ├── popup/          # Popup window
│   ├── options/        # Settings page
│   └── types/          # TypeScript type definitions
├── dist/               # Build output
├── public/             # Static assets
└── styles/             # Style files
```

### Development Commands

```bash
# Development mode (watch file changes)
npm run dev

# Production build
npm run build

# Run tests
npm test

# Code linting
npm run lint

# Type checking
npm run type-check
```

### Tech Stack

- **TypeScript** - Type-safe JavaScript
- **Webpack** - Module bundler
- **Chrome Extension Manifest V3** - Latest extension standard
- **Canvas API** - Image processing and stitching
- **Chrome APIs** - tabs, scripting, downloads, storage

## 🛠️ Troubleshooting

### Common Issues

**Q: Screenshot fails or appears blank**
- Ensure the page is fully loaded
- Check if the element is within the visible area
- Try refreshing the page

**Q: Long screenshot is incomplete**
- Confirm the element is actually scrollable or extends beyond viewport
- Check for JavaScript errors
- Try manually scrolling before taking screenshot

**Q: File doesn't auto-download**
- Check browser download settings
- Ensure "Auto Download" option is enabled
- Verify download permissions

**Q: Extension won't start**
- Reload the extension
- Check Chrome version (requires 88+)
- Check console for error messages

### Performance Tips

**For large screenshots:**
- Use JPEG format to reduce file size
- Lower quality settings (70-80%)
- Enable progress display to monitor processing

**For high-resolution screens:**
- System automatically detects device pixel ratio
- May require more processing time
- Consider using smaller screenshot areas

## 🔒 Privacy & Security

### Permission Explanation
- **activeTab**: Access current tab content
- **tabs**: Required for screenshot functionality
- **storage**: Store user settings
- **downloads**: Auto-download screenshots
- **scripting**: Inject content scripts

### Data Processing
- All processing is done locally
- No screenshots or data are uploaded
- Settings are stored locally in browser

## 📄 License

MIT License

## 🤝 Contributing

Issues and Pull Requests are welcome!

### Development Workflow
1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

If you encounter issues, please provide:
1. Chrome version
2. Operating system
3. Error message screenshots
4. Steps to reproduce

---

**Version**: 1.0.0  
**Compatibility**: Chrome 88+  
**Manifest**: V3