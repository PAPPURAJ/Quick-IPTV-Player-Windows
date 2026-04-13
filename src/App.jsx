import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'quickiptvplayer-state-v1'
const THEME_KEY = 'quickiptvplayer-theme-v1'
const GRID_TILE_WIDTHS = [118, 138, 162, 188, 216]
const GRID_GAPS = [12, 14, 16, 18, 20]
const LIST_LOGO_SIZES = [48, 56, 64, 72, 80]
const LIST_PADDINGS = [12, 14, 16, 18, 20]
const LIST_GAPS = [12, 14, 16, 18, 20]
const DEFAULT_ZOOM_INDEX = 2

const emptyForm = {
  id: null,
  name: 'New Playlist',
  source: '',
  active: true,
}

function createPlaylistId() {
  return `playlist-${crypto.randomUUID()}`
}

function createChannelKey(playlistId, url) {
  return `${playlistId}::${url}`
}

function resolveUrl(url, baseUrl) {
  try {
    return baseUrl ? new URL(url, baseUrl).toString() : url
  } catch {
    return url
  }
}

function extractAttributes(line) {
  const attributes = {}
  for (const match of line.matchAll(/([\w-]+)="([^"]*)"/g)) {
    attributes[match[1]] = match[2]
  }
  return attributes
}

function parsePlaylistText(text, { baseUrl, playlistName, fallbackUrl } = {}) {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error('Playlist content is empty.')
  }
  if (/^https?:\/\//i.test(trimmed) && trimmed.split(/\r?\n/).length === 1) {
    return {
      channels: [
        {
          name: playlistName || 'Direct stream',
          url: trimmed,
          group: 'Live',
          logo: '',
        },
      ],
    }
  }
  if (/#EXT-X-(TARGETDURATION|STREAM-INF|MEDIA-SEQUENCE)/.test(trimmed)) {
    if (!fallbackUrl) {
      throw new Error(
        'This looks like a direct HLS manifest. Add its URL instead of pasting the manifest text.',
      )
    }
    return {
      channels: [
        {
          name: playlistName || 'Live stream',
          url: fallbackUrl,
          group: 'Live',
          logo: '',
        },
      ],
    }
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const channels = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line.startsWith('#EXTINF')) continue

    const attributes = extractAttributes(line)
    const title = line.includes(',')
      ? line.slice(line.indexOf(',') + 1).trim() || 'Untitled channel'
      : 'Untitled channel'

    let streamUrl = ''
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const candidate = lines[cursor]
      if (!candidate.startsWith('#')) {
        streamUrl = resolveUrl(candidate, baseUrl)
        index = cursor
        break
      }
    }

    if (!streamUrl) continue

    channels.push({
      name: title,
      url: streamUrl,
      group: attributes['group-title'] || 'General',
      logo: attributes['tvg-logo'] || '',
    })
  }

  if (channels.length === 0) {
    throw new Error('No playable channels were found.')
  }

  return { channels }
}

function serializePlaylistDefinition(formData) {
  return {
    id: formData.id || createPlaylistId(),
    name: formData.name.trim(),
    source: formData.source.trim(),
    active: formData.active,
  }
}

function sanitizeStoredState(rawState) {
  if (!rawState) {
    return { playlists: [], favorites: [] }
  }
  return {
    playlists: Array.isArray(rawState.playlists) ? rawState.playlists : [],
    favorites: Array.isArray(rawState.favorites) ? rawState.favorites : [],
  }
}

function getDesktopApi() {
  return typeof window !== 'undefined' ? window.quickIptvDesktop || null : null
}

function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark'
  const storedTheme = window.localStorage.getItem(THEME_KEY)
  return storedTheme === 'light' ? 'light' : 'dark'
}

function IconGrid() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M4 4h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 10h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4zM4 16h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4z" />
    </svg>
  )
}

function IconList() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
    </svg>
  )
}

function IconZoomIn() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
      <path d="M12 10h-2v2H9v-2H7V9h2V7h1v2h2v1z" />
    </svg>
  )
}

