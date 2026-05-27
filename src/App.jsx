import { useState, useMemo, useRef, useEffect } from "react";
import { db } from "./firebase";
import {
  collection, doc, onSnapshot,
  setDoc, updateDoc, deleteDoc, addDoc,
} from "firebase/firestore";

// ─── Constants ────────────────────────────────────────────────────────────────
const CHANNELS = [
  { id: "robin",  label: "Bin's",  sub: "@robs_bin.s", color: "#f97316", light: "#fff4ed", emoji: "🥊" },
  { id: "collab", label: "Estelle", sub: "@estelle",   color: "#06b6d4", light: "#ecfeff", emoji: "🤝" },
  { id: "common", label: "Commun", sub: "collabs",      color: "#8b5cf6", light: "#f5f3ff", emoji: "⚡" },
];
const METRICS = ["views","likes","shares","saves"];
const ML = { views:"Vues", likes:"Likes", shares:"Partages", saves:"Enreg." };
const MI = { views:"👁", likes:"❤️", shares:"📤", saves:"🔖" };
const STATUS_OPTIONS = ["Idée","En écriture","À filmer","En montage","Planifié","Publié"];
const STATUS_COLOR = {
  "Idée":"#e0e7ff","En écriture":"#fef9c3","À filmer":"#ffedd5",
  "En montage":"#dcfce7","Planifié":"#dbeafe","Publié":"#f0fdf4",
};
const STATUS_TEXT = {
  "Idée":"#4338ca","En écriture":"#854d0e","À filmer":"#c2410c",
  "En montage":"#166534","Planifié":"#1e40af","Publié":"#15803d",
};

const SEED = [
  {
    channel:"robin", title:"Highlights DF6 – KO Round 2",
    description:"Meilleur extrait du combat avec slow-mo sur le KO final.",
    status:"Publié", pubDate:"2026-04-13", testReel:true,
    plans:["Plan large entrée cage","Slow-mo échange final","Réaction corner"],
    notes:["Shoutout Mehdi et Guilhem","Tagger @bistrotcheztoto"],
    testStats:{views:18400,likes:1120,shares:340,saves:210},
    stats:{j1:{views:22000,likes:1400,shares:420,saves:280},j7:{views:51000,likes:3200,shares:980,saves:640},j30:{views:89000,likes:5800,shares:1700,saves:1100}},
  },
  {
    channel:"robin", title:"Morning Routine – Fight Week",
    description:"Une journée type à J-7 : réveil, nutrition, séance.",
    status:"Publié", pubDate:"2026-04-20", testReel:false,
    plans:["Réveil 6h","Petit-déj pesée","Entraînement Old School Academy","Récupération"],
    notes:["Voix off en montage","Inclure coach Gaëtan"],
    testStats:null,
    stats:{j1:{views:8200,likes:510,shares:90,saves:130},j7:{views:19400,likes:1100,shares:210,saves:290},j30:{views:31000,likes:1800,shares:330,saves:440}},
  },
  {
    channel:"common", title:"POV : On prépare un fight ensemble",
    description:"Collab POV de la prépa commune — coulisses authentiques.",
    status:"Publié", pubDate:"2026-04-25", testReel:true,
    plans:["Arrivée à la salle","Échauffement ensemble","Sparring filmé caméra épaule"],
    notes:["Son ambiant max","Pas de musique sur les échanges"],
    testStats:{views:9800,likes:670,shares:190,saves:88},
    stats:{j1:{views:14000,likes:920,shares:310,saves:180},j7:{views:38000,likes:2600,shares:890,saves:520},j30:{views:67000,likes:4400,shares:1500,saves:890}},
  },
  {
    channel:"common", title:"Collab – Sparring Session Raw",
    description:"Sparring non coupé, style documentaire.",
    status:"En montage", pubDate:"", testReel:false,
    plans:["3 rounds complets","Interview post-session","Réaction en direct"],
    notes:["Vérifier le son micro-cravate","Export 4K"],
    testStats:null,
    stats:{j1:null,j7:null,j30:null},
  },
  {
    channel:"collab", title:"Stretching quotidien fighter",
    description:"Routine mobilité 15 min recommandée pour les MMA.",
    status:"Planifié", pubDate:"", testReel:false,
    plans:["Intro mouvement","8 exercices enchaînés","Outro CTA"],
    notes:["Sous-titres FR + EN","Fond neutre"],
    testStats:null,
    stats:{j1:null,j7:null,j30:null},
  },
  {
    channel:"robin", title:"Pesée PEF 11 – coulisses",
    description:"Atmosphère backstage pesée officielle PEF 11.",
    status:"À filmer", pubDate:"2026-06-05", testReel:true,
    plans:["Arrivée salle pesée","Face-off","Réaction après pesée"],
    notes:["Prendre le micro-perche","Vérifier accréditation média"],
    testStats:{views:0,likes:0,shares:0,saves:0},
    stats:{j1:null,j7:null,j30:null},
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = n => {
  if (n == null) return "—";
  if (n >= 1e6) return (n/1e6).toFixed(1)+"M";
  if (n >= 1000) return (n/1000).toFixed(1)+"K";
  return String(n);
};
const ch = id => CHANNELS.find(c => c.id === id);

function merged(video) {
  const r = {};
  for (const p of ["j1","j7","j30"]) {
    const real = video.stats?.[p];
    if (!real) { r[p] = null; continue; }
    if (video.testReel && video.testStats) {
      r[p] = {};
      for (const m of METRICS) r[p][m] = (real[m]||0) + (video.testStats[m]||0);
    } else {
      r[p] = { ...real };
    }
  }
  return r;
}

// ─── Firebase hooks ───────────────────────────────────────────────────────────
function useVideos() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "videos"), async (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Seed initial data if empty
      if (docs.length === 0 && !seeded) {
        setSeeded(true);
        for (const v of SEED) {
          await addDoc(collection(db, "videos"), v);
        }
        return;
      }
      setVideos(docs);
      setLoading(false);
    });
    return unsub;
  }, [seeded]);

  async function saveVideo(video) {
    const { id, ...data } = video;
    if (id) {
      await updateDoc(doc(db, "videos", id), data);
    } else {
      await addDoc(collection(db, "videos"), data);
    }
  }

  async function addVideo(data) {
    await addDoc(collection(db, "videos"), data);
  }

  async function removeVideo(id) {
    await deleteDoc(doc(db, "videos", id));
  }

  return { videos, loading, saveVideo, addVideo, removeVideo };
}

