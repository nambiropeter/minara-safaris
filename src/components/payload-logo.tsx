import React from "react";

export function PayloadLogo() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 0" }}>
      <img
        src="/images/minara-logo.png"
        alt="Minara Safaris"
        style={{
          maxHeight: "84px",
          width: "auto",
          objectFit: "contain",
          filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05))",
        }}
      />
    </div>
  );
}

export default PayloadLogo;