function IconZoomOut() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM7 9h5v1H7z" />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M15.5 14h-.8l-.28-.27A6.46 6.46 0 0016 9.5 6.5 6.5 0 109.5 16a6.46 6.46 0 004.23-1.58l.27.28v.8L19 20.5 20.5 19zM9.5 14A4.5 4.5 0 119.5 5a4.5 4.5 0 010 9z" />
    </svg>
  )
}

function IconSidebarToggle({ collapsed }) {
  return (
    <svg viewBox="0 0 24 24">
      {collapsed ? (
        <path d="M9.29 6.71 13.58 11l-4.29 4.29 1.42 1.42L16.42 11l-5.71-5.71z" />
      ) : (
        <path d="M14.71 17.29 10.42 13l4.29-4.29-1.42-1.42L7.58 13l5.71 5.71z" />
      )}
    </svg>
  )
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="m14 4 6 6-2.1.7-2.2 2.2.6 4.6-1.1 1.1-4.6-.6-4.5 4.5-1.4-1.4 4.5-4.5-.6-4.6 1.1-1.1 4.6.6 2.2-2.2z" />
    </svg>
  )
}

function IconMiniPlayer() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm0 2v10h16V7zm8 2h6v4h-6z" />
    </svg>
  )
}

function IconTheme({ theme }) {
  return theme === 'dark' ? (
    <svg viewBox="0 0 24 24">
      <path d="M12 3a1 1 0 0 1 1 1v1.2a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1zm0 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm8-6a1 1 0 0 1 1 1 1 1 0 0 1-1 1h-1.2a1 1 0 1 1 0-2zM6.4 6.4a1 1 0 0 1 0 1.4l-.85.86A1 1 0 1 1 4.14 7.25L5 6.4a1 1 0 0 1 1.4 0zM4 11a1 1 0 1 1 0 2H2.8a1 1 0 1 1 0-2zm1.55 5.75a1 1 0 0 1 1.41 0l.85.85a1 1 0 0 1-1.41 1.41l-.85-.85a1 1 0 0 1 0-1.41zM12 18.8a1 1 0 0 1 1 1V21a1 1 0 1 1-2 0v-1.2a1 1 0 0 1 1-1zm6.45-2.05a1 1 0 0 1 0 1.41l-.85.85a1 1 0 1 1-1.41-1.41l.85-.85a1 1 0 0 1 1.41 0zM18.45 6.4l.85.85a1 1 0 1 1-1.41 1.41l-.85-.86a1 1 0 0 1 1.41-1.4z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24">
      <path d="M20.7 14.1A8.5 8.5 0 0 1 9.9 3.3a.6.6 0 0 0-.7-.8A9.5 9.5 0 1 0 21.5 14.8a.6.6 0 0 0-.8-.7z" />
    </svg>
  )
}

function BrowserToolbar({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onZoomOut,
  onZoomIn,
  canZoomOut,
  canZoomIn,
  resultCount,
  theme,
  onToggleTheme,
  compact = false,
}) {
  return (
    <div className={`browser-toolbar-shell ${compact ? 'compact' : ''}`}>
      <label className="search-field">
        <IconSearch />
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search channels, groups, playlists"
        />
      </label>
      <div className="browser-toolbar-meta">{resultCount} shown</div>
      <div className="header-toolbar">
        <button
          className={`toolbar-btn ${viewMode === 'grid' ? 'active' : ''}`}
          onClick={() => onViewModeChange('grid')}
          type="button"
          title="Grid view"
        >
          <IconGrid />
        </button>
        <button
          className={`toolbar-btn ${viewMode === 'list' ? 'active' : ''}`}
          onClick={() => onViewModeChange('list')}
          type="button"
          title="List view"
        >
          <IconList />
        </button>
        <button className="toolbar-btn" onClick={onToggleTheme} type="button" title="Toggle theme">
          <IconTheme theme={theme} />
        </button>
        <button
          className="toolbar-btn"
          onClick={onZoomOut}
          type="button"
          title="Zoom out"
          disabled={!canZoomOut}
        >
          <IconZoomOut />
        </button>
        <button
          className="toolbar-btn"
          onClick={onZoomIn}
          type="button"
          title="Zoom in"
          disabled={!canZoomIn}
        >
          <IconZoomIn />
        </button>
      </div>
    </div>
  )
}

