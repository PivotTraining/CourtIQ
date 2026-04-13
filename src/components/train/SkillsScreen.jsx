"use client";

import { useState, useMemo } from "react";
import { DRILL_BANK, DRILL_CATEGORIES, SKILL_LEVELS } from "@/lib/drillBank";
import Icon from "@/components/ui/Icons";

const cardStyle = {
  background: "var(--color-card)",
  borderRadius: 16,
  border: "1px solid var(--color-border)",
  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
  overflow: "hidden",
};

export default function SkillsScreen() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedLevel, setSelectedLevel] = useState("all");
  const [expandedDrill, setExpandedDrill] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredDrills = useMemo(() => {
    let drills = DRILL_BANK;
    if (selectedCategory !== "all") drills = drills.filter((d) => d.category === selectedCategory);
    if (selectedLevel !== "all") drills = drills.filter((d) => d.level === selectedLevel);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      drills = drills.filter((d) =>
        d.name.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return drills;
  }, [selectedCategory, selectedLevel, searchQuery]);

  const categoryCount = useMemo(() => {
    const counts = { all: DRILL_BANK.length };
    DRILL_BANK.forEach((d) => { counts[d.category] = (counts[d.category] || 0) + 1; });
    return counts;
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Search */}
      <div style={{ position: "relative" }}>
        <Icon name="target" size={16} color="var(--color-text-sec)" style={{ position: "absolute", left: 14, top: 14 }} />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search 162 drills..."
          style={{
            width: "100%", padding: "12px 16px 12px 38px", borderRadius: 14,
            border: "1px solid var(--color-border)", background: "var(--color-card)",
            fontSize: 14, fontWeight: 600, outline: "none", boxSizing: "border-box",
            color: "var(--color-text)", fontFamily: "inherit",
          }}
        />
      </div>

      {/* Skill Level Filter */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
        <button
          onClick={() => setSelectedLevel("all")}
          style={{
            padding: "8px 14px", borderRadius: 20, border: "none", cursor: "pointer",
            fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
            background: selectedLevel === "all" ? "#FF6B35" : "var(--color-muted)",
            color: selectedLevel === "all" ? "white" : "var(--color-text-sec)",
          }}
        >
          All Levels
        </button>
        {SKILL_LEVELS.map((l) => (
          <button
            key={l.id}
            onClick={() => setSelectedLevel(l.id === selectedLevel ? "all" : l.id)}
            style={{
              padding: "8px 14px", borderRadius: 20, border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
              background: selectedLevel === l.id ? l.color : "var(--color-muted)",
              color: selectedLevel === l.id ? "white" : "var(--color-text-sec)",
            }}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Category Pills */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
        <button
          onClick={() => setSelectedCategory("all")}
          style={{
            padding: "8px 12px", borderRadius: 12, border: "none", cursor: "pointer",
            fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
            display: "flex", alignItems: "center", gap: 4,
            background: selectedCategory === "all" ? "var(--color-card)" : "var(--color-muted)",
            color: selectedCategory === "all" ? "var(--color-accent)" : "var(--color-text-sec)",
            boxShadow: selectedCategory === "all" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
          }}
        >
          All ({categoryCount.all})
        </button>
        {DRILL_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCategory(c.id === selectedCategory ? "all" : c.id)}
            style={{
              padding: "8px 12px", borderRadius: 12, border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
              display: "flex", alignItems: "center", gap: 4,
              background: selectedCategory === c.id ? "var(--color-card)" : "var(--color-muted)",
              color: selectedCategory === c.id ? c.color : "var(--color-text-sec)",
              boxShadow: selectedCategory === c.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <Icon name={c.iconName} size={12} color={selectedCategory === c.id ? c.color : "var(--color-text-sec)"} />
            {c.label} ({categoryCount[c.id] || 0})
          </button>
        ))}
      </div>

      {/* Results count */}
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-sec)", padding: "0 2px" }}>
        {filteredDrills.length} drill{filteredDrills.length !== 1 ? "s" : ""}
        {selectedLevel !== "all" && ` · ${SKILL_LEVELS.find((l) => l.id === selectedLevel)?.label}`}
        {selectedCategory !== "all" && ` · ${DRILL_CATEGORIES.find((c) => c.id === selectedCategory)?.label}`}
      </div>

      {/* Drill List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filteredDrills.map((drill) => {
          const isExpanded = expandedDrill === drill.id;
          const cat = DRILL_CATEGORIES.find((c) => c.id === drill.category);
          const level = SKILL_LEVELS.find((l) => l.id === drill.level);

          return (
            <div key={drill.id} style={cardStyle}>
              {/* Drill Header — always visible */}
              <button
                onClick={() => setExpandedDrill(isExpanded ? null : drill.id)}
                style={{
                  width: "100%", padding: "14px 16px", background: "none", border: "none",
                  cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12,
                }}
              >
                {/* Category icon */}
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: `${cat?.color || "#6B7194"}15`,
                }}>
                  <Icon name={cat?.iconName || "basketball"} size={20} color={cat?.color || "#6B7194"} />
                </div>

                {/* Name + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {drill.name}
                    </span>
                    {drill.hasAnimation && (
                      <Icon name="stickman" size={14} color={cat?.color || "#FF6B35"} />
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: level?.color || "#6B7194" }}>{drill.level}</span>
                    <span style={{ fontSize: 10, color: "var(--color-text-sec)" }}>{drill.reps} reps</span>
                    <span style={{ fontSize: 10, color: "var(--color-text-sec)" }}>~{drill.duration}min</span>
                  </div>
                </div>

                {/* Expand chevron */}
                <Icon name="chevDown" size={16} color="var(--color-text-sec)"
                  style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s ease" }} />
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--color-border)" }}>
                  {/* Description */}
                  <p style={{ fontSize: 13, color: "var(--color-text-sec)", lineHeight: 1.6, margin: "12px 0" }}>
                    {drill.description}
                  </p>

                  {/* Coaching Tip */}
                  {drill.videoTip && (
                    <div style={{
                      background: "rgba(255,107,53,0.06)", borderRadius: 12, padding: "10px 14px",
                      border: "1px solid rgba(255,107,53,0.1)", marginBottom: 8,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <Icon name="zap" size={12} color="#FF6B35" />
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#FF6B35" }}>Coaching Tip</span>
                      </div>
                      <p style={{ fontSize: 12, color: "var(--color-text-sec)", lineHeight: 1.5, margin: 0 }}>
                        {drill.videoTip}
                      </p>
                    </div>
                  )}

                  {/* Tags */}
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 8 }}>
                    {drill.tags.map((tag) => (
                      <span key={tag} style={{
                        fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 8,
                        background: "var(--color-muted)", color: "var(--color-text-sec)",
                        textTransform: "uppercase", letterSpacing: 0.3,
                      }}>
                        {tag}
                      </span>
                    ))}
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "3px 8px", borderRadius: 8,
                      background: `${level?.color}15`, color: level?.color,
                      textTransform: "uppercase",
                    }}>
                      {drill.ageRange === "all" ? "All ages" : `Ages ${drill.ageRange}`}
                    </span>
                  </div>

                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredDrills.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <Icon name="target" size={40} color="var(--color-text-sec)" />
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-text)", marginTop: 12 }}>No drills found</div>
          <div style={{ fontSize: 13, color: "var(--color-text-sec)", marginTop: 4 }}>Try a different filter or search term</div>
        </div>
      )}

      <div style={{ height: 20 }} />
    </div>
  );
}
