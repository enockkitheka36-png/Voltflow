import React from "react";
import "./BrandLogo.css";

export function BrandLogo({ style }) {
  return (
    <svg className="vf-brand-logo" viewBox="1000 2500 3800 1200" role="img" aria-label="Voltflow" style={style}>
      <image href="./logo.png" width="6250" height="6250" />
    </svg>
  );
}
