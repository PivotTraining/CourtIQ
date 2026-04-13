"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import SectionHeader from "@/components/ui/SectionHeader";
import Card from "@/components/ui/Card";
import SectionDivider from "@/components/ui/SectionDivider";
import EmptyState from "@/components/ui/EmptyState";

const SORT_OPTIONS = [
  { id: "pts", label: "Points" },
  { id: "ast", label: "Assists" },
  { id: "reb", label: "Rebounds" },
  { id: "fgPct", label: "FG%" },
];

export default function TeamScreen() {
  const { teamData, teamInfo, loading } = useApp();
  const [sortBy, setSortBy] = useState("pts");

  if (loading) {
    return (
      <div className="animate-pulse flex flex-col gap-4">
        <div className="h-32 bg-muted rounded-[20px]" />
        <div className="h-16 bg-muted rounded-2xl" />
        <div className="h-16 bg-muted rounded-2xl" />
        <div className="h-16 bg-muted rounded-2xl" />
      </div>
    );
  }

  if (teamData.length === 0) {
    return (
      <EmptyState
        icon="👥"
        title="No team yet"
        subtitle="Team features are coming soon. For now, focus on tracking your individual game!"
      />
    );
  }

  const sorted = [...teamData].sort((a, b) => b[sortBy] - a[sortBy]);

  return (
    <div>
      {/* Team Header */}
      {teamInfo.name && (
        <div className="bg-gradient-to-br from-[#1A1D2E] to-[#2D3048] rounded-[20px] p-5 mb-2 text-white text-center">
          <div className="text-lg font-extrabold tracking-tight">{teamInfo.name}</div>
          <div className="text-xs opacity-70 mt-1">
            {teamInfo.season} Season {teamInfo.record !== "0-0" ? `\u00B7 ${teamInfo.record} Record` : ""}
          </div>
          <div className="flex justify-center gap-5 mt-3.5">
            {[
              { label: "PPG", value: teamInfo.ppg },
              { label: "FG%", value: teamInfo.fgPct },
              { label: "APG", value: teamInfo.apg },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-xl font-black">{s.value}</div>
                <div className="text-[10px] opacity-60 font-semibold uppercase">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <SectionDivider />

      {/* Sort Controls */}
      <SectionHeader icon="👥" title="Roster Stats" />
      <div className="flex gap-1.5 mb-3.5 flex-wrap">
        {SORT_OPTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSortBy(s.id)}
            className={`py-1.5 px-3.5 rounded-full border-none cursor-pointer text-xs font-bold transition-all ${
              sortBy === s.id ? "bg-accent text-white" : "bg-muted text-text-sec"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {sorted.map((p) => (
        <Card
          key={p.name}
          className="p-3.5 mb-2 flex items-center gap-3"
          style={{ border: p.isUser ? "2px solid #FF6B35" : "1px solid transparent" }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-extrabold"
            style={{ background: p.isUser ? "#FF6B35" : "#F0F1F5", color: p.isUser ? "white" : "#6B7194" }}
          >
            {p.role || "?"}
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold text-text flex items-center gap-1.5">
              {p.name}
              {p.isUser && (
                <span className="text-[9px] bg-accent-light text-accent px-1.5 py-[2px] rounded font-extrabold">YOU</span>
              )}
            </div>
          </div>
          <div className="flex gap-3 items-center">
            {[
              { key: "pts", label: "PPG", value: p.pts },
              { key: "ast", label: "APG", value: p.ast },
              { key: "reb", label: "RPG", value: p.reb },
              { key: "fgPct", label: "FG%", value: `${p.fgPct}%` },
            ].map((stat) => (
              <div key={stat.key} className="text-center">
                <div className="text-[15px] font-extrabold" style={{ color: sortBy === stat.key ? "#FF6B35" : "#1A1D2E" }}>
                  {stat.value}
                </div>
                <div className="text-[9px] text-text-sec font-semibold">{stat.label}</div>
              </div>
            ))}
          </div>
        </Card>
      ))}

      <SectionDivider />

      <div className="bg-gradient-to-br from-[#F0FDF4] to-[#DCFCE7] rounded-[14px] p-3.5 flex items-center gap-2.5 border border-[#BBF7D0]">
        <span className="text-[22px]">🤝</span>
        <div>
          <div className="text-xs font-bold text-[#166534]">Team Chemistry</div>
          <div className="text-[11px] text-[#15803D] leading-snug">
            Team features are being built out. Stay tuned for full roster analytics!
          </div>
        </div>
      </div>
    </div>
  );
}
