import Kreator from '../pages/Kreator'
import { useSwipePages } from '../hooks/useSwipePages'

export default function KreatorHubTabs({ creatorUsername, ownPresets, loadingOwn, navigate }) {
  const { activeIndex: activePage, containerRef, trackStyle, goTo: goToPage, touchHandlers } = useSwipePages(2)

  return (
    <div className="kreator-hub">
      <div className="kreator-page-header">
        <div className="eyebrow">KREATOR</div>
      </div>

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

      <div className="kreator-hub-scroller" ref={containerRef}>
        <div className="kreator-hub-track" style={trackStyle} {...touchHandlers}>
          <div className="kreator-hub-page">
            <Kreator hideHeader />
          </div>

          <div className="kreator-hub-page">
            <div className="admin-content" style={{ padding: '14px 0 0' }}>
              <div className="admin-header" style={{ padding: '0 18px' }}>
                <span className="admin-tag">KREATOR</span>
                <h2>Preset Kamu ({ownPresets.length})</h2>
              </div>
              <button
                className="save-btn"
                style={{ marginBottom: 16, marginLeft: 18, marginRight: 18, width: 'calc(100% - 36px)' }}
                onClick={() => navigate('/kreator/tambah-preset')}
              >
                + Upload Preset Baru
              </button>
              {loadingOwn && <div className="empty-state" style={{ paddingLeft: 18, paddingRight: 18 }}>Memuat presetmu...</div>}
              {!loadingOwn && ownPresets.length === 0 && (
                <div className="empty-state" style={{ paddingLeft: 18, paddingRight: 18 }}>Kamu belum punya preset. Yuk upload pertamamu!</div>
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
    </div>
  )
}
