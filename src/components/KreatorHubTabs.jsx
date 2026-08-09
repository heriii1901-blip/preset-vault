import { useRef, useState } from 'react'
import Kreator from '../pages/Kreator'

export default function KreatorHubTabs({ creatorUsername, ownPresets, loadingOwn, navigate }) {
  const [activePage, setActivePage] = useState(0)
  const scrollerRef = useRef(null)

  function goToPage(index) {
    setActivePage(index)
    const el = scrollerRef.current
    if (el) el.scrollTo({ left: el.clientWidth * index, behavior: 'smooth' })
  }

  function handleScroll(e) {
    const el = e.currentTarget
    const index = Math.round(el.scrollLeft / el.clientWidth)
    if (index !== activePage) setActivePage(index)
  }

  return (
    <div className="kreator-hub">
      <div className="kreator-hub-tabs">
        <button
          type="button"
          className={`kreator-hub-tab${activePage === 0 ? ' is-active' : ''}`}
          onClick={() => goToPage(0)}
        >
          Kreator
        </button>
        <button
          type="button"
          className={`kreator-hub-tab${activePage === 1 ? ' is-active' : ''}`}
          onClick={() => goToPage(1)}
        >
          Panel Saya
        </button>
      </div>

      <div className="kreator-hub-scroller" ref={scrollerRef} onScroll={handleScroll}>
        <div className="kreator-hub-page">
          <Kreator />
        </div>

        <div className="kreator-hub-page">
          <div className="admin-content" style={{ padding: '14px 18px 20px' }}>
            <div className="admin-header">
              <span className="admin-tag">KREATOR</span>
              <h2>Preset Kamu ({ownPresets.length})</h2>
            </div>
            <button
              className="save-btn"
              style={{ marginBottom: 16 }}
              onClick={() => navigate('/kreator/tambah-preset')}
            >
              + Upload Preset Baru
            </button>
            {loadingOwn && <div className="empty-state">Memuat presetmu...</div>}
            {!loadingOwn && ownPresets.length === 0 && (
              <div className="empty-state">Kamu belum punya preset. Yuk upload pertamamu!</div>
            )}
            {!loadingOwn && ownPresets.length > 0 && (
              <div className="preset-grid" style={{ padding: 0 }}>
                {ownPresets.map((p) => (
                  <div
                    key={p.id}
                    className="grid-cell"
                    onClick={() => navigate(`/preset/${p.id}`, { state: { source: 'kreator', creatorUsername } })}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    {p.preview_video_url ? (
                      <video
                        src={p.preview_video_url}
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        draggable={false}
                      />
                    ) : (
                      <div className="grid-fallback">🎬</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