function ChannelCard({ channel, isActive = false, onSelect, viewMode, className = '' }) {
  return (
    <button
      className={`channel-card ${viewMode} ${isActive ? 'active' : ''} ${className}`.trim()}
      onClick={() => onSelect(channel)}
      type="button"
      title={channel.name}
    >
      <div className="channel-logo-container">
        {channel.logo ? (
          <img
            src={channel.logo}
            alt={channel.name}
            onError={(event) => {
              event.target.style.display = 'none'
              event.target.nextSibling.style.display = 'block'
            }}
          />
        ) : null}
        <span style={{ display: channel.logo ? 'none' : 'block' }}>
          {channel.name.substring(0, 2).toUpperCase()}
        </span>
      </div>
      <div className="channel-copy">
        <h3>{channel.name}</h3>
        <p>
          {channel.playlistName} / {channel.group}
        </p>
      </div>
    </button>
  )
}

function ChannelResults({ channels, selectedChannel, onSelect, viewMode, className = '' }) {
  if (channels.length === 0) {
    return (
      <div className={`channel-results-empty ${className}`.trim()}>
        <h3>No channels found</h3>
        <p>Try another playlist or adjust the search text.</p>
      </div>
    )
  }

  return (
    <div className={`channel-results ${viewMode} ${className}`.trim()}>
      {channels.map((channel) => (
        <ChannelCard
          key={channel.key}
          channel={channel}
          isActive={selectedChannel?.key === channel.key}
          onSelect={onSelect}
          viewMode={viewMode}
        />
      ))}
    </div>
  )
}

function getCompactNavigationChannels(channels, currentChannel, maxItems = 7) {
  if (!channels.length) return []
  const currentIndex = channels.findIndex((item) => item.key === currentChannel?.key)
  if (currentIndex === -1 || channels.length <= maxItems) {
    return channels.slice(0, maxItems)
  }

  const halfWindow = Math.floor(maxItems / 2)
  let start = Math.max(0, currentIndex - halfWindow)
  let end = Math.min(channels.length, start + maxItems)

  if (end - start < maxItems) {
    start = Math.max(0, end - maxItems)
  }

  return channels.slice(start, end)
}

