# Duplicatizerarator

![License](https://img.shields.io/badge/license-GPL%20v3-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows-blue.svg)
![Status](https://img.shields.io/badge/status-Active-green.svg)

A modern, high-performance duplicate file finder for Windows.

**Repository:** [https://github.com/ChiefD425/duplicatizerarator](https://github.com/ChiefD425/duplicatizerarator)

## Features

- **Fast Scanning**: Efficiently scans drives and folders for duplicates.
- **Smart Detection**: Uses file hashing to ensure 100% accuracy.
- **Safe Deletion**: Moves duplicates to a holding folder instead of permanent deletion.
- **Modern UI**: Beautiful, glassmorphism-inspired interface.
- **Portable**: Runs as a standalone EXE without installation.

## Development

### Prerequisites

- Node.js (v18+)
- NPM

### Setup

```bash
npm install
```

### Run

```bash
npm run dev
```

### Build

```bash
npm run build:win
```

## Author

**Fred Deichler**  
Email: [fred.deichler@gmail.com](mailto:fred.deichler@gmail.com)

## License

GNU GPL v3

## Acknowledgements

- **[WinDirStat](https://github.com/windirstat/windirstat)**: Inspiration for the high-performance scanning algorithms and efficient file traversal strategies.
- **[Czkawka](https://github.com/qarmin/czkawka)**: Reference for fast duplicate detection algorithms and efficient hashing strategies.
- **[dupeGuru](https://github.com/arsenetar/dupeguru)**: Reference for fuzzy matching and cross-platform architecture concepts.
