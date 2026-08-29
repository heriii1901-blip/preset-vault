import Kreator from '../pages/Kreator'
import { useSwipePages } from '../hooks/useSwipePages'
import { useTabIndicator } from '../hooks/useTabIndicator'
import PresetVideoCell from './PresetVideoCell'

export default function KreatorHubTabs({ creatorUsername, ownPresets, loadingOwn, navigate, getCache, setCache }) {
  const { activeIndex: activePage, progress, trackStyle, scrollerRef, goTo: goToPage, touchHandlers } = useSwipePages(2)
  const { containerRef, tabRefs, indicatorStyle, getTabColor } = useTabIndicator(progress, 2)

  return (
    <div className="kreator-hub">
      <div className="kreator-page-header">
        <div className="eyebrow">KREATOR</div>
      </div>

      <div className="kreator-hub-tabs" ref={containerRef}>
        <div className="tab-indicator" style={indicatorStyle} />
        <button
          ref={(el) => (tabRefs.current[0] = el)}
          type="button"
          className={`kreator-hub-tab${activePage === 0 ? ' is-active' : ''}`}
          style={{ color: getTabColor(0) }}
          onClick={() => goToPage(0)}
        >
          Kreator
        </button>
        <button
          ref={(el) => (tabRefs.current[1] = el)}
          type="button"
          className={`kreator-hub-tab${activePage === 1 ? ' is-active' : ''}`}
          style={{ color: getTabColor(1) }}
          onClick={() => goToPage(1)}
        >
          Panel Saya
        </button>
      </div>

      <div className="kreator-hub-scroller" ref={scrollerRef}>
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
                {ownPresets.map((p, i) => (
                  <PresetVideoCell
                    key={p.id}
                    preset={p}
                    index={i}
                    getCache={getCache}
                    setCache={setCache}
                    onNavigate={(preset) => navigate(`/preset/${preset.id}`, { state: { source: 'kreator', creatorUsername } })}
                    showOverlay={false}
                  />
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
