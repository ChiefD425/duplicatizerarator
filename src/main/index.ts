import { app, shell, BrowserWindow, ipcMain, protocol, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
// @ts-ignore
import icon from '../../resources/icon.png?asset'
import { initDatabase, getDuplicates } from './database'
import { scanFiles, cancelScan } from './scanner'
import { processDuplicates } from './processor'
import { getDrives } from './utils'
import { moveFiles, restoreFiles, getHistory } from './actions'
import { logger } from './logger'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  logger.setWindow(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.duplicatizerarator.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register custom protocol for local files
  protocol.registerFileProtocol('media', (request, callback) => {
    const url = request.url.replace('media://', '')
    try {
      return callback(decodeURIComponent(url))
    } catch (error) {
      console.error(error)
    }
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Register the scheme as privileged
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      bypassCSP: true
    }
  }
])

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC Handlers

// Initialize DB
initDatabase()

ipcMain.handle('get-drives', async () => {
  return await getDrives()
})

ipcMain.handle('start-scan', async (_event, options) => {
  const mainWindow = BrowserWindow.getAllWindows()[0]
  if (mainWindow) {
    // Run in background
    scanFiles(options, mainWindow).then((completed) => {
      if (completed) {
        logger.info('Scan completed, starting processing...')
        processDuplicates(mainWindow)
      } else {
        logger.info('Scan cancelled, skipping processing')
      }
    })
  }
  return { success: true }
})

ipcMain.handle('cancel-scan', () => {
  cancelScan()
  return { success: true }
})

ipcMain.handle('get-duplicates', (_event, options) => {
  return getDuplicates(options)
})

ipcMain.handle('move-files', async (_event, fileIds) => {
  await moveFiles(fileIds)
  return { success: true }
})

ipcMain.handle('get-history', () => {
  return getHistory()
})

ipcMain.handle('restore-files', async (_event, historyIds) => {
  await restoreFiles(historyIds)
  return { success: true }
})

ipcMain.handle('show-item-in-folder', async (_event, path) => {
  shell.showItemInFolder(path)
  return { success: true }
})

ipcMain.handle('get-file-preview', async (_event, path) => {
  console.log('[Main] get-file-preview called for:', path)
  try {
    const image = nativeImage.createFromPath(path)
    if (image.isEmpty()) {
      console.log('[Main] Image is empty for path:', path)
      return null
    }
    const dataURL = image.resize({ width: 800 }).toDataURL()
    console.log('[Main] Preview generated successfully, data URL length:', dataURL.length)
    return dataURL
  } catch (error) {
    console.error('[Main] Failed to load preview:', error)
    return null
  }
})

ipcMain.on('ping', () => console.log('pong'))
