"use client";

import Icon from "@/components/ui/Icons";

export default function EmptyState({ icon, title, subtitle, actionLabel, onAction }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "64px 24px",
        textAlign: "center",
      }}
    >
      <div style={{ marginBottom: 16 }}>
        {typeof icon === "string" ? (
          <Icon name={icon} size={48} color="var(--color-text-sec)" />
        ) : (
          icon
        )}
      </div>
      <h3
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "var(--color-text)",
          marginBottom: 4,
          marginTop: 0,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 14,
          color: "var(--color-text-sec)",
          lineHeight: 1.5,
          maxWidth: 280,
          margin: 0,
        }}
      >
        {subtitle}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          style={{
            marginTop: 16,
            padding: "10px 20px",
            borderRadius: 12,
            background: "var(--color-accent)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            minHeight: 44,
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
