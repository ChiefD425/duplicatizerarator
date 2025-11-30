# Features & Roadmap

## ✅ Completed Features
- **Fast Scanning**: Efficient directory traversal and file enumeration.
- **Smart Detection**: SHA-256 hashing (or similar) to identify exact duplicates.
- **Safe Deletion**: Mechanism to move files to a temporary folder instead of permanent deletion.
- **Modern UI**: Glassmorphism design with dark mode aesthetics.
- **Portable Build**: Generates a standalone `.exe` file.
- **Drive Selection**: UI to select which drives/folders to scan.
- **File Type Filtering**: Basic filtering by file extension/type.

## 🚧 In Progress
- **Performance Optimization**: Improving scan speed for very large drives (See `better-sqlite3` integration).
- **Background Scanning**: Ensuring scans continue when navigating away from the scan view.
- **Progress Indication**: Accurate percentage completion during scanning.

## 📅 Planned / Roadmap
- **Advanced Filters**: Filter by file size (e.g., > 100MB), date modified, etc.
- **Preview**: Built-in preview for common file types (images, text) before deletion.
- **Export Results**: Export list of duplicates to CSV/JSON.
- **Auto-Select**: Smart algorithms to auto-select "copies" to delete (e.g., keep oldest, keep newest).
- **Theme Customization**: Allow users to tweak the accent colors.

## 🐛 Known Issues
- **Memory Usage**: High memory consumption during scan of millions of files (needs optimization).
- **Window Dragging**: Custom title bar dragging can sometimes be finicky on certain resolutions.
