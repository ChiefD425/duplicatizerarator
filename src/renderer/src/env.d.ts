/// <reference types="vite/client" />

interface Window {
  api: {
    getDrives: () => Promise<any[]>
    startScan: (options: any) => Promise<any>
    getDuplicates: (options?: any) => Promise<any[]>
    getDuplicateFolders: () => Promise<any[]>
    getDuplicateStats: () => Promise<{ totalFiles: number, originalFiles: number, duplicateFolders: number }>
    moveFiles: (fileIds: number[]) => Promise<any>
    getHistory: () => Promise<any[]>
    restoreFiles: (historyIds: number[]) => Promise<any>
    showItemInFolder: (path: string) => Promise<any>
    getFilePreview: (path: string) => Promise<string | null>
    addExcludedFolder: (path: string) => Promise<{ success: boolean; error?: string }>
    removeExcludedFolder: (path: string) => Promise<{ success: boolean; error?: string }>
    getExcludedFolders: () => Promise<string[]>
    cancelScan: () => Promise<{ success: boolean }>
    onScanProgress: (callback: (event: any, value: any) => void) => void
    onScanComplete: (callback: (event: any, value: any) => void) => void
    onProcessingProgress: (callback: (event: any, value: any) => void) => void
    onHashingProgress: (callback: (event: any, value: any) => void) => void
    onProcessingComplete: (callback: (event: any, value: any) => void) => void
    onScanCancelled: (callback: (event: any, value: any) => void) => void
    onLogMessage: (callback: (event: any, value: any) => void) => void
    removeListener: (channel: string) => void
  }
}
