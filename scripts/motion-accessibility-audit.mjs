import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('src/App.jsx', 'utf8');
const styles = fs.readFileSync('src/components/ui.css', 'utf8');
const workspace = fs.readFileSync('src/components/workspace/workspace.css', 'utf8');
assert.match(app, /matchMedia\?\.\("\(prefers-reduced-motion: reduce\)"\)\.matches \? "instant" : "smooth"/);
assert.match(app, /role=\{toast\.type === "error" \? "alert" : "status"\} aria-atomic="true"/);
assert.match(styles, /\.vf-page-enter\s*\{\s*animation:[^;]*0\.26s/);
assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.vf-page-enter,[\s\S]*animation: none !important/);
assert.match(workspace, /@media \(prefers-reduced-motion: reduce\)[^}]*transition: none/);
assert.match(app, /panelLayout\.estimatedPanelsThatFit > 0 && \(\s*<div className="grid-cols-4"/);
console.log('PASS: Source-level motion preference and announcement guards; OS reduced-motion runtime remains a separate manual check.');
