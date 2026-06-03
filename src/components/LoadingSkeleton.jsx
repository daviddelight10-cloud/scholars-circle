import React from "react";

export function CardSkeleton() {
  return (
    <div className="card" style={{ padding: "20px" }}>
      <div className="skeleton skeleton-title" style={{ height: "24px", width: "60%", marginBottom: "16px" }} />
      <div className="skeleton skeleton-text" style={{ height: "16px", width: "100%", marginBottom: "8px" }} />
      <div className="skeleton skeleton-text" style={{ height: "16px", width: "90%", marginBottom: "8px" }} />
      <div className="skeleton skeleton-text" style={{ height: "16px", width: "80%", marginBottom: "16px" }} />
      <div className="skeleton skeleton-button" style={{ height: "40px", width: "120px", borderRadius: "8px" }} />
    </div>
  );
}

export function ListSkeleton({ count = 3 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton skeleton-list-item" style={{ height: "60px", borderRadius: "8px" }} />
      ))}
    </div>
  );
}

export function TextSkeleton({ lines = 3 }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton skeleton-text"
          style={{
            height: "16px",
            width: i === lines - 1 ? "70%" : "100%",
          }}
        />
      ))}
    </div>
  );
}

export function AvatarSkeleton() {
  return (
    <div
      className="skeleton skeleton-avatar"
      style={{
        width: "48px",
        height: "48px",
        borderRadius: "50%",
      }}
    />
  );
}

export function StatsGridSkeleton({ count = 4 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ padding: "20px" }}>
          <div className="skeleton skeleton-title" style={{ height: "20px", width: "40%", marginBottom: "12px" }} />
          <div className="skeleton skeleton-text" style={{ height: "32px", width: "60%", marginBottom: "8px" }} />
          <div className="skeleton skeleton-text" style={{ height: "14px", width: "80%" }} />
        </div>
      ))}
    </div>
  );
}

export default function LoadingSkeleton({ type = "card", ...props }) {
  switch (type) {
    case "card":
      return <CardSkeleton {...props} />;
    case "list":
      return <ListSkeleton {...props} />;
    case "text":
      return <TextSkeleton {...props} />;
    case "avatar":
      return <AvatarSkeleton {...props} />;
    case "stats":
      return <StatsGridSkeleton {...props} />;
    default:
      return <CardSkeleton {...props} />;
  }
}
