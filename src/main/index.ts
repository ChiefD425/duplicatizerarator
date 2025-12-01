
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
    try {
      const url = request.url
      // Handle legacy/direct paths if they don't match the new pattern
      if (!url.includes('?path=')) {
        let decoded = decodeURIComponent(url.replace('media://', ''))
        // If it starts with a slash and looks like a Windows drive path (e.g. /C:/...), remove the leading slash
        if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(decoded)) {
          decoded = decoded.slice(1)
        }
        return callback(decoded)
      }

      // New robust approach: media://open?path=<encoded_path>
      const urlObj = new URL(url)
      const filePath = urlObj.searchParams.get('path')
      
      if (filePath) {
        return callback(filePath)
      }
    } catch (error) {
      console.error('Protocol error:', error)
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

ipcMain.handle('get-duplicate-folders', () => {
  return getDuplicateFolders()
})

ipcMain.handle('get-duplicate-stats', () => {
  return getDuplicateStats()
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
  logger.info('[Main] get-file-preview called for:', path)
  try {
    if (!existsSync(path)) {
      logger.error('[Main] File does not exist:', path)
      return null
    }

    const image = nativeImage.createFromPath(path)
    if (!image.isEmpty()) {
      const dataURL = image.resize({ width: 800 }).toDataURL()
      logger.info('[Main] Preview generated via nativeImage')
      return dataURL
    }
    
    logger.warn('[Main] nativeImage empty, trying fallback read...')
    // Fallback: read file directly and convert to base64
    const buffer = readFileSync(path)
    const base64 = buffer.toString('base64')
    const ext = path.split('.').pop()?.toLowerCase()
    const mimeType = ext === 'png' ? 'image/png' : 
                    ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 
                    ext === 'gif' ? 'image/gif' : 
                    ext === 'webp' ? 'image/webp' : 'application/octet-stream'
    
    logger.info('[Main] Preview generated via fallback read')
    return `data:${mimeType};base64,${base64}`

  } catch (error: any) {
    logger.error('[Main] Failed to load preview:', error.message)
    return null
  }
})

ipcMain.handle('add-excluded-folder', async (_event, path) => {
  logger.info('[Main] Adding excluded folder:', path)
  try {
    // 1. Add to DB
    addExcludedFolder(path)
    // 2. Remove existing files from DB
    removeFilesByPrefix(path)
    return { success: true }
  } catch (error: any) {
    logger.error('[Main] Failed to add excluded folder:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('get-excluded-folders', async () => {
  return getExcludedFolders()
})

ipcMain.handle('remove-excluded-folder', async (_event, path) => {
  logger.info('[Main] Removing excluded folder:', path)
  try {
    removeExcludedFolder(path)
    return { success: true }
  } catch (error: any) {
    logger.error('[Main] Failed to remove excluded folder:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.on('ping', () => console.log('pong'))