// ─── Components ───────────────────────────────────────────────────────────────
function Tag({ children, bg, color }) {
  return (
    <span style={{ fontSize:11, fontWeight:700, padding:"3px 9px", borderRadius:20,
      background:bg, color, display:"inline-block", whiteSpace:"nowrap" }}>
      {children}
    </span>
  );
}

function SyncBadge({ saving }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11,
      color: saving ? "#f59e0b" : "#22c55e", fontWeight:700 }}>
      <span style={{ width:7, height:7, borderRadius:"50%",
        background: saving ? "#f59e0b" : "#22c55e",
        boxShadow: saving ? "0 0 0 3px #f59e0b33" : "0 0 0 3px #22c55e33",
        display:"inline-block", animation: saving ? "pulse 1s infinite" : "none" }}/>
      {saving ? "Sync…" : "Synchronisé"}
    </div>
  );
}

function AttachmentZone({ attachments = [], onChange }) {
  const ref = useRef();
  function handleFiles(files) {
    const newItems = Array.from(files).map(f => ({
      name: f.name,
      type: f.type.startsWith("image") ? "image"
          : f.type.startsWith("audio") ? "audio"
          : f.type.startsWith("video") ? "video" : "file",
      url: URL.createObjectURL(f),
    }));
    onChange([...attachments, ...newItems]);
  }
  return (
    <div style={S.attachGrid}>
      {attachments.map((a, i) => (
        <div key={i} style={S.attachItem}>
          {a.type==="image" && <img src={a.url} style={S.attachImg} alt={a.name}/>}
          {a.type==="audio" && <div style={S.attachAudio}><span style={{fontSize:22}}>🎙</span><audio controls src={a.url} style={{width:"100%",marginTop:4}}/></div>}
          {a.type==="video" && <video src={a.url} controls style={S.attachImg}/>}
          {a.type==="file"  && <div style={S.attachFile}>📎 {a.name}</div>}
          <button style={S.removeBtn} onClick={() => onChange(attachments.filter((_,j)=>j!==i))}>✕</button>
        </div>
      ))}
      <div style={S.attachDrop} onClick={() => ref.current.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}>
        <span style={{fontSize:28,color:"#cbd5e1"}}>+</span>
        <span style={{fontSize:12,color:"#94a3b8"}}>Photo / Audio / Vidéo</span>
        <input ref={ref} type="file" multiple accept="image/*,audio/*,video/*"
          style={{display:"none"}} onChange={e => handleFiles(e.target.files)}/>
      </div>
    </div>
  );
}

