import { useEffect, useRef } from 'react'

export default function LoadingScreen() {
  const waveRef = useRef(null)

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

  return (
    <div style={styles.wrapper}>
      <div className="waves loading-waves" ref={waveRef}></div>
    </div>
  )
}

const styles = {
  wrapper: {
    position: "relative",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    background: "#0a0a0a",
    overflow: "hidden",
  },
}
