const { useState, useEffect, useCallback, useMemo } = React;

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
var BODYWEIGHT_KG = 105; // overridden by user setting at runtime
const G = 9.81; // m/s²
// Pull-up ROM: ~0.5m vertical displacement per rep (conservative)
const ROM_M = 0.5;
// Work per rep (J) = mass × g × displacement
const JOULES_PER_KG_PER_REP = G * ROM_M; // 4.905 J per kg per rep
const JOULES_PER_REP = BODYWEIGHT_KG * JOULES_PER_KG_PER_REP; // ~515 J per rep
// Mechanical efficiency of muscle ~25%, so metabolic cost ~4x mechanical work
const metabolicJPerRep = JOULES_PER_REP / 0.25;
const kcalPerRep = metabolicJPerRep / 4184;

const STORAGE_KEY = "gtg_pull_v1";

const GRIPS = [
  { id: "narrow",  label: "Narrow",  sub: "pronated · straight bar",   color: "#00E5FF" },
  { id: "wide",    label: "Wide",    sub: "pronated · sloped handles",  color: "#39FF14" },
  { id: "neutral", label: "Neutral", sub: "hammer · medium handles",    color: "#FF9500" },
  { id: "chin",    label: "Chin-up", sub: "supinated · close handles",  color: "#FF4081" },
];

// bwFraction: % of bodyweight lifted (Gouvali & Boudolos 2005); rom: vertical displacement (m)
const PUSH_TYPES = [
  { id: "wide",     label: "Wide",     sub: "hands wide · chest focus",  color: "#FF6B6B", bwFraction: 0.70, rom: 0.25 },
  { id: "standard", label: "Standard", sub: "shoulder-width · balanced", color: "#FBBF24", bwFraction: 0.69, rom: 0.25 },
  { id: "diamond",  label: "Diamond",  sub: "hands close · triceps",     color: "#A78BFA", bwFraction: 0.75, rom: 0.25 },
];

const WEEK_GOAL_START = 100;
const PUSH_GOAL_START = 150;

// All date functions use LOCAL time to avoid UTC timezone shift bugs
function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+dd;
}

function todayStr() { return localDateStr(new Date()); }

function getWeekStart(dateStr) {
  // Monday-based week, fully local time
  const [y,m,day2] = dateStr.split('-').map(Number);
  const d = new Date(y, m-1, day2);
  const dow = d.getDay(); // 0=Sun,1=Mon,...,6=Sat
  const diff = dow === 0 ? -6 : 1 - dow; // Mon=0 offset
  d.setDate(d.getDate() + diff);
  return localDateStr(d);
}

function formatDate(str) {
  const [y,m,d] = str.split('-').map(Number);
  const date = new Date(y,m-1,d);
  const dayNames = ["Su","Mo","Tu","We","Th","Fr","Sa"];
  return dayNames[date.getDay()] + " " + d;
}
function formatDayName(str) {
  const [y,m,d] = str.split('-').map(Number);
  const date = new Date(y,m-1,d);
  return ["Su","Mo","Tu","We","Th","Fr","Sa"][date.getDay()];
}
function formatDayNum(str) {
  return str.split('-')[2].replace(/^0/,'');
}

function getLast7Days() {
  // Always show Mon-Sun of current week, Monday first
  const today = new Date();
  const dow = today.getDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  const days = [];
  for (let i=0; i<7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(localDateStr(d));
  }
  return days;
}

function getLast8Weeks() {
  const weeks = [];
  for (let i=7; i>=0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i*7);
    weeks.push(getWeekStart(localDateStr(d)));
  }
  return [...new Set(weeks)];
}

function getLast30Days() {
  var days = [];
  for (var i=29; i>=0; i--) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    days.push(localDateStr(d));
  }
  return days;
}

// Push joules for a single log entry (object with wide/standard/diamond counts)
// Each type uses its own bwFraction and rom; bodyweightKg is the user's bodyweight
function pushJoulesForEntry(entry, bodyweightKg) {
  return PUSH_TYPES.reduce(function(sum, t) {
    return sum + (entry[t.id] || 0) * bodyweightKg * t.bwFraction * 9.81 * t.rom;
  }, 0);
}

function loadStorage() { try { const r=localStorage.getItem(STORAGE_KEY); return r?JSON.parse(r):null; } catch{return null;} }
function saveStorage(s) { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(s)); } catch{} }

// ─── ICONS ───────────────────────────────────────────────────────────────────
function Icon({name,size=20,color="currentColor"}) {
  const p = {
    bar:    <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    flame:  <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 01-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/>,
    trophy: <><path d="M6 9H4.5a2.5 2.5 0 010-5H6"/><path d="M18 9h1.5a2.5 2.5 0 000-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0012 0V2z"/></>,
    plus:   <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    x:      <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    trash:  <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></>,
    zap:    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>,
    target: <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
    edit:   <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{p[name]}</svg>;
}

// ─── RING ─────────────────────────────────────────────────────────────────────
function Ring({pct,color,size=80,stroke=6,children}) {
  const r=(size-stroke*2)/2, circ=2*Math.PI*r;
  const safePct = Math.min(pct, 1);
  return (
    <div style={{position:"relative",display:"inline-block",width:size,height:size}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)",position:"absolute",top:0,left:0}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e1e30" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={circ*(1-safePct)}
          style={{transition:"stroke-dashoffset 0.6s ease"}} strokeLinecap="round"/>
        {pct>1 && <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color+"55"} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={circ*(1-(pct-1))}
          style={{transition:"stroke-dashoffset 0.6s ease"}} strokeLinecap="round"/>}
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column"}}>
        {children}
      </div>
    </div>
  );
}

// ─── BAR CHART ───────────────────────────────────────────────────────────────
function safeGrip(d, gid) {
  return (d && d.grips && d.grips[gid]) ? d.grips[gid] : 0;
}

