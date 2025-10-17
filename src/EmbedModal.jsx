import { useEffect } from "react";

export default function EmbedModal({ trackId, onClose }) {
  useEffect(() => {
    const onEsc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  if (!trackId) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 640,
          background: "#111",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 10px 30px rgba(0,0,0,0.6)"
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 8,
            borderBottom: "1px solid #222",
            color: "#fff"
          }}
        >
          <span style={{ fontSize: 12, opacity: 0.8 }}>Playing on Spotify</span>
          <button onClick={onClose} style={{ color: "#ccc" }}>✕</button>
        </div>

        <iframe
          key={trackId} // force reload when track changes
          title="Spotify Player"
          src={`https://open.spotify.com/embed/track/${trackId}`}
          width="100%"
          height="152"
          frameBorder="0"
          allow="autoplay; encrypted-media; clipboard-write; fullscreen; picture-in-picture"
          loading="lazy"
        />
      </div>
    </div>
  );
}
