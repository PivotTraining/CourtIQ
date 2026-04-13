"use client";

export default function TabBar({ tabs, active, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        background: "var(--color-muted)",
        borderRadius: 12,
        padding: 3,
        marginBottom: 16,
        gap: 3,
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            flex: 1,
            padding: "10px 8px",
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 700,
            transition: "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            background:
              active === tab.id ? "var(--color-card)" : "transparent",
            color:
              active === tab.id
                ? "var(--color-accent)"
                : "var(--color-text-sec)",
            boxShadow:
              active === tab.id
                ? "0 2px 8px rgba(0,0,0,0.08)"
                : "none",
          }}
        >
          {tab.icon && <span style={{ display: "flex", alignItems: "center" }}>{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
