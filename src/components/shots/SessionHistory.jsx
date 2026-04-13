"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { fetchSessionHistory } from "@/lib/queries";
import { calcPct } from "@/lib/utils";
import { COURT_ZONES } from "@/lib/constants";
import Icon from "@/components/ui/Icons";

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StatCell({ value, label, color }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontSize: 18,
          fontWeight: 900,
          color: color || "var(--color-text)",
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 8,
          color: "var(--color-text-sec)",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function SessionCard({ session }) {
  const shots = session.shot_logs || [];
  const stats = session.game_stats || {};
  const madeShots = shots.filter((s) => s.made).length;
  const fgPct = calcPct(madeShots, shots.length);

  const totalPts =
    shots
      .filter((s) => s.made)
      .reduce((sum, s) => {
        const zone = COURT_ZONES.find((z) => z.id === s.zone_id);
        return sum + (zone?.pts || 2);
      }, 0) + (stats.ft_made || 0);

  return (
    <div
      style={{
        background: "var(--color-card)",
        borderRadius: 16,
        padding: 16,
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        border: "1px solid var(--color-border)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon
            name={session.type === "game" ? "trophy" : "zap"}
            size={20}
            color="#FF6B35"
          />
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--color-text)",
                textTransform: "capitalize",
              }}
            >
              {session.type}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--color-text-sec)",
              }}
            >
              {formatDate(session.created_at)}
            </div>
          </div>
        </div>
        {session.mode === "team" && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "var(--color-accent)",
              background: "rgba(255,107,53,0.1)",
              padding: "2px 8px",
              borderRadius: 6,
            }}
          >
            Team
          </span>
        )}
      </div>

      {/* Stats Row */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        {totalPts > 0 && (
          <StatCell value={totalPts} label="PTS" color="var(--color-accent)" />
        )}
        {shots.length > 0 && (
          <StatCell
            value={`${fgPct}%`}
            label="FG"
            color={
              fgPct >= 50 ? "#22C55E" : fgPct >= 40 ? "#FF6B35" : "#EF4444"
            }
          />
        )}
        {shots.length > 0 && (
          <StatCell value={`${madeShots}/${shots.length}`} label="SHOTS" />
        )}
        {stats.ast > 0 && (
          <StatCell value={stats.ast} label="AST" color="#22C55E" />
        )}
        {stats.reb > 0 && (
          <StatCell value={stats.reb} label="REB" color="#F59E0B" />
        )}
        {stats.stl > 0 && (
          <StatCell value={stats.stl} label="STL" color="#22C55E" />
        )}
        {stats.blk > 0 && (
          <StatCell value={stats.blk} label="BLK" color="#8B5CF6" />
        )}
        {stats.min > 0 && (
          <div style={{ textAlign: "center", marginLeft: "auto" }}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: "var(--color-text-sec)",
                lineHeight: 1.2,
              }}
            >
              {stats.min}
            </div>
            <div
              style={{
                fontSize: 8,
                color: "var(--color-text-sec)",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              MIN
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SessionHistory() {
  const { playerId } = useApp();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, game, practice

  useEffect(() => {
    if (!playerId) return;
    fetchSessionHistory(playerId)
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [playerId]);

  const filtered =
    filter === "all" ? sessions : sessions.filter((s) => s.type === filter);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginTop: 8,
        }}
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              height: 96,
              background: "var(--color-muted)",
              borderRadius: 16,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <h3
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: "var(--color-text)",
            margin: 0,
          }}
        >
          Session History
        </h3>
        <span
          style={{
            fontSize: 11,
            color: "var(--color-text-sec)",
          }}
        >
          {sessions.length} sessions
        </span>
      </div>

      {/* Filter */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
        }}
      >
        {["all", "game", "practice"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "8px 14px",
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 700,
              textTransform: "capitalize",
              border: "none",
              cursor: "pointer",
              minHeight: 36,
              display: "flex",
              alignItems: "center",
              gap: 4,
              background:
                filter === f ? "var(--color-accent)" : "var(--color-muted)",
              color:
                filter === f ? "#fff" : "var(--color-text-sec)",
            }}
          >
            {f === "all" ? (
              "All"
            ) : f === "game" ? (
              <>
                <Icon name="trophy" size={12} /> Games
              </>
            ) : (
              <>
                <Icon name="zap" size={12} /> Practice
              </>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px 0",
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <Icon name="barChart" size={32} color="#6B7194" />
          </div>
          <p
            style={{
              fontSize: 14,
              color: "var(--color-text-sec)",
              margin: 0,
            }}
          >
            No sessions yet. Start tracking!
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {filtered.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      )}
    </div>
  );
}
