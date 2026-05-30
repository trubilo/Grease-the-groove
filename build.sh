#!/bin/bash
# GTG Pull Tracker - Build Script
# Compiles app.jsx → index.html (self-contained, no CDN dependencies)
# Usage: ./build.sh
# Output: index.html (ready to upload to GitHub Pages)

set -e

echo "→ Compiling JSX..."
npx babel app.jsx --out-file app.compiled.js

echo "→ Validating JS..."
node -e "
const js = require('fs').readFileSync('app.compiled.js','utf8');
try { new Function(js); console.log('  JS syntax OK'); }
catch(e) { console.error('  SYNTAX ERROR:', e.message); process.exit(1); }
"

echo "→ Bundling HTML..."
python3 bundle.py

echo "→ Done. index.html is ready to upload."
echo "   Deploy: upload index.html to GitHub repo as index.html"
echo "   URL: https://trubilo.github.io/Grease-the-groove"
