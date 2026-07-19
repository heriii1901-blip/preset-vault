import LoadingScreen from "../components/LoadingScreen";
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { user, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const waveRef = useRef(null)

  // Kalau udah login, langsung lempar ke home, gak usah liat layar login lagi
  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  // Generate bar waveform ambient di background, sama kayak di mockup
  useEffect(() => {
    const wave = waveRef.current
    if (!wave) return
    wave.innerHTML = ''
    for (let i = 0; i < 28; i++) {
      const bar = document.createElement('span')
      bar.style.height = `${14 + Math.random() * 112}px`
      bar.style.animationDelay = `${Math.random() * 1.5}s`
      wave.appendChild(bar)
    }
  }, [])

  const handleLogin = async () => {
    try {
      await loginWithGoogle()
    } catch (err) {
      console.error('Login gagal:', err)
      alert('Login gagal, coba lagi.')
    }
  }

  export default function Login() {
  // ... state-state yang udah ada (misal: const [loading, setLoading] = useState...)

  if (loading) return <LoadingScreen />;
    
  return (
    <div className="screen login-screen">
      <div className="waves" ref={waveRef}></div>
      <div className="login-content">
        <div className="eyebrow">PAM · PRESET VAULT</div>
        <div className="brand">
          Simpen preset,
          <br />
          pantengin beat.
        </div>
        <div className="tagline">
          Koleksi preset jedag-jedug lo, tersusun rapi per lagu. Masuk sekali,
          ketuk-ketuk selamanya.
        </div>
        <button className="google-btn" onClick={handleLogin}>
          <svg viewBox="0 0 48 48" width="18" height="18">
            <path fill="#FFC107" d="M43.6 20.5H42V20.4H24v7.2h11.3c-1.6 4.6-6 7.9-11.3 7.9-6.9 0-12.5-5.6-12.5-12.5S17.1 10.5 24 10.5c3.2 0 6.1 1.2 8.3 3.2l5.4-5.4C34.5 5 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.7-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6 4.4C13.9 15.1 18.6 12 24 12c3.2 0 6.1 1.2 8.3 3.2l5.4-5.4C34.5 6.5 29.5 4.5 24 4.5c-7.6 0-14.2 4.3-17.7 10.2z" />
            <path fill="#4CAF50" d="M24 44c5.4 0 10.3-1.9 14.1-5.1l-6.5-5.5c-2.1 1.5-4.8 2.4-7.6 2.4-5.3 0-9.7-3.3-11.3-7.9l-6.2 4.8C10 39.6 16.5 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20.4H24v7.2h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.5 5.5c-.4.4 7-5.1 7-14.7 0-1.4-.1-2.7-.4-3.5z" />
          </svg>
          Masuk pake Google
        </button>
        <div className="fine-print">
          Lanjut = setuju sama Ketentuan & Privasi PAM
        </div>
      </div>
    </div>
  )
}
