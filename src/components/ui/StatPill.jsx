"use client";

export default function StatPill({ label, value, sub, color = "#FF6B35" }) {
  return (
    <div
      className="bg-card rounded-2xl py-3.5 px-2.5 text-center shadow-[0_2px_12px_rgba(0,0,0,0.06)] flex-1 min-w-0"
      style={{ borderTop: `3px solid ${color}` }}
    >
      <div className="text-[22px] font-extrabold text-text leading-none">{value}</div>
      <div className="text-[11px] text-text-sec mt-1 font-semibold uppercase tracking-wider">
        {label}
      </div>
      {sub && <div className="text-[10px] text-text-sec mt-0.5">{sub}</div>}
    </div>
  );
}
