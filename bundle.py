#!/usr/bin/env python3
"""
GTG Pull Tracker - HTML Bundler
Combines React + ReactDOM + compiled app JS into a single self-contained index.html
All </script> tags inside JS bundles are escaped to prevent HTML parser breakage.
"""
import re

def escape_scripts(s):
    """Escape </script> and <script> literals inside JS to prevent HTML parser confusion."""
    s = s.replace('</script>', r'<\/script>')
    s = s.replace('<script>', r'\x3cscript>')
    return s

react       = escape_scripts(open('react.min.js').read())
reactdom    = escape_scripts(open('react-dom.min.js').read())
compiled    = open('app.compiled.js').read()
# Strip the final ReactDOM.createRoot line - we add it after export/import functions
compiled_body = escape_scripts('\n'.join(compiled.strip().split('\n')[:-1]))

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"/>
  <meta name="mobile-web-app-capable" content="yes"/>
  <meta name="apple-mobile-web-app-capable" content="yes"/>
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
  <meta name="theme-color" content="#07070e"/>
  <link rel="manifest" href="data:application/json,%7B%22name%22%3A%22GTG+Pull+Tracker%22%2C%22short_name%22%3A%22GTG%22%2C%22display%22%3A%22standalone%22%2C%22background_color%22%3A%22%2307070e%22%2C%22theme_color%22%3A%22%2307070e%22%7D"/>
  <title>GTG Pull Tracker</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }}
    body {{ background: #07070e; color: #f0f0f0; font-family: 'Courier New', monospace; overscroll-behavior: none; -webkit-text-size-adjust: 100%; }}
    input::-webkit-outer-spin-button, input::-webkit-inner-spin-button {{ -webkit-appearance: none; }}
    input[type=number] {{ -moz-appearance: textfield; }}
    ::-webkit-scrollbar {{ display: none; }}
    #err {{ color:#ff6b6b; padding:20px; font-size:13px; line-height:1.6; white-space:pre-wrap; word-break:break-all; }}
  </style>
</head>
<body>
<div id="root"><div style="color:#555;padding:20px;font-family:monospace">Loading...</div></div>
<script>{react}</script>
<script>{reactdom}</script>
<script>
window.onerror = function(msg,src,line,col,err) {{
  document.getElementById('root').innerHTML = '<div id=err>CRASH:\\n'+msg+'\\nLine:'+line+'\\n'+(err&&err.stack||'')+'</div>';
  return true;
}};
</script>
<script>
{compiled_body}

function exportData() {{
  try {{
    const raw = localStorage.getItem("gtg_pull_v1");
    if (!raw) {{ alert("No data to export yet."); return; }}
    const blob = new Blob([raw], {{type:"application/json"}});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "gtg-backup-"+new Date().toISOString().slice(0,10)+".json";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }} catch(e) {{ alert("Export failed: "+e.message); }}
}}

function importData(file, onDone) {{
  const reader = new FileReader();
  reader.onload = function(e) {{
    try {{
      const parsed = JSON.parse(e.target.result);
      if (!parsed.logs) {{ alert("Invalid backup file."); return; }}
      localStorage.setItem("gtg_pull_v1", JSON.stringify(parsed));
      onDone();
    }} catch(err) {{ alert("Could not read file: "+err.message); }}
  }};
  reader.readAsText(file);
}}

window.gtgExport = exportData;
window.gtgImport = importData;

try {{
  ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App, null));
}} catch(e) {{
  document.getElementById('root').innerHTML = '<div id=err>RENDER ERROR:\\n'+e.message+'\\n'+(e.stack||'')+'</div>';
}}
</script>
</body>
</html>"""

# Verify no raw script tags leaked through
blocks = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
issues = [(i, b.count('<script>'), b.count('</script>')) for i,b in enumerate(blocks)
          if b.count('<script>') or b.count('</script>')]
if issues:
    print(f"WARNING: script tag leakage in blocks {issues}")
else:
    print(f"  Script blocks: {len(blocks)}, no leakage ✓")

with open('index.html', 'w') as f:
    f.write(html)

size_kb = len(html) // 1024
print(f"  Output: index.html ({size_kb} KB)")
