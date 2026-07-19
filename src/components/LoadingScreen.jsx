export default function LoadingScreen() {
  return (
    <div style={styles.wrapper}>
      <svg width="200" height="120" viewBox="0 0 240 160">
        <defs>
          <style>{`
            .bar { transform-origin: bottom; }
            .b1 { animation: bar1 0.9s ease-in-out infinite; }
            .b2 { animation: bar2 0.9s ease-in-out infinite 0.1s; }
            .b3 { animation: bar3 0.9s ease-in-out infinite 0.2s; }
            .b4 { animation: bar1 0.9s ease-in-out infinite 0.3s; }
            .b5 { animation: bar2 0.9s ease-in-out infinite 0.15s; }
            @keyframes bar1 { 0%,100% { transform: scaleY(0.3); } 50% { transform: scaleY(1); } }
            @keyframes bar2 { 0%,100% { transform: scaleY(0.9); } 50% { transform: scaleY(0.35); } }
            @keyframes bar3 { 0%,100% { transform: scaleY(0.5); } 50% { transform: scaleY(1); } }
            .wl { animation: wave 1.2s ease-in-out infinite; }
            @keyframes wave { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
          `}</style>
        </defs>

        <g transform="translate(61,20)">
          <rect className="bar b1" x="0" y="20" width="14" height="80" rx="7" fill="#8b5cf6" />
          <rect className="bar b2" x="26" y="20" width="14" height="80" rx="7" fill="#8b5cf6" />
          <rect className="bar b3" x="52" y="20" width="14" height="80" rx="7" fill="#8b5cf6" />
          <rect className="bar b4" x="78" y="20" width="14" height="80" rx="7" fill="#8b5cf6" />
          <rect className="bar b5" x="104" y="20" width="14" height="80" rx="7" fill="#8b5cf6" />
        </g>

        <g fill="#a1a1aa" fontSize="14" textAnchor="middle">
          {["m","e","m","u","a","t","."," .","."].map((ch, i) => (
            <text
              key={i}
              x={60 + i * 10}
              y="140"
              className="wl"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              {ch}
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    background: "#0a0a0a",
  },
};
