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

const WEEK_GOAL_START = 100;

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

function BarChart({data, colorFn, labelFn, valueFn, height, goal, stacked, labelEvery}) {
  var BAR_H = height || 80;
  labelEvery = labelEvery || 1;
  var LABEL_H = 36;
  var today = todayStr();
  var vals = data.map(function(d) {
    return stacked ? GRIPS.reduce(function(a,g){return a+safeGrip(d,g.id);},0) : valueFn(d);
  });
  var max = Math.max.apply(null, vals.concat([goal||0, 1]));
  var n = data.length;
  var gap = 4;
  // Use table-based layout: each column is a <td> with explicit pixel height
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
                  {/* Label sits above bar in its own fixed space */}
                  <div style={{height:"18px",display:"flex",alignItems:"flex-end",justifyContent:"center",marginBottom:"2px"}}>
                    {total>0 && <div style={{fontSize:"11px",color:isToday?"#fff":"#bbb",fontWeight:"900",lineHeight:"1"}}>{total}</div>}
                  </div>
                  {/* Bar at exact pixel height */}
                  {total===0 ? (
                    <div style={{width:"100%",height:"2px",background:"#1e1e2e"}}/>
                  ) : stacked ? (
                    <div style={{width:"100%",height:`${barH}px`,overflow:"hidden",borderRadius:"3px 3px 0 0"}}>
                      {[...GRIPS].reverse().map(function(g) {
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

// ─── EDIT LOG MODAL (past entries) ──────────────────────────────────────────────
function EditLogModal({date, existing, onClose, onSave, onDelete}) {
  const [reps, setReps] = useState({...existing});
  const total = GRIPS.reduce((a,g)=>a+(reps[g.id]||0),0);
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
          <span style={{fontSize:"14px",fontWeight:"900",color:"#BF5FFF",letterSpacing:"2px"}}>EDIT</span>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"#888"}}>
            <Icon name="x" size={22}/>
          </button>
        </div>
        <div style={{fontSize:"13px",color:"#888",marginBottom:"18px"}}>{date}</div>
        {GRIPS.map(g=>{
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
            background:"linear-gradient(135deg,#BF5FFF,#7B2FFF)",border:"none",
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
function GoalModal({currentGoal, currentWeight, onClose, onSave}) {
  const [goal, setGoal] = useState(String(currentGoal));
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

        <div style={{fontSize:"11px",color:"#FF9500",letterSpacing:"3px",marginBottom:"6px"}}>WEEKLY REP GOAL</div>
        <input type="number" value={goal} onChange={function(e){setGoal(e.target.value);}}
          style={{...inp, marginBottom:"6px"}}/>
        <div style={{fontSize:"12px",color:"#666",marginBottom:"18px"}}>Total reps across all grips. Increase ~20% every 4 weeks.</div>

        <button onClick={function(){onSave(Number(goal)||currentGoal, Number(weight)||currentWeight);}}
          style={{width:"100%",padding:"14px",background:"linear-gradient(135deg,#FF9500,#cc7700)",
            border:"none",borderRadius:"12px",color:"#000",fontWeight:"900",fontSize:"15px",
            letterSpacing:"2px",cursor:"pointer",fontFamily:"'Courier New',monospace"}}>
          SAVE SETTINGS
        </button>
      </div>
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────
function App() {
  // logs: { "2024-01-15": { narrow:5, wide:3, neutral:0, chin:10 }, ... }
  const [logs, setLogs]       = useState({});
  const [weekGoal, setWeekGoal] = useState(WEEK_GOAL_START);
  const [bodyweight, setBodyweight] = useState(105);
  const [nav, setNav]         = useState("today");
  const [showGoal, setShowGoal] = useState(false);
  const [chartScale, setChartScale] = useState("week"); // week | month | alltime
  const [editDate, setEditDate] = useState(null);
  // Draft: unsaved inline edits for today
  const [draft, setDraft] = useState(null); // null = not editing, obj = {narrow,wide,neutral,chin}
  const isDirty = draft !== null;
  const initialized = React.useRef(false);

  useEffect(()=>{
    const s=loadStorage();
    if(s){
      if(s.logs)     setLogs(s.logs);
      if(s.weekGoal) setWeekGoal(s.weekGoal);
      if(s.bodyweight) { setBodyweight(s.bodyweight); BODYWEIGHT_KG=s.bodyweight; }
    }
    initialized.current = true;
  },[]);

  useEffect(()=>{
    if(!initialized.current) return;
    saveStorage({logs,weekGoal,bodyweight});
  },[logs,weekGoal,bodyweight]);
  // Keep global in sync for energy calcs
  BODYWEIGHT_KG = bodyweight;

  const today = todayStr();
  const savedLog = logs[today] || {narrow:0,wide:0,neutral:0,chin:0};
  const todayLog = draft !== null ? draft : savedLog;
  const todayReps = GRIPS.reduce((a,g)=>a+(todayLog[g.id]||0),0);

  const saveDraft = () => {
    if (draft !== null) {
      setLogs(prev => ({...prev, [today]: {...draft}}));
      setDraft(null);
    }
  };
  const cancelDraft = () => setDraft(null);
  // Single setState - initialises from savedLog if draft is null
  const setGripVal = (id, val) => {
    setDraft(prev => ({...(prev !== null ? prev : savedLog), [id]: Math.max(0, val)}));
  };

  // Week stats
  const weekStart = getWeekStart(today);
  const weekReps = useMemo(()=>{
    return Object.entries(logs)
      .filter(([d])=>getWeekStart(d)===weekStart)
      .reduce((a,[,v])=>a+GRIPS.reduce((b,g)=>b+(v[g.id]||0),0),0);
  },[logs,weekStart]);

  const weekTonnage = weekReps * bodyweight;
  const joulesPerRep = bodyweight * 9.81 * 0.5;
  const metabolicJPerRep = joulesPerRep / 0.25;
  const kcalPerRep = metabolicJPerRep / 4184;
  const weekJoules  = weekReps * joulesPerRep;
  const weekKjoules = weekJoules / 1000;
  const weekKcal    = weekReps * kcalPerRep;
  const weekPct     = weekGoal ? weekReps / weekGoal : 0;

  // All-time
  const allReps = useMemo(()=>
    Object.values(logs).reduce((a,v)=>a+GRIPS.reduce((b,g)=>b+(v[g.id]||0),0),0)
  ,[logs]);
  const allTonnage = allReps * bodyweight;
  const allJoules  = allReps * joulesPerRep;
  const allKcal    = allReps * kcalPerRep;

  // Last 7 days data
  const last7 = getLast7Days().map(function(d) {
    const entry = logs[d] || {};
    return {
      date: d,
      reps: GRIPS.reduce(function(a,g){return a+((entry[g.id])||0);},0),
      grips: {
        narrow:  entry.narrow  || 0,
        wide:    entry.wide    || 0,
        neutral: entry.neutral || 0,
        chin:    entry.chin    || 0,
      },
    };
  });

  // Last 8 weeks data
  const last8weeks = useMemo(()=>{
    const weeks = getLast8Weeks();
    return weeks.map(function(ws) {
      return {
        weekStart: ws,
        reps: Object.entries(logs)
          .filter(function(pair){return getWeekStart(pair[0])===ws;})
          .reduce(function(a,pair){return a+GRIPS.reduce(function(b,g){return b+(pair[1][g.id]||0);},0);},0),
      };
    });
  },[logs]);

  // All-time weekly data from first log entry onwards
  const allTimeWeeks = useMemo(()=>{
    var allDates = Object.keys(logs).sort();
    if(allDates.length===0) return last8weeks;
    var firstWeek = getWeekStart(allDates[0]);
    var todayW = localDateStr(new Date());
    var weeks = [];
    var cur = new Date(firstWeek);
    while(localDateStr(cur) <= todayW) {
      var ws = localDateStr(cur);
      weeks.push({
        weekStart: ws,
        reps: Object.entries(logs)
          .filter(function(p){return getWeekStart(p[0])===ws;})
          .reduce(function(a,p){return a+GRIPS.reduce(function(b,g){return b+(p[1][g.id]||0);},0);},0),
      });
      cur.setDate(cur.getDate()+7);
    }
    return weeks;
  },[logs]);

  // Grip breakdown this week
  const weekGripReps = useMemo(()=>{
    const totals = {narrow:0,wide:0,neutral:0,chin:0};
    Object.entries(logs)
      .filter(([d])=>getWeekStart(d)===weekStart)
      .forEach(([,v])=>GRIPS.forEach(g=>{ totals[g.id]+=(v[g.id]||0); }));
    return totals;
  },[logs,weekStart]);

  const saveLog = (date, reps) => {
    setLogs(prev=>({...prev,[date]:reps}));
    setEditDate(null);
  };

  const deleteLog = (date) => {
    setLogs(prev=>{ const n={...prev}; delete n[date]; return n; });
  };

  // Sorted history
  const historyDates = useMemo(()=>
    Object.keys(logs).sort((a,b)=>b.localeCompare(a))
  ,[logs]);

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

          {/* Header */}
          <div style={{padding:"24px 20px 20px",background:"linear-gradient(180deg,#0c0c1e,#07070e)"}}>
            <div style={{fontSize:"14px",letterSpacing:"5px",color:"#aaa",marginBottom:"6px"}}>GTG PULL TRACKER</div>
            <div style={{fontSize:"15px",color:"#ddd",marginBottom:"20px"}}>
              {new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}
            </div>

            {/* Weekly goal progress */}
            <div style={{marginBottom:"16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                <div style={{fontSize:"13px",color:"#ccc",letterSpacing:"3px"}}>WEEKLY GOAL</div>
                <button onClick={()=>setShowGoal(true)}
                  style={{background:"none",border:"1px solid #2a2a3a",borderRadius:"20px",
                    cursor:"pointer",color:"#888",fontSize:"11px",fontWeight:"900",
                    padding:"4px 10px",fontFamily:"'Courier New',monospace",letterSpacing:"1px"}}>
                  ⚙ SETTINGS
                </button>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                <div style={{fontSize:"32px",fontWeight:"900",color:"#00E5FF",lineHeight:1}}>{weekReps}</div>
                <div style={{flex:1}}>
                  <div style={{height:"10px",background:"#1a1a2a",borderRadius:"5px",overflow:"hidden",marginBottom:"4px"}}>
                    <div style={{
                      width:`${Math.min(100,Math.round(weekPct*100))}%`,
                      height:"100%",
                      background:weekPct>=1?"#39FF14":"#00E5FF",
                      borderRadius:"5px",
                      transition:"width 0.5s"
                    }}/>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <div style={{fontSize:"12px",color:"#888"}}>{Math.round(weekPct*100)}% of {weekGoal} reps</div>
                    <div style={{fontSize:"12px",color:weekPct>=1?"#39FF14":"#555"}}>
                      {weekPct>=1?"✓ DONE":weekGoal-weekReps+" to go"}
                    </div>
                  </div>
                </div>
              </div>
              {/* Weekly energy row */}
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

            {/* Inline log section */}
            <div style={{background:"#0e0e1e",borderRadius:"12px",padding:"16px",border:`1px solid ${isDirty?"#00E5FF44":"#1a1a2a"}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
                <div style={{fontSize:"14px",color:"#ccc",letterSpacing:"3px"}}>TODAY</div>
                <div style={{fontSize:"20px",fontWeight:"900",color:"#f0f0f0"}}>{todayReps} reps</div>
              </div>

              {GRIPS.map(g=>{
                const r = todayLog[g.id]||0;
                return (
                  <div key={g.id} style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"10px"}}>
                    {/* Grip label */}
                    <div style={{width:"72px",flexShrink:0}}>
                      <div style={{fontSize:"13px",fontWeight:"900",color:r>0?g.color:"#888"}}>{g.label}</div>
                    </div>
                    {/* − button */}
                    <button onClick={()=>setGripVal(g.id, r-1)}
                      style={{width:"38px",height:"38px",borderRadius:"8px",border:`1px solid ${r>0?g.color+"55":"#252530"}`,
                        background:"transparent",color:r>0?g.color:"#555",fontSize:"20px",fontWeight:"900",
                        cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      −
                    </button>
                    {/* Number input */}
                    <input
                      type="number"
                      value={r === 0 ? "" : r}
                      placeholder="0"
                      onChange={e => setGripVal(g.id, parseInt(e.target.value)||0)}
                      style={{flex:1,textAlign:"center",background:"#0a0a18",border:`1px solid ${r>0?g.color+"55":"#252530"}`,
                        borderRadius:"8px",color:r>0?g.color:"#888",fontSize:"22px",fontWeight:"900",
                        padding:"6px 4px",fontFamily:"'Courier New',monospace",outline:"none",minWidth:0}}
                    />
                    {/* +1 */}
                    <button onClick={()=>setGripVal(g.id, r+1)}
                      style={{width:"38px",height:"38px",borderRadius:"8px",border:`1px solid ${g.color+"55"}`,
                        background:g.color+"15",color:g.color,fontSize:"16px",fontWeight:"900",
                        cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      +1
                    </button>
                    {/* +5 */}
                    <button onClick={()=>setGripVal(g.id, r+5)}
                      style={{width:"38px",height:"38px",borderRadius:"8px",border:`1px solid ${g.color+"55"}`,
                        background:g.color+"25",color:g.color,fontSize:"14px",fontWeight:"900",
                        cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      +5
                    </button>
                    {/* × clear - always shown, dimmed when 0 */}
                    <button onClick={()=>setGripVal(g.id, 0)}
                      style={{width:"28px",height:"28px",borderRadius:"6px",border:"1px solid #2a2a3a",
                        background:"transparent",color:r>0?"#888":"#252530",fontSize:"14px",
                        cursor:r>0?"pointer":"default",display:"flex",alignItems:"center",
                        justifyContent:"center",flexShrink:0,transition:"color 0.15s"}}>
                      ×
                    </button>
                  </div>
                );
              })}

              {/* Save / Cancel */}
              <div style={{display:"flex",gap:"8px",marginTop:"6px"}}>
                <button onClick={saveDraft}
                  style={{flex:1,padding:"12px",
                    background:isDirty?"linear-gradient(135deg,#00E5FF,#0077aa)":"#1a1a2a",
                    border:"none",borderRadius:"10px",color:isDirty?"#000":"#444",fontWeight:"900",
                    fontSize:"14px",letterSpacing:"2px",cursor:isDirty?"pointer":"default",
                    fontFamily:"'Courier New',monospace",transition:"all 0.2s"}}>
                  {isDirty ? "SAVE" : "SAVED ✓"}
                </button>
                {isDirty && <button onClick={cancelDraft}
                  style={{padding:"12px 16px",background:"transparent",border:"1px solid #2a2a3a",
                    borderRadius:"10px",color:"#666",fontSize:"14px",cursor:"pointer",
                    fontFamily:"'Courier New',monospace"}}>
                  CANCEL
                </button>}
              </div>
            </div>
          </div>

          {/* 7-day bar chart */}
          <div style={{padding:"0 16px"}}>
            <div style={{background:"#0c0c1c",borderRadius:"14px",padding:"16px",border:"1px solid #1a1a2a"}}>
              <div style={{fontSize:"14px",color:"#ccc",letterSpacing:"3px",marginBottom:"4px"}}>LAST 7 DAYS</div>
              <div style={{fontSize:"14px",color:"#bbb",marginBottom:"12px"}}>reps per day</div>
              <div style={{position:"relative"}}>
                <BarChart
                  data={last7}
                  height={70}
                  valueFn={d=>d.reps}
                  labelFn={d=>formatDate(d.date)}
                  colorFn={(d,i)=>d.date===today?"#00E5FF":"#00E5FF66"}
                  stacked={true}
                />
              </div>
            </div>
          </div>

          {/* This week grip split */}
          <div style={{padding:"16px"}}>
            <div style={{background:"#0c0c1c",borderRadius:"14px",padding:"16px",border:"1px solid #1a1a2a"}}>
              <div style={{fontSize:"14px",color:"#ccc",letterSpacing:"3px",marginBottom:"14px"}}>THIS WEEK BY GRIP</div>
              {GRIPS.map(g=>{
                const r = weekGripReps[g.id]||0;
                const pct = weekReps>0 ? r/weekReps : 0;
                return (
                  <div key={g.id} style={{marginBottom:"12px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:"5px"}}>
                      <span style={{fontSize:"15px",fontWeight:"700",color:r>0?g.color:"#ccc"}}>{g.label}</span>
                      <span style={{fontSize:"15px",color:r>0?g.color:"#bbb",fontWeight:"900"}}>{r} reps</span>
                    </div>
                    <div style={{height:"6px",background:"#1a1a2a",borderRadius:"3px",overflow:"hidden"}}>
                      <div style={{width:`${pct*100}%`,height:"100%",background:g.color,
                        borderRadius:"3px",transition:"width 0.5s ease"}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Energy today */}
          <div style={{padding:"0 16px 8px"}}>
            <div style={{background:"#0c0c1c",borderRadius:"14px",padding:"16px",border:"1px solid #1a1a2a"}}>
              <div style={{fontSize:"14px",color:"#ccc",letterSpacing:"3px",marginBottom:"14px"}}>TODAY'S ENERGY</div>
              {todayReps === 0 ? (
                <div style={{fontSize:"13px",color:"#555",textAlign:"center",padding:"8px 0"}}>Log reps to see energy output</div>
              ) : (
                <>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"14px"}}>
                    {[
                      {label:"MECHANICAL",val:`${Math.round(todayReps*joulesPerRep)} J`,color:"#00E5FF"},
                      {label:"METABOLIC", val:`${Math.round(todayReps*metabolicJPerRep/1000)} kJ`,color:"#39FF14"},
                      {label:"TONNAGE",   val:`${(todayReps*bodyweight).toLocaleString()} kg`,color:"#FF9500"},
                      {label:"KCAL",      val:`${(todayReps*kcalPerRep).toFixed(1)}`,color:"#FF4081"},
                    ].map(function(s) { return (
                      <div key={s.label} style={{background:"#0a0a18",borderRadius:"8px",padding:"10px",textAlign:"center"}}>
                        <div style={{fontSize:"18px",fontWeight:"900",color:s.color}}>{s.val}</div>
                        <div style={{fontSize:"10px",color:"#666",letterSpacing:"1px",marginTop:"3px"}}>{s.label}</div>
                      </div>
                    ); })}
                  </div>
                  <div style={{fontSize:"12px",color:"#555",marginBottom:"12px",lineHeight:"1.6",padding:"10px",background:"#0a0a18",borderRadius:"8px"}}>
                    Muscles are ~25% efficient — 4J burned for every 1J of movement. The other 3J become heat. That's why metabolic cost = mechanical × 4.
                  </div>
                  {[
                    {label:"Boil 1L water",   metabolicJ:857000, emoji:"☕"},
                    {label:"Charge iPhone",   metabolicJ:280000, emoji:"📱"},
                    {label:"LED bulb 1 hour", metabolicJ:206000, emoji:"💡"},
                    {label:"Burn Mars bar",   metabolicJ:1046000,emoji:"🍫"},
                  ].map(function(e) {
                    var todayJ = todayReps * metabolicJPerRep;
                    var pct = Math.min(100, Math.round((todayJ/e.metabolicJ)*100));
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
          <div style={{fontSize:"14px",letterSpacing:"5px",color:"#aaa",marginBottom:"6px"}}>STATISTICS</div>
          <div style={{fontSize:"24px",fontFamily:"Georgia,serif",fontWeight:"900",color:"#39FF14",marginBottom:"20px"}}>
            All Time
          </div>

          {/* All-time stats */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"16px"}}>
            {[
              {label:"TOTAL REPS",  val:allReps.toLocaleString(),                      color:"#00E5FF"},
              {label:"TONNAGE",     val:`${(allTonnage/1000).toFixed(1)}t`,            color:"#FF9500"},
              {label:"ENERGY",      val:`${Math.round(allJoules/1000)} kJ`,            color:"#39FF14"},
              {label:"KCAL",        val:`${Math.round(allKcal)}`,                      color:"#FF4081"},
            ].map(s=>(
              <div key={s.label} style={{background:"#0c0c1c",borderRadius:"12px",padding:"16px",
                border:`1px solid ${s.color}22`,textAlign:"center"}}>
                <div style={{fontSize:"24px",fontWeight:"900",color:s.color,lineHeight:1}}>{s.val}</div>
                <div style={{fontSize:"15px",color:"#ccc",letterSpacing:"1px",marginTop:"6px"}}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Time scale chart */}
          <div style={{background:"#0c0c1c",borderRadius:"14px",padding:"16px",
            border:"1px solid #1a1a2a",marginBottom:"16px"}}>
            {/* Toggle */}
            <div style={{display:"flex",gap:"6px",marginBottom:"14px"}}>
              {[["week","WEEK"],["month","MONTH"],["alltime","ALL TIME"]].map(function(pair) {
                var key=pair[0], label=pair[1];
                var active = chartScale===key;
                return (
                  <button key={key} onClick={function(){setChartScale(key);}}
                    style={{flex:1,padding:"7px 4px",background:active?"#FF9500":"transparent",
                      border:`1px solid ${active?"#FF9500":"#2a2a3a"}`,borderRadius:"8px",
                      color:active?"#000":"#888",fontSize:"11px",fontWeight:"900",
                      cursor:"pointer",fontFamily:"'Courier New',monospace",letterSpacing:"1px"}}>
                    {label}
                  </button>
                );
              })}
            </div>
            {chartScale==="week" && (
              <BarChart
                data={last7}
                height={80}
                valueFn={function(d){return d.reps;}}
                labelFn={function(d){return formatDate(d.date);}}
                colorFn={function(d){return d.date===today?"#FF9500":"#FF950066";}}
                stacked={true}
              />
            )}
            {chartScale==="month" && (
              <BarChart
                data={getLast30Days().map(function(d) {
                  var entry = logs[d] || {};
                  return {
                    date: d,
                    reps: GRIPS.reduce(function(a,g){return a+(entry[g.id]||0);},0),
                    grips: {narrow:entry.narrow||0,wide:entry.wide||0,neutral:entry.neutral||0,chin:entry.chin||0},
                  };
                })}
                height={80}
                valueFn={function(d){return d.reps;}}
                labelFn={function(d){return formatDate(d.date);}}
                colorFn={function(d){return d.date===today?"#FF9500":"#FF950066";}}
                stacked={true}
                labelEvery={5}
              />
            )}
            {chartScale==="alltime" && (
              <BarChart
                data={allTimeWeeks}
                height={80}
                valueFn={function(d){return d.reps;}}
                labelFn={function(d){
                  var dt=new Date(d.weekStart);
                  return (dt.getDate())+"/"+(dt.getMonth()+1);
                }}
                colorFn={function(d){return getWeekStart(today)===d.weekStart?"#FF9500":"#FF950066";}}
                goal={weekGoal}
                labelEvery={allTimeWeeks.length>16?4:allTimeWeeks.length>8?2:1}
              />
            )}
          </div>

          {/* Grip all-time breakdown */}
          <div style={{background:"#0c0c1c",borderRadius:"14px",padding:"16px",border:"1px solid #1a1a2a",marginBottom:"16px"}}>
            <div style={{fontSize:"14px",color:"#ccc",letterSpacing:"3px",marginBottom:"14px"}}>ALL TIME BY GRIP</div>
            {GRIPS.map(g=>{
              const r = Object.values(logs).reduce((a,v)=>a+(v[g.id]||0),0);
              const pct = allReps>0?r/allReps:0;
              const t = r*bodyweight;
              return (
                <div key={g.id} style={{marginBottom:"14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"5px"}}>
                    <div>
                      <span style={{fontSize:"14px",fontWeight:"700",color:r>0?g.color:"#ccc"}}>{g.label}</span>
                      <span style={{fontSize:"14px",color:"#bbb",marginLeft:"8px"}}>{g.sub}</span>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:"14px",color:r>0?g.color:"#bbb",fontWeight:"900"}}>{r} reps</div>
                      <div style={{fontSize:"15px",color:"#ccc"}}>{t.toLocaleString()} kg</div>
                    </div>
                  </div>
                  <div style={{height:"6px",background:"#1a1a2a",borderRadius:"3px",overflow:"hidden"}}>
                    <div style={{width:`${pct*100}%`,height:"100%",background:g.color,
                      borderRadius:"3px",transition:"width 0.5s"}}/>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Energy equivalents fun facts */}
          <div style={{background:"#0c0c1c",borderRadius:"14px",padding:"16px",border:"1px solid #1a1a2a"}}>
            <div style={{fontSize:"14px",color:"#ccc",letterSpacing:"3px",marginBottom:"14px"}}>ENERGY EQUIVALENTS</div>
            {[
              {label:"Boil 1L of water",        metabolicJ:857000, emoji:"☕", note:"150kJ electrical ÷ 25% efficiency"},
              {label:"iPhone full charge",       metabolicJ:280000, emoji:"📱", note:"14Wh battery ÷ 25% muscle eff."},
              {label:"LED bulb for 1 hour",      metabolicJ:206000, emoji:"💡", note:"10W × 3600s ÷ 25% efficiency"},
              {label:"Burn a Mars bar",          metabolicJ:1046000,emoji:"🍫", note:"250 kcal × 4184 J/kcal"},
            ].map(e=>{
              const repsNeeded = Math.round(e.metabolicJ / metabolicJPerRep);
              return (
                <div key={e.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  padding:"9px 0",borderBottom:"1px solid #111"}}>
                  <div style={{fontSize:"14px",color:"#ccc"}}>{e.emoji} {e.label}</div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:"14px",fontWeight:"900",color:"#00E5FF"}}>{repsNeeded} reps</div>
                    <div style={{fontSize:"13px",color:"#ccc"}}>{e.note}</div>
                  </div>
                </div>
              );
            })}
            <div style={{fontSize:"14px",color:"#ccc",marginTop:"12px",lineHeight:"1.6"}}>
              Your {allReps} lifetime reps = {Math.round(allJoules/1000)} kJ mechanical energy.
              Metabolically that's {Math.round(allKcal)} kcal — enough to {allKcal>300?"run about "+Math.round(allKcal/60)+"km":"make a decent dent in a snack"}.
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY / LOG ── */}
      {nav==="history" && (
        <div style={{padding:"22px 16px 88px"}}>
          <div style={{fontSize:"14px",letterSpacing:"5px",color:"#aaa",marginBottom:"6px"}}>HISTORY</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px"}}>
            <div style={{fontSize:"24px",fontFamily:"Georgia,serif",fontWeight:"900",color:"#BF5FFF"}}>
              Rep Log
            </div>

          </div>

          {historyDates.length === 0 && (
            <div style={{textAlign:"center",padding:"40px 20px",color:"#ccc",fontSize:"14px",lineHeight:"1.8"}}>
              No reps logged yet.<br/>Hit LOG REPS on the Today tab.
            </div>
          )}

          {historyDates.map(date=>{
            const entry = logs[date];
            const total = GRIPS.reduce((a,g)=>a+(entry[g.id]||0),0);
            const tonnage = total*bodyweight;
            const kj = Math.round(total*bodyweight*9.81*0.5/1000);
            return (
              <div key={date} style={{background:"#0c0c1c",borderRadius:"12px",padding:"14px",
                border:"1px solid #1a1a2a",marginBottom:"10px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"10px"}}>
                  <div>
                    <div style={{fontSize:"14px",fontWeight:"700",color:"#f0f0f0"}}>{formatDate(date)}</div>
                    <div style={{fontSize:"14px",color:"#ccc",marginTop:"2px"}}>
                      {tonnage.toLocaleString()} kg · {kj} kJ
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                    <div style={{fontSize:"22px",fontWeight:"900",color:"#00E5FF"}}>{total}</div>
                    <div style={{fontSize:"15px",color:"#ccc"}}>reps</div>
                    <button onClick={()=>setEditDate(date)}
                      style={{background:"none",border:"none",cursor:"pointer",padding:"4px",color:"#bbb"}}>
                      <Icon name="edit" size={16}/>
                    </button>
                    <button onClick={()=>{ if(window.confirm("Delete this entry?")) deleteLog(date); }}
                      style={{background:"none",border:"none",cursor:"pointer",padding:"4px",color:"#bbb"}}>
                      <Icon name="trash" size={16}/>
                    </button>
                  </div>
                </div>
                <div style={{display:"flex",gap:"6px"}}>
                  {GRIPS.map(g=>{
                    const r=entry[g.id]||0;
                    return r>0?(
                      <div key={g.id} style={{padding:"4px 8px",background:g.color+"18",
                        borderRadius:"6px",border:`1px solid ${g.color}33`}}>
                        <span style={{fontSize:"14px",fontWeight:"900",color:g.color}}>{r}</span>
                        <span style={{fontSize:"15px",color:g.color+"88",marginLeft:"4px"}}>{g.label}</span>
                      </div>
                    ):null;
                  })}
                </div>
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
        <EditLogModal
          date={editDate}
          existing={logs[editDate]||{narrow:0,wide:0,neutral:0,chin:0}}
          onClose={()=>setEditDate(null)}
          onSave={(reps)=>{ setLogs(prev=>({...prev,[editDate]:reps})); setEditDate(null); }}
          onDelete={()=>{ setLogs(prev=>{const n={...prev};delete n[editDate];return n;}); setEditDate(null); }}
        />
      )}
      {showGoal && (
        <GoalModal
          currentGoal={weekGoal}
          currentWeight={bodyweight}
          onClose={()=>setShowGoal(false)}
          onSave={function(g,w){setWeekGoal(g);setBodyweight(w);BODYWEIGHT_KG=w;setShowGoal(false);}}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
