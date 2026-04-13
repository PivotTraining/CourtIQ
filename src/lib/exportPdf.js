/* ══════════════════════════════════════════════════════
   COURT IQ — PDF Season Report Export
   Generates a clean, branded PDF with season stats.
   ══════════════════════════════════════════════════════ */

export async function generateSeasonReport(player, season, ratings) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  let y = 20;

  const accent = [255, 107, 53];
  const dark = [26, 29, 46];
  const gray = [107, 113, 148];

  // ── Header ──
  doc.setFillColor(...accent);
  doc.rect(0, 0, w, 45, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("Court IQ", 15, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Season Report", 15, 26);
  doc.text(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), 15, 33);

  // Player info (right side of header)
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(player.name || "Player", w - 15, 18, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`${player.position || ""} ${player.team ? `· ${player.team}` : ""} ${player.number ? `#${player.number}` : ""}`, w - 15, 26, { align: "right" });
  if (ratings) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`OVR: ${ratings.overall}`, w - 15, 36, { align: "right" });
  }

  y = 55;

  // ── Season Overview ──
  doc.setTextColor(...dark);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Season Overview", 15, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...gray);

  const overviewData = [
    ["Games Played", season.gamesPlayed?.toString() || "0"],
    ["Practice Sessions", season.practiceSessions?.toString() || "0"],
    ["Total Shots", season.totalShots?.toString() || "0"],
    ["Total Points", season.totalPts?.toString() || "0"],
    ["Minutes Per Game", season.mpg || "0"],
  ];

  for (const [label, value] of overviewData) {
    doc.setTextColor(...gray);
    doc.text(label, 15, y);
    doc.setTextColor(...dark);
    doc.setFont("helvetica", "bold");
    doc.text(value, 90, y);
    doc.setFont("helvetica", "normal");
    y += 7;
  }

  y += 5;

  // ── Per-Game Averages ──
  doc.setTextColor(...dark);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Per-Game Averages", 15, y);
  y += 10;

  doc.setFontSize(10);
  const avgData = [
    ["Points Per Game", season.ppg || "0"],
    ["Assists Per Game", season.apg || "0"],
    ["Rebounds Per Game", season.rpg || "0"],
    ["Steals Per Game", season.spg || "0"],
    ["Blocks Per Game", season.bpg || "0"],
    ["Turnovers Per Game", season.topg || "0"],
  ];

  for (const [label, value] of avgData) {
    doc.setTextColor(...gray);
    doc.setFont("helvetica", "normal");
    doc.text(label, 15, y);
    doc.setTextColor(...dark);
    doc.setFont("helvetica", "bold");
    doc.text(value, 90, y);
    y += 7;
  }

  y += 5;

  // ── Shooting Splits ──
  doc.setTextColor(...dark);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Shooting Splits", 15, y);
  y += 10;

  doc.setFontSize(10);
  const shootingData = [
    ["Field Goal %", `${season.fgPct || 0}%`],
    ["3-Point %", `${season.threePct || 0}%`],
    ["2-Point %", `${season.twoPct || 0}%`],
  ];

  for (const [label, value] of shootingData) {
    doc.setTextColor(...gray);
    doc.setFont("helvetica", "normal");
    doc.text(label, 15, y);
    doc.setTextColor(...dark);
    doc.setFont("helvetica", "bold");
    doc.text(value, 90, y);
    y += 7;
  }

  y += 5;

  // ── Skill Ratings ──
  if (ratings) {
    doc.setTextColor(...dark);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Skill Ratings", 15, y);
    y += 10;

    doc.setFontSize(10);
    const ratingData = [
      ["Overall", ratings.overall],
      ["Shooting", ratings.shooting],
      ["Playmaking", ratings.playmaking],
      ["Rebounding", ratings.rebounding],
      ["Defense", ratings.defense],
      ["Efficiency", ratings.efficiency],
    ];

    for (const [label, value] of ratingData) {
      doc.setTextColor(...gray);
      doc.setFont("helvetica", "normal");
      doc.text(label, 15, y);

      // Draw rating bar
      doc.setFillColor(240, 241, 245);
      doc.rect(90, y - 3, 80, 4, "F");
      doc.setFillColor(...accent);
      doc.rect(90, y - 3, (value / 100) * 80, 4, "F");

      doc.setTextColor(...dark);
      doc.setFont("helvetica", "bold");
      doc.text(value.toString(), 175, y);
      y += 7;
    }
  }

  y += 5;

  // ── Career Highs ──
  if (season.highs) {
    doc.setTextColor(...dark);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Career Highs", 15, y);
    y += 10;

    doc.setFontSize(10);
    if (season.highs.pts > 0) { doc.setTextColor(...gray); doc.setFont("helvetica", "normal"); doc.text("Points", 15, y); doc.setTextColor(...dark); doc.setFont("helvetica", "bold"); doc.text(season.highs.pts.toString(), 90, y); y += 7; }
    if (season.highs.ast > 0) { doc.setTextColor(...gray); doc.setFont("helvetica", "normal"); doc.text("Assists", 15, y); doc.setTextColor(...dark); doc.setFont("helvetica", "bold"); doc.text(season.highs.ast.toString(), 90, y); y += 7; }
    if (season.highs.reb > 0) { doc.setTextColor(...gray); doc.setFont("helvetica", "normal"); doc.text("Rebounds", 15, y); doc.setTextColor(...dark); doc.setFont("helvetica", "bold"); doc.text(season.highs.reb.toString(), 90, y); y += 7; }
  }

  // ── Footer ──
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 180);
  doc.text("Generated by Court IQ — A product of Pivot Training and Development", w / 2, 285, { align: "center" });

  // Save
  doc.save(`CourtIQ_${(player.name || "Player").replace(/\s+/g, "_")}_Season_Report.pdf`);
}
