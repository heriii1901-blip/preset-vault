import { BottomNav } from '../components/BottomNav'

export default function Kreator() {
  return (
    <div className="screen">
      <div className="empty-state" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>
        Akan Hadir!!!
      </div>
      <BottomNav />
    </div>
  )
}