function BarChart({data, colorFn, labelFn, valueFn, height, goal, stacked, labelEvery, types}) {
  var BAR_H = height || 80;
  labelEvery = labelEvery || 1;
  var chartTypes = types || GRIPS;
  var today = todayStr();
  var vals = data.map(function(d) {
    return stacked ? chartTypes.reduce(function(a,g){return a+safeGrip(d,g.id);},0) : valueFn(d);
  });
  var max = Math.max.apply(null, vals.concat([goal||0, 1]));
  var gap = 4;
  return (
    <div>
      <table style={{width:"100%",borderCollapse:"separate",borderSpacing:`${gap}px 0`,tableLayout:"fixed"}}>
        <tbody>
          <tr style={{verticalAlign:"bottom",height:`${BAR_H+20}px`}}>
            {data.map(function(d,i) {
              var total = vals[i];
              var barH = total>0 ? Math.max(4, Math.round((total/max)*BAR_H)) : 2;
              var isToday = d.date === today;
              return (
                <td key={i} style={{verticalAlign:"bottom",padding:0,height:`${BAR_H+20}px`}}>
                  <div style={{height:"18px",display:"flex",alignItems:"flex-end",justifyContent:"center",marginBottom:"2px"}}>
                    {total>0 && <div style={{fontSize:"11px",color:isToday?"#fff":"#bbb",fontWeight:"900",lineHeight:"1"}}>{total}</div>}
                  </div>
                  {total===0 ? (
                    <div style={{width:"100%",height:"2px",background:"#1e1e2e"}}/>
                  ) : stacked ? (
                    <div style={{width:"100%",height:`${barH}px`,overflow:"hidden",borderRadius:"3px 3px 0 0"}}>
                      {[...chartTypes].reverse().map(function(g) {
                        var r = safeGrip(d, g.id);
                        if(!r) return null;
                        var sh = Math.max(1, Math.round((r/total)*barH));
                        return <div key={g.id} style={{width:"100%",height:`${sh}px`,background:isToday?g.color:g.color+"99"}}/>;
                      })}
                    </div>
                  ) : (
                    <div style={{width:"100%",height:`${barH}px`,background:isToday?colorFn(d,i):colorFn(d,i)+"77",borderRadius:"3px 3px 0 0"}}/>
                  )}
                </td>
              );
            })}
          </tr>
          <tr>
            {data.map(function(d,i) {
              var isToday = d.date === today;
              var showLabel = labelEvery===1 || (i % labelEvery === 0) || isToday;
              var label = d.date ? formatDayName(d.date) : labelFn(d);
              var num = d.date ? formatDayNum(d.date) : "";
              return (
                <td key={i} style={{textAlign:"center",padding:"4px 0 0 0"}}>
                  {showLabel && <div style={{fontSize:"11px",fontWeight:"900",color:isToday?"#00E5FF":"#888",lineHeight:"1.3"}}>{label}</div>}
                  {showLabel && <div style={{fontSize:"11px",color:isToday?"#ccc":"#555",lineHeight:"1.3"}}>{num}</div>}
                  {!showLabel && <div style={{height:"22px"}}/>}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── GENERIC EDIT LOG MODAL ──────────────────────────────────────────────────
function EditLogModal({date, existing, types, accentColor, onClose, onSave, onDelete}) {
  const [reps, setReps] = useState({...existing});
  const inp = {
    textAlign:"center", background:"#0a0a18", border:"1px solid #2a2a40",
    borderRadius:"8px", color:"#f0f0f0", fontSize:"22px", fontWeight:"900",
    padding:"6px 4px", fontFamily:"'Courier New',monospace", outline:"none", width:"100%",
  };
  const setV = (id, val) => setReps(r=>({...r,[id]:Math.max(0,val)}));
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",zIndex:100,
      display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:"#0e0e1e",borderRadius:"24px 24px 0 0",
        padding:"24px 20px 44px",width:"100%",border:"1px solid #1e1e32"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
          <span style={{fontSize:"14px",fontWeight:"900",color:accentColor||"#BF5FFF",letterSpacing:"2px"}}>EDIT</span>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"#888"}}>
            <Icon name="x" size={22}/>
          </button>
        </div>
        <div style={{fontSize:"13px",color:"#888",marginBottom:"18px"}}>{date}</div>
        {types.map(g=>{
          const r = reps[g.id]||0;
          return (
            <div key={g.id} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"10px"}}>
              <div style={{width:"72px",flexShrink:0,fontSize:"13px",fontWeight:"900",color:r>0?g.color:"#888"}}>{g.label}</div>
              <button onClick={()=>setV(g.id,r-1)} style={{width:"36px",height:"36px",borderRadius:"8px",
                border:`1px solid ${r>0?g.color+"55":"#252530"}`,background:"transparent",
                color:r>0?g.color:"#555",fontSize:"20px",cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>−</button>
              <input type="number" value={r===0?"":r} placeholder="0"
                onChange={e=>setV(g.id,parseInt(e.target.value)||0)} style={inp}/>
              <button onClick={()=>setV(g.id,r+1)} style={{width:"36px",height:"36px",borderRadius:"8px",
                border:`1px solid ${g.color+"55"}`,background:g.color+"15",
                color:g.color,fontSize:"15px",fontWeight:"900",cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>+1</button>
              <button onClick={()=>setV(g.id,r+5)} style={{width:"36px",height:"36px",borderRadius:"8px",
                border:`1px solid ${g.color+"55"}`,background:g.color+"25",
                color:g.color,fontSize:"13px",fontWeight:"900",cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>+5</button>
            </div>
          );
        })}
        <div style={{display:"flex",gap:"8px",marginTop:"10px"}}>
          <button onClick={()=>onSave(reps)} style={{flex:1,padding:"13px",
            background:`linear-gradient(135deg,${accentColor||"#BF5FFF"},${accentColor||"#7B2FFF"})`,border:"none",
            borderRadius:"10px",color:"#fff",fontWeight:"900",fontSize:"14px",
            letterSpacing:"2px",cursor:"pointer",fontFamily:"'Courier New',monospace"}}>SAVE</button>
          <button onClick={onDelete} style={{padding:"13px 16px",background:"transparent",
            border:"1px solid #ff444444",borderRadius:"10px",color:"#ff4444",
            fontSize:"13px",cursor:"pointer",fontFamily:"'Courier New',monospace"}}>DELETE</button>
        </div>
      </div>
    </div>
  );
}

// ─── GOAL MODAL ───────────────────────────────────────────────────────────────
function GoalModal({currentGoal, currentPushGoal, currentWeight, onClose, onSave}) {
  const [goal, setGoal] = useState(String(currentGoal));
  const [pushGoal, setPushGoal] = useState(String(currentPushGoal));
  const [weight, setWeight] = useState(String(currentWeight));
  const inp = {background:"#0f0f22",border:"1px solid #2a2a40",borderRadius:"10px",
    color:"#f0f0f0",padding:"12px",fontSize:"22px",textAlign:"center",
    fontFamily:"'Courier New',monospace",width:"100%",outline:"none"};
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:100,
      display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}} onClick={onClose}>
      <div onClick={function(e){e.stopPropagation();}} style={{background:"#0e0e1e",borderRadius:"20px",
        padding:"28px 22px",width:"100%",maxWidth:"340px",border:"1px solid #1e1e32"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px"}}>
          <span style={{fontSize:"14px",fontWeight:"900",color:"#FF9500",letterSpacing:"2px"}}>SETTINGS</span>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"#ccc"}}>
            <Icon name="x" size={22}/>
          </button>
        </div>

        <div style={{fontSize:"11px",color:"#FF9500",letterSpacing:"3px",marginBottom:"6px"}}>BODYWEIGHT (kg)</div>
        <input type="number" value={weight} onChange={function(e){setWeight(e.target.value);}}
          style={{...inp, marginBottom:"6px"}}/>
        <div style={{fontSize:"12px",color:"#666",marginBottom:"18px"}}>Used for tonnage and energy calculations</div>

        <div style={{fontSize:"11px",color:"#00E5FF",letterSpacing:"3px",marginBottom:"6px"}}>WEEKLY PULL GOAL</div>
        <input type="number" value={goal} onChange={function(e){setGoal(e.target.value);}}
          style={{...inp, marginBottom:"6px"}}/>
        <div style={{fontSize:"12px",color:"#666",marginBottom:"18px"}}>Pull-up reps across all grips. Increase ~20% every 4 weeks.</div>

        <div style={{fontSize:"11px",color:"#FF6B6B",letterSpacing:"3px",marginBottom:"6px"}}>WEEKLY PUSH GOAL</div>
        <input type="number" value={pushGoal} onChange={function(e){setPushGoal(e.target.value);}}
          style={{...inp, marginBottom:"6px"}}/>
        <div style={{fontSize:"12px",color:"#666",marginBottom:"18px"}}>Pushup reps across all types. Increase ~20% every 4 weeks.</div>

        <button onClick={function(){onSave(Number(goal)||currentGoal, Number(pushGoal)||currentPushGoal, Number(weight)||currentWeight);}}
          style={{width:"100%",padding:"14px",background:"linear-gradient(135deg,#FF9500,#cc7700)",
            border:"none",borderRadius:"12px",color:"#000",fontWeight:"900",fontSize:"15px",
            letterSpacing:"2px",cursor:"pointer",fontFamily:"'Courier New',monospace"}}>
          SAVE SETTINGS
        </button>
      </div>
    </div>
  );
}

// ─── INLINE LOGGER ────────────────────────────────────────────────────────────
function InlineLogger({title, types, todayLog, isDirty, onSetVal, onSave, onCancel, dirtyColor}) {
  const totalReps = types.reduce((a,g)=>a+(todayLog[g.id]||0),0);
  const inp = {flex:1,textAlign:"center",background:"#0a0a18",borderRadius:"8px",
    color:"#888",fontSize:"22px",fontWeight:"900",padding:"6px 4px",
    fontFamily:"'Courier New',monospace",outline:"none",minWidth:0};
  return (
    <div style={{background:"#0e0e1e",borderRadius:"12px",padding:"16px",
      border:`1px solid ${isDirty?(dirtyColor||"#00E5FF")+"44":"#1a1a2a"}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
        <div style={{fontSize:"14px",color:"#ccc",letterSpacing:"3px"}}>{title}</div>
        <div style={{fontSize:"20px",fontWeight:"900",color:"#f0f0f0"}}>{totalReps} reps</div>
      </div>
      {types.map(g=>{
        const r = todayLog[g.id]||0;
        return (
          <div key={g.id} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"10px"}}>
            <div style={{width:"72px",flexShrink:0}}>
              <div style={{fontSize:"13px",fontWeight:"900",color:r>0?g.color:"#888"}}>{g.label}</div>
            </div>
            <button onClick={()=>onSetVal(g.id,r-1)}
              style={{width:"38px",height:"38px",borderRadius:"8px",border:`1px solid ${r>0?g.color+"55":"#252530"}`,
                background:"transparent",color:r>0?g.color:"#555",fontSize:"20px",fontWeight:"900",
                cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              −
            </button>
            <input type="number" value={r===0?"":r} placeholder="0"
              onChange={e=>onSetVal(g.id,parseInt(e.target.value)||0)}
              style={{...inp,border:`1px solid ${r>0?g.color+"55":"#252530"}`,color:r>0?g.color:"#888"}}/>
            <button onClick={()=>onSetVal(g.id,r+1)}
              style={{width:"38px",height:"38px",borderRadius:"8px",border:`1px solid ${g.color+"55"}`,
                background:g.color+"15",color:g.color,fontSize:"16px",fontWeight:"900",
                cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              +1
            </button>
            <button onClick={()=>onSetVal(g.id,r+5)}
              style={{width:"38px",height:"38px",borderRadius:"8px",border:`1px solid ${g.color+"55"}`,
                background:g.color+"25",color:g.color,fontSize:"14px",fontWeight:"900",
                cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              +5
            </button>
            <button onClick={()=>onSetVal(g.id,0)}
              style={{width:"28px",height:"28px",borderRadius:"6px",border:"1px solid #2a2a3a",
                background:"transparent",color:r>0?"#888":"#252530",fontSize:"14px",
                cursor:r>0?"pointer":"default",display:"flex",alignItems:"center",
                justifyContent:"center",flexShrink:0,transition:"color 0.15s"}}>
              ×
            </button>
          </div>
        );
      })}
      <div style={{display:"flex",gap:"8px",marginTop:"6px"}}>
        <button onClick={onSave}
          style={{flex:1,padding:"12px",
            background:isDirty?`linear-gradient(135deg,${dirtyColor||"#00E5FF"},${dirtyColor||"#0077aa"})`:"#1a1a2a",
            border:"none",borderRadius:"10px",color:isDirty?"#000":"#444",fontWeight:"900",
            fontSize:"14px",letterSpacing:"2px",cursor:isDirty?"pointer":"default",
            fontFamily:"'Courier New',monospace",transition:"all 0.2s"}}>
          {isDirty ? "SAVE" : "SAVED ✓"}
        </button>
        {isDirty && <button onClick={onCancel}
          style={{padding:"12px 16px",background:"transparent",border:"1px solid #2a2a3a",
            borderRadius:"10px",color:"#666",fontSize:"14px",cursor:"pointer",
            fontFamily:"'Courier New',monospace"}}>
          CANCEL
        </button>}
      </div>
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────
function App() {
  const [logs, setLogs]         = useState({});
  const [pushLogs, setPushLogs] = useState({});
  const [weekGoal, setWeekGoal] = useState(WEEK_GOAL_START);
  const [pushGoal, setPushGoal] = useState(PUSH_GOAL_START);
  const [bodyweight, setBodyweight] = useState(105);
  const [nav, setNav]           = useState("today");
  const [showGoal, setShowGoal] = useState(false);
  const [chartScale, setChartScale] = useState("week");
  const [pushChartScale, setPushChartScale] = useState("week");
  const [editDate, setEditDate] = useState(null);
  const [editPushDate, setEditPushDate] = useState(null);
  const [draft, setDraft]       = useState(null);
  const [pushDraft, setPushDraft] = useState(null);
  const isDirty = draft !== null;
  const isPushDirty = pushDraft !== null;
  const initialized = React.useRef(false);

  useEffect(()=>{
    const s=loadStorage();
    if(s){
      if(s.logs)     setLogs(s.logs);
      if(s.pushLogs) setPushLogs(s.pushLogs);
      if(s.weekGoal) setWeekGoal(s.weekGoal);
      if(s.pushGoal) setPushGoal(s.pushGoal);
      if(s.bodyweight) { setBodyweight(s.bodyweight); BODYWEIGHT_KG=s.bodyweight; }
    }
    initialized.current = true;
  },[]);

  useEffect(()=>{
    if(!initialized.current) return;
    saveStorage({logs,pushLogs,weekGoal,pushGoal,bodyweight});
  },[logs,pushLogs,weekGoal,pushGoal,bodyweight]);

  BODYWEIGHT_KG = bodyweight;

  const today = todayStr();

  // ── Pull draft ──
  const savedLog = logs[today] || {narrow:0,wide:0,neutral:0,chin:0};
  const todayLog = draft !== null ? draft : savedLog;
  const todayReps = GRIPS.reduce((a,g)=>a+(todayLog[g.id]||0),0);
  const saveDraft = () => { if(draft!==null){setLogs(prev=>({...prev,[today]:{...draft}}));setDraft(null);} };
  const cancelDraft = () => setDraft(null);
  const setGripVal = (id,val) => setDraft(prev=>({...(prev!==null?prev:savedLog),[id]:Math.max(0,val)}));

  // ── Push draft ──
  const savedPushLog = pushLogs[today] || {wide:0,standard:0,diamond:0};
  const todayPushLog = pushDraft !== null ? pushDraft : savedPushLog;
  const savePushDraft = () => { if(pushDraft!==null){setPushLogs(prev=>({...prev,[today]:{...pushDraft}}));setPushDraft(null);} };
  const cancelPushDraft = () => setPushDraft(null);
  const setPushGripVal = (id,val) => setPushDraft(prev=>({...(prev!==null?prev:savedPushLog),[id]:Math.max(0,val)}));

  // ── Energy constants (bodyweight-dependent) ──
  const joulesPerRep = bodyweight * 9.81 * 0.5;
  const metabolicJPerRep = joulesPerRep / 0.25;
  const kcalPerRep = metabolicJPerRep / 4184;

  // ── Pull week stats ──
  const weekStart = getWeekStart(today);
  const weekReps = useMemo(()=>
    Object.entries(logs)
      .filter(([d])=>getWeekStart(d)===weekStart)
      .reduce((a,[,v])=>a+GRIPS.reduce((b,g)=>b+(v[g.id]||0),0),0)
  ,[logs,weekStart]);
  const weekPct = weekGoal ? weekReps/weekGoal : 0;
  const weekTonnage  = weekReps * bodyweight;
  const weekKjoules  = weekReps * joulesPerRep / 1000;
  const weekKcal     = weekReps * kcalPerRep;

  // ── Push week stats ──
  const pushWeekReps = useMemo(()=>
    Object.entries(pushLogs)
      .filter(([d])=>getWeekStart(d)===weekStart)
      .reduce((a,[,v])=>a+PUSH_TYPES.reduce((b,g)=>b+(v[g.id]||0),0),0)
  ,[pushLogs,weekStart]);
  const pushWeekPct = pushGoal ? pushWeekReps/pushGoal : 0;

  // ── Pull all-time ──
  const allReps = useMemo(()=>
    Object.values(logs).reduce((a,v)=>a+GRIPS.reduce((b,g)=>b+(v[g.id]||0),0),0)
  ,[logs]);
  const allTonnage = allReps * bodyweight;
  const allJoules  = allReps * joulesPerRep;
  const allKcal    = allReps * kcalPerRep;

  // ── Push all-time ──
  const pushAllReps = useMemo(()=>
    Object.values(pushLogs).reduce((a,v)=>a+PUSH_TYPES.reduce((b,g)=>b+(v[g.id]||0),0),0)
  ,[pushLogs]);
  // Tonnage = effective weight moved per type (bwFraction × bodyweight × reps)
  const pushAllTonnage = useMemo(()=>
    Object.values(pushLogs).reduce((a,v)=>a+PUSH_TYPES.reduce((b,t)=>b+(v[t.id]||0)*bodyweight*t.bwFraction,0),0)
  ,[pushLogs,bodyweight]);
  // Energy: per-type bwFraction and rom (not identical to pull-up formula)
  const pushAllJoules = useMemo(()=>
    Object.values(pushLogs).reduce((a,v)=>a+pushJoulesForEntry(v,bodyweight),0)
  ,[pushLogs,bodyweight]);
  const pushAllKcal = pushAllJoules / 0.25 / 4184;

  // ── Pull chart data ──
  const last7 = getLast7Days().map(function(d) {
    const entry = logs[d] || {};
    return { date:d, reps:GRIPS.reduce((a,g)=>a+(entry[g.id]||0),0),
      grips:{narrow:entry.narrow||0,wide:entry.wide||0,neutral:entry.neutral||0,chin:entry.chin||0} };
  });
  const last8weeks = useMemo(()=>getLast8Weeks().map(ws=>({
    weekStart:ws,
    reps:Object.entries(logs).filter(([d])=>getWeekStart(d)===ws)
      .reduce((a,[,v])=>a+GRIPS.reduce((b,g)=>b+(v[g.id]||0),0),0),
  })),[logs]);
  const allTimeWeeks = useMemo(()=>{
    var allDates=Object.keys(logs).sort();
    if(allDates.length===0) return last8weeks;
    var cur=new Date(getWeekStart(allDates[0])), todayW=localDateStr(new Date()), weeks=[];
    while(localDateStr(cur)<=todayW){
      var ws=localDateStr(cur);
      weeks.push({weekStart:ws,reps:Object.entries(logs).filter(([d])=>getWeekStart(d)===ws)
        .reduce((a,[,v])=>a+GRIPS.reduce((b,g)=>b+(v[g.id]||0),0),0)});
      cur.setDate(cur.getDate()+7);
    }
    return weeks;
  },[logs]);

  // ── Push chart data ──
  const pushLast7 = getLast7Days().map(function(d) {
    const entry = pushLogs[d] || {};
    return { date:d, reps:PUSH_TYPES.reduce((a,g)=>a+(entry[g.id]||0),0),
      grips:{wide:entry.wide||0,standard:entry.standard||0,diamond:entry.diamond||0} };
  });
  const pushLast8weeks = useMemo(()=>getLast8Weeks().map(ws=>({
    weekStart:ws,
    reps:Object.entries(pushLogs).filter(([d])=>getWeekStart(d)===ws)
      .reduce((a,[,v])=>a+PUSH_TYPES.reduce((b,g)=>b+(v[g.id]||0),0),0),
  })),[pushLogs]);
  const pushAllTimeWeeks = useMemo(()=>{
    var allDates=Object.keys(pushLogs).sort();
    if(allDates.length===0) return pushLast8weeks;
    var cur=new Date(getWeekStart(allDates[0])), todayW=localDateStr(new Date()), weeks=[];
    while(localDateStr(cur)<=todayW){
      var ws=localDateStr(cur);
      weeks.push({weekStart:ws,reps:Object.entries(pushLogs).filter(([d])=>getWeekStart(d)===ws)
        .reduce((a,[,v])=>a+PUSH_TYPES.reduce((b,g)=>b+(v[g.id]||0),0),0)});
      cur.setDate(cur.getDate()+7);
    }
    return weeks;
  },[pushLogs]);

  // ── Grip/type breakdowns ──
  const weekGripReps = useMemo(()=>{
    const t={narrow:0,wide:0,neutral:0,chin:0};
    Object.entries(logs).filter(([d])=>getWeekStart(d)===weekStart)
      .forEach(([,v])=>GRIPS.forEach(g=>{t[g.id]+=(v[g.id]||0);}));
    return t;
  },[logs,weekStart]);
  const pushWeekTypeReps = useMemo(()=>{
    const t={wide:0,standard:0,diamond:0};
    Object.entries(pushLogs).filter(([d])=>getWeekStart(d)===weekStart)
      .forEach(([,v])=>PUSH_TYPES.forEach(g=>{t[g.id]+=(v[g.id]||0);}));
    return t;
  },[pushLogs,weekStart]);

  // ── History (combined pull+push dates) ──
  const historyDates = useMemo(()=>{
    const all = new Set([...Object.keys(logs),...Object.keys(pushLogs)]);
    return [...all].sort((a,b)=>b.localeCompare(a));
  },[logs,pushLogs]);

  const deleteLog     = (date)=>{setLogs(prev=>{const n={...prev};delete n[date];return n;});};
  const deletePushLog = (date)=>{setPushLogs(prev=>{const n={...prev};delete n[date];return n;});};

  const NAV=[
    {id:"today",  icon:"flame",  label:"TODAY"},
    {id:"stats",  icon:"bar",    label:"STATS"},
    {id:"history",icon:"trophy", label:"LOG"},
  ];

  return (
    <div style={{minHeight:"100vh",background:"#07070e",color:"#f0f0f0",
      fontFamily:"'Courier New',monospace",maxWidth:"480px",margin:"0 auto",position:"relative"}}>

      {/* ── TODAY ── */}
      {nav==="today" && (
        <div style={{paddingBottom:"80px"}}>
          <div style={{padding:"24px 20px 20px",background:"linear-gradient(180deg,#0c0c1e,#07070e)"}}>
            <div style={{fontSize:"14px",letterSpacing:"5px",color:"#aaa",marginBottom:"6px"}}>GTG TRACKER</div>
            <div style={{fontSize:"15px",color:"#ddd",marginBottom:"20px"}}>
              {new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}
            </div>

            {/* Dual weekly goals */}
            <div style={{marginBottom:"16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
                <div style={{fontSize:"13px",color:"#ccc",letterSpacing:"3px"}}>WEEKLY GOALS</div>
                <button onClick={()=>setShowGoal(true)}
                  style={{background:"none",border:"1px solid #2a2a3a",borderRadius:"20px",
                    cursor:"pointer",color:"#888",fontSize:"11px",fontWeight:"900",
                    padding:"4px 10px",fontFamily:"'Courier New',monospace",letterSpacing:"1px"}}>
                  ⚙ SETTINGS
                </button>
              </div>
              {[
                {label:"PULLS", reps:weekReps, goal:weekGoal, pct:weekPct, color:"#00E5FF"},
                {label:"PUSHES",reps:pushWeekReps,goal:pushGoal,pct:pushWeekPct,color:"#FF6B6B"},
              ].map(function(row){
                return (
                  <div key={row.label} style={{marginBottom:"10px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"3px"}}>
                      <div style={{fontSize:"11px",color:row.color,letterSpacing:"2px",width:"52px",flexShrink:0}}>{row.label}</div>
                      <div style={{fontSize:"22px",fontWeight:"900",color:row.color,lineHeight:1,minWidth:"40px"}}>{row.reps}</div>
                      <div style={{flex:1}}>
                        <div style={{height:"8px",background:"#1a1a2a",borderRadius:"4px",overflow:"hidden"}}>
                          <div style={{width:`${Math.min(100,Math.round(row.pct*100))}%`,height:"100%",
                            background:row.pct>=1?"#39FF14":row.color,borderRadius:"4px",transition:"width 0.5s"}}/>
                        </div>
                      </div>
                      <div style={{fontSize:"11px",color:row.pct>=1?"#39FF14":"#555",minWidth:"52px",textAlign:"right"}}>
                        {row.pct>=1?"✓ DONE":row.goal-row.reps+" left"}
                      </div>
                    </div>
                    <div style={{paddingLeft:"102px",fontSize:"11px",color:"#555"}}>{Math.round(row.pct*100)}% of {row.goal} reps</div>
                  </div>
                );
              })}
              {/* Weekly pull energy */}
              <div style={{display:"flex",gap:"8px",marginTop:"10px"}}>
                {[
                  {label:"TONNAGE",val:`${(weekTonnage/1000).toFixed(2)}t`,color:"#FF9500"},
                  {label:"ENERGY", val:`${Math.round(weekKjoules)}kJ`,    color:"#00E5FF"},
                  {label:"KCAL",   val:`${weekKcal.toFixed(1)}`,          color:"#39FF14"},
                ].map(function(s){ return (
                  <div key={s.label} style={{flex:1,background:"#0e0e1e",borderRadius:"8px",
                    padding:"8px 4px",textAlign:"center",border:`1px solid ${s.color}22`}}>
                    <div style={{fontSize:"15px",fontWeight:"900",color:s.color}}>{s.val}</div>
                    <div style={{fontSize:"10px",color:"#666",letterSpacing:"1px",marginTop:"2px"}}>{s.label}</div>
                  </div>
                ); })}
              </div>
            </div>

            {/* Pull logger */}
            <InlineLogger
              title="PULL-UPS"
              types={GRIPS}
              todayLog={todayLog}
              isDirty={isDirty}
              onSetVal={setGripVal}
              onSave={saveDraft}
              onCancel={cancelDraft}
              dirtyColor="#00E5FF"
            />

            {/* Push logger */}
            <div style={{marginTop:"12px"}}>
              <InlineLogger
                title="PUSHUPS"
                types={PUSH_TYPES}
                todayLog={todayPushLog}
                isDirty={isPushDirty}
                onSetVal={setPushGripVal}
                onSave={savePushDraft}
                onCancel={cancelPushDraft}
                dirtyColor="#FF6B6B"
              />
            </div>
          </div>

          {/* 7-day charts */}
          <div style={{padding:"0 16px"}}>
            <div style={{background:"#0c0c1c",borderRadius:"14px",padding:"16px",border:"1px solid #1a1a2a"}}>
              <div style={{fontSize:"14px",color:"#ccc",letterSpacing:"3px",marginBottom:"4px"}}>LAST 7 DAYS</div>
              <div style={{fontSize:"12px",color:"#888",marginBottom:"8px",letterSpacing:"1px"}}>PULLS</div>
              <BarChart data={last7} height={60} valueFn={d=>d.reps} labelFn={d=>formatDate(d.date)}
                colorFn={(d)=>d.date===today?"#00E5FF":"#00E5FF66"} stacked={true} types={GRIPS}/>
              <div style={{fontSize:"12px",color:"#888",marginBottom:"8px",marginTop:"12px",letterSpacing:"1px"}}>PUSHES</div>
              <BarChart data={pushLast7} height={60} valueFn={d=>d.reps} labelFn={d=>formatDate(d.date)}
                colorFn={(d)=>d.date===today?"#FF6B6B":"#FF6B6B66"} stacked={true} types={PUSH_TYPES}/>
            </div>
          </div>

          {/* This week breakdowns */}
          <div style={{padding:"16px"}}>
            <div style={{background:"#0c0c1c",borderRadius:"14px",padding:"16px",border:"1px solid #1a1a2a"}}>
              <div style={{fontSize:"14px",color:"#ccc",letterSpacing:"3px",marginBottom:"14px"}}>THIS WEEK BY TYPE</div>
              <div style={{fontSize:"12px",color:"#888",marginBottom:"10px",letterSpacing:"1px"}}>PULL-UPS</div>
              {GRIPS.map(g=>{
                const r=weekGripReps[g.id]||0, pct=weekReps>0?r/weekReps:0;
                return (
                  <div key={g.id} style={{marginBottom:"10px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                      <span style={{fontSize:"13px",fontWeight:"700",color:r>0?g.color:"#ccc"}}>{g.label}</span>
                      <span style={{fontSize:"13px",color:r>0?g.color:"#bbb",fontWeight:"900"}}>{r}</span>
                    </div>
                    <div style={{height:"5px",background:"#1a1a2a",borderRadius:"3px",overflow:"hidden"}}>
                      <div style={{width:`${pct*100}%`,height:"100%",background:g.color,borderRadius:"3px",transition:"width 0.5s"}}/>
                    </div>
                  </div>
                );
              })}
              <div style={{fontSize:"12px",color:"#888",marginBottom:"10px",marginTop:"14px",letterSpacing:"1px"}}>PUSHUPS</div>
              {PUSH_TYPES.map(g=>{
                const r=pushWeekTypeReps[g.id]||0, pct=pushWeekReps>0?r/pushWeekReps:0;
                return (
                  <div key={g.id} style={{marginBottom:"10px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                      <span style={{fontSize:"13px",fontWeight:"700",color:r>0?g.color:"#ccc"}}>{g.label}</span>
                      <span style={{fontSize:"13px",color:r>0?g.color:"#bbb",fontWeight:"900"}}>{r}</span>
                    </div>
                    <div style={{height:"5px",background:"#1a1a2a",borderRadius:"3px",overflow:"hidden"}}>
                      <div style={{width:`${pct*100}%`,height:"100%",background:g.color,borderRadius:"3px",transition:"width 0.5s"}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Energy today (pulls) */}
          <div style={{padding:"0 16px 8px"}}>
            <div style={{background:"#0c0c1c",borderRadius:"14px",padding:"16px",border:"1px solid #1a1a2a"}}>
              <div style={{fontSize:"14px",color:"#ccc",letterSpacing:"3px",marginBottom:"14px"}}>TODAY'S ENERGY</div>
              {todayReps === 0 ? (
                <div style={{fontSize:"13px",color:"#555",textAlign:"center",padding:"8px 0"}}>Log pull-ups to see energy output</div>
              ) : (
                <>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"14px"}}>
                    {[
                      {label:"MECHANICAL",val:`${Math.round(todayReps*joulesPerRep)} J`,color:"#00E5FF"},
                      {label:"METABOLIC", val:`${Math.round(todayReps*metabolicJPerRep/1000)} kJ`,color:"#39FF14"},
                      {label:"TONNAGE",   val:`${(todayReps*bodyweight).toLocaleString()} kg`,color:"#FF9500"},
                      {label:"KCAL",      val:`${(todayReps*kcalPerRep).toFixed(1)}`,color:"#FF4081"},
                    ].map(function(s){ return (
                      <div key={s.label} style={{background:"#0a0a18",borderRadius:"8px",padding:"10px",textAlign:"center"}}>
                        <div style={{fontSize:"18px",fontWeight:"900",color:s.color}}>{s.val}</div>
                        <div style={{fontSize:"10px",color:"#666",letterSpacing:"1px",marginTop:"3px"}}>{s.label}</div>
                      </div>
                    ); })}
                  </div>
                  <div style={{fontSize:"12px",color:"#555",marginBottom:"12px",lineHeight:"1.6",padding:"10px",background:"#0a0a18",borderRadius:"8px"}}>
                    Muscles are ~25% efficient — 4J burned for every 1J of movement. The other 3J become heat.
                  </div>
                  {[
                    {label:"Boil 1L water",   metabolicJ:857000, emoji:"☕"},
                    {label:"Charge iPhone",   metabolicJ:280000, emoji:"📱"},
                    {label:"LED bulb 1 hour", metabolicJ:206000, emoji:"💡"},
                    {label:"Burn Mars bar",   metabolicJ:1046000,emoji:"🍫"},
                  ].map(function(e) {
                    var todayJ=todayReps*metabolicJPerRep, pct=Math.min(100,Math.round((todayJ/e.metabolicJ)*100));
                    return (
                      <div key={e.label} style={{marginBottom:"10px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                          <span style={{fontSize:"13px",color:"#ccc"}}>{e.emoji} {e.label}</span>
                          <span style={{fontSize:"13px",color:"#00E5FF",fontWeight:"900"}}>{pct}%</span>
                        </div>
                        <div style={{height:"6px",background:"#1a1a2a",borderRadius:"3px",overflow:"hidden"}}>
                          <div style={{width:`${pct}%`,height:"100%",background:"#00E5FF",borderRadius:"3px"}}/>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── STATS ── */}
      {nav==="stats" && (
        <div style={{padding:"22px 16px 88px"}}>

          {/* ── PULL STATS ── */}
          <div style={{fontSize:"14px",letterSpacing:"5px",color:"#aaa",marginBottom:"6px"}}>PULL-UPS</div>
          <div style={{fontSize:"24px",fontFamily:"Georgia,serif",fontWeight:"900",color:"#39FF14",marginBottom:"16px"}}>All Time</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"16px"}}>
            {[
              {label:"TOTAL REPS",val:allReps.toLocaleString(),           color:"#00E5FF"},
              {label:"TONNAGE",   val:`${(allTonnage/1000).toFixed(1)}t`, color:"#FF9500"},
              {label:"ENERGY",    val:`${Math.round(allJoules/1000)} kJ`, color:"#39FF14"},
              {label:"KCAL",      val:`${Math.round(allKcal)}`,           color:"#FF4081"},
            ].map(s=>(
              <div key={s.label} style={{background:"#0c0c1c",borderRadius:"12px",padding:"16px",
                border:`1px solid ${s.color}22`,textAlign:"center"}}>
                <div style={{fontSize:"24px",fontWeight:"900",color:s.color,lineHeight:1}}>{s.val}</div>
                <div style={{fontSize:"11px",color:"#ccc",letterSpacing:"1px",marginTop:"6px"}}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{background:"#0c0c1c",borderRadius:"14px",padding:"16px",border:"1px solid #1a1a2a",marginBottom:"16px"}}>
            <div style={{display:"flex",gap:"6px",marginBottom:"14px"}}>
              {[["week","WEEK"],["month","MONTH"],["alltime","ALL TIME"]].map(function(pair){
                var active=chartScale===pair[0];
                return <button key={pair[0]} onClick={()=>setChartScale(pair[0])}
                  style={{flex:1,padding:"7px 4px",background:active?"#00E5FF":"transparent",
                    border:`1px solid ${active?"#00E5FF":"#2a2a3a"}`,borderRadius:"8px",
                    color:active?"#000":"#888",fontSize:"11px",fontWeight:"900",
                    cursor:"pointer",fontFamily:"'Courier New',monospace",letterSpacing:"1px"}}>{pair[1]}</button>;
              })}
            </div>
            {chartScale==="week" && <BarChart data={last7} height={80} valueFn={d=>d.reps}
              labelFn={d=>formatDate(d.date)} colorFn={d=>d.date===today?"#00E5FF":"#00E5FF66"} stacked={true} types={GRIPS}/>}
            {chartScale==="month" && <BarChart
              data={getLast30Days().map(d=>{var e=logs[d]||{};return{date:d,reps:GRIPS.reduce((a,g)=>a+(e[g.id]||0),0),grips:{narrow:e.narrow||0,wide:e.wide||0,neutral:e.neutral||0,chin:e.chin||0}};})}
              height={80} valueFn={d=>d.reps} labelFn={d=>formatDate(d.date)}
              colorFn={d=>d.date===today?"#00E5FF":"#00E5FF66"} stacked={true} labelEvery={5} types={GRIPS}/>}
            {chartScale==="alltime" && <BarChart data={allTimeWeeks} height={80} valueFn={d=>d.reps}
              labelFn={d=>{var dt=new Date(d.weekStart);return dt.getDate()+"/"+(dt.getMonth()+1);}}
              colorFn={d=>getWeekStart(today)===d.weekStart?"#00E5FF":"#00E5FF66"}
              goal={weekGoal} labelEvery={allTimeWeeks.length>16?4:allTimeWeeks.length>8?2:1}/>}
          </div>
          <div style={{background:"#0c0c1c",borderRadius:"14px",padding:"16px",border:"1px solid #1a1a2a",marginBottom:"16px"}}>
            <div style={{fontSize:"14px",color:"#ccc",letterSpacing:"3px",marginBottom:"14px"}}>ALL TIME BY GRIP</div>
            {GRIPS.map(g=>{
              const r=Object.values(logs).reduce((a,v)=>a+(v[g.id]||0),0), pct=allReps>0?r/allReps:0;
              return (
                <div key={g.id} style={{marginBottom:"12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                    <div><span style={{fontSize:"13px",fontWeight:"700",color:r>0?g.color:"#ccc"}}>{g.label}</span>
                      <span style={{fontSize:"12px",color:"#666",marginLeft:"8px"}}>{g.sub}</span></div>
                    <div style={{fontSize:"13px",color:r>0?g.color:"#bbb",fontWeight:"900"}}>{r}</div>
                  </div>
                  <div style={{height:"5px",background:"#1a1a2a",borderRadius:"3px",overflow:"hidden"}}>
                    <div style={{width:`${pct*100}%`,height:"100%",background:g.color,borderRadius:"3px",transition:"width 0.5s"}}/>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── PUSH STATS ── */}
          <div style={{fontSize:"14px",letterSpacing:"5px",color:"#aaa",marginBottom:"6px",marginTop:"8px"}}>PUSHUPS</div>
          <div style={{fontSize:"24px",fontFamily:"Georgia,serif",fontWeight:"900",color:"#FF6B6B",marginBottom:"16px"}}>All Time</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"16px"}}>
            {[
              {label:"TOTAL REPS",val:pushAllReps.toLocaleString(),              color:"#FF6B6B"},
              {label:"TONNAGE",   val:`${(pushAllTonnage/1000).toFixed(1)}t`,    color:"#FBBF24"},
              {label:"ENERGY",    val:`${Math.round(pushAllJoules/1000)} kJ`,    color:"#A78BFA"},
              {label:"KCAL",      val:`${Math.round(pushAllKcal)}`,              color:"#FF6B6B"},
            ].map(s=>(
              <div key={s.label} style={{background:"#0c0c1c",borderRadius:"12px",padding:"16px",
                border:`1px solid ${s.color}22`,textAlign:"center"}}>
                <div style={{fontSize:"24px",fontWeight:"900",color:s.color,lineHeight:1}}>{s.val}</div>
                <div style={{fontSize:"11px",color:"#ccc",letterSpacing:"1px",marginTop:"6px"}}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{background:"#0c0c1c",borderRadius:"14px",padding:"16px",border:"1px solid #1a1a2a",marginBottom:"16px"}}>
            <div style={{display:"flex",gap:"6px",marginBottom:"14px"}}>
              {[["week","WEEK"],["month","MONTH"],["alltime","ALL TIME"]].map(function(pair){
                var active=pushChartScale===pair[0];
                return <button key={pair[0]} onClick={()=>setPushChartScale(pair[0])}
                  style={{flex:1,padding:"7px 4px",background:active?"#FF6B6B":"transparent",
                    border:`1px solid ${active?"#FF6B6B":"#2a2a3a"}`,borderRadius:"8px",
                    color:active?"#000":"#888",fontSize:"11px",fontWeight:"900",
                    cursor:"pointer",fontFamily:"'Courier New',monospace",letterSpacing:"1px"}}>{pair[1]}</button>;
              })}
            </div>
            {pushChartScale==="week" && <BarChart data={pushLast7} height={80} valueFn={d=>d.reps}
              labelFn={d=>formatDate(d.date)} colorFn={d=>d.date===today?"#FF6B6B":"#FF6B6B66"} stacked={true} types={PUSH_TYPES}/>}
            {pushChartScale==="month" && <BarChart
              data={getLast30Days().map(d=>{var e=pushLogs[d]||{};return{date:d,reps:PUSH_TYPES.reduce((a,g)=>a+(e[g.id]||0),0),grips:{wide:e.wide||0,standard:e.standard||0,diamond:e.diamond||0}};})}
              height={80} valueFn={d=>d.reps} labelFn={d=>formatDate(d.date)}
              colorFn={d=>d.date===today?"#FF6B6B":"#FF6B6B66"} stacked={true} labelEvery={5} types={PUSH_TYPES}/>}
            {pushChartScale==="alltime" && <BarChart data={pushAllTimeWeeks} height={80} valueFn={d=>d.reps}
              labelFn={d=>{var dt=new Date(d.weekStart);return dt.getDate()+"/"+(dt.getMonth()+1);}}
              colorFn={d=>getWeekStart(today)===d.weekStart?"#FF6B6B":"#FF6B6B66"}
              goal={pushGoal} labelEvery={pushAllTimeWeeks.length>16?4:pushAllTimeWeeks.length>8?2:1}/>}
          </div>
          <div style={{background:"#0c0c1c",borderRadius:"14px",padding:"16px",border:"1px solid #1a1a2a",marginBottom:"16px"}}>
            <div style={{fontSize:"14px",color:"#ccc",letterSpacing:"3px",marginBottom:"14px"}}>ALL TIME BY TYPE</div>
            {PUSH_TYPES.map(g=>{
              const r=Object.values(pushLogs).reduce((a,v)=>a+(v[g.id]||0),0), pct=pushAllReps>0?r/pushAllReps:0;
              return (
                <div key={g.id} style={{marginBottom:"12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                    <div><span style={{fontSize:"13px",fontWeight:"700",color:r>0?g.color:"#ccc"}}>{g.label}</span>
                      <span style={{fontSize:"12px",color:"#666",marginLeft:"8px"}}>{g.sub}</span></div>
                    <div style={{fontSize:"13px",color:r>0?g.color:"#bbb",fontWeight:"900"}}>{r}</div>
                  </div>
                  <div style={{height:"5px",background:"#1a1a2a",borderRadius:"3px",overflow:"hidden"}}>
                    <div style={{width:`${pct*100}%`,height:"100%",background:g.color,borderRadius:"3px",transition:"width 0.5s"}}/>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Energy equivalents */}
          {(function(){
            var totalMetabolicJ = (allJoules + pushAllJoules) / 0.25;
            return (
            <div style={{background:"#0c0c1c",borderRadius:"14px",padding:"16px",border:"1px solid #1a1a2a"}}>
              <div style={{fontSize:"14px",color:"#ccc",letterSpacing:"3px",marginBottom:"14px"}}>ENERGY EQUIVALENTS</div>
              {[
                {label:"Boil 1L of water",   metabolicJ:857000, emoji:"☕", note:"150kJ ÷ 25% efficiency"},
                {label:"iPhone full charge",  metabolicJ:280000, emoji:"📱", note:"14Wh ÷ 25% efficiency"},
                {label:"LED bulb for 1 hour", metabolicJ:206000, emoji:"💡", note:"10W × 3600s ÷ 25%"},
                {label:"Burn a Mars bar",     metabolicJ:1046000,emoji:"🍫", note:"250 kcal × 4184 J/kcal"},
              ].map(e=>{
                const repsNeeded = Math.round(e.metabolicJ/metabolicJPerRep);
                const times = totalMetabolicJ / e.metabolicJ;
                const timesStr = times >= 1
                  ? (Number.isInteger(Math.round(times*10)/10) ? Math.round(times) : (times).toFixed(1)) + "×"
                  : Math.round(times*100) + "%";
                const timesColor = times >= 1 ? "#39FF14" : "#555";
                return (
                  <div key={e.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                    padding:"9px 0",borderBottom:"1px solid #111"}}>
                    <div>
                      <div style={{fontSize:"13px",color:"#ccc"}}>{e.emoji} {e.label}</div>
                      <div style={{fontSize:"11px",color:timesColor,marginTop:"2px",fontWeight:times>=1?"900":"400"}}>
                        {timesStr} all time
                      </div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:"13px",fontWeight:"900",color:"#00E5FF"}}>{repsNeeded} pulls</div>
                      <div style={{fontSize:"11px",color:"#555"}}>{e.note}</div>
                    </div>
                  </div>
                );
              })}
              <div style={{fontSize:"12px",color:"#666",marginTop:"12px",lineHeight:"1.6"}}>
                {allReps} lifetime pulls + {pushAllReps} pushups = {Math.round((allJoules+pushAllJoules)/1000)} kJ total mechanical work.
              </div>
            </div>
            );
          })()}
        </div>
      )}

      {/* ── HISTORY / LOG ── */}
      {nav==="history" && (
        <div style={{padding:"22px 16px 88px"}}>
          <div style={{fontSize:"14px",letterSpacing:"5px",color:"#aaa",marginBottom:"6px"}}>HISTORY</div>
          <div style={{fontSize:"24px",fontFamily:"Georgia,serif",fontWeight:"900",color:"#BF5FFF",marginBottom:"20px"}}>Rep Log</div>

          {historyDates.length===0 && (
            <div style={{textAlign:"center",padding:"40px 20px",color:"#ccc",fontSize:"14px",lineHeight:"1.8"}}>
              No reps logged yet.<br/>Log reps on the Today tab.
            </div>
          )}

          {historyDates.map(date=>{
            const pullEntry = logs[date];
            const pushEntry = pushLogs[date];
            const pullTotal = pullEntry ? GRIPS.reduce((a,g)=>a+(pullEntry[g.id]||0),0) : 0;
            const pushTotal = pushEntry ? PUSH_TYPES.reduce((a,g)=>a+(pushEntry[g.id]||0),0) : 0;
            const pushTonnage = pushEntry ? PUSH_TYPES.reduce((a,t)=>a+(pushEntry[t.id]||0)*bodyweight*t.bwFraction,0) : 0;
            const tonnage = pullTotal*bodyweight + pushTonnage;
            return (
              <div key={date} style={{background:"#0c0c1c",borderRadius:"12px",padding:"14px",
                border:"1px solid #1a1a2a",marginBottom:"10px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"10px"}}>
                  <div>
                    <div style={{fontSize:"14px",fontWeight:"700",color:"#f0f0f0"}}>{formatDate(date)}</div>
                    <div style={{fontSize:"12px",color:"#666",marginTop:"2px"}}>{tonnage.toLocaleString()} kg total</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                    {pullTotal>0 && <div style={{fontSize:"18px",fontWeight:"900",color:"#00E5FF"}}>{pullTotal}<span style={{fontSize:"11px",color:"#555",marginLeft:"2px"}}>↑</span></div>}
                    {pushTotal>0 && <div style={{fontSize:"18px",fontWeight:"900",color:"#FF6B6B"}}>{pushTotal}<span style={{fontSize:"11px",color:"#555",marginLeft:"2px"}}>↓</span></div>}
                    {pullEntry && <button onClick={()=>setEditDate(date)}
                      style={{background:"none",border:"none",cursor:"pointer",padding:"4px",color:"#00E5FF88"}}>
                      <Icon name="edit" size={15}/>
                    </button>}
                    {pushEntry && <button onClick={()=>setEditPushDate(date)}
                      style={{background:"none",border:"none",cursor:"pointer",padding:"4px",color:"#FF6B6B88"}}>
                      <Icon name="edit" size={15}/>
                    </button>}
                    <button onClick={()=>{ if(window.confirm("Delete all entries for this day?")){ if(pullEntry)deleteLog(date); if(pushEntry)deletePushLog(date); }}}
                      style={{background:"none",border:"none",cursor:"pointer",padding:"4px",color:"#bbb"}}>
                      <Icon name="trash" size={15}/>
                    </button>
                  </div>
                </div>
                {pullEntry && pullTotal>0 && (
                  <div style={{display:"flex",gap:"5px",flexWrap:"wrap",marginBottom:pushEntry&&pushTotal>0?"6px":"0"}}>
                    {GRIPS.map(g=>{const r=pullEntry[g.id]||0; return r>0?(
                      <div key={g.id} style={{padding:"3px 7px",background:g.color+"18",borderRadius:"6px",border:`1px solid ${g.color}33`}}>
                        <span style={{fontSize:"13px",fontWeight:"900",color:g.color}}>{r}</span>
                        <span style={{fontSize:"11px",color:g.color+"88",marginLeft:"3px"}}>{g.label}</span>
                      </div>
                    ):null;})}
                  </div>
                )}
                {pushEntry && pushTotal>0 && (
                  <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                    {PUSH_TYPES.map(g=>{const r=pushEntry[g.id]||0; return r>0?(
                      <div key={g.id} style={{padding:"3px 7px",background:g.color+"18",borderRadius:"6px",border:`1px solid ${g.color}33`}}>
                        <span style={{fontSize:"13px",fontWeight:"900",color:g.color}}>{r}</span>
                        <span style={{fontSize:"11px",color:g.color+"88",marginLeft:"3px"}}>{g.label}</span>
                      </div>
                    ):null;})}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* BOTTOM NAV */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",
        width:"100%",maxWidth:"480px",background:"#0a0a1a",
        borderTop:"1px solid #151525",display:"flex",
        paddingBottom:"env(safe-area-inset-bottom,10px)"}}>
        {NAV.map(item=>(
          <button key={item.id} onClick={()=>setNav(item.id)} style={{
            flex:1,padding:"14px 4px 10px",background:"transparent",border:"none",
            color:nav===item.id?"#00E5FF":"#444",
            cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:"5px",transition:"color 0.2s",
          }}>
            <Icon name={item.icon} size={22} color={nav===item.id?"#00E5FF":"#444"}/>
            <span style={{fontSize:"15px",letterSpacing:"2px",fontFamily:"'Courier New',monospace",fontWeight:"700"}}>
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {editDate && (
        <EditLogModal date={editDate} types={GRIPS} accentColor="#BF5FFF"
          existing={logs[editDate]||{narrow:0,wide:0,neutral:0,chin:0}}
          onClose={()=>setEditDate(null)}
          onSave={(reps)=>{setLogs(prev=>({...prev,[editDate]:reps}));setEditDate(null);}}
          onDelete={()=>{deleteLog(editDate);setEditDate(null);}}/>
      )}
      {editPushDate && (
        <EditLogModal date={editPushDate} types={PUSH_TYPES} accentColor="#FF6B6B"
          existing={pushLogs[editPushDate]||{wide:0,standard:0,diamond:0}}
          onClose={()=>setEditPushDate(null)}
          onSave={(reps)=>{setPushLogs(prev=>({...prev,[editPushDate]:reps}));setEditPushDate(null);}}
          onDelete={()=>{deletePushLog(editPushDate);setEditPushDate(null);}}/>
      )}
      {showGoal && (
        <GoalModal currentGoal={weekGoal} currentPushGoal={pushGoal} currentWeight={bodyweight}
          onClose={()=>setShowGoal(false)}
          onSave={function(g,pg,w){setWeekGoal(g);setPushGoal(pg);setBodyweight(w);BODYWEIGHT_KG=w;setShowGoal(false);}}/>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
