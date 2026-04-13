"use client";

export default function SectionDivider() {
  return (
    <div
      style={{
        marginTop: 20,
        marginBottom: 20,
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          flex: 1,
          height: 1.5,
          background:
            "linear-gradient(to right, transparent, #D5D7E0, transparent)",
        }}
      />
    </div>
  );
}
