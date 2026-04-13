"use client";

import Icon from "@/components/ui/Icons";

export default function SectionHeader({ icon, title, action, onAction }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
        paddingLeft: 2,
        paddingRight: 2,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {typeof icon === "string" ? (
          <Icon name={icon} size={18} color="var(--color-accent)" />
        ) : (
          icon
        )}
        <span
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: "var(--color-text)",
          }}
        >
          {title}
        </span>
      </div>
      {action && (
        <button
          onClick={onAction}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--color-accent)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            padding: "4px 8px",
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}
