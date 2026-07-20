export default function LoadingScreen() {
  return (
    <div style={styles.wrapper}>
      <div style={styles.waveBox}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            style={{
              ...styles.bar,
              animationDelay: `${i * 0.12}s`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes wave-bar {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}

const styles = {
  wrapper: {
    position: "fixed",
    inset: 0,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#0a0a0a",
  },
  waveBox: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    height: "90px",
  },
  bar: {
    width: "10px",
    height: "80px",
    borderRadius: "99px",
    background: "linear-gradient(180deg, #7C5CFF, #FF3D7F)",
    animation: "wave-bar 0.9s ease-in-out infinite",
    transformOrigin: "center",
  },
}