function ChannelPlayer({
  channel,
  channels,
  viewMode,
  browserContentStyle,
  searchQuery,
  onSearchChange,
  onViewModeChange,
  onZoomOut,
  onZoomIn,
  canZoomOut,
  canZoomIn,
  isChannelBrowserOpen,
  onChannelSelect,
  onClose,
  onOpenChannelBrowser,
  onCloseChannelBrowser,
  isDesktop,
  isMiniPlayer,
  isAlwaysOnTop,
  theme,
  onToggleTheme,
  onToggleMiniPlayer,
  onToggleAlwaysOnTop,
}) {
  const videoRef = useRef(null)
  const hideChromeTimeoutRef = useRef(null)
  const compactStripRef = useRef(null)
  const dragStateRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    scrollLeft: 0,
  })
  const isCompactPlayerMode = isMiniPlayer || isAlwaysOnTop
  const compactNavigationChannels = useMemo(
    () => getCompactNavigationChannels(channels, channel, isCompactPlayerMode ? 7 : 0),
    [channel, channels, isCompactPlayerMode],
  )
  const [isChromeVisible, setIsChromeVisible] = useState(!isCompactPlayerMode)

  useEffect(
    () => () => {
      if (hideChromeTimeoutRef.current) {
        window.clearTimeout(hideChromeTimeoutRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    const video = videoRef.current
    if (!video) return undefined
    if (!channel?.url) {
      video.removeAttribute('src')
      video.load()
      return undefined
    }

    let hls
    let cancelled = false
    video.pause()

    async function attachStream() {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = channel.url
      } else if (channel.url.includes('.m3u8')) {
        const module = await import('hls.js')
        const Hls = module.default
        if (cancelled) return
        if (Hls.isSupported()) {
          hls = new Hls()
          hls.loadSource(channel.url)
          hls.attachMedia(video)
        } else {
          video.src = channel.url
        }
      } else {
        video.src = channel.url
      }

      if (cancelled) return
      video.load()
      const playPromise = video.play()
      if (playPromise?.catch) playPromise.catch(() => {})
    }

    attachStream()
    return () => {
      cancelled = true
      if (hls) hls.destroy()
    }
  }, [channel])

  useEffect(() => {
    setIsChromeVisible(isCompactPlayerMode ? false : true)
  }, [channel?.key, isChannelBrowserOpen, isCompactPlayerMode])

  function revealChrome() {
    if (!isChromeVisible) {
      setIsChromeVisible(true)
    }
    if (hideChromeTimeoutRef.current) {
      window.clearTimeout(hideChromeTimeoutRef.current)
    }
    if (isChannelBrowserOpen) return
    hideChromeTimeoutRef.current = window.setTimeout(() => {
      setIsChromeVisible(false)
    }, isCompactPlayerMode ? 3200 : 2600)
  }

  function handleCompactStripWheel(event) {
    const strip = compactStripRef.current
    if (!strip) return
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
    event.preventDefault()
    strip.scrollLeft += event.deltaY
  }

  function handleCompactStripPointerDown(event) {
    const strip = compactStripRef.current
    if (!strip) return
    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: strip.scrollLeft,
    }
    strip.setPointerCapture(event.pointerId)
  }

  function handleCompactStripPointerMove(event) {
    const strip = compactStripRef.current
    const dragState = dragStateRef.current
    if (!strip || !dragState.active) return
    const deltaX = event.clientX - dragState.startX
    strip.scrollLeft = dragState.scrollLeft - deltaX
  }

  function handleCompactStripPointerUp() {
    const strip = compactStripRef.current
    const dragState = dragStateRef.current
    if (!strip || !dragState.active) return
    if (dragState.pointerId !== null) {
      strip.releasePointerCapture(dragState.pointerId)
    }
    dragStateRef.current = {
      active: false,
      pointerId: null,
      startX: 0,
      scrollLeft: strip.scrollLeft,
    }
  }

  return (
    <div
      className={`player-container ${isChannelBrowserOpen ? 'browser-open' : ''} ${isCompactPlayerMode ? 'compact-player-mode' : ''}`}
      onMouseMove={revealChrome}
      onClick={revealChrome}
      style={browserContentStyle}
    >
      {isCompactPlayerMode ? (
        <>
          <div
            className={`player-compact-topbar ${isChromeVisible || isChannelBrowserOpen ? 'visible' : ''}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="compact-now-playing">
              <h2>{channel.name}</h2>
              <p>
                {channel.playlistName} / {channel.group}
              </p>
            </div>
            <div className="compact-settings-panel">
              <button
                className={`btn-overlay-toggle ${isChannelBrowserOpen ? 'active' : ''}`}
                onClick={isChannelBrowserOpen ? onCloseChannelBrowser : onOpenChannelBrowser}
                type="button"
              >
                Channels
              </button>
              <button className="btn-overlay-toggle subtle" onClick={onClose} type="button">
                Back
              </button>
              <button className="btn-overlay-toggle subtle" onClick={onToggleTheme} type="button">
                <IconTheme theme={theme} />
                <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
              {isDesktop && (
                <>
                  <button
                    className={`btn-overlay-toggle subtle ${isMiniPlayer ? 'active' : ''}`}
                    onClick={onToggleMiniPlayer}
                    type="button"
                  >
                    <IconMiniPlayer />
                    <span>{isMiniPlayer ? 'Exit Mini' : 'Mini Player'}</span>
                  </button>
                  <button
                    className={`btn-overlay-toggle subtle ${isAlwaysOnTop ? 'active' : ''}`}
                    onClick={onToggleAlwaysOnTop}
                    type="button"
                  >
                    <IconPin />
                    <span>{isAlwaysOnTop ? 'On Top' : 'Pin On Top'}</span>
                  </button>
                </>
              )}
            </div>
          </div>
          {!isChannelBrowserOpen && compactNavigationChannels.length > 0 && (
            <div
              className={`player-compact-bottomrail ${isChromeVisible ? 'visible' : ''}`}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="compact-bottomrail-label">Quick Channels</div>
              <div
                ref={compactStripRef}
                className="compact-channel-strip"
                onWheel={handleCompactStripWheel}
                onPointerDown={handleCompactStripPointerDown}
                onPointerMove={handleCompactStripPointerMove}
                onPointerUp={handleCompactStripPointerUp}
                onPointerCancel={handleCompactStripPointerUp}
              >
                {compactNavigationChannels.map((item) => (
                  <button
                    key={item.key}
                    className={`compact-channel-chip ${item.key === channel.key ? 'active' : ''}`}
                    onClick={() => onChannelSelect(item)}
                    type="button"
                    title={item.name}
                  >
                    <span className="compact-channel-chip-logo">
                      {item.logo ? (
                        <img
                          src={item.logo}
                          alt={item.name}
                          onError={(event) => {
                            event.target.style.display = 'none'
                            event.target.nextSibling.style.display = 'grid'
                          }}
                        />
                      ) : null}
                      <span style={{ display: item.logo ? 'none' : 'grid' }}>
                        {item.name.substring(0, 2).toUpperCase()}
                      </span>
                    </span>
                    <span className="compact-channel-chip-name">{item.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div
          className={`player-header ${isChromeVisible || isChannelBrowserOpen ? 'visible' : ''}`}
          onClick={(event) => event.stopPropagation()}
        >
          <button className="btn-back" onClick={onClose} title="Go back to channels" type="button">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
          </button>
          <div className="player-info">
            <h2>{channel.name}</h2>
            <p>
              {channel.playlistName} / {channel.group}
            </p>
          </div>
          <div className="player-actions">
            <button
              className={`btn-overlay-toggle ${isChannelBrowserOpen ? 'active' : ''}`}
              onClick={isChannelBrowserOpen ? onCloseChannelBrowser : onOpenChannelBrowser}
              type="button"
            >
              Channels
            </button>
            <button className="btn-overlay-toggle subtle" onClick={onToggleTheme} type="button">
              <IconTheme theme={theme} />
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            {isDesktop && (
              <>
                <button
                  className={`btn-overlay-toggle subtle ${isMiniPlayer ? 'active' : ''}`}
                  onClick={onToggleMiniPlayer}
                  type="button"
                >
                  <IconMiniPlayer />
                  <span>{isMiniPlayer ? 'Exit Mini' : 'Mini Player'}</span>
                </button>
                <button
                  className={`btn-overlay-toggle subtle ${isAlwaysOnTop ? 'active' : ''}`}
                  onClick={onToggleAlwaysOnTop}
                  type="button"
                >
                  <IconPin />
                  <span>{isAlwaysOnTop ? 'On Top' : 'Pin On Top'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <video ref={videoRef} className="video-frame" controls autoPlay playsInline />

      {isChannelBrowserOpen && (
        <div
          className="player-browser-overlay"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="false"
          aria-label="Channel browser"
        >
          <div className="player-browser-header">
            <div>
              <h3>Channel Browser</h3>
              <p>Search, switch view, zoom, and jump to another channel.</p>
            </div>
            <button className="btn-overlay-toggle" onClick={onCloseChannelBrowser} type="button">
              Close
            </button>
          </div>

          <BrowserToolbar
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
            onZoomOut={onZoomOut}
            onZoomIn={onZoomIn}
            canZoomOut={canZoomOut}
            canZoomIn={canZoomIn}
            resultCount={channels.length}
            theme={theme}
            onToggleTheme={onToggleTheme}
            compact
          />

          <div className="player-browser-scroll">
            <ChannelResults
              channels={channels}
              selectedChannel={channel}
              onSelect={onChannelSelect}
              viewMode={viewMode}
              className="player-browser-results"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function App() {
  const [state, setState] = useState(() => {
    try {
      return sanitizeStoredState(JSON.parse(window.localStorage.getItem(STORAGE_KEY)))
    } catch {
      return sanitizeStoredState()
    }
  })
  const [formData, setFormData] = useState(emptyForm)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [navSelection, setNavSelection] = useState('all')
  const [selectedChannel, setSelectedChannel] = useState(null)
  const [isPlayerChannelBrowserOpen, setIsPlayerChannelBrowserOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('grid')
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false)
  const [isMiniPlayer, setIsMiniPlayer] = useState(false)
  const [theme, setTheme] = useState(getInitialTheme)

  const desktopApi = useMemo(() => getDesktopApi(), [])
  const deferredSearchQuery = useDeferredValue(searchQuery)

  const allChannels = useMemo(
    () =>
      state.playlists.flatMap((playlist) =>
        (playlist.channels || []).map((channel) => ({
          ...channel,
          playlistId: playlist.id,
          playlistName: playlist.name,
          active: playlist.active,
          key: createChannelKey(playlist.id, channel.url),
        })),
      ),
    [state.playlists],
  )

  const displayedChannels = useMemo(() => {
    if (navSelection === 'all') {
      return allChannels.filter((channel) => channel.active)
    }
    return allChannels.filter((channel) => channel.playlistId === navSelection)
  }, [allChannels, navSelection])

  const filteredChannels = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase()
    if (!query) return displayedChannels
    return displayedChannels.filter((channel) =>
      [channel.name, channel.group, channel.playlistName].some((value) =>
        value?.toLowerCase().includes(query),
      ),
    )
  }, [deferredSearchQuery, displayedChannels])

  const browserContentStyle = useMemo(
    () => ({
      '--channel-grid-min': `${GRID_TILE_WIDTHS[zoomIndex]}px`,
      '--channel-grid-gap': `${GRID_GAPS[zoomIndex]}px`,
      '--channel-list-logo': `${LIST_LOGO_SIZES[zoomIndex]}px`,
      '--channel-list-padding': `${LIST_PADDINGS[zoomIndex]}px`,
      '--channel-list-gap': `${LIST_GAPS[zoomIndex]}px`,
    }),
    [zoomIndex],
  )

  const canZoomOut = zoomIndex > 0
  const canZoomIn = zoomIndex < GRID_TILE_WIDTHS.length - 1
  const isCompactWindow = Boolean(selectedChannel && (isMiniPlayer || isAlwaysOnTop))

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (!desktopApi?.getWindowState) return undefined

    let cancelled = false

    async function loadWindowState() {
      try {
        const windowState = await desktopApi.getWindowState()
        if (cancelled || !windowState) return
        setIsAlwaysOnTop(Boolean(windowState.isAlwaysOnTop))
        setIsMiniPlayer(Boolean(windowState.isMiniPlayer))
      } catch {
        setIsAlwaysOnTop(false)
        setIsMiniPlayer(false)
      }
    }

    loadWindowState()

    return () => {
      cancelled = true
    }
  }, [desktopApi])

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key !== 'Escape') return
      if (isPlayerChannelBrowserOpen) {
        setIsPlayerChannelBrowserOpen(false)
        return
      }
      if (selectedChannel) {
        setSelectedChannel(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPlayerChannelBrowserOpen, selectedChannel])

  async function buildPlaylist(formInput) {
    const definition = serializePlaylistDefinition(formInput)
    if (!definition.name || !definition.source) throw new Error('Playlist URL is required.')

    const directStream = /\.(m3u8|mp4|webm|ogg)(\?|$)/i.test(definition.source)
    if (directStream) {
      return {
        ...definition,
        channels: [{ name: definition.name, url: definition.source, group: 'Live', logo: '' }],
        lastLoadedAt: Date.now(),
        error: '',
      }
    }

    let response
    if (desktopApi?.fetchPlaylist) {
      try {
        response = await desktopApi.fetchPlaylist(definition.source)
      } catch (error) {
        throw new Error(error.message)
      }
      const parsed = parsePlaylistText(response.text, {
        baseUrl: response.finalUrl || definition.source,
        playlistName: definition.name,
        fallbackUrl: definition.source,
      })
      return { ...definition, channels: parsed.channels, lastLoadedAt: Date.now(), error: '' }
    }

    try {
      response = await fetch(definition.source)
    } catch {
      throw new Error(
        'Playlist URL could not be loaded due to CORS. Use a direct stream or enable desktop mode.',
      )
    }
    if (!response.ok) throw new Error(`Playlist request failed with status ${response.status}.`)

    const text = await response.text()
    const parsed = parsePlaylistText(text, {
      baseUrl: definition.source,
      playlistName: definition.name,
      fallbackUrl: definition.source,
    })
    return { ...definition, channels: parsed.channels, lastLoadedAt: Date.now(), error: '' }
  }

  async function handleLoadPlaylist(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const playlist = await buildPlaylist(formData)
      setState((currentState) => {
        const existingIndex = currentState.playlists.findIndex((item) => item.id === playlist.id)
        const nextPlaylists =
          existingIndex >= 0
            ? currentState.playlists.map((item) => (item.id === playlist.id ? playlist : item))
            : [playlist, ...currentState.playlists]
        return { ...currentState, playlists: nextPlaylists }
      })
      setIsAddModalOpen(false)
      setFormData(emptyForm)
      setNavSelection('all')
    } catch (error) {
      alert(error.message)
    } finally {
      setBusy(false)
    }
  }

  function getNavTitle() {
    if (navSelection === 'all') return 'All Channels'
    const playlist = state.playlists.find((item) => item.id === navSelection)
    return playlist ? playlist.name : 'Unknown'
  }

  function handleChannelSelect(channel) {
    setSelectedChannel(channel)
    setIsPlayerChannelBrowserOpen(false)
  }

  async function handleToggleAlwaysOnTop() {
    if (!desktopApi?.setAlwaysOnTop) return
    try {
      const windowState = await desktopApi.setAlwaysOnTop(!isAlwaysOnTop)
      setIsAlwaysOnTop(Boolean(windowState?.isAlwaysOnTop))
    } catch (error) {
      alert(error.message)
    }
  }

  async function handleToggleMiniPlayer(forceValue) {
    if (!desktopApi?.setMiniPlayer) return
    const nextValue = typeof forceValue === 'boolean' ? forceValue : !isMiniPlayer
    try {
      const windowState = await desktopApi.setMiniPlayer(nextValue)
      setIsMiniPlayer(Boolean(windowState?.isMiniPlayer))
    } catch (error) {
      alert(error.message)
    }
  }

  async function handleClosePlayer() {
    setSelectedChannel(null)
    setIsPlayerChannelBrowserOpen(false)
    if (isMiniPlayer) {
      await handleToggleMiniPlayer(false)
    }
  }

  return (
    <div className={`app-layout ${isCompactWindow ? 'compact-layout' : ''}`}>
      {!isCompactWindow && (
        <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-logo">
          <div className="logo-box">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          {!isSidebarCollapsed && <div className="sidebar-brand">QuickIPTV Player</div>}
          <button
            className="sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            type="button"
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <IconSidebarToggle collapsed={isSidebarCollapsed} />
          </button>
        </div>

        <div className="sidebar-actions">
          <button className="btn-pill" onClick={() => setIsAddModalOpen(true)} type="button">
            <span>+</span>
            {!isSidebarCollapsed && <span>Add Playlist</span>}
          </button>
        </div>

        <div className="sidebar-nav">
          {!isSidebarCollapsed && <h3 className="nav-section-title">YOUR PLAYLISTS</h3>}
          <button
            className={`nav-item ${navSelection === 'all' ? 'active' : ''}`}
            onClick={() => setNavSelection('all')}
            type="button"
            title="All Channels"
          >
            <span className="nav-item-label">{isSidebarCollapsed ? 'All' : 'All Channels'}</span>
          </button>
          {state.playlists.map((playlist) => (
            <button
              key={playlist.id}
              className={`nav-item ${navSelection === playlist.id ? 'active' : ''}`}
              onClick={() => setNavSelection(playlist.id)}
              title={playlist.name}
              type="button"
            >
              <span className="nav-item-label">
                {isSidebarCollapsed ? playlist.name.slice(0, 1).toUpperCase() : playlist.name}
              </span>
            </button>
          ))}
        </div>
        <div className="sidebar-footer">
          <div>{isSidebarCollapsed ? 'QI' : 'pappuraj.com'}</div>
          {!isSidebarCollapsed && (
            <a
              className="sidebar-footer-link"
              href="https://play.google.com/store/apps/details?id=com.pappuraj.quickiptvplayer"
              target="_blank"
              rel="noreferrer"
            >
              Android App
            </a>
          )}
        </div>
      </aside>
      )}

      {selectedChannel ? (
        <ChannelPlayer
          channel={selectedChannel}
          channels={filteredChannels}
          viewMode={viewMode}
          browserContentStyle={browserContentStyle}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onViewModeChange={setViewMode}
          onZoomOut={() => setZoomIndex((current) => Math.max(0, current - 1))}
          onZoomIn={() =>
            setZoomIndex((current) => Math.min(GRID_TILE_WIDTHS.length - 1, current + 1))
          }
          canZoomOut={canZoomOut}
          canZoomIn={canZoomIn}
          isChannelBrowserOpen={isPlayerChannelBrowserOpen}
          onChannelSelect={handleChannelSelect}
          onClose={handleClosePlayer}
          onOpenChannelBrowser={() => setIsPlayerChannelBrowserOpen(true)}
          onCloseChannelBrowser={() => setIsPlayerChannelBrowserOpen(false)}
          isDesktop={Boolean(desktopApi?.isDesktop)}
          isMiniPlayer={isMiniPlayer}
          isAlwaysOnTop={isAlwaysOnTop}
          theme={theme}
          onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          onToggleMiniPlayer={() => void handleToggleMiniPlayer()}
          onToggleAlwaysOnTop={() => void handleToggleAlwaysOnTop()}
        />
      ) : (
        <main className="main-content" style={browserContentStyle}>
          <div className="main-header">
            <div className="header-titles">
              <h1>{getNavTitle()}</h1>
              <p>{filteredChannels.length} channels available</p>
            </div>
            <BrowserToolbar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onZoomOut={() => setZoomIndex((current) => Math.max(0, current - 1))}
              onZoomIn={() =>
                setZoomIndex((current) => Math.min(GRID_TILE_WIDTHS.length - 1, current + 1))
              }
              canZoomOut={canZoomOut}
              canZoomIn={canZoomIn}
              resultCount={filteredChannels.length}
              theme={theme}
              onToggleTheme={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            />
          </div>

          <div className="main-scroll-area">
            <ChannelResults
              channels={filteredChannels}
              selectedChannel={selectedChannel}
              onSelect={handleChannelSelect}
              viewMode={viewMode}
            />
          </div>
        </main>
      )}

      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Add Playlist</h2>
            <p>Enter an M3U or M3U8 playlist URL.</p>

            <form onSubmit={handleLoadPlaylist}>
              <div className="input-group">
                <label>Playlist URL</label>
                <input
                  type="text"
                  autoFocus
                  value={formData.source}
                  onChange={(event) => setFormData({ ...formData, source: event.target.value })}
                  required
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => {
                    setIsAddModalOpen(false)
                    setFormData(emptyForm)
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={busy}>
                  {busy ? 'Loading...' : 'Load Playlist'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
