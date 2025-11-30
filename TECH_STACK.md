# Technology Stack

## Core
- **Runtime**: [Electron](https://www.electronjs.org/) (v29+)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (v5+)
- **Frontend Framework**: [React](https://react.dev/) (v18+)
- **Bundler**: [Vite](https://vitejs.dev/) (via `electron-vite`)

## Data & State
- **Database**: [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - Used for high-performance file indexing and querying.
- **State Management**: React Context / Hooks (Local state).

## UI / Styling
- **Styling Engine**: Vanilla CSS with CSS Variables (`src/renderer/src/assets/index.css`).
- **Icons**: [Lucide React](https://lucide.dev/guide/packages/lucide-react).
- **Animations**: [Framer Motion](https://www.framer.com/motion/).
- **Utilities**: `clsx` for conditional class names.

## Build & Packaging
- **Builder**: [electron-builder](https://www.electron.build/).
- **Target**: Windows (Portable Executable).

## Development Tools
- **Linting**: ESLint (Standard config).
- **Formatting**: Prettier (if configured).
