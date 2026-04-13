import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('quickIptvDesktop', {
  isDesktop: true,
  fetchPlaylist: (url) => ipcRenderer.invoke('iptv:fetch-playlist', url),
  getWindowState: () => ipcRenderer.invoke('iptv:get-window-state'),
  setAlwaysOnTop: (enabled) => ipcRenderer.invoke('iptv:set-always-on-top', enabled),
  setMiniPlayer: (enabled) => ipcRenderer.invoke('iptv:set-mini-player', enabled),
})