function ProjectDetail({ video, onClose, onSave }) {
  const c = ch(video.channel);
  const [v, setV] = useState(video);
  const [tab, setTab] = useState("brief");
  const [newPlan, setNewPlan] = useState("");
  const [newNote, setNewNote] = useState("");
  const [editStats, setEditStats] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync external changes (another user saved)
  useEffect(() => { setV(video); }, [video.id]);

  const setField = (k, val) => setV(d => ({ ...d, [k]: val }));
  const setStat = (period, metric, val) =>
    setV(d => ({ ...d, stats: { ...d.stats, [period]: { ...(d.stats?.[period]||{}), [metric]: Number(val)||0 }}}));
  const setTest = (metric, val) =>
    setV(d => ({ ...d, testStats: { ...(d.testStats||{}), [metric]: Number(val)||0 }}));

  async function save() {
    setSaving(true);
    await onSave(v);
    setSaving(false);
  }

  const mg = merged(v);

  return (
    <div style={S.drawer}>
      <div style={{...S.drawerBar, background:`linear-gradient(135deg,${c.color}18,${c.light})`}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
          <span style={{fontSize:22}}>{c.emoji}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,color:c.color,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{c.label}</div>
            <input value={v.title} onChange={e=>setField("title",e.target.value)}
              style={{...S.titleInput,color:"#1e293b"}} placeholder="Titre de la vidéo"/>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
          <SyncBadge saving={saving}/>
          <button style={{...S.saveBtn,background:c.color}} onClick={save}>💾 Sauvegarder</button>
          <button style={S.closeBtn2} onClick={onClose}>✕</button>
        </div>
      </div>

      <div style={S.drawerMeta}>
        <select value={v.status} onChange={e=>setField("status",e.target.value)} style={S.sel}>
          {STATUS_OPTIONS.map(o=><option key={o}>{o}</option>)}
        </select>
        <input type="date" value={v.pubDate||""} onChange={e=>setField("pubDate",e.target.value)} style={S.sel}/>
        <label style={S.checkLabel}>
          <input type="checkbox" checked={!!v.testReel} onChange={e=>setField("testReel",e.target.checked)}/>
          <span style={{fontSize:12,fontWeight:600,color:"#f59e0b"}}>Reel d'essai</span>
        </label>
      </div>

      <div style={S.subTabs}>
        {[["brief","✏️ Brief"],["plans","🎬 Plans"],["media","📎 Médias"],["stats","📊 Stats"]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{...S.subTab,...(tab===t?{...S.subTabActive,borderColor:c.color,color:c.color}:{})}}>
            {l}
          </button>
        ))}
      </div>

      <div style={S.drawerBody}>
        {tab==="brief" && (
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div>
              <label style={S.label}>Description / Concept</label>
              <textarea value={v.description||""} onChange={e=>setField("description",e.target.value)}
                style={S.textarea} rows={4} placeholder="Concept, message, émotion voulue…"/>
            </div>
            <div>
              <label style={S.label}>Notes collaboratives</label>
              {(v.notes||[]).map((n,i)=>(
                <div key={i} style={S.noteRow}>
                  <span style={{...S.noteDot,background:c.color}}/>
                  <input value={n} onChange={e=>{const ns=[...v.notes];ns[i]=e.target.value;setField("notes",ns);}}
                    style={S.noteInput}/>
                  <button style={S.rmBtn} onClick={()=>setField("notes",(v.notes||[]).filter((_,j)=>j!==i))}>✕</button>
                </div>
              ))}
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <input style={{...S.noteInput,flex:1}} value={newNote} onChange={e=>setNewNote(e.target.value)}
                  placeholder="Ajouter une note…"
                  onKeyDown={e=>{if(e.key==="Enter"&&newNote.trim()){setField("notes",[...(v.notes||[]),newNote]);setNewNote("");}}}/>
                <button style={{...S.addSmall,background:c.color+"22",color:c.color}}
                  onClick={()=>{if(newNote.trim()){setField("notes",[...(v.notes||[]),newNote]);setNewNote("");}}}>+</button>
              </div>
            </div>
          </div>
        )}

        {tab==="plans" && (
          <div>
            <label style={S.label}>Plans à filmer</label>
            {(v.plans||[]).map((p,i)=>(
              <div key={i} style={S.planRow}>
                <span style={S.planNum}>{i+1}</span>
                <input value={p} onChange={e=>{const ps=[...v.plans];ps[i]=e.target.value;setField("plans",ps);}}
                  style={{...S.noteInput,flex:1}}/>
                <button style={S.rmBtn} onClick={()=>setField("plans",(v.plans||[]).filter((_,j)=>j!==i))}>✕</button>
              </div>
            ))}
            <div style={{display:"flex",gap:8,marginTop:10}}>
              <input style={{...S.noteInput,flex:1}} value={newPlan} onChange={e=>setNewPlan(e.target.value)}
                placeholder="Nouveau plan à filmer…"
                onKeyDown={e=>{if(e.key==="Enter"&&newPlan.trim()){setField("plans",[...(v.plans||[]),newPlan]);setNewPlan("");}}}/>
              <button style={{...S.addSmall,background:c.color+"22",color:c.color}}
                onClick={()=>{if(newPlan.trim()){setField("plans",[...(v.plans||[]),newPlan]);setNewPlan("");}}}>+</button>
            </div>
          </div>
        )}

        {tab==="media" && (
          <div>
            <label style={S.label}>Photos, audios, vidéos de référence</label>
            <AttachmentZone attachments={v.attachments||[]} onChange={a=>setField("attachments",a)}/>
            <p style={{fontSize:11,color:"#94a3b8",marginTop:12}}>
              ⚠️ Les médias sont stockés localement. Pour partager des fichiers avec ton collab, utilise un lien Google Drive ou Dropbox dans les notes.
            </p>
          </div>
        )}

        {tab==="stats" && (
          <div>
            {v.testReel && (
              <div style={S.statsBlock}>
                <div style={{...S.statsBlockTitle,color:"#f59e0b"}}>🎯 Reel d'essai</div>
                <div style={S.statsRow2}>
                  {METRICS.map(m=>(
                    <div key={m} style={S.statBox}>
                      <div style={S.statBoxIcon}>{MI[m]}</div>
                      <div style={S.statBoxLabel}>{ML[m]}</div>
                      {editStats
                        ? <input style={S.statIn} value={v.testStats?.[m]||""} onChange={e=>setTest(m,e.target.value)} placeholder="0"/>
                        : <div style={{...S.statBoxVal,color:"#f59e0b"}}>{fmt(v.testStats?.[m])}</div>
                      }
                    </div>
                  ))}
                </div>
              </div>
            )}

            {[{key:"j1",label:"J+1"},{key:"j7",label:"J+7"},{key:"j30",label:"J+30"}].map(({key,label})=>{
              const real = v.stats?.[key];
              const tot  = mg[key];
              return (
                <div key={key} style={S.statsBlock}>
                  <div style={{...S.statsBlockTitle,color:c.color}}>
                    {label}
                    {!real && <span style={{fontSize:11,color:"#94a3b8",fontWeight:400,marginLeft:8}}>à saisir</span>}
                    {v.testReel && tot && real && <span style={{fontSize:11,color:"#f59e0b",fontWeight:600,marginLeft:8}}>· essai + classique cumulés</span>}
                  </div>
                  <div style={S.statsRow2}>
                    {METRICS.map(m=>(
                      <div key={m} style={S.statBox}>
                        <div style={S.statBoxIcon}>{MI[m]}</div>
                        <div style={S.statBoxLabel}>{ML[m]}</div>
                        {editStats
                          ? <input style={S.statIn} value={v.stats?.[key]?.[m]||""} onChange={e=>setStat(key,m,e.target.value)} placeholder="0"/>
                          : <>
                              <div style={{...S.statBoxVal,color:c.color}}>{fmt(real?.[m])}</div>
                              {v.testReel && tot && real && (
                                <div style={{fontSize:10,color:"#f59e0b",fontWeight:700}}>↑ {fmt(tot[m])} total</div>
                              )}
                            </>
                        }
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <div style={{display:"flex",gap:10,marginTop:8}}>
              <button style={{...S.saveBtn,background:editStats?c.color:"#e2e8f0",color:editStats?"#fff":"#475569"}}
                onClick={()=>{ if(editStats) save(); setEditStats(e=>!e); }}>
                {editStats ? "✓ Valider" : "✏️ Modifier les stats"}
              </button>
              {editStats && (
                <button style={{...S.saveBtn,background:"#f1f5f9",color:"#94a3b8"}}
                  onClick={()=>{ setV(video); setEditStats(false); }}>Annuler</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CompareView({ videos }) {
  const [metric, setMetric] = useState("views");
  const [period, setPeriod]  = useState("j30");

  const rows = useMemo(() => {
    return videos
      .map(v => { const mg = merged(v); return { ...v, val: mg[period]?.[metric] ?? null }; })
      .filter(v => v.val != null)
      .sort((a,b) => b.val - a.val);
  }, [videos, metric, period]);

  const max = rows[0]?.val || 1;

  return (
    <div style={S.comparePage}>
      <div style={S.compareHeader}>
        <h2 style={S.compareH2}>Analyse comparative</h2>
        <p style={S.compareSubtitle}>Classe tes vidéos pour comprendre ce qui performe</p>
      </div>

      <div style={S.controls}>
        <div style={S.controlGroup}>
          <span style={S.controlLabel}>Métrique</span>
          <div style={S.pills}>
            {METRICS.map(m=>(
              <button key={m} onClick={()=>setMetric(m)}
                style={{...S.pill,...(metric===m?{background:"#f97316",color:"#fff",borderColor:"#f97316"}:{})}}>
                {MI[m]} {ML[m]}
              </button>
            ))}
          </div>
        </div>
        <div style={S.controlGroup}>
          <span style={S.controlLabel}>Période</span>
          <div style={S.pills}>
            {[["j1","J+1"],["j7","J+7"],["j30","J+30"]].map(([k,l])=>(
              <button key={k} onClick={()=>setPeriod(k)}
                style={{...S.pill,...(period===k?{background:"#06b6d4",color:"#fff",borderColor:"#06b6d4"}:{})}}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {rows.length === 0
        ? <div style={S.empty}>Aucune donnée — saisis les stats dans les projets.</div>
        : <div style={S.compareList}>
            {rows.map((v,i) => {
              const c = ch(v.channel);
              const pct = Math.round(v.val/max*100);
              return (
                <div key={v.id} style={S.compareRow}>
                  <div style={{...S.rankBadge,
                    background:i===0?"#fbbf24":i===1?"#e2e8f0":i===2?"#fdba74":"#f1f5f9",
                    color:i===0?"#78350f":i===1?"#334155":i===2?"#7c2d12":"#64748b"}}>
                    #{i+1}
                  </div>
                  <div style={S.compareInfo}>
                    <Tag bg={c.light} color={c.color}>{c.emoji} {c.label}</Tag>
                    <span style={S.cmpTitle}>{v.title}</span>
                    {v.testReel && <Tag bg="#fef3c7" color="#d97706">TEST+REEL</Tag>}
                  </div>
                  <div style={S.barWrap}>
                    <div style={{...S.barFill,width:`${pct}%`,background:`linear-gradient(90deg,${c.color},${c.color}99)`}}/>
                    <span style={{...S.barLabel,color:c.color}}>{fmt(v.val)}</span>
                  </div>
                </div>
              );
            })}
          </div>
      }

      {rows.length >= 2 && (
        <div style={S.insights}>
          <div style={S.insightTitle}>💡 Ce qu'on retient</div>
          <div style={S.insightItem}>🏆 <strong>{rows[0].title}</strong> — meilleure perf {ML[metric]} ({period==="j1"?"J+1":period==="j7"?"J+7":"J+30"}) : {fmt(rows[0].val)}</div>
          {rows[0].testReel && <div style={S.insightItem}>🔁 Le reel d'essai a amplifié les stats totales sur ce contenu.</div>}
          <div style={S.insightItem}>📉 <strong>{rows[rows.length-1].title}</strong> en retrait ({fmt(rows[rows.length-1].val)}) — analyser hook, heure de pub, format.</div>
          {(()=>{
            const commons = rows.filter(v=>v.channel==="common");
            if (!commons.length) return null;
            const avg = Math.round(commons.reduce((a,v)=>a+v.val,0)/commons.length);
            return <div style={S.insightItem}>⚡ Les collabs <strong>Commun</strong> font en moyenne {fmt(avg)} {ML[metric]}.</div>;
          })()}
        </div>
      )}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { videos, loading, saveVideo, addVideo } = useVideos();
  const [mainTab, setMainTab]   = useState("projects");
  const [filter, setFilter]     = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [showAdd, setShowAdd]   = useState(false);
  const [newV, setNewV] = useState({ channel:"robin", title:"", pubDate:"", testReel:false });

  const selected = videos.find(v => v.id === selectedId);
  const filtered = filter === "all" ? videos : videos.filter(v => v.channel === filter);

  async function handleAdd() {
    if (!newV.title.trim()) return;
    await addVideo({
      ...newV, description:"", plans:[], notes:[], attachments:[],
      testStats: newV.testReel ? {views:0,likes:0,shares:0,saves:0} : null,
      stats: { j1:null, j7:null, j30:null },
    });
    setNewV({ channel:"robin", title:"", pubDate:"", testReel:false });
    setShowAdd(false);
  }

  if (loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      background:"#f0f4ff",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:12}}>◈</div>
        <div style={{fontSize:16,fontWeight:700,color:"#1e293b"}}>ContentOS</div>
        <div style={{fontSize:13,color:"#94a3b8",marginTop:4}}>Connexion à la base de données…</div>
      </div>
    </div>
  );

  return (
    <div style={S.root}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {/* Header */}
      <header style={S.header}>
        <div style={S.logo}>
          <span style={S.logoMark}>◈</span>
          <div>
            <div style={S.logoName}>ContentOS</div>
            <div style={S.logoSub}>Bin's × Collab</div>
          </div>
        </div>
        <nav style={S.mainNav}>
          {[["projects","🗂 Projets"],["compare","📊 Analyse"]].map(([id,label])=>(
            <button key={id} onClick={()=>{setMainTab(id);setSelectedId(null);}}
              style={{...S.mainNavBtn,...(mainTab===id?S.mainNavBtnActive:{})}}>
              {label}
            </button>
          ))}
        </nav>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <SyncBadge saving={false}/>
          <button style={S.newBtn} onClick={()=>setShowAdd(v=>!v)}>+ Nouvelle vidéo</button>
        </div>
      </header>

      {/* Add form */}
      {showAdd && (
        <div style={S.addBar}>
          <select style={S.sel} value={newV.channel} onChange={e=>setNewV(d=>({...d,channel:e.target.value}))}>
            {CHANNELS.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
          </select>
          <input style={{...S.sel,flex:1}} placeholder="Titre de la vidéo" value={newV.title}
            onChange={e=>setNewV(d=>({...d,title:e.target.value}))}
            onKeyDown={e=>e.key==="Enter"&&handleAdd()}/>
          <input style={S.sel} type="date" value={newV.pubDate}
            onChange={e=>setNewV(d=>({...d,pubDate:e.target.value}))}/>
          <label style={S.checkLabel}>
            <input type="checkbox" checked={newV.testReel}
              onChange={e=>setNewV(d=>({...d,testReel:e.target.checked}))}/>
            <span style={{fontSize:12,fontWeight:600,color:"#f59e0b"}}>Reel d'essai</span>
          </label>
          <button style={S.newBtn} onClick={handleAdd}>Créer</button>
        </div>
      )}

      {/* Body */}
      {mainTab==="projects" && (
        <div style={S.body}>
          {/* Sidebar */}
          <div style={S.sidebar2}>
            <div style={S.sidebarSection}>Canaux</div>
            {[{id:"all",label:"Tous",sub:"",color:"#64748b",light:"#f8fafc",emoji:"🎯"},...CHANNELS].map(c=>(
              <button key={c.id} onClick={()=>{setFilter(c.id);setSelectedId(null);}}
                style={{...S.chBtn,...(filter===c.id?{background:c.light,borderLeft:`3px solid ${c.color}`,color:c.color}:{borderLeft:"3px solid transparent"})}}>
                <span style={{fontSize:16}}>{c.emoji}</span>
                <div>
                  <div style={{fontSize:13,fontWeight:700}}>{c.label||"Tous"}</div>
                  {c.sub&&<div style={{fontSize:10,color:"#94a3b8"}}>{c.sub}</div>}
                </div>
                <span style={{marginLeft:"auto",fontSize:11,color:"#94a3b8",fontWeight:600}}>
                  {c.id==="all"?videos.length:videos.filter(v=>v.channel===c.id).length}
                </span>
              </button>
            ))}

            <div style={{...S.sidebarSection,marginTop:24}}>Statuts</div>
            {STATUS_OPTIONS.map(st=>{
              const count = filtered.filter(v=>v.status===st).length;
              return count > 0 ? (
                <div key={st} style={S.statusLine}>
                  <span style={{...S.statusDot2,background:STATUS_TEXT[st]}}/>
                  <span style={{fontSize:12,color:"#475569"}}>{st}</span>
                  <span style={{marginLeft:"auto",fontSize:11,fontWeight:700,color:STATUS_TEXT[st]}}>{count}</span>
                </div>
              ) : null;
            })}
          </div>

          {/* Cards */}
          <div style={{...S.cardArea,...(selected?{maxWidth:460,minWidth:320}:{})}}>
            {filtered.map(v => {
              const c = ch(v.channel);
              const mg = merged(v);
              const best = mg.j30 || mg.j7 || mg.j1;
              return (
                <div key={v.id} onClick={()=>setSelectedId(v.id===selectedId?null:v.id)}
                  style={{...S.card,...(selectedId===v.id?{borderColor:c.color,boxShadow:`0 0 0 2px ${c.color}33`}:{})}}>
                  <div style={{...S.cardAccent,background:`linear-gradient(135deg,${c.color}18,${c.light})`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:4}}>
                      <Tag bg={c.light} color={c.color}>{c.emoji} {c.label}</Tag>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                        {v.testReel && <Tag bg="#fef3c7" color="#d97706">TEST</Tag>}
                        <Tag bg={STATUS_COLOR[v.status]} color={STATUS_TEXT[v.status]}>{v.status}</Tag>
                      </div>
                    </div>
                    <div style={S.cardTitle}>{v.title}</div>
                    {v.description && <div style={S.cardDesc}>{v.description.slice(0,80)}{v.description.length>80?"…":""}</div>}
                  </div>
                  <div style={S.cardBody}>
                    <div style={S.cardMiniStats}>
                      {METRICS.map(m=>(
                        <div key={m} style={S.miniStat2}>
                          <span style={{fontSize:13}}>{MI[m]}</span>
                          <span style={{fontSize:12,fontWeight:700,color:"#1e293b"}}>{fmt(best?.[m])}</span>
                          <span style={{fontSize:10,color:"#94a3b8"}}>{ML[m]}</span>
                        </div>
                      ))}
                    </div>
                    <div style={S.cardFooter}>
                      <div style={{display:"flex",gap:4,alignItems:"center"}}>
                        {["j1","j7","j30"].map(p=>(
                          <span key={p} title={p} style={{width:8,height:8,borderRadius:"50%",
                            background:mg[p]?c.color:"#e2e8f0",display:"inline-block"}}/>
                        ))}
                        <span style={{fontSize:10,color:"#94a3b8",marginLeft:4}}>données</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        {v.pubDate && <span style={{fontSize:11,color:"#94a3b8"}}>📅 {v.pubDate}</span>}
                        <button style={S.deleteBtn} onClick={e=>{
                          e.stopPropagation();
                          if(window.confirm(`Supprimer "${v.title}" ?`)){
                            removeVideo(v.id);
                            if(selectedId===v.id) setSelectedId(null);
                          }
                        }}>🗑</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detail drawer */}
          {selected && (
            <div style={S.drawerWrap}>
              <ProjectDetail video={selected} onClose={()=>setSelectedId(null)} onSave={saveVideo}/>
            </div>
          )}
        </div>
      )}

      {mainTab==="compare" && <CompareView videos={videos}/>}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  root:{minHeight:"100vh",background:"#f0f4ff",color:"#1e293b",fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif",display:"flex",flexDirection:"column"},
  header:{display:"flex",alignItems:"center",gap:20,padding:"12px 24px",background:"#fff",borderBottom:"1px solid #e2e8f0",boxShadow:"0 1px 4px rgba(0,0,0,.06)",position:"sticky",top:0,zIndex:200},
  logo:{display:"flex",alignItems:"center",gap:10,marginRight:"auto"},
  logoMark:{fontSize:26,background:"linear-gradient(135deg,#f97316,#8b5cf6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"},
  logoName:{fontSize:16,fontWeight:800,color:"#1e293b",letterSpacing:"-0.03em"},
  logoSub:{fontSize:10,color:"#94a3b8",fontWeight:600},
  mainNav:{display:"flex",gap:4},
  mainNavBtn:{padding:"8px 18px",borderRadius:22,border:"1px solid #e2e8f0",background:"transparent",color:"#64748b",cursor:"pointer",fontSize:13,fontWeight:600},
  mainNavBtnActive:{background:"linear-gradient(135deg,#f97316,#f59e0b)",color:"#fff",border:"none",boxShadow:"0 2px 8px #f9731640"},
  newBtn:{padding:"9px 20px",background:"linear-gradient(135deg,#8b5cf6,#06b6d4)",border:"none",borderRadius:22,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:"0 2px 8px #8b5cf640"},
  addBar:{display:"flex",gap:10,alignItems:"center",padding:"12px 24px",background:"#fff",borderBottom:"1px solid #e2e8f0",flexWrap:"wrap"},
  sel:{padding:"8px 12px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,color:"#1e293b",fontSize:13,outline:"none"},
  checkLabel:{display:"flex",alignItems:"center",gap:6,cursor:"pointer"},
  body:{display:"flex",flex:1,overflow:"hidden",minHeight:0},
  sidebar2:{width:200,background:"#fff",borderRight:"1px solid #e2e8f0",padding:"16px 12px",display:"flex",flexDirection:"column",gap:2,flexShrink:0,overflowY:"auto"},
  sidebarSection:{fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",color:"#94a3b8",padding:"8px 8px 4px"},
  chBtn:{display:"flex",alignItems:"center",gap:10,padding:"10px 10px",borderRadius:10,border:"none",borderLeft:"3px solid transparent",background:"transparent",cursor:"pointer",textAlign:"left",width:"100%"},
  statusLine:{display:"flex",alignItems:"center",gap:8,padding:"5px 10px"},
  statusDot2:{width:7,height:7,borderRadius:"50%",flexShrink:0},
  cardArea:{flex:1,padding:"20px",overflowY:"auto",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:16,alignContent:"start"},
  card:{background:"#fff",borderRadius:16,border:"2px solid #e2e8f0",cursor:"pointer",overflow:"hidden",transition:"border-color .15s,box-shadow .15s"},
  cardAccent:{padding:"16px 16px 12px"},
  cardTitle:{fontSize:15,fontWeight:700,color:"#0f172a",marginTop:10,lineHeight:1.35},
  cardDesc:{fontSize:12,color:"#64748b",marginTop:4,lineHeight:1.5},
  cardBody:{padding:"12px 16px",borderTop:"1px solid #f1f5f9"},
  cardMiniStats:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,marginBottom:10},
  miniStat2:{display:"flex",flexDirection:"column",alignItems:"center",gap:2,background:"#f8fafc",borderRadius:8,padding:"6px 4px"},
  cardFooter:{display:"flex",justifyContent:"space-between",alignItems:"center"},
  drawerWrap:{width:440,background:"#fff",borderLeft:"1px solid #e2e8f0",display:"flex",flexDirection:"column",overflowY:"auto",flexShrink:0},
  drawer:{display:"flex",flexDirection:"column",minHeight:"100%"},
  drawerBar:{padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexShrink:0,flexWrap:"wrap"},
  titleInput:{fontSize:15,fontWeight:700,border:"none",background:"transparent",outline:"none",width:"100%"},
  drawerMeta:{display:"flex",gap:8,padding:"10px 16px",borderBottom:"1px solid #f1f5f9",flexWrap:"wrap",alignItems:"center",flexShrink:0},
  subTabs:{display:"flex",borderBottom:"1px solid #f1f5f9",flexShrink:0},
  subTab:{flex:1,padding:"10px 4px",border:"none",borderBottom:"2px solid transparent",background:"transparent",color:"#94a3b8",cursor:"pointer",fontSize:12,fontWeight:600,textAlign:"center"},
  subTabActive:{borderBottomColor:"currentcolor"},
  drawerBody:{flex:1,padding:"16px",overflowY:"auto"},
  saveBtn:{padding:"8px 16px",border:"none",borderRadius:10,fontWeight:700,cursor:"pointer",fontSize:13},
  closeBtn2:{background:"none",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:18,lineHeight:1},
  label:{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:"#94a3b8",display:"block",marginBottom:6},
  textarea:{width:"100%",padding:"10px 12px",border:"1px solid #e2e8f0",borderRadius:10,fontSize:13,color:"#1e293b",background:"#f8fafc",resize:"vertical",fontFamily:"inherit",boxSizing:"border-box",outline:"none"},
  noteRow:{display:"flex",alignItems:"center",gap:8,marginBottom:6},
  noteDot:{width:7,height:7,borderRadius:"50%",flexShrink:0},
  noteInput:{flex:1,padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,color:"#1e293b",background:"#f8fafc",outline:"none"},
  planRow:{display:"flex",alignItems:"center",gap:8,marginBottom:8},
  planNum:{width:22,height:22,borderRadius:"50%",background:"#f1f5f9",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#64748b",flexShrink:0},
  rmBtn:{background:"none",border:"none",color:"#cbd5e1",cursor:"pointer",fontSize:14,padding:"0 2px"},
  addSmall:{padding:"7px 14px",border:"none",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:15},
  attachGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10,marginTop:4},
  attachItem:{position:"relative",borderRadius:10,overflow:"hidden",border:"1px solid #e2e8f0",background:"#f8fafc"},
  attachImg:{width:"100%",height:100,objectFit:"cover",display:"block"},
  attachAudio:{padding:10,display:"flex",flexDirection:"column",alignItems:"center"},
  attachFile:{padding:12,fontSize:11,color:"#64748b",wordBreak:"break-all"},
  attachDrop:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,height:130,border:"2px dashed #e2e8f0",borderRadius:10,cursor:"pointer",background:"#fafbff"},
  removeBtn:{position:"absolute",top:4,right:4,background:"rgba(255,255,255,.9)",border:"none",borderRadius:"50%",width:20,height:20,fontSize:11,cursor:"pointer",color:"#64748b"},
  statsBlock:{background:"#f8fafc",borderRadius:12,padding:14,marginBottom:12,border:"1px solid #f1f5f9"},
  statsBlockTitle:{fontSize:12,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10},
  statsRow2:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8},
  statBox:{background:"#fff",borderRadius:10,padding:"10px 6px",display:"flex",flexDirection:"column",alignItems:"center",gap:3,boxShadow:"0 1px 3px rgba(0,0,0,.05)"},
  statBoxIcon:{fontSize:16},
  statBoxLabel:{fontSize:10,color:"#94a3b8",fontWeight:600},
  statBoxVal:{fontSize:15,fontWeight:800},
  statIn:{width:"100%",padding:"4px 6px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:13,textAlign:"center",fontWeight:700,color:"#1e293b",outline:"none",boxSizing:"border-box"},
  comparePage:{flex:1,padding:"28px 32px",overflowY:"auto",maxWidth:860},
  compareHeader:{marginBottom:24},
  compareH2:{fontSize:24,fontWeight:800,color:"#0f172a",letterSpacing:"-0.03em",margin:0},
  compareSubtitle:{fontSize:14,color:"#94a3b8",marginTop:4},
  controls:{display:"flex",gap:32,marginBottom:28,flexWrap:"wrap"},
  controlGroup:{display:"flex",flexDirection:"column",gap:8},
  controlLabel:{fontSize:11,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.07em",color:"#94a3b8"},
  pills:{display:"flex",gap:6,flexWrap:"wrap"},
  pill:{padding:"7px 14px",borderRadius:20,border:"1px solid #e2e8f0",background:"#fff",color:"#64748b",cursor:"pointer",fontSize:12,fontWeight:600},
  compareList:{display:"flex",flexDirection:"column",gap:10},
  compareRow:{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",background:"#fff",borderRadius:14,boxShadow:"0 1px 4px rgba(0,0,0,.05)",flexWrap:"wrap"},
  rankBadge:{width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,flexShrink:0},
  compareInfo:{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0,flexWrap:"wrap"},
  cmpTitle:{fontSize:13,fontWeight:600,color:"#0f172a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},
  barWrap:{display:"flex",alignItems:"center",gap:10,width:200,flexShrink:0},
  barFill:{height:10,borderRadius:5,minWidth:4,transition:"width .4s"},
  barLabel:{fontSize:14,fontWeight:800,minWidth:50,textAlign:"right"},
  insights:{marginTop:24,background:"linear-gradient(135deg,#f0f4ff,#fff4ed)",borderRadius:16,padding:20,border:"1px solid #e2e8f0"},
  insightTitle:{fontSize:13,fontWeight:800,color:"#0f172a",marginBottom:12},
  insightItem:{fontSize:13,color:"#475569",marginBottom:8,lineHeight:1.6},
  empty:{color:"#94a3b8",fontSize:14,padding:"40px 0",textAlign:"center"},
  deleteBtn:{background:"none",border:"none",color:"#fca5a5",cursor:"pointer",fontSize:15,padding:"2px 4px",borderRadius:6,lineHeight:1},
};
