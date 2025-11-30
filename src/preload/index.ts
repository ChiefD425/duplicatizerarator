import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getDrives: () => ipcRenderer.invoke('get-drives'),
  startScan: (options: any) => ipcRenderer.invoke('start-scan', options),
  getDuplicates: (options?: any) => ipcRenderer.invoke('get-duplicates', options),
  moveFiles: (fileIds: number[]) => ipcRenderer.invoke('move-files', fileIds),
  getHistory: () => ipcRenderer.invoke('get-history'),
  restoreFiles: (historyIds: number[]) => ipcRenderer.invoke('restore-files', historyIds),
  cancelScan: () => ipcRenderer.invoke('cancel-scan'),
  onScanProgress: (callback: (event: any, value: any) => void) => ipcRenderer.on('scan-progress', callback),
  onScanComplete: (callback: (event: any, value: any) => void) => ipcRenderer.on('scan-complete', callback),
  onProcessingProgress: (callback: (event: any, value: any) => void) => ipcRenderer.on('processing-progress', callback),
  onHashingProgress: (callback: (event: any, value: any) => void) => ipcRenderer.on('hashing-progress', callback),
  onProcessingComplete: (callback: (event: any, value: any) => void) => ipcRenderer.on('processing-complete', callback),
  onScanCancelled: (callback: (event: any, value: any) => void) => ipcRenderer.on('scan-cancelled', callback),
  onLogMessage: (callback: (event: any, value: any) => void) => ipcRenderer.on('log-message', callback),
  removeListener: (channel: string) => ipcRenderer.removeAllListeners(channel)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
