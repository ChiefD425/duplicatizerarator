# Agent Guide for Duplicatizerarator

Welcome, Agent. This guide provides the necessary context and instructions to effectively contribute to the Duplicatizerarator project.

## Project Overview
Duplicatizerarator is a modern, high-performance duplicate file finder for Windows. It is built as an Electron application with a focus on speed, accuracy, and a premium user experience (Glassmorphism UI).

## Architecture
- **Framework**: Electron (Main + Renderer processes)
- **Frontend**: React + TypeScript + Vite
- **Styling**: Vanilla CSS with CSS Variables (Glassmorphism theme)
- **Data/Indexing**: `better-sqlite3` (Used for fast file indexing and querying)
- **Build System**: `electron-builder` (Portable Windows EXE)

## Key Directories
- `src/main`: Backend logic (Electron main process), file scanning, database interactions.
- `src/preload`: Context bridge for secure communication between Main and Renderer.
- `src/renderer`: Frontend UI (React components, CSS, assets).
- `resources`: Static assets (icons, etc.).

## Development Workflow
1.  **Install Dependencies**: `npm install`
2.  **Start Dev Server**: `npm run dev` (Runs both Electron and Vite server)
3.  **Build**: `npm run build:win` (Creates portable executable in `dist/`)

## Coding Standards
- **UI/UX**: Maintain the "wow-factor" glassmorphism design. Use existing CSS variables in `src/renderer/src/assets/index.css`.
- **Performance**: File scanning must be non-blocking. Use `better-sqlite3` for handling large file lists efficiently.
- **Safety**: Never delete files directly without user confirmation. Move to a holding folder first (Safe Deletion).
- **Types**: Use TypeScript interfaces for all data structures.

## Task Management
- Check `FEATURES.md` for the status of current and planned features.
- Update `FEATURES.md` when you complete a feature or change its status.
- If a `TASKS.md` exists in the root, follow it for granular steps.

## Common Issues / Notes
- **Windowing**: The app uses a custom title bar (frameless window). Ensure layout handles this.
- **Permissions**: File system access is handled in the Main process. Use IPC to request file operations from the Renderer.
