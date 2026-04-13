import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, ipcMain, shell } from 'electron'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const isDev = !app.isPackaged
const DEFAULT_WINDOW_SIZE = {
  width: 1560,
  height: 980,
  minWidth: 1180,
  minHeight: 760,
}
const MINI_PLAYER_SIZE = {
  width: 480,
  height: 320,
  minWidth: 420,
  minHeight: 260,
}

let mainWindow = null
let isMiniPlayer = false
let restoredBounds = null

function getWindowState(window) {
  return {
    isAlwaysOnTop: window.isAlwaysOnTop(),
    isMiniPlayer,
  }
}

function applyMiniPlayer(window, enabled) {
  if (enabled === isMiniPlayer) {
    return getWindowState(window)
  }

  if (enabled) {
    if (window.isFullScreen()) {
      window.setFullScreen(false)
    }
    if (window.isMaximized()) {
      window.unmaximize()
    }

    restoredBounds = window.getBounds()
    isMiniPlayer = true
    window.setAspectRatio(16 / 9)
    window.setMinimumSize(MINI_PLAYER_SIZE.minWidth, MINI_PLAYER_SIZE.minHeight)
    window.setSize(MINI_PLAYER_SIZE.width, MINI_PLAYER_SIZE.height)
    window.center()
  } else {
    isMiniPlayer = false
    window.setAspectRatio(0)
    window.setMinimumSize(DEFAULT_WINDOW_SIZE.minWidth, DEFAULT_WINDOW_SIZE.minHeight)

    if (restoredBounds) {
      window.setBounds(restoredBounds)
    } else {
      window.setSize(DEFAULT_WINDOW_SIZE.width, DEFAULT_WINDOW_SIZE.height)
      window.center()
    }
  }

  return getWindowState(window)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: DEFAULT_WINDOW_SIZE.width,
    height: DEFAULT_WINDOW_SIZE.height,
    minWidth: DEFAULT_WINDOW_SIZE.minWidth,
    minHeight: DEFAULT_WINDOW_SIZE.minHeight,
    backgroundColor: '#04101d',
    autoHideMenuBar: true,
    title: 'QuickIPTV Player',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    isMiniPlayer = false
    restoredBounds = null
  })
}

ipcMain.handle('iptv:fetch-playlist', async (_event, playlistUrl) => {
  let parsedUrl

  try {
    parsedUrl = new URL(playlistUrl)
  } catch {
    throw new Error('Playlist URL is invalid.')
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Only HTTP and HTTPS playlist URLs are supported.')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(parsedUrl, {
      signal: controller.signal,
      headers: {
        'user-agent': 'QuickIPTV Player Desktop',
      },
    })

    if (!response.ok) {
      throw new Error(`Playlist request failed with status ${response.status}.`)
    }

    return {
      text: await response.text(),
      finalUrl: response.url || parsedUrl.toString(),
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Playlist request timed out.')
    }

    throw new Error(
      error.message || 'The playlist URL could not be loaded in the desktop app.',
    )
  } finally {
    clearTimeout(timer)
  }
})

ipcMain.handle('iptv:get-window-state', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  return getWindowState(window)
})

ipcMain.handle('iptv:set-always-on-top', (event, enabled) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  window.setAlwaysOnTop(Boolean(enabled))
  return getWindowState(window)
})

ipcMain.handle('iptv:set-mini-player', (event, enabled) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  return applyMiniPlayer(window, Boolean(enabled))
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
