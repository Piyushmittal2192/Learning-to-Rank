import { useState, useMemo, useRef, useEffect } from "react";

/* ═══════════════════════ DATA ═══════════════════════ */
const PRODUCTS = [
  { id:0, name:"Wireless Headphones", cat:"Audio",       price:49.99, img:"🎧", rel:3,
    raw:{ impressions:5200, clicks:624, addToCart:312, purchases:156, dwellSec:48, bounce:0.22, reviews:4.6, rCount:1840 },
    f:[0.12,0.06,0.03,48,0.78,4.6,0.92] },
  { id:1, name:"USB-C Hub",           cat:"Accessories",  price:29.99, img:"🔌", rel:2,
    raw:{ impressions:4100, clicks:369, addToCart:164, purchases:74,  dwellSec:32, bounce:0.38, reviews:4.2, rCount:920  },
    f:[0.09,0.04,0.018,32,0.85,4.2,0.88] },
  { id:2, name:"Screen Protector",    cat:"Protection",   price:9.99,  img:"📱", rel:1,
    raw:{ impressions:8300, clicks:498, addToCart:166, purchases:83,  dwellSec:15, bounce:0.55, reviews:3.8, rCount:3200 },
    f:[0.06,0.02,0.010,15,0.95,3.8,0.70] },
  { id:3, name:"HDMI Cable 6ft",      cat:"Cables",       price:12.99, img:"🔗", rel:0,
    raw:{ impressions:6100, clicks:183, addToCart:61,  purchases:18,  dwellSec:8,  bounce:0.72, reviews:3.5, rCount:560  },
    f:[0.03,0.01,0.003, 8,0.90,3.5,0.65] },
  { id:4, name:"Bluetooth Speaker",   cat:"Audio",        price:79.99, img:"🔊", rel:3,
    raw:{ impressions:3900, clicks:507, addToCart:273, purchases:137, dwellSec:55, bounce:0.18, reviews:4.7, rCount:2100 },
    f:[0.13,0.07,0.035,55,0.65,4.7,0.95] },
  { id:5, name:"Laptop Cooling Pad",  cat:"Accessories",  price:24.99, img:"💻", rel:2,
    raw:{ impressions:3200, clicks:256, addToCart:112, purchases:48,  dwellSec:28, bounce:0.41, reviews:4.0, rCount:680  },
    f:[0.08,0.035,0.015,28,0.82,4.0,0.80] },
  { id:6, name:"Mouse Pad XL",        cat:"Accessories",  price:14.99, img:"🖱", rel:1,
    raw:{ impressions:5800, clicks:290, addToCart:87,  purchases:35,  dwellSec:12, bounce:0.60, reviews:3.9, rCount:410  },
    f:[0.05,0.015,0.006,12,0.92,3.9,0.72] },
  { id:7, name:"Webcam HD 1080p",     cat:"Electronics",  price:44.99, img:"📷", rel:2,
    raw:{ impressions:2800, clicks:252, addToCart:126, purchases:50,  dwellSec:38, bounce:0.32, reviews:4.3, rCount:780  },
    f:[0.09,0.045,0.018,38,0.72,4.3,0.85] },
];

const FEAT_NAMES  = ["CTR","Add-to-cart rate","Conv. rate","Dwell time (s)","Price score","Review score","Availability"];
const FEAT_MAX    = [1,1,1,60,1,5,1];
const REL_COLORS  = ["#64748b","#f59e0b","#f97316","#ef4444"];
const REL_LABELS  = ["Irrelevant","Marginal","Relevant","Highly relevant"];

/* ═══════════════════════ MATH ═══════════════════════ */
const sigmoid  = x => 1/(1+Math.exp(-Math.max(-500,Math.min(500,x))));
const dcg      = rels => rels.reduce((s,r,i)=>s+(Math.pow(2,r)-1)/Math.log2(i+2),0);
const idcg     = rels => dcg([...rels].sort((a,b)=>b-a));
const ndcg     = rels => { const id=idcg(rels); return id===0?0:dcg(rels)/id; };
const softmax  = arr  => { const mx=Math.max(...arr); const e=arr.map(v=>Math.exp(v-mx)); const s=e.reduce((a,b)=>a+b,0); return e.map(v=>v/s); };
const mrr      = (rels,t=2) => { const i=rels.findIndex(r=>r>=t); return i<0?0:1/(i+1); };
const mapK     = (rels,t=2) => { let h=0,sm=0; rels.forEach((r,i)=>{if(r>=t){h++;sm+=h/(i+1)}}); return h===0?0:sm/h; };
const clamp    = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const lerp     = (a,b,t) => a+(b-a)*t;

/* ═══════════════════════ DESIGN TOKENS ═══════════════════════ */
const C = {
  bg0:"#05070c", bg1:"#0b0e15", bg2:"#101420", bg3:"#161c28", bg4:"#1c2335",
  bd:"#1e2736", bd2:"#253045",
  t1:"#e2e8f0", t2:"#94a3b8", t3:"#64748b", t4:"#3d4f66",
  acc:"#22d3ee", acc2:"#0ea5e9",
  warn:"#f59e0b", warn2:"#fbbf24",
  err:"#ef4444", err2:"#f87171",
  ok:"#22c55e",  ok2:"#4ade80",
  purple:"#a78bfa", purple2:"#c4b5fd",
  pink:"#ec4899",
};

/* ═══════════════════════ SHARED UI ═══════════════════════ */
const Card = ({children,style,accent})=>(
  <div style={{background:C.bg2,border:`1px solid ${accent||C.bd}`,borderRadius:10,padding:"18px 20px",...style}}>{children}</div>
);
const InnerCard = ({children,style})=>(
  <div style={{background:C.bg1,border:`1px solid ${C.bd}`,borderRadius:8,padding:"12px 14px",...style}}>{children}</div>
);
const Tag = ({color=C.t3,children,sm})=>(
  <span style={{display:"inline-block",fontSize:sm?9:10,fontWeight:600,padding:sm?"1px 5px":"2px 7px",borderRadius:4,background:color+"22",color,letterSpacing:.4}}>{children}</span>
);
const Mono = ({children,color=C.t2})=>(
  <span style={{fontFamily:"'Courier New',monospace",fontSize:12,color}}>{children}</span>
);
const Bar = ({value,max=1,color=C.acc,h=10,animated=true})=>(
  <div style={{flex:1,height:h,background:C.bg0,borderRadius:3,overflow:"hidden"}}>
    <div style={{width:`${clamp(value/max*100,0,100)}%`,height:"100%",background:color,borderRadius:3,transition:animated?"width .4s ease":"none"}} />
  </div>
);
const Slider = ({label,min,max,step=1,value,onChange,color=C.acc,width=100})=>(
  <div style={{display:"flex",alignItems:"center",gap:8}}>
    <span style={{fontSize:11,color:C.t2,width:width,flexShrink:0}}>{label}</span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))} style={{flex:1,accentColor:color}} />
    <span style={{fontSize:11.5,color,fontFamily:"monospace",width:46,textAlign:"right"}}>{typeof value==="number"?value.toFixed(step<1?2:0):value}</span>
  </div>
);
const Stat = ({label,value,color=C.acc,sub})=>(
  <div style={{background:C.bg1,borderRadius:8,padding:"10px 14px",flex:1,minWidth:80,border:`1px solid ${C.bd}`}}>
    <div style={{fontSize:9.5,color:C.t4,marginBottom:3,textTransform:"uppercase",letterSpacing:.8}}>{label}</div>
    <div style={{fontSize:20,fontWeight:700,color,fontFamily:"'Courier New',monospace",letterSpacing:-1}}>{value}</div>
    {sub&&<div style={{fontSize:10,color:C.t4,marginTop:2}}>{sub}</div>}
  </div>
);

/* ═══════════════════════ EDUCATIONAL COMPONENTS ═══════════════════════ */

// Callout / Insight box
const Insight = ({type="info",title,children})=>{
  const palette={info:C.acc,tip:C.ok,warning:C.warn,formula:C.purple,advanced:C.pink,code:C.t3};
  const icons={info:"ℹ",tip:"💡",warning:"⚠",formula:"∑",advanced:"⚡",code:"⌨"};
  const col=palette[type]||C.acc;
  return(
    <div style={{background:col+"0d",border:`1px solid ${col}33`,borderRadius:8,padding:"12px 16px",borderLeft:`3px solid ${col}`}}>
      {title&&<div style={{fontSize:10.5,fontWeight:700,color:col,marginBottom:5,display:"flex",alignItems:"center",gap:5}}><span>{icons[type]||"ℹ"}</span>{title}</div>}
      <div style={{fontSize:12.5,color:C.t2,lineHeight:1.75}}>{children}</div>
    </div>
  );
};

// Code block
const Code = ({children,title})=>(
  <div style={{background:C.bg0,border:`1px solid ${C.bd2}`,borderRadius:8,overflow:"hidden",margin:"6px 0"}}>
    {title&&<div style={{padding:"5px 12px",background:C.bg1,borderBottom:`1px solid ${C.bd}`,fontSize:10,color:C.t3,fontWeight:600,letterSpacing:.5}}>{title}</div>}
    <div style={{padding:"12px 16px",fontFamily:"'Courier New',Courier,monospace",fontSize:11.5,color:"#a5f3fc",lineHeight:1.85,overflowX:"auto",whiteSpace:"pre"}}>{children}</div>
  </div>
);

// Math / formula block
const MathBox = ({children,label})=>(
  <div style={{background:C.bg0,border:`1px solid ${C.purple}33`,borderRadius:8,padding:"12px 16px",margin:"6px 0"}}>
    {label&&<div style={{fontSize:9.5,color:C.purple,fontWeight:700,marginBottom:4,textTransform:"uppercase",letterSpacing:.8}}>{label}</div>}
    <div style={{fontFamily:"'Courier New',Courier,monospace",fontSize:13,color:C.purple2,lineHeight:2,whiteSpace:"pre-wrap"}}>{children}</div>
  </div>
);

// Step-by-step walkthrough
const Steps = ({steps,color=C.acc})=>{
  const [cur,setCur]=useState(0);
  return(
    <div>
      <div style={{background:C.bg1,borderRadius:8,padding:"16px",marginBottom:10,minHeight:100}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <div style={{width:22,height:22,borderRadius:"50%",background:color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#000",flexShrink:0}}>{cur+1}</div>
          <div style={{fontSize:13,fontWeight:700,color:C.t1}}>{steps[cur].title}</div>
        </div>
        <div style={{fontSize:12.5,color:C.t2,lineHeight:1.7,marginBottom:steps[cur].math?8:0}}>{steps[cur].body}</div>
        {steps[cur].math&&<MathBox>{steps[cur].math}</MathBox>}
      </div>
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        {steps.map((_,i)=><button key={i} onClick={()=>setCur(i)} style={{padding:"5px 10px",borderRadius:5,border:`1px solid ${i===cur?color+"55":C.bd}`,background:i===cur?color+"15":"transparent",color:i===cur?color:C.t3,fontSize:10,fontWeight:600,cursor:"pointer"}}>Step {i+1}</button>)}
        <button onClick={()=>setCur(c=>Math.min(c+1,steps.length-1))} style={{padding:"5px 14px",borderRadius:5,border:`1px solid ${color}`,background:color,color:"#000",fontSize:10,fontWeight:700,cursor:"pointer",marginLeft:"auto"}}>Next →</button>
      </div>
    </div>
  );
};

// Sub-navigation inside each tab
const SubNav = ({items,active,onChange})=>(
  <div style={{display:"flex",gap:2,marginBottom:18,background:C.bg1,borderRadius:8,padding:"4px",border:`1px solid ${C.bd}`}}>
    {items.map(it=><button key={it.key} onClick={()=>onChange(it.key)} style={{flex:1,padding:"7px 6px",borderRadius:6,border:"none",fontSize:10.5,fontWeight:600,cursor:"pointer",transition:"all .2s",background:active===it.key?C.bg3:"transparent",color:active===it.key?C.t1:C.t3,textAlign:"center"}}>{it.icon} {it.label}</button>)}
  </div>
);

// Section header inside tabs
const STitle = ({children,sub,badge})=>(
  <div style={{marginBottom:14}}>
    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
      <h2 style={{fontSize:16,fontWeight:700,color:C.t1,margin:0,letterSpacing:-.2}}>{children}</h2>
      {badge&&<Tag color={badge.color}>{badge.text}</Tag>}
    </div>
    {sub&&<p style={{fontSize:12.5,color:C.t3,margin:"4px 0 0",lineHeight:1.6}}>{sub}</p>}
  </div>
);

// Two-column grid helper
const Grid2 = ({children,gap=12})=>(
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap}}>{children}</div>
);

// Difficulty badge
const Diff = ({level})=>{
  const map={beginner:[C.ok,"Beginner"],intermediate:[C.warn,"Intermediate"],advanced:[C.err,"Advanced"]};
  const [c,l]=map[level]||[C.t3,"All levels"];
  return <Tag color={c}>{l}</Tag>;
};

// Product row
const PRow = ({p,sel,onClick,extra})=>(
  <div onClick={onClick} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:sel?C.bg3:C.bg1,borderRadius:6,border:`1px solid ${sel?C.acc+"44":C.bd}`,cursor:onClick?"pointer":"default",transition:"all .15s",marginBottom:3}}>
    <span style={{fontSize:14,width:20}}>{p.img}</span>
    <div style={{flex:1,minWidth:0}}>
      <div style={{fontSize:11.5,color:C.t1,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</div>
      <div style={{fontSize:9.5,color:C.t3}}>${p.price} · {p.cat}</div>
    </div>
    <Tag color={REL_COLORS[p.rel]} sm>rel {p.rel}</Tag>
    {extra}
  </div>
);
/* ═══════════════════════════════════════════════════════════════════════
   TAB 1 — LTR OVERVIEW
═══════════════════════════════════════════════════════════════════════ */
function T1() {
  const [sub,setSub]=useState("why");
  const SUBS=[{key:"why",icon:"🎯",label:"Why ranking?"},{key:"pipeline",icon:"⚙️",label:"Pipeline"},{key:"approaches",icon:"🗺",label:"Approaches"},{key:"data",icon:"📊",label:"Training data"}];

  // pipeline step data
  const PIPE=[
    {t:"1. User query",d:'A customer types "wireless headphones" into your search box. The raw text is tokenised, spell-corrected, and expanded with synonyms ("bluetooth headphones", "wireless earphones").',x:"Query understanding adds context: is this navigational (they know a brand) or exploratory? Device, time-of-day, and past purchases are logged alongside the query."},
    {t:"2. Candidate retrieval (recall)",d:"A fast index (BM25, ANN vector search, or both) fetches the top 200–1 000 candidate products. This stage optimises recall — we'd rather have too many than miss a good product.",x:"Typical latency budget: < 10 ms. Tools: Elasticsearch, Faiss, ScaNN. The output is a list of (product_id, rough_score) pairs."},
    {t:"3. Feature extraction",d:"For each (query, product) pair in the candidate set, we compute a feature vector from the product catalogue and historical engagement logs: CTR, add-to-cart rate, review score, BM25 score, dwell time, etc.",x:"Features combine query-level (popularity), product-level (reviews), and query-product interaction (historical CTR for this exact query-product pair). Retrieved from a feature store (Redis, DynamoDB) in < 5 ms."},
    {t:"4. LTR model scoring",d:"The LTR model (pointwise, pairwise, or listwise) takes the feature vectors and outputs a relevance score for each candidate. Products are sorted by this score.",x:"This is where the ML happens. The model was trained offline on historical data where relevance labels come from user behaviour: purchase=3, add-to-cart=2, click=1, skip=0."},
    {t:"5. Post-rank & serving",d:"Business rules are applied after the ML model: inject sponsored products, enforce diversity (not 10 headphones from the same brand), freshness boost for new listings, location-based filtering.",x:"The final ranked list (top 10–40 items) is returned to the frontend. Every impression, click, and purchase is logged — feeding the next training cycle. The loop closes."},
  ];
  const [pStep,setPStep]=useState(0);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <STitle sub="A complete, beginner-friendly introduction to Learning to Rank for e-commerce search" badge={{color:C.acc,text:"Foundation"}}>What is Learning to Rank?</STitle>
      <SubNav items={SUBS} active={sub} onChange={setSub} />

      {sub==="why"&&<>
        <Insight type="tip" title="Start here — the business case">
          Imagine your e-commerce site has 50,000 products. A customer sees only the first 10. <strong style={{color:C.t1}}>Position 1 gets ~28% of all clicks; position 10 gets ~2.5%.</strong> If you rank the wrong product first, you lose revenue AND the customer gets a bad experience. A 1% improvement in NDCG can mean millions of dollars in additional revenue at scale.
        </Insight>
        <Grid2>
          {[{t:"Traditional heuristic ranking",c:C.err,points:["Sort by popularity globally","Sort by price (low→high)","Sort by rating stars","Ignore query context","One-size-fits-all rule"],icon:"❌"},
            {t:"Learning to Rank (ML)",c:C.ok,points:["Learns from actual clicks & purchases","Personalises to query intent","Balances relevance + conversion + margin","Updates as behaviour changes","Optimises measurable IR metrics"],icon:"✅"},
          ].map(x=><Card key={x.t} style={{borderColor:x.c+"33"}}>
            <div style={{fontSize:13,fontWeight:700,color:x.c,marginBottom:8}}>{x.icon} {x.t}</div>
            {x.points.map((p,i)=><div key={i} style={{fontSize:12,color:C.t2,lineHeight:1.6,paddingLeft:10,borderLeft:`2px solid ${x.c}33`}}>{p}</div>)}
          </Card>)}
        </Grid2>
        <Card>
          <div style={{fontSize:11,color:C.t3,textTransform:"uppercase",letterSpacing:.8,marginBottom:10}}>The mathematics of ordering</div>
          <div style={{fontSize:12.5,color:C.t2,lineHeight:1.8}}>
            Given a query <Mono color={C.acc}>q</Mono> and a set of <Mono color={C.acc}>n</Mono> candidate documents/products <Mono color={C.acc}>D = {"{"} d₁, d₂, …, dₙ {"}"}</Mono>, we want to learn a scoring function:<br/><br/>
            <code style={{background:C.bg1,padding:"8px 14px",borderRadius:6,display:"block",fontFamily:"monospace",fontSize:13,color:C.purple2,letterSpacing:.3}}>f(q, dᵢ) → sᵢ ∈ ℝ</code><br/>
            such that sorting by score produces an ordering that maximises a ranking quality metric (e.g. NDCG). The model <Mono color={C.acc}>f</Mono> is trained on <em>labelled</em> query-document pairs where labels represent relevance grades derived from user behaviour.
          </div>
        </Card>
        <Insight type="info" title="Why not just sort by predicted CTR?">
          Pointwise CTR prediction treats each product independently and then sorts. This ignores <strong style={{color:C.t1}}>inter-document relationships</strong> — whether product A should rank above product B depends on both, not just each in isolation. Pairwise and listwise methods model this directly. Also, CTR is biased by position (position 1 always gets more clicks), so naive CTR isn't a fair measure of relevance.
        </Insight>
      </>}

      {sub==="pipeline"&&<>
        <Insight type="tip" title="The two-stage architecture">
          Almost every real system uses two stages: <strong style={{color:C.t1}}>(1) retrieval</strong> for speed — fetch 200–1000 candidates fast; <strong style={{color:C.t1}}>(2) re-ranking</strong> for quality — score those candidates with your LTR model. The LTR model runs on a small set, so it can be as complex as you need.
        </Insight>
        <Card>
          <div style={{fontSize:11,color:C.t3,textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>Interactive pipeline — click each step</div>
          <div style={{background:C.bg1,borderRadius:8,padding:16,minHeight:110,marginBottom:10}}>
            <div style={{fontSize:14,fontWeight:700,color:C.acc,marginBottom:6}}>{PIPE[pStep].t}</div>
            <div style={{fontSize:13,color:C.t1,lineHeight:1.6,marginBottom:6}}>{PIPE[pStep].d}</div>
            <div style={{fontSize:11.5,color:C.t3,lineHeight:1.5,fontStyle:"italic"}}>{PIPE[pStep].x}</div>
          </div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {PIPE.map((_,i)=><button key={i} onClick={()=>setPStep(i)} style={{flex:1,padding:"8px 4px",borderRadius:6,border:`1px solid ${i===pStep?C.acc+"55":C.bd}`,background:i===pStep?C.acc+"12":"transparent",color:i===pStep?C.acc:C.t3,fontSize:10,fontWeight:600,cursor:"pointer",minWidth:60}}>Step {i+1}</button>)}
          </div>
        </Card>
        <Code title="Typical system architecture">
{`User query ──► [Query understanding]
                     │
                     ▼
              [BM25 + ANN retrieval]  ← 200–1000 candidates (< 10ms)
                     │
                     ▼
              [Feature extraction]    ← feature store lookup (< 5ms)
                     │
                     ▼
              [LTR model scoring]     ← LambdaMART / DNN (< 20ms)
                     │
                     ▼
              [Business rules]        ← diversity, ads, freshness
                     │
                     ▼
              [Top-K results]  ──► User sees 10–40 products
                     │
                     ▼
              [Engagement logging]    ← feeds next training cycle`}
        </Code>
      </>}

      {sub==="approaches"&&<>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[
            {n:"Pointwise",c:C.acc,icon:"◎",easy:"Score each product independently. Like giving each essay a grade without knowing the other essays.",math:"f(q,dᵢ) = ŷᵢ  →  predict relevance grade directly\nLoss = (yᵢ − ŷᵢ)²   or   BCE(yᵢ, σ(ŷᵢ))",pros:["Simple, fast","Good baseline","Interpretable"],cons:["Ignores relative order","MSE ≠ NDCG","Equal penalty at all ranks"],when:"Cold-start, ads CTR, baseline systems"},
            {n:"Pairwise",c:C.warn,icon:"⇄",easy:"For every pair of products, learn which one should rank higher. Like asking 'in a head-to-head match, which product wins?'",math:"P(dᵢ ≻ dⱼ) = σ(f(q,dᵢ) − f(q,dⱼ))\nLoss = −[y·log P(i≻j) + (1−y)·log P(j≻i)]",pros:["Models ordering directly","Better correlation with NDCG","Handles relative relevance"],cons:["O(n²) pairs per query","Treats all positions equally","Still not directly metric-aware"],when:"Product search re-ranking, recommendation ordering"},
            {n:"Listwise",c:C.purple,icon:"≡",easy:"Consider the whole page of results at once. Optimise the entire list, not just pairs.",math:"P(permutation π) ∝ ∏ᵢ exp(sᵢ) / Σⱼ₌ᵢ exp(sⱼ)\nListNet top-1: Loss = CE(softmax(y), softmax(s))",pros:["Global optimisation","Can directly target NDCG","Full-list awareness"],cons:["Permutation space is n!","Expensive to compute","Gradient surrogates needed"],when:"Category pages, full SERP optimisation, homepage feed"},
          ].map(a=><Card key={a.n} style={{borderColor:a.c+"33"}}>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              <div style={{flex:"0 0 120px"}}>
                <div style={{fontSize:22,marginBottom:4}}>{a.icon}</div>
                <div style={{fontSize:14,fontWeight:700,color:a.c,marginBottom:4}}>{a.n}</div>
                <Tag color={a.c}>in use</Tag>
              </div>
              <div style={{flex:1,minWidth:200}}>
                <div style={{fontSize:12.5,color:C.t2,lineHeight:1.6,marginBottom:8,fontStyle:"italic"}}>"{a.easy}"</div>
                <MathBox>{a.math}</MathBox>
                <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
                  <div style={{flex:1,minWidth:120}}>
                    <div style={{fontSize:10,color:C.ok,fontWeight:600,marginBottom:3}}>✓ Pros</div>
                    {a.pros.map((p,i)=><div key={i} style={{fontSize:11,color:C.t2,lineHeight:1.5}}>· {p}</div>)}
                  </div>
                  <div style={{flex:1,minWidth:120}}>
                    <div style={{fontSize:10,color:C.err,fontWeight:600,marginBottom:3}}>✗ Cons</div>
                    {a.cons.map((p,i)=><div key={i} style={{fontSize:11,color:C.t2,lineHeight:1.5}}>· {p}</div>)}
                  </div>
                </div>
                <div style={{marginTop:8,fontSize:11,color:C.t3}}><strong style={{color:C.warn}}>Use when:</strong> {a.when}</div>
              </div>
            </div>
          </Card>)}
        </div>
        <Card>
          <div style={{fontSize:11,color:C.t3,textTransform:"uppercase",marginBottom:8}}>Algorithm evolution</div>
          <div style={{display:"flex",alignItems:"center",gap:0,flexWrap:"wrap",justifyContent:"center"}}>
            {[{n:"Pointwise\n(CTR pred)",c:C.acc,y:"2000s"},{n:"RankNet\n(pairwise NN)",c:C.warn,y:"2005"},{n:"LambdaRank\n(+ΔNDCG)",c:C.err,y:"2006"},{n:"LambdaMART\n(+GBDT)",c:C.ok,y:"2010"}].map((m,i)=><div key={i} style={{display:"flex",alignItems:"center"}}>
              <div style={{padding:"8px 10px",borderRadius:6,background:m.c+"12",border:`1px solid ${m.c}33`,textAlign:"center",minWidth:75}}>
                <div style={{fontSize:11,color:m.c,fontWeight:700,whiteSpace:"pre-line",lineHeight:1.4}}>{m.n}</div>
                <div style={{fontSize:9,color:C.t4,marginTop:2}}>{m.y}</div>
              </div>
              {i<3&&<div style={{padding:"0 4px",color:C.t4,fontSize:14}}>→</div>}
            </div>)}
          </div>
        </Card>
      </>}

      {sub==="data"&&<>
        <Insight type="tip" title="The fundamental challenge: implicit feedback">
          Unlike supervised ML tasks where labels come from humans, LTR in e-commerce uses <strong style={{color:C.t1}}>implicit feedback</strong> — you infer relevance from behaviour. A click means "maybe relevant". A purchase means "very relevant". No click means "probably not relevant" (but could be position bias). This is noisier than human labels but scales to millions of queries.
        </Insight>
        <Card>
          <div style={{fontSize:11,color:C.t3,textTransform:"uppercase",marginBottom:10}}>Relevance label construction from engagement</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {[{ev:"Purchase",rel:3,color:C.err,rate:"~1-3% of impressions",why:"Highest signal — customer paid money. Nearly certain relevance."},
              {ev:"Add to cart",rel:2,color:C.warn,rate:"~3-8% of impressions",why:"Strong intent. Customer found it relevant enough to consider buying."},
              {ev:"Click (long dwell)",rel:2,color:C.warn,rate:"~8-15% of impressions",why:"Dwell time > 30s suggests genuine interest, not accidental click."},
              {ev:"Click (short dwell)",rel:1,color:C.ok,rate:"~5-10% of impressions",why:"Some relevance but product may not fully match need. Borderline signal."},
              {ev:"Impression only (no click)",rel:0,color:C.t3,rate:"~75-85%",why:"Lowest signal. Could be irrelevant OR position bias (too far down). Handle carefully."},
            ].map(x=><div key={x.ev} style={{display:"grid",gridTemplateColumns:"130px 50px 100px 1fr",gap:8,alignItems:"center",padding:"6px 8px",background:C.bg1,borderRadius:5}}>
              <span style={{fontSize:12,color:C.t1,fontWeight:600}}>{x.ev}</span>
              <Tag color={x.color}>rel={x.rel}</Tag>
              <span style={{fontSize:10,color:C.t3}}>{x.rate}</span>
              <span style={{fontSize:11,color:C.t2,lineHeight:1.4}}>{x.why}</span>
            </div>)}
          </div>
        </Card>
        <Grid2>
          <Insight type="warning" title="Survivorship bias">
            Products never shown to users have no click data. Your model will never learn about them unless you include <strong style={{color:C.t1}}>exploration traffic</strong> (randomly injecting unseen products to collect data). Pure exploitation leads to the rich-get-richer problem.
          </Insight>
          <Insight type="info" title="Train/val/test split — NEVER use random split">
            Always split by <strong style={{color:C.t1}}>time</strong>: train on older data, validate on recent, test on newest. Random splits leak future into the past and inflate metrics. Use the last 1–2 weeks as test set.
          </Insight>
        </Grid2>
        <Card>
          <div style={{fontSize:11,color:C.t3,textTransform:"uppercase",marginBottom:8}}>Explicit vs. implicit labels</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,fontSize:12,color:C.t2,lineHeight:1.6}}>
            <InnerCard><div style={{fontWeight:700,color:C.acc,marginBottom:4}}>Explicit (human judgements)</div>
              Human raters label (query, product) pairs 0–4. Used in public datasets (MSLR-WEB30K, Yahoo C14). High quality but expensive and slow. Good for research, impractical for every e-commerce category.</InnerCard>
            <InnerCard><div style={{fontWeight:700,color:C.warn,marginBottom:4}}>Implicit (from logs)</div>
              Derived from clicks, purchases, dwell time. Free and abundant. Noisy and biased. Requires debiasing (IPW). Used in production systems. The click logs from a single day at Amazon dwarf all public LTR datasets combined.</InnerCard>
          </div>
        </Card>
      </>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TAB 2 — FEATURE ENGINEERING
═══════════════════════════════════════════════════════════════════════ */
function T2() {
  const [sub,setSub]=useState("logs");
  const [sel,setSel]=useState(0);
  const [propensity,setPropensity]=useState([1.0,0.68,0.49,0.37,0.28,0.21,0.16,0.12,0.09,0.07]);
  const SUBS=[{key:"logs",icon:"📋",label:"Raw logs"},{key:"features",icon:"⚗️",label:"Compute features"},{key:"bias",icon:"⚠️",label:"Position bias"},{key:"tips",icon:"🛠",label:"Eng. tips"}];
  const p=PRODUCTS[sel];

  // Compute corrected CTR with IPW
  const rawCTR=PRODUCTS.map((pr,i)=>pr.raw.clicks/pr.raw.impressions);
  // Simulate position exposure: assume each product was shown at positions 1-10
  const avgPos=PRODUCTS.map((_,i)=>1+i*0.9); // simplified
  const correctedCTR=PRODUCTS.map((pr,i)=>{
    const prop=propensity[Math.min(Math.round(avgPos[i])-1,9)];
    return prop>0?(pr.raw.clicks/pr.raw.impressions)/prop:0;
  });

  const FEAT_FORMULAS=[
    {name:"CTR",formula:"clicks / impressions",note:"Bayesian-smooth with global prior to avoid zero-count noise",val:pr=>pr.raw.clicks/pr.raw.impressions},
    {name:"Add-to-cart rate",formula:"addToCart / clicks",note:"Conditional on click — filters position bias",val:pr=>pr.raw.addToCart/pr.raw.clicks},
    {name:"Conversion rate",formula:"purchases / impressions",note:"End-to-end funnel signal. Noisy but highest-quality relevance",val:pr=>pr.raw.purchases/pr.raw.impressions},
    {name:"Avg dwell time",formula:"mean(session_end − click_time)",note:"Long dwell ≈ engaged; bounce ≈ irrelevant. z-score normalise",val:pr=>pr.raw.dwellSec/60},
    {name:"Price score",formula:"1 − (price − min_price)/(max_price − min_price)",note:"Higher = more competitive in category. Normalised 0–1",val:pr=>1-clamp((pr.price-8)/(80-8),0,1)},
    {name:"Review score",formula:"(avg_rating × log(1 + count)) / max",note:"Wilson score or Bayesian credibility interval. Balances score vs. volume",val:pr=>pr.raw.reviews/5},
    {name:"Availability",formula:"1 − stockout_rate",note:"In-stock products only; out-of-stock always score 0",val:pr=>pr.f[6]},
  ];

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <STitle sub="Turning raw clickstream logs into ML-ready feature vectors" badge={{color:C.warn,text:"Practical"}}>Feature Engineering</STitle>
      <SubNav items={SUBS} active={sub} onChange={setSub} />

      {sub==="logs"&&<>
        <Insight type="tip" title="What does an engagement log row look like?">
          Every time a product is shown to a user and they interact (or don't), you log a row. Millions of these rows per day become your training data.
        </Insight>
        <Code title="Engagement log schema (one row = one impression)">
{`{
  "timestamp":       "2024-03-15T14:23:01Z",
  "session_id":      "sess_8f3a9c",
  "user_id":         "u_1234",           // hashed, anonymised
  "query":           "wireless headphones",
  "query_category":  "audio",
  "product_id":      "prod_4892",
  "position":        3,                  // ← which rank was shown
  "impression":      true,
  "clicked":         true,
  "dwell_time_sec":  47,
  "add_to_cart":     true,
  "purchased":       false,
  "price":           49.99,
  "device":          "mobile",
  "hour_of_day":     14,
  "user_segment":    "frequent_buyer"
}`}
        </Code>
        <Grid2>
          <Card>
            <div style={{fontSize:11,color:C.t3,textTransform:"uppercase",marginBottom:8}}>Event type → relevance label</div>
            {[["purchase → 3","Converted: unambiguous relevance"],["cart → 2","Strong intent signal"],["click + dwell > 30s → 2","Engaged click"],["click + bounce → 1","Weak relevance"],["impression only → 0","No engagement"],].map(([k,v])=><div key={k} style={{fontSize:11.5,color:C.t2,padding:"4px 0",borderBottom:`1px solid ${C.bg1}`}}><span style={{color:C.acc,fontWeight:600}}>{k}</span> — {v}</div>)}
          </Card>
          <Card>
            <div style={{fontSize:11,color:C.t3,textTransform:"uppercase",marginBottom:8}}>Scale perspective</div>
            {[["Amazon","~400M queries/day"],["Google Shopping","~1B queries/day"],["Mid-size e-commerce","~1–10M queries/day"],["Small store","100K–1M queries/day"],["Log size (1 day, mid)","~50–500 GB"],].map(([k,v])=><div key={k} style={{fontSize:11.5,color:C.t2,padding:"4px 0",borderBottom:`1px solid ${C.bg1}`}}><span style={{color:C.warn,fontWeight:600}}>{k}</span> — {v}</div>)}
          </Card>
        </Grid2>
      </>}

      {sub==="features"&&<>
        <div style={{display:"grid",gridTemplateColumns:"160px 1fr",gap:12}}>
          <Card style={{padding:"10px 12px"}}>
            <div style={{fontSize:10,color:C.t3,textTransform:"uppercase",marginBottom:8}}>Select product</div>
            {PRODUCTS.map((pr,i)=><button key={i} onClick={()=>setSel(i)} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 8px",borderRadius:5,border:i===sel?`1px solid ${C.acc}`:"1px solid transparent",background:i===sel?C.acc+"10":"transparent",cursor:"pointer",textAlign:"left",width:"100%",marginBottom:2}}>
              <span style={{fontSize:13}}>{pr.img}</span>
              <span style={{fontSize:11,color:i===sel?C.acc:C.t2,fontWeight:i===sel?600:400}}>{pr.name.split(" ").slice(0,2).join(" ")}</span>
            </button>)}
          </Card>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Card style={{padding:"12px 16px"}}>
              <div style={{fontSize:11,color:C.warn,textTransform:"uppercase",marginBottom:8}}>Raw engagement: {p.name}</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:8}}>
                {[["Impressions",p.raw.impressions,"Times shown"],["Clicks",p.raw.clicks,"Times clicked"],["Add-to-cart",p.raw.addToCart,"Cart events"],["Purchases",p.raw.purchases,"Conversions"],["Dwell (avg)",p.raw.dwellSec+"s","On product page"],["Bounce",`${(p.raw.bounce*100).toFixed(0)}%`,"Left immediately"],["Rating",p.raw.reviews+"/5","Avg review score"],["Reviews",p.raw.rCount,"Review count"]].map(([k,v,d])=><div key={k} style={{background:C.bg1,borderRadius:6,padding:"7px 10px"}}>
                  <div style={{fontSize:9.5,color:C.t4}}>{k}</div>
                  <div style={{fontSize:15,fontWeight:700,color:C.t1,fontFamily:"monospace"}}>{v}</div>
                  <div style={{fontSize:9,color:C.t4}}>{d}</div>
                </div>)}
              </div>
            </Card>
            <Card style={{padding:"12px 16px"}}>
              <div style={{fontSize:11,color:C.acc,textTransform:"uppercase",marginBottom:8}}>Computed feature vector</div>
              {FEAT_FORMULAS.map((ff,i)=><div key={ff.name} style={{marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
                  <span style={{fontSize:11,color:C.t1,width:130,flexShrink:0,fontWeight:600}}>{ff.name}</span>
                  <Bar value={ff.val(p)} max={1} color={C.acc} />
                  <span style={{fontSize:11,color:C.acc,fontFamily:"monospace",width:40,textAlign:"right"}}>{ff.val(p).toFixed(3)}</span>
                </div>
                <div style={{fontSize:10,color:C.t4,paddingLeft:138}}><Mono color={C.purple2}>{ff.formula}</Mono> — {ff.note}</div>
              </div>)}
            </Card>
          </div>
        </div>
        <Code title="Python: computing features from a Spark DataFrame">
{`from pyspark.sql import functions as F

features = (raw_logs
  .groupBy("query", "product_id")
  .agg(
    F.sum("clicked").alias("clicks"),
    F.sum("impression").alias("impressions"),
    F.sum("add_to_cart").alias("cart_events"),
    F.sum("purchased").alias("purchases"),
    F.mean("dwell_time_sec").alias("avg_dwell"),
  )
  .withColumn("ctr",         F.col("clicks") / F.col("impressions"))
  .withColumn("atc_rate",    F.col("cart_events") / F.col("clicks"))
  .withColumn("conv_rate",   F.col("purchases") / F.col("impressions"))
  # Bayesian smoothing: add prior counts to avoid 0/0
  .withColumn("smooth_ctr",
    (F.col("clicks") + 10) / (F.col("impressions") + 100))
)`}
        </Code>
      </>}

      {sub==="bias"&&<>
        <Insight type="warning" title="Position bias: the biggest problem in LTR training data">
          A product in <strong style={{color:C.t1}}>position 1 gets ~3× more clicks than position 5</strong> — regardless of relevance. If you train on raw CTR without correcting for this, your model will learn "position 1 products are good" rather than "these products are intrinsically relevant". The model then perpetuates the existing ranking.
        </Insight>
        <Card>
          <div style={{fontSize:11,color:C.t3,textTransform:"uppercase",marginBottom:8}}>Examination probability — adjust propensity slider</div>
          <div style={{marginBottom:12}}>
            <Slider label="Pos 1 propensity" min={50} max={100} value={propensity[0]*100} onChange={v=>{const p=[...propensity];p[0]=v/100;setPropensity(p)}} color={C.err} />
          </div>
          <div style={{display:"flex",gap:10}}>
            <div style={{flex:1}}>
              <div style={{fontSize:10,color:C.err,marginBottom:6}}>Raw CTR (biased — position confounds)</div>
              {PRODUCTS.map((pr,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <span style={{fontSize:11,color:C.t2,width:60,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis"}}>{pr.name.split(" ")[0]}</span>
                <Bar value={rawCTR[i]} max={0.15} color={C.err} />
                <span style={{fontSize:10,fontFamily:"monospace",color:C.err,width:40,textAlign:"right"}}>{(rawCTR[i]*100).toFixed(1)}%</span>
              </div>)}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:10,color:C.ok,marginBottom:6}}>IPW-corrected CTR (unbiased relevance signal)</div>
              {PRODUCTS.map((pr,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <span style={{fontSize:11,color:C.t2,width:60,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis"}}>{pr.name.split(" ")[0]}</span>
                <Bar value={correctedCTR[i]} max={0.25} color={C.ok} />
                <span style={{fontSize:10,fontFamily:"monospace",color:C.ok,width:40,textAlign:"right"}}>{(correctedCTR[i]*100).toFixed(1)}%</span>
              </div>)}
            </div>
          </div>
        </Card>
        <MathBox label="Inverse Propensity Weighting (IPW)">
{`Observed CTR at position k:  CTR_obs(k) = P(click|shown at k)
                             = P(examined|k) × P(relevant)   [examination hypothesis]
                             = θ(k) × r(d)

Debiased relevance estimate: r̂(d) = CTR_obs(k) / θ(k)

Training loss with IPW:      L = −Σ (1/θ(kᵢ)) × [yᵢ log ŷᵢ + (1−yᵢ) log(1−ŷᵢ)]

Estimate θ(k): randomise a small fraction of traffic, show products
at random positions → clicks at each position estimate propensity.`}
        </MathBox>
        <Insight type="info" title="Position as a feature (alternative approach)">
          Another technique: include <strong style={{color:C.t1}}>position as an input feature</strong> during training, and always set it to 0 (or position 1) at inference. The model learns to subtract out position effects. Simpler than IPW but assumes the effect is additive.
        </Insight>
      </>}

      {sub==="tips"&&<>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[
            {t:"Bayesian CTR smoothing",c:C.acc,d:'A product with 2 clicks / 10 impressions has CTR=20% — but this is unreliable. Add a "prior" of k clicks out of n impressions: smooth_CTR = (clicks + k) / (impressions + n). Typical values: k=5, n=50. This pulls low-count estimates toward the global average.',code:"smooth_ctr = (clicks + 5) / (impressions + 50)  # prior: 5/50 = 10%"},
            {t:"Feature normalisation",c:C.warn,d:"LambdaMART (tree-based) doesn't need normalisation — trees split on thresholds. Neural LTR models DO need it. Use z-score normalisation per feature per query, or min-max scaling globally. Never use global z-score for CTR — it varies wildly across queries.",code:"# For neural models only:\nX_norm = (X - X.mean(axis=0)) / (X.std(axis=0) + 1e-8)"},
            {t:"Log-transform skewed features",c:C.ok,d:"Review count, impression count, and revenue features are highly right-skewed (a few products have millions of reviews, most have tens). Apply log(1+x) to compress the distribution. This helps tree-based and neural models find better splits.",code:"df['log_review_count'] = np.log1p(df['review_count'])\ndf['log_impressions']  = np.log1p(df['impressions'])"},
            {t:"Feature interaction terms",c:C.purple,d:"Sometimes explicit interactions help: price_score × review_score captures 'cheap AND well-reviewed'. CTR × conversion_rate captures 'people who click also buy'. Trees find these automatically; linear models need them specified.",code:"df['price_x_review'] = df['price_score'] * df['review_score']\ndf['engagement_score'] = df['ctr'] * df['conv_rate']"},
            {t:"Freshness features",c:C.err,d:"New products have no engagement data — this is the cold-start problem. Add features like days_since_listing, is_new_product, and category_average_ctr as a fallback. Optionally, use a separate 'new product' model that relies only on catalogue features.",code:"df['days_since_listing'] = (today - df['listing_date']).dt.days\ndf['log_age'] = np.log1p(df['days_since_listing'])"},
          ].map(tip=><Card key={tip.t} style={{borderColor:tip.c+"33"}}>
            <div style={{fontSize:13,fontWeight:700,color:tip.c,marginBottom:6}}>{tip.t}</div>
            <div style={{fontSize:12,color:C.t2,lineHeight:1.65,marginBottom:6}}>{tip.d}</div>
            <Code>{tip.code}</Code>
          </Card>)}
        </div>
      </>}
    </div>
  );
}
/* ═══════════════════════════════════════════════════════════════════════
   TAB 3 — EVALUATION METRICS
═══════════════════════════════════════════════════════════════════════ */
function T3() {
  const [sub,setSub]=useState("dcg");
  const [order,setOrder]=useState([4,0,1,7,5,2,6,3]);
  const SUBS=[{key:"dcg",icon:"📈",label:"DCG & NDCG"},{key:"mrr",icon:"🎯",label:"MRR & MAP"},{key:"why",icon:"🤔",label:"Why not accuracy?"},{key:"choose",icon:"🔍",label:"Which metric?"}];
  const O=order.map(i=>PRODUCTS[i]);
  const rels=O.map(d=>d.rel);
  const cont=rels.map((r,i)=>(Math.pow(2,r)-1)/Math.log2(i+2));
  const idealRels=[...rels].sort((a,b)=>b-a);
  const swap=(i,j)=>{const n=[...order];[n[i],n[j]]=[n[j],n[i]];setOrder(n)};

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <STitle sub="DCG, NDCG, MRR, MAP — the metrics that every LTR algorithm optimises" badge={{color:C.purple,text:"Math"}}>Evaluation Metrics</STitle>
      <SubNav items={SUBS} active={sub} onChange={setSub} />

      {sub==="dcg"&&<>
        <Insight type="tip" title="Intuition first">
          A perfect ranking puts the most relevant product first. <strong style={{color:C.t1}}>DCG rewards this</strong> with a position discount: the relevance gain at position i is divided by log₂(i+1). So getting a rel=3 product into position 1 is worth much more than having it at position 5.
        </Insight>
        <Steps color={C.purple} steps={[
          {title:"Step 1: Assign relevance grades",body:"Each product in the list gets a relevance grade based on engagement: 0=irrelevant, 1=marginally relevant, 2=relevant, 3=highly relevant. For a query like 'wireless audio', the Bluetooth Speaker gets 3, the USB-C Hub gets 2, the HDMI Cable gets 0.",math:"Relevance grades: y = [3, 2, 1, 0, 3, 2, 1, 2]  (for our 8 products)"},
          {title:"Step 2: Compute the gain at each position",body:"The gain (numerator) uses an exponential scale: 2^rel - 1. This strongly favours highly-relevant products: rel=0→0, rel=1→1, rel=2→3, rel=3→7. The exponential ensures that a highly-relevant product at rank 1 is worth much more than two marginally-relevant ones.",math:"Gain(relᵢ) = 2^relᵢ − 1\nrel=0: gain=0  |  rel=1: gain=1  |  rel=2: gain=3  |  rel=3: gain=7"},
          {title:"Step 3: Apply the position discount",body:"Divide each gain by log₂(i+1) where i is 1-indexed position. Position 1: log₂(2)=1.0 (no discount). Position 2: log₂(3)=1.58. Position 5: log₂(6)=2.58. The gain shrinks rapidly as position increases — ranking matters most at the top.",math:"Discount(i) = 1 / log₂(i + 1)\nPos 1: 1/1.00=1.000  |  Pos 3: 1/2.00=0.500  |  Pos 7: 1/3.00=0.333"},
          {title:"Step 4: Sum to get DCG",body:"DCG@K is the sum of discounted gains over the top K positions. Larger DCG = better ranking. But DCG is hard to interpret on its own because it depends on how many relevant products exist in the candidate set.",math:"DCG@K = Σᵢ₌₁ᴷ (2^relᵢ − 1) / log₂(i + 1)"},
          {title:"Step 5: Normalise to get NDCG",body:"NDCG normalises DCG by the ideal DCG (IDCG) — the DCG you'd get if all relevant products were ranked perfectly at the top. NDCG ∈ [0,1]. NDCG=1.0 is a perfect ranking. This lets you compare across queries with different numbers of relevant products.",math:"IDCG@K = DCG of ideal (sorted by relevance) ordering\nNDCG@K = DCG@K / IDCG@K  ∈  [0, 1]"},
        ]} />

        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <Stat label="DCG@8" value={dcg(rels).toFixed(3)} />
          <Stat label="IDCG@8" value={idcg(rels).toFixed(3)} color={C.t3} />
          <Stat label="NDCG@8" value={ndcg(rels).toFixed(3)} color={ndcg(rels)>.9?C.ok:ndcg(rels)>.7?C.warn:C.err} />
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Card>
            <div style={{fontSize:11,color:C.t3,textTransform:"uppercase",marginBottom:8}}>Reorder products (click arrows) → watch metrics change</div>
            {O.map((pr,i)=><div key={pr.id} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 6px",borderBottom:i<O.length-1?`1px solid ${C.bg1}`:"none"}}>
              <span style={{fontSize:10,color:C.t4,width:18}}>#{i+1}</span>
              <span style={{fontSize:13}}>{pr.img}</span>
              <span style={{flex:1,fontSize:11,color:C.t1}}>{pr.name}</span>
              <Tag color={REL_COLORS[pr.rel]}>{pr.rel}</Tag>
              <div style={{display:"flex",flexDirection:"column",gap:0}}>
                <button onClick={()=>i>0&&swap(i,i-1)} style={{fontSize:8,color:i>0?C.t3:C.bd,background:"none",border:"none",cursor:i>0?"pointer":"default",padding:"1px 3px"}}>▲</button>
                <button onClick={()=>i<order.length-1&&swap(i,i+1)} style={{fontSize:8,color:i<order.length-1?C.t3:C.bd,background:"none",border:"none",cursor:i<order.length-1?"pointer":"default",padding:"1px 3px"}}>▼</button>
              </div>
            </div>)}
            <button onClick={()=>setOrder([...PRODUCTS].sort((a,b)=>b.rel-a.rel).map(pr=>pr.id))} style={{marginTop:8,width:"100%",padding:"6px",borderRadius:5,border:`1px solid ${C.ok}33`,background:C.ok+"10",color:C.ok,fontSize:11,cursor:"pointer",fontWeight:600}}>Set ideal order (NDCG=1.0)</button>
          </Card>
          <Card>
            <div style={{fontSize:11,color:C.t3,textTransform:"uppercase",marginBottom:8}}>Per-position DCG contribution</div>
            {cont.map((c,i)=><div key={i} style={{marginBottom:5}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:2}}>
                <span style={{color:C.t3}}>Pos {i+1} [{O[i].img}] gain={(Math.pow(2,rels[i])-1).toFixed(0)}/log₂({i+2})={Math.log2(i+2).toFixed(2)}</span>
                <span style={{color:REL_COLORS[rels[i]],fontFamily:"monospace"}}>{c.toFixed(3)}</span>
              </div>
              <Bar value={c} max={7.5} color={REL_COLORS[rels[i]]} />
            </div>)}
          </Card>
        </div>
      </>}

      {sub==="mrr"&&<>
        <Grid2>
          <Card>
            <div style={{fontSize:13,fontWeight:700,color:C.warn,marginBottom:8}}>MRR — Mean Reciprocal Rank</div>
            <div style={{fontSize:12.5,color:C.t2,lineHeight:1.7,marginBottom:8}}>
              For each query, find the rank of the <em>first relevant result</em>. MRR = average of 1/rank across all queries. Perfect for <strong style={{color:C.t1}}>navigational queries</strong> — "where can I buy AirPods Pro?" — where users only care that the first result is what they want.
            </div>
            <MathBox>{"MRR = (1/|Q|) × Σ_q  1/rank_q\nwhere rank_q = position of first relevant doc for query q\n\nExample: ranks = [1, 3, 2]  →  MRR = (1 + 1/3 + 1/2) / 3 = 0.61"}</MathBox>
            <div style={{marginTop:8,fontSize:11,color:C.t3}}>
              Current ranking MRR: <strong style={{color:C.warn}}>{mrr(rels).toFixed(3)}</strong>
              (first relevant is at position {rels.findIndex(r=>r>=2)+1})
            </div>
          </Card>
          <Card>
            <div style={{fontSize:13,fontWeight:700,color:C.purple,marginBottom:8}}>MAP — Mean Average Precision</div>
            <div style={{fontSize:12.5,color:C.t2,lineHeight:1.7,marginBottom:8}}>
              Average Precision computes precision at every rank where a relevant product appears, then averages these. MAP averages AP across queries. Good when <strong style={{color:C.t1}}>multiple relevant products</strong> exist and you care about finding all of them.
            </div>
            <MathBox>{"AP = (1/R) × Σᵢ P@i × rel(i)\nwhere R = total relevant, P@i = precision at position i\n\nExample: rels=[3,0,2,1,3] → relevant at pos 1,3,5\nP@1=1.0, P@3=2/3, P@5=3/5  →  AP = (1+0.67+0.60)/3 = 0.76"}</MathBox>
            <div style={{marginTop:8,fontSize:11,color:C.t3}}>
              Current ranking MAP: <strong style={{color:C.purple}}>{mapK(rels).toFixed(3)}</strong>
            </div>
          </Card>
        </Grid2>
        <Insight type="info" title="When to use MRR vs MAP vs NDCG">
          <strong style={{color:C.t1}}>NDCG:</strong> When relevance is graded (0–3) and products vary in quality — most e-commerce search.<br/>
          <strong style={{color:C.warn}}>MRR:</strong> When users only care about the first relevant result — navigational queries, question-answering.<br/>
          <strong style={{color:C.purple}}>MAP:</strong> When binary relevance (relevant/not) and you want to reward finding all relevant items — document retrieval, patent search.
        </Insight>
      </>}

      {sub==="why"&&<>
        <Insight type="warning" title="Why standard classification metrics fail for ranking">
          If you treat LTR as binary classification (clicked/not), you optimise accuracy — the fraction of products correctly labeled. But accuracy treats position 1 and position 100 equally. A model that perfectly labels all products but ranks them in random order has 100% accuracy but terrible NDCG.
        </Insight>
        <Grid2>
          {[
            {m:"Accuracy",bad:"Treats all positions equally. Getting position 100 right is the same as position 1.",eg:"Model A: NDCG=0.3, Accuracy=90%  ← bad ranking, high accuracy",c:C.err},
            {m:"AUC-ROC",bad:"Measures overall discrimination, not position quality. Doesn't weight top of list.",eg:"Model B: NDCG=0.85, AUC=0.82  ← good ranking, lower AUC",c:C.err},
            {m:"MSE",bad:"Penalises score error, not rank error. Two models with same MSE can have very different NDCG.",eg:"Model C: NDCG=0.7, MSE=0.15  vs  Model D: NDCG=0.9, MSE=0.15",c:C.err},
            {m:"NDCG",bad:"None — this is what we actually care about. Weighted, position-aware, normalised.",eg:"Directly measures ranking quality. NDCG@10 = how good is your top-10 list?",c:C.ok},
          ].map(x=><Card key={x.m} style={{borderColor:x.c+"33"}}>
            <div style={{fontSize:13,fontWeight:700,color:x.c,marginBottom:6}}>{x.m}</div>
            <div style={{fontSize:12,color:C.t2,lineHeight:1.6,marginBottom:6}}>{x.bad}</div>
            <div style={{fontSize:11,color:C.t3,fontStyle:"italic"}}>{x.eg}</div>
          </Card>)}
        </Grid2>
        <Card>
          <div style={{fontSize:11,color:C.t3,textTransform:"uppercase",marginBottom:8}}>The Spearman correlation gap</div>
          <div style={{fontSize:12.5,color:C.t2,lineHeight:1.7}}>
            Research by Järvelin & Kekäläinen (2002) showed that <strong style={{color:C.t1}}>accuracy and AUC correlate poorly with NDCG</strong> at the individual query level. A model can have high AUC on test data yet produce terrible rankings for specific queries. Always evaluate with NDCG on a held-out query set, not just classification metrics.
          </div>
        </Card>
      </>}

      {sub==="choose"&&<>
        <Card>
          <div style={{fontSize:11,color:C.t3,textTransform:"uppercase",marginBottom:10}}>Metric selection guide for e-commerce</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {[
              {scenario:"Product search (general)",metric:"NDCG@10",why:"Graded relevance, top results matter most, multiple relevant products"},
              {scenario:"Navigational search ('buy Nike Air Max')",metric:"MRR@10",why:"User wants the one correct product, not a ranked list of options"},
              {scenario:"Category browse page",metric:"NDCG@20",why:"Users scroll further; both precision and recall at depth matter"},
              {scenario:"Ad ranking (sponsored products)",metric:"NDCG + Revenue",why:"Blend relevance with bid price; both matter for the business"},
              {scenario:"Recommendation carousel (6 slots)",metric:"NDCG@6",why:"Evaluate the specific number of visible slots, not beyond"},
              {scenario:"Research / paper benchmarking",metric:"NDCG@1, @5, @10",why:"Report multiple depths; MSLR-WEB30K convention"},
            ].map(x=><div key={x.scenario} style={{display:"grid",gridTemplateColumns:"180px 90px 1fr",gap:8,padding:"7px 10px",background:C.bg1,borderRadius:6}}>
              <span style={{fontSize:11.5,color:C.t1,fontWeight:600}}>{x.scenario}</span>
              <Tag color={C.purple}>{x.metric}</Tag>
              <span style={{fontSize:11,color:C.t2}}>{x.why}</span>
            </div>)}
          </div>
        </Card>
        <Insight type="advanced" title="Statistical significance testing for metrics">
          When comparing two models' NDCG on a test set, use a <strong style={{color:C.t1}}>paired t-test or Wilcoxon signed-rank test</strong> per query. A 0.5% NDCG improvement may or may not be statistically significant depending on variance across queries. Industry standard: report p-value {"<"} 0.05 with 95% CI from bootstrap resampling of queries. Never deploy a model without a statistically significant offline NDCG gain.
        </Insight>
      </>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TAB 4 — POINTWISE
═══════════════════════════════════════════════════════════════════════ */
function T4() {
  const [sub,setSub]=useState("concept");
  const [w,setW]=useState([3.5,4.0,5.0,0.03,0.8,0.5,1.0]);
  const [b,setB]=useState(-2.5);
  const [lr_gd,setLrGd]=useState(0.5);
  const [epoch,setEpoch]=useState(0);
  const [isTraining,setIsTraining]=useState(false);
  const timerRef=useRef(null);
  const SUBS=[{key:"concept",icon:"💡",label:"Concept"},{key:"model",icon:"📐",label:"Model & loss"},{key:"train",icon:"🏋️",label:"Training"},{key:"impl",icon:"🚀",label:"Implementation"}];

  const logits=PRODUCTS.map(p=>p.f.reduce((s,f,i)=>s+f*w[i],0)+b);
  const preds=logits.map(sigmoid);
  const labels=PRODUCTS.map(p=>p.rel>=2?1:0);
  const bce=labels.map((y,i)=>-(y*Math.log(preds[i]+1e-8)+(1-y)*Math.log(1-preds[i]+1e-8)));
  const avgL=bce.reduce((s,v)=>s+v,0)/bce.length;
  const po=[...PRODUCTS.map((p,i)=>({...p,sc:preds[i]}))].sort((a,b)=>b.sc-a.sc);
  const pN=ndcg(po.map(d=>d.rel));

  // Simulated training
  const epochLoss=useMemo(()=>{
    const lossHistory=[];
    let cw=[1,1,1,0.01,0.5,0.5,0.5],cb=-1;
    for(let e=0;e<30;e++){
      let l=0;
      PRODUCTS.forEach(p=>{
        const z=p.f.reduce((s,f,i)=>s+f*cw[i],0)+cb;
        const pred=sigmoid(z);
        const y=p.rel>=2?1:0;
        l+=-(y*Math.log(pred+1e-8)+(1-y)*Math.log(1-pred+1e-8));
        const err=pred-y;
        cw=cw.map((ww,i)=>ww-lr_gd*0.1*err*p.f[i]);
        cb-=lr_gd*0.1*err;
      });
      lossHistory.push(l/PRODUCTS.length);
    }
    return lossHistory;
  },[lr_gd]);

  useEffect(()=>{
    if(isTraining){
      timerRef.current=setInterval(()=>setEpoch(e=>{ if(e>=29){clearInterval(timerRef.current);setIsTraining(false);return 29;} return e+1; }),200);
    } else clearInterval(timerRef.current);
    return ()=>clearInterval(timerRef.current);
  },[isTraining]);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <STitle sub="Predict relevance for each document independently — the foundation of e-commerce CTR prediction" badge={{color:C.acc,text:"Beginner-friendly"}}>Pointwise Approach</STitle>
      <SubNav items={SUBS} active={sub} onChange={setSub} />

      {sub==="concept"&&<>
        <Insight type="tip" title="The central idea">
          Treat ranking as <strong style={{color:C.t1}}>regression or classification per document</strong>. For each (query, product) pair independently, predict a number. Then sort by that number. The model never sees other products in the list during training or inference.
        </Insight>
        <Steps color={C.acc} steps={[
          {title:"Understand the analogy",body:"Imagine grading essays in an exam. You grade each essay independently — you don't compare Essay A to Essay B while reading it. You just assign a score. Then essays are ranked by score. That's pointwise. The advantage: simple, scalable, parallelisable."},
          {title:"Apply to e-commerce",body:"For the query 'wireless headphones' and the product 'Bluetooth Speaker': extract features (CTR=0.13, dwell=55s, reviews=4.7...) and predict P(click). The Bluetooth Speaker should score higher than the HDMI Cable because its features indicate higher engagement for audio queries.",math:"f(q='wireless headphones', d='Bluetooth Speaker') → P(click) = 0.78\nf(q='wireless headphones', d='HDMI Cable')          → P(click) = 0.04"},
          {title:"The training problem",body:"Given historical logs of (query, product, clicked/not-clicked), train a binary classifier. The positive class = clicked (or purchased). The negative class = shown but not clicked. This is a standard supervised ML problem — any classifier works.",math:"Training data: {(xᵢ, yᵢ)}  where xᵢ = feature vector,  yᵢ ∈ {0, 1}\nObjective: minimise BCE loss over all (query, product) pairs"},
          {title:"The ranking step",body:"At inference: for a given query, compute P(click) for every candidate product. Sort in descending order. The product with the highest predicted click probability is shown first. Ranking = sorting by model output.",math:"rank(d) = position of d in sort(candidates, key=f(q,d), reverse=True)"},
          {title:"Why it sometimes fails",body:"Two products can have the same predicted CTR but one belongs at position 1 and the other at position 3. Pointwise doesn't know this — it just sees individual scores. It optimises prediction error, not ranking quality. This is the core limitation that pairwise and listwise methods solve.",math:"Problem: identical loss for orderings [3,2,1,0] and [1,0,2,3]\n        if predicted scores are close enough"},
        ]} />
      </>}

      {sub==="model"&&<>
        <Insight type="formula" title="Logistic regression as a pointwise LTR model">
          The simplest pointwise model: predict P(click) = σ(w·x + b) where x is the feature vector, w are learned weights, and σ is the sigmoid function. The weights tell you which features matter most for predicting clicks.
        </Insight>
        <MathBox label="Logistic regression forward pass">
{`x = [ctr, atc_rate, conv_rate, dwell, price_score, review_score, availability]
z = w₁·ctr + w₂·atc + w₃·conv + w₄·dwell + w₅·price + w₆·review + w₇·avail + b
P(click) = σ(z) = 1 / (1 + e⁻ᶻ)

Binary cross-entropy loss (per product):
L(y, ŷ) = −[y·log(ŷ) + (1−y)·log(1−ŷ)]

Gradient w.r.t. weights (used in gradient descent):
∂L/∂wᵢ = (ŷ − y) · xᵢ    ← simple! proportional to prediction error × feature`}
        </MathBox>
        <Card>
          <div style={{fontSize:11,color:C.t3,textTransform:"uppercase",marginBottom:10}}>Interactive weight adjustment</div>
          {FEAT_NAMES.map((fn,i)=><Slider key={fn} label={fn} min={-200} max={800} step={10} value={w[i]*100} onChange={v=>{const nw=[...w];nw[i]=v/100;setW(nw)}} color={C.acc} />)}
          <div style={{marginTop:6}}><Slider label="Bias (b)" min={-500} max={100} step={10} value={b*100} onChange={v=>setB(v/100)} color={C.t3} /></div>
        </Card>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <Stat label="Avg BCE loss" value={avgL.toFixed(4)} color={C.err} sub="lower = better fit" />
          <Stat label="Predicted NDCG" value={pN.toFixed(4)} color={pN>.9?C.ok:C.warn} sub="from sorted predictions" />
        </div>
        <Card>
          <div style={{fontSize:11,color:C.t3,textTransform:"uppercase",marginBottom:8}}>Per-product: P(click) vs true label</div>
          {PRODUCTS.map((p,i)=><div key={p.id} style={{display:"grid",gridTemplateColumns:"26px 100px 44px 1fr 48px 48px",gap:5,alignItems:"center",padding:"4px 0",borderBottom:`1px solid ${C.bg1}`}}>
            <span style={{fontSize:13}}>{p.img}</span>
            <span style={{fontSize:10.5,color:C.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
            <Tag color={labels[i]?C.ok:C.t3} sm>{labels[i]?"click":"skip"}</Tag>
            <Bar value={preds[i]} max={1} color={preds[i]>0.5===!!labels[i]?C.ok:C.err} />
            <span style={{fontSize:10,fontFamily:"monospace",color:C.acc,textAlign:"right"}}>{(preds[i]*100).toFixed(1)}%</span>
            <span style={{fontSize:10,fontFamily:"monospace",color:C.err,textAlign:"right"}}>L={bce[i].toFixed(3)}</span>
          </div>)}
        </Card>
      </>}

      {sub==="train"&&<>
        <Insight type="tip" title="Gradient descent — how weights are learned">
          We start with random weights and repeatedly compute the loss, then adjust weights in the direction that reduces the loss. Each adjustment is tiny (controlled by the learning rate). After many passes through the data (epochs), weights converge to values that minimise the loss.
        </Insight>
        <MathBox label="Stochastic gradient descent update rule">
{`For each training sample (x, y):
  1. Forward pass:  z = w·x + b,  ŷ = σ(z)
  2. Compute loss:  L = −[y·log(ŷ) + (1−y)·log(1−ŷ)]
  3. Compute grad:  ∂L/∂w = (ŷ − y) · x,   ∂L/∂b = (ŷ − y)
  4. Update:        w ← w − η · ∂L/∂w
                    b ← b − η · ∂L/∂b

η (eta) = learning rate. Too large → oscillates. Too small → slow.
Typical: η = 0.001 to 0.1 for logistic regression.`}
        </MathBox>
        <Card>
          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
            <Slider label="Learning rate η" min={10} max={200} value={lr_gd*100} onChange={v=>{ setLrGd(v/100);setEpoch(0);setIsTraining(false); }} color={C.ok} width={90} />
            <button onClick={()=>{setEpoch(0);setIsTraining(true)}} style={{padding:"7px 14px",borderRadius:6,background:C.ok,color:"#000",fontWeight:700,fontSize:11,border:"none",cursor:"pointer"}}>▶ Train</button>
            <button onClick={()=>{setIsTraining(false);setEpoch(0)}} style={{padding:"7px 14px",borderRadius:6,background:C.bg3,color:C.t2,fontWeight:700,fontSize:11,border:`1px solid ${C.bd}`,cursor:"pointer"}}>↺ Reset</button>
          </div>
          <div style={{fontSize:11,color:C.t3,marginBottom:6}}>Training loss across 30 epochs — epoch {epoch+1}/30</div>
          <div style={{display:"flex",alignItems:"flex-end",gap:2,height:80}}>
            {epochLoss.map((l,i)=><div key={i} style={{flex:1,background:i<=epoch?C.ok:C.bd,borderRadius:"2px 2px 0 0",height:`${(l/epochLoss[0])*76}px`,transition:"all .2s",opacity:i===epoch?1:0.7}} title={`Epoch ${i+1}: loss=${l.toFixed(4)}`} />)}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:C.t4,marginTop:2}}><span>Epoch 1: {epochLoss[0].toFixed(4)}</span><span>Epoch 30: {epochLoss[29].toFixed(4)}</span></div>
          {epoch===29&&<Insight type="tip">Training converged! Loss decreased by {((1-epochLoss[29]/epochLoss[0])*100).toFixed(1)}%. The model has learned which features predict clicks.</Insight>}
        </Card>
      </>}

      {sub==="impl"&&<>
        <Grid2>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Code title="LightGBM pointwise (XGBoost rank)">
{`import lightgbm as lgb

# Prepare data
X_train  # shape (n_samples, n_features)
y_train  # relevance labels 0-3

model = lgb.LGBMRegressor(
  objective='regression',   # or 'binary'
  n_estimators=500,
  learning_rate=0.05,
  max_depth=6,
  min_child_samples=20,
  subsample=0.8,
  colsample_bytree=0.8,
)
model.fit(X_train, y_train,
  eval_set=[(X_val, y_val)],
  callbacks=[lgb.early_stopping(50)]
)

# Rank by score
scores = model.predict(X_test)
ranked = sorted(zip(scores, products),
                reverse=True)`}
            </Code>
            <Code title="Scikit-learn logistic regression baseline">
{`from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

# Scale features (important for LR)
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X_train)

clf = LogisticRegression(C=1.0, max_iter=1000)
clf.fit(X_scaled, y_binary)  # y: clicked=1, not=0

# Feature importance: coefficients
for feat, coef in zip(feature_names, clf.coef_[0]):
    print(f"{feat:20s}: {coef:+.4f}")`}
            </Code>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <Card>
              <div style={{fontSize:12,fontWeight:700,color:C.acc,marginBottom:8}}>Production tips</div>
              {[["Use LightGBM, not LogReg","Trees handle non-linearity and mixed feature types natively. ~5x better NDCG than LR on most ranking tasks."],["Calibrate probabilities","After training, apply Platt scaling or isotonic regression so output scores are true probabilities."],["Online learning","Retrain daily/weekly with new engagement data. Use warm-starting to avoid retraining from scratch."],["Monitor score distribution","If score distribution shifts significantly (data drift), model needs retraining. Track mean and variance of model scores over time."],].map(([k,v])=><div key={k} style={{marginBottom:8,paddingBottom:8,borderBottom:`1px solid ${C.bd}`}}><div style={{fontSize:11.5,color:C.t1,fontWeight:600}}>{k}</div><div style={{fontSize:11,color:C.t2,lineHeight:1.5}}>{v}</div></div>)}
            </Card>
            <Insight type="advanced" title="Wide & Deep (Google, 2016)">
              The industry evolution: combine a wide linear model (for memorisation of feature crosses) with a deep neural network (for generalisation). <strong style={{color:C.t1}}>Wide:</strong> logistic regression on feature crosses. <strong style={{color:C.t1}}>Deep:</strong> embedding + dense layers. Both losses summed. This became the blueprint for modern CTR prediction in Google Play, later TikTok, Pinterest, etc.
            </Insight>
          </div>
        </Grid2>
      </>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TAB 5 — PAIRWISE / RANKNET
═══════════════════════════════════════════════════════════════════════ */
function T5() {
  const [sub,setSub]=useState("concept");
  const [dI,setDI]=useState(4);
  const [dJ,setDJ]=useState(3);
  const [sig,setSig]=useState(1);
  const SUBS=[{key:"concept",icon:"💡",label:"Concept"},{key:"ranknet",icon:"🧮",label:"RankNet math"},{key:"train",icon:"🔁",label:"Training"},{key:"practical",icon:"🛠",label:"Practical"}];

  const sc=i=>PRODUCTS[i].f.reduce((s,v)=>s+v*1.5,0);
  const si=sc(dI),sj=sc(dJ),diff=si-sj;
  const pij=sigmoid(sig*diff);
  const tl=PRODUCTS[dI].rel>PRODUCTS[dJ].rel?1:PRODUCTS[dI].rel<PRODUCTS[dJ].rel?0:0.5;
  const loss=-(tl*Math.log(pij+1e-8)+(1-tl)*Math.log(1-pij+1e-8));

  const pairs=useMemo(()=>{
    const r=[];
    for(let a=0;a<PRODUCTS.length;a++) for(let b=a+1;b<PRODUCTS.length;b++){
      if(PRODUCTS[a].rel===PRODUCTS[b].rel) continue;
      const hi=PRODUCTS[a].rel>PRODUCTS[b].rel?a:b, lo=PRODUCTS[a].rel>PRODUCTS[b].rel?b:a;
      const p=sigmoid(sig*(sc(hi)-sc(lo)));
      r.push({hi,lo,p,loss:-Math.log(p+1e-8),ok:p>0.5});
    }
    return r.sort((a,b)=>b.loss-a.loss);
  },[sig]);

  const acc=pairs.length>0?pairs.filter(p=>p.ok).length/pairs.length:0;

  // Sigmoid curve
  const W=380,H=155,pL=36,pR=8,pT=6,pB=22;
  const pW=W-pL-pR,pH=H-pT-pB;
  const tx=v=>pL+(v+5)/10*pW, ty=v=>pT+(1-v)*pH;
  const pts=[]; for(let x=-5;x<=5;x+=.15) pts.push({x,y:sigmoid(sig*x)});
  const pathD=pts.map((p,i)=>`${i===0?"M":"L"}${tx(p.x).toFixed(1)},${ty(p.y).toFixed(1)}`).join(" ");

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <STitle sub="Learn relative preferences between product pairs — RankNet and beyond" badge={{color:C.warn,text:"Intermediate"}}>Pairwise Approach / RankNet</STitle>
      <SubNav items={SUBS} active={sub} onChange={setSub} />

      {sub==="concept"&&<>
        <Insight type="tip" title="The key insight: ordering, not scoring">
          Instead of predicting absolute relevance, learn which product should rank higher in a head-to-head comparison. This directly models the ranking problem. Think of it like a sports tournament: we don't need to know each team's absolute strength, just who beats whom.
        </Insight>
        <Steps color={C.warn} steps={[
          {title:"The preference learning framing",body:"For every ordered pair of products (i, j) where product i is more relevant than j (yᵢ > yⱼ), we want the model to output score sᵢ > sⱼ. We don't care about the exact values of sᵢ and sⱼ, only their relative order.",math:"Pairwise preference: Pᵢⱼ = P(product i should rank above j)\nIf relᵢ > relⱼ, we want Pᵢⱼ → 1.0\nIf relᵢ < relⱼ, we want Pᵢⱼ → 0.0  (Pⱼᵢ → 1.0)"},
          {title:"How RankNet models this",body:"RankNet (Burges et al., 2005) uses a neural network to compute scores sᵢ = f(xᵢ) for each product. It then passes the score difference through a sigmoid to get the pairwise probability. This is differentiable — we can backpropagate!",math:"Pᵢⱼ = σ(sᵢ − sⱼ) = 1 / (1 + e^(−(sᵢ−sⱼ)))\nIf sᵢ >> sⱼ, then Pᵢⱼ ≈ 1.0 (model confident i ranks above j)\nIf sᵢ ≈ sⱼ,  then Pᵢⱼ ≈ 0.5 (model uncertain)"},
          {title:"The training objective",body:"For each pair where i should rank above j (labelled preference ȳᵢⱼ = 1), minimise the pairwise cross-entropy loss. The gradient tells the model: 'increase sᵢ relative to sⱼ when you're wrong about their ordering.'",math:"L(i,j) = −[ȳᵢⱼ·log Pᵢⱼ + (1−ȳᵢⱼ)·log(1−Pᵢⱼ)]\nGradient: ∂L/∂sᵢ = σ(sᵢ−sⱼ) − ȳᵢⱼ  =  Pᵢⱼ − ȳᵢⱼ"},
          {title:"The O(n²) problem and sampling",body:"With n products per query, there are n(n-1)/2 pairs. For n=1000 products, that's ~500,000 pairs per query. Training on all pairs is expensive. In practice: sample pairs (focus on harder pairs), or use LambdaRank which computes the same gradient without enumerating pairs explicitly.",math:"n=100 products: 4,950 pairs/query\nn=1000 products: 499,500 pairs/query  ← expensive!\nSolution: sample pairs, or compute net gradient directly (→ LambdaRank)"},
        ]} />
      </>}

      {sub==="ranknet"&&<>
        <MathBox label="RankNet: full mathematical derivation">
{`Network: score s = f(x; θ) — any differentiable model (NN, linear)

For pair (i, j) with yᵢ > yⱼ (product i more relevant):
  Preferred label: ȳᵢⱼ = 1

Pairwise probability:
  Pᵢⱼ = σ(sᵢ − sⱼ) = 1 / (1 + exp(−(sᵢ − sⱼ)))

Cross-entropy loss for this pair:
  Cᵢⱼ = −log Pᵢⱼ = log(1 + exp(sⱼ − sᵢ))   [when ȳᵢⱼ=1]

Gradient w.r.t. score sᵢ:
  ∂Cᵢⱼ/∂sᵢ = σ(sⱼ − sᵢ) = 1 − Pᵢⱼ   [i is "too low"]

Gradient w.r.t. score sⱼ:
  ∂Cᵢⱼ/∂sⱼ = σ(sᵢ − sⱼ) = Pᵢⱼ        [j is "too high"]

Net gradient for doc i across all pairs:
  ∂C/∂sᵢ = Σⱼ (∂Cᵢⱼ/∂sᵢ − ∂Cⱼᵢ/∂sᵢ)  [paired symmetry]

This gradient flows back through f(x; θ) via standard backpropagation.`}
        </MathBox>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Card style={{padding:"12px 14px"}}>
            <div style={{fontSize:10,color:C.acc,textTransform:"uppercase",marginBottom:8}}>Select product i (should rank higher)</div>
            {PRODUCTS.map((p,i)=><PRow key={p.id} p={p} sel={i===dI} onClick={()=>i!==dJ&&setDI(i)} />)}
          </Card>
          <Card style={{padding:"12px 14px"}}>
            <div style={{fontSize:10,color:C.warn,textTransform:"uppercase",marginBottom:8}}>Select product j (should rank lower)</div>
            {PRODUCTS.map((p,i)=><PRow key={p.id} p={p} sel={i===dJ} onClick={()=>i!==dI&&setDJ(i)} />)}
          </Card>
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <Stat label="sᵢ − sⱼ" value={diff.toFixed(3)} color={diff>0?C.ok:C.err} sub={diff>0?"model ranks i above j":"model ranks j above i (error!)"} />
          <Stat label="P(i ≻ j)" value={pij.toFixed(4)} color={C.warn} sub={`true label: ${tl.toFixed(1)}`} />
          <Stat label="Pair loss" value={loss.toFixed(4)} color={C.err} sub="CE loss for this pair" />
        </div>
        <Card style={{padding:"12px 20px"}}><Slider label="σ steepness" min={20} max={300} value={sig*100} onChange={v=>setSig(v/100)} color={C.warn} /></Card>
        <Card>
          <div style={{fontSize:11,color:C.t3,textTransform:"uppercase",marginBottom:6}}>Sigmoid: P(i ≻ j) = σ(σ_param × (sᵢ − sⱼ))</div>
          <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%"}}>
            <line x1={pL} y1={pT+pH} x2={pL+pW} y2={pT+pH} stroke={C.bd} strokeWidth=".5" />
            <line x1={pL} y1={pT} x2={pL} y2={pT+pH} stroke={C.bd} strokeWidth=".5" />
            <line x1={pL} y1={ty(.5)} x2={pL+pW} y2={ty(.5)} stroke={C.bd} strokeWidth=".5" strokeDasharray="3 3" />
            <line x1={tx(0)} y1={pT} x2={tx(0)} y2={pT+pH} stroke={C.bd} strokeWidth=".5" strokeDasharray="3 3" />
            {[-4,-2,0,2,4].map(v=><text key={v} x={tx(v)} y={H-2} textAnchor="middle" fill={C.t4} fontSize="8">{v}</text>)}
            {[0,.5,1].map(v=><text key={v} x={pL-4} y={ty(v)+3} textAnchor="end" fill={C.t4} fontSize="8">{v}</text>)}
            <path d={pathD} fill="none" stroke={C.warn} strokeWidth="2" />
            <circle cx={tx(clamp(diff,-4.8,4.8))} cy={ty(pij)} r="5" fill={C.err} stroke={C.bg2} strokeWidth="2" />
            <text x={tx(clamp(diff,-4.8,4.8))+8} y={ty(pij)-5} fill={C.err} fontSize="9" fontFamily="monospace">({diff.toFixed(1)},{pij.toFixed(2)})</text>
          </svg>
        </Card>
      </>}

      {sub==="train"&&<>
        <Card>
          <div style={{fontSize:11,color:C.t3,textTransform:"uppercase",marginBottom:8}}>All training pairs — sorted by loss (hardest first)</div>
          <div style={{marginBottom:8}}><Slider label="σ steepness" min={20} max={300} value={sig*100} onChange={v=>setSig(v/100)} color={C.warn} /></div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:10}}>
            <Stat label="Total pairs" value={pairs.length} color={C.t2} />
            <Stat label="Accuracy" value={`${(acc*100).toFixed(1)}%`} color={acc>.8?C.ok:C.warn} />
            <Stat label="Avg loss" value={(pairs.reduce((s,p)=>s+p.loss,0)/pairs.length||0).toFixed(3)} color={C.err} />
          </div>
          <div style={{maxHeight:200,overflowY:"auto"}}>
            {pairs.map((p,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"60px 14px 60px 1fr 56px 50px",gap:4,alignItems:"center",padding:"3px 0",borderBottom:`1px solid ${C.bg1}`,fontSize:10.5}}>
              <span style={{color:C.ok}}>{PRODUCTS[p.hi].img} {PRODUCTS[p.hi].name.split(" ")[0]}</span>
              <span style={{color:C.t4,textAlign:"center"}}>≻</span>
              <span style={{color:C.err}}>{PRODUCTS[p.lo].img} {PRODUCTS[p.lo].name.split(" ")[0]}</span>
              <Bar value={p.p} max={1} color={p.ok?C.ok:C.err} h={7} />
              <span style={{fontFamily:"monospace",color:p.ok?C.ok:C.err,textAlign:"right"}}>P={p.p.toFixed(2)}</span>
              <span style={{fontFamily:"monospace",color:C.err,textAlign:"right"}}>L={p.loss.toFixed(3)}</span>
            </div>)}
          </div>
        </Card>
        <Insight type="info" title="Focus on hard pairs">
          Pairs where the model is very confident (P ≈ 1.0 or 0.0) have near-zero gradient — the model doesn't learn from them. Focus training on <strong style={{color:C.t1}}>uncertain pairs</strong> (P ≈ 0.5) or pairs that are currently wrong (P {">"} 0.5 when they shouldn't be). This is why LambdaRank is more efficient — it automatically downweights easy pairs.
        </Insight>
      </>}

      {sub==="practical"&&<>
        <Code title="RankNet with PyTorch (minimal implementation)">
{`import torch, torch.nn as nn

class RankNet(nn.Module):
    def __init__(self, n_features):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(n_features, 64), nn.ReLU(), nn.Dropout(0.2),
            nn.Linear(64, 32),          nn.ReLU(),
            nn.Linear(32, 1)
        )
    def forward(self, x):
        return self.net(x).squeeze(-1)   # score per product

def ranknet_loss(scores_i, scores_j, labels):
    # labels: 1 if i>j, 0 if j>i, 0.5 if equal
    diff = scores_i - scores_j
    prob = torch.sigmoid(diff)
    return nn.functional.binary_cross_entropy(prob, labels)

# Training loop
model = RankNet(n_features=7)
opt   = torch.optim.Adam(model.parameters(), lr=1e-3)

for epoch in range(100):
    for xi, xj, y in pair_dataloader:   # batches of pairs
        si, sj = model(xi), model(xj)
        loss   = ranknet_loss(si, sj, y)
        opt.zero_grad(); loss.backward(); opt.step()`}
        </Code>
        <Grid2>
          <Insight type="warning" title="The n² scaling problem">
            For n=1000 candidates per query and 1M queries/day: n²/2 = 500K pairs × 1M queries = <strong style={{color:C.t1}}>500 billion gradient computations per day</strong>. This is why pure RankNet is rarely used in production. LambdaRank solves this by computing the net gradient directly without enumerating pairs.
          </Insight>
          <Insight type="advanced" title="Pair sampling strategies">
            <strong style={{color:C.t1}}>Uniform sampling:</strong> random pairs — simple, ignores difficulty.<br/>
            <strong style={{color:C.t1}}>Hard negative mining:</strong> focus on pairs where model is wrong — faster convergence.<br/>
            <strong style={{color:C.t1}}>Top-k sampling:</strong> only pairs in top-K positions — aligns with what users see.<br/>
            In practice: restrict pairs to a relevance-difference threshold to avoid wasting compute on nearly-equal items.
          </Insight>
        </Grid2>
      </>}
    </div>
  );
}
/* ═══════════════════════════════════════════════════════════════════════
   TAB 6 — LISTWISE / LISTNET
═══════════════════════════════════════════════════════════════════════ */
function T6() {
  const [sub,setSub]=useState("concept");
  const [scores,setScores]=useState(PRODUCTS.map(p=>p.f.reduce((s,v)=>s+v*1.5,0)));
  const SUBS=[{key:"concept",icon:"💡",label:"Concept"},{key:"math",icon:"∑",label:"ListNet math"},{key:"interact",icon:"🎛",label:"Interactive"},{key:"other",icon:"📚",label:"Other methods"}];
  const tS=PRODUCTS.map(p=>p.rel);
  const pp=softmax(scores), tp=softmax(tS);
  const ce=-tp.reduce((s,p,i)=>s+p*Math.log(pp[i]+1e-10),0);
  const kl=tp.reduce((s,p,i)=>s+(p>0?p*Math.log(p/(pp[i]+1e-10)):0),0);
  const po=[...PRODUCTS.map((p,i)=>({...p,sc:scores[i]}))].sort((a,b)=>b.sc-a.sc);
  const pN=ndcg(po.map(d=>d.rel));

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <STitle sub="Optimise the entire ranked list at once — ListNet, ListMLE, and beyond" badge={{color:C.purple,text:"Advanced"}}>Listwise Approach / ListNet</STitle>
      <SubNav items={SUBS} active={sub} onChange={setSub} />

      {sub==="concept"&&<>
        <Insight type="tip" title="Why consider the whole list?">
          Pointwise treats each product in isolation. Pairwise considers pairs. Listwise considers <strong style={{color:C.t1}}>the full permutation</strong> — the entire ordered list of products. This allows the model to make globally-optimal ranking decisions, not just locally-optimal ones.
        </Insight>
        <Steps color={C.purple} steps={[
          {title:"The permutation probability",body:"A 'listwise' approach defines a probability distribution over all possible orderings of n products. The ideal probability concentrates on permutations where relevant products are at the top. The problem: there are n! permutations. For n=10 products, that's 3,628,800 permutations — impossible to enumerate.",math:"P(permutation π) = ∏ᵢ exp(sπ(i)) / Σⱼ≥ᵢ exp(sπ(j))\nFor n=10: 10! = 3,628,800 permutations to consider"},
          {title:"ListNet's top-1 approximation",body:"ListNet approximates the full permutation probability using just the top-1 probability: the probability that each product is ranked first. This is simply the softmax of scores. It's tractable (O(n)) and differentiable.",math:"P_top1(dᵢ | s) = exp(sᵢ) / Σⱼ exp(sⱼ)   ← softmax\nP_top1(dᵢ | y) = exp(yᵢ) / Σⱼ exp(yⱼ)   ← from relevance labels"},
          {title:"The cross-entropy loss",body:"ListNet minimises the cross-entropy between the true top-1 distribution (from relevance labels) and the predicted top-1 distribution (from model scores). When these distributions match, the model is ranking optimally.",math:"L = −Σᵢ P_top1(dᵢ | y) · log P_top1(dᵢ | s)\n  = −Σᵢ tp_true(i) · log tp_pred(i)"},
          {title:"The gradient — elegant simplicity",body:"The gradient of ListNet's cross-entropy loss with respect to each product's score is beautifully simple: just the difference between predicted and true top-1 probabilities. Products with too-low scores get a positive gradient (push up); overscored products get a negative gradient.",math:"∂L/∂sᵢ = P_top1(dᵢ | s) − P_top1(dᵢ | y)\n       = pp(i) − tp(i)   ← predicted minus true distribution"},
          {title:"From gradient to ranking update",body:"After computing gradients, any optimiser (SGD, Adam) can update the model. For each batch of query-document lists, compute the softmax distributions, find the gradient per product, backpropagate. Repeat until convergence.",math:"Update rule: θ ← θ − η · Σ_q Σᵢ (∂L_q/∂sᵢ) · (∂sᵢ/∂θ)\n(η = learning rate, θ = all model parameters)"},
        ]} />
      </>}

      {sub==="math"&&<>
        <MathBox label="ListNet: complete derivation">
{`Given: products {d₁,...,dₙ}, relevance labels y = [y₁,...,yₙ]
       model scores                s = [s₁,...,sₙ]

Step 1: Convert to probability distributions via softmax
  true dist:  tp(i) = exp(yᵢ) / Σⱼ exp(yⱼ)
  pred dist:  pp(i) = exp(sᵢ) / Σⱼ exp(sⱼ)

Step 2: Cross-entropy loss
  L = −Σᵢ tp(i) · log(pp(i))
    = −Σᵢ tp(i) · [sᵢ − log(Σⱼ exp(sⱼ))]
    = log(Σⱼ exp(sⱼ)) − Σᵢ tp(i) · sᵢ

Step 3: Gradient (clean closed form)
  ∂L/∂sᵢ = pp(i) − tp(i)

Step 4: Interpretation
  If tp(i) > pp(i): product i is under-ranked → increase sᵢ
  If tp(i) < pp(i): product i is over-ranked  → decrease sᵢ

KL divergence (alternative loss):
  KL(tp || pp) = Σᵢ tp(i) · log(tp(i) / pp(i))
  Minimising KL ≡ minimising CE (same gradient w.r.t. s)`}
        </MathBox>
        <Insight type="info" title="Why softmax captures ranking?">
          The softmax acts like a "soft argmax" — for a well-ranked list, the most-relevant product gets score → ∞ relative to others, so its softmax value → 1.0. When scores are learned to match the relevance-based softmax, the ranking is optimal. The temperature of the softmax (implicit) controls how "sharp" the distribution is.
        </Insight>
        <Insight type="advanced" title="ListMLE — an alternative listwise method">
          ListMLE (Shi et al., 2010) maximises the <strong style={{color:C.t1}}>likelihood of the true permutation</strong> given scores. It uses the Plackett-Luce model: P(rank 1st|scores) × P(rank 2nd|remaining) × ... This is O(n) like ListNet and has better theoretical properties, but a harder loss landscape.
        </Insight>
      </>}

      {sub==="interact"&&<>
        <Insight type="tip">Adjust product scores. Watch the predicted top-1 distribution shift. Your goal: make the predicted (purple) distribution match the true (green) distribution to minimise cross-entropy.</Insight>
        <Card>
          <div style={{fontSize:11,color:C.t3,textTransform:"uppercase",marginBottom:8}}>Adjust predicted scores</div>
          {PRODUCTS.map((p,i)=><div key={p.id} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
            <span style={{fontSize:13,width:20}}>{p.img}</span>
            <span style={{fontSize:10,color:C.t2,width:45,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis"}}>{p.name.split(" ")[0]}</span>
            <input type="range" min={0} max={600} value={scores[i]*100} onChange={e=>{const ns=[...scores];ns[i]=e.target.value/100;setScores(ns)}} style={{flex:1,accentColor:C.purple}} />
            <span style={{fontSize:10,color:C.purple,fontFamily:"monospace",width:32,textAlign:"right"}}>{scores[i].toFixed(1)}</span>
          </div>)}
        </Card>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <Stat label="Cross-entropy" value={ce.toFixed(4)} color={C.err} sub="lower = better match" />
          <Stat label="KL divergence" value={kl.toFixed(4)} color={C.warn} />
          <Stat label="NDCG" value={pN.toFixed(4)} color={pN>.9?C.ok:C.warn} />
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Card>
            <div style={{fontSize:10,color:C.ok,textTransform:"uppercase",marginBottom:8}}>True top-1 probability (from relevance grades)</div>
            {PRODUCTS.map((p,i)=><div key={p.id} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
              <span style={{fontSize:12}}>{p.img}</span>
              <Bar value={tp[i]} max={Math.max(...tp)*1.1} color={C.ok} />
              <span style={{fontSize:10,fontFamily:"monospace",color:C.ok,width:36,textAlign:"right"}}>{(tp[i]*100).toFixed(1)}%</span>
            </div>)}
          </Card>
          <Card>
            <div style={{fontSize:10,color:C.purple,textTransform:"uppercase",marginBottom:8}}>Predicted top-1 probability (from model scores)</div>
            {PRODUCTS.map((p,i)=><div key={p.id} style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
              <span style={{fontSize:12}}>{p.img}</span>
              <Bar value={pp[i]} max={Math.max(...tp)*1.1} color={C.purple} />
              <span style={{fontSize:10,fontFamily:"monospace",color:C.purple,width:36,textAlign:"right"}}>{(pp[i]*100).toFixed(1)}%</span>
            </div>)}
          </Card>
        </div>
        <Card>
          <div style={{fontSize:11,color:C.t3,textTransform:"uppercase",marginBottom:8}}>Per-product gradient ∂L/∂sᵢ = pp(i) - tp(i)</div>
          {PRODUCTS.map((p,i)=>{
            const g=pp[i]-tp[i];
            return <div key={p.id} style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
              <span style={{fontSize:12,width:20}}>{p.img}</span>
              <span style={{fontSize:10,color:C.t2,width:50,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis"}}>{p.name.split(" ")[0]}</span>
              <div style={{flex:1,height:9,background:C.bg0,borderRadius:3,position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",left:"50%",top:0,width:1,height:"100%",background:C.bd2}} />
                <div style={{position:"absolute",...(g>=0?{left:"50%"}:{right:"50%"}),top:0,height:"100%",width:`${Math.abs(g)*50*8}%`,background:g>=0?C.err:C.ok,borderRadius:3,transition:"all .3s"}} />
              </div>
              <span style={{fontSize:10,fontFamily:"monospace",color:g>=0?C.err:C.ok,width:50,textAlign:"right"}}>{g>=0?"over +":""}{g.toFixed(3)}</span>
            </div>;
          })}
          <div style={{fontSize:10,color:C.t4,marginTop:6}}>Red ↑ = over-ranked (decrease score) · Green ↓ = under-ranked (increase score)</div>
        </Card>
      </>}

      {sub==="other"&&<>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[{n:"ListMLE",c:C.purple,y:"2010",d:"Maximises the likelihood of the observed permutation using the Plackett-Luce model. More principled than ListNet but has a more complex loss landscape. Better theoretical guarantees.",code:"L = −log P(true permutation) = −Σᵢ log[exp(sπ(i)) / Σⱼ≥ᵢ exp(sπ(j))]"},
            {n:"AdaRank",c:C.acc,y:"2007",d:"A boosting algorithm that directly optimises NDCG. At each round, trains a weak ranker on queries where the current ensemble performs worst. Strong empirically on information retrieval benchmarks.",code:"F_m(x) = F_{m-1}(x) + α_m · h_m(x)  [boosting]\nα_m selected to maximise IR metric directly"},
            {n:"SoftRank",c:C.warn,y:"2008",d:"Smoothly approximates the rank positions using a probability distribution over all permutations. Directly differentiable w.r.t. NDCG. Computationally expensive (O(n³) per query).",code:"P(rank(dᵢ) = k) = computed from pairwise probs\nNDCG̃ = Σᵢ Σₖ P(rank(dᵢ)=k) · gain(yᵢ) · discount(k)"},
            {n:"APPROXNDCG / NeuralNDCG",c:C.ok,y:"2018-2020",d:"Modern neural methods that use smooth (differentiable) approximations of NDCG directly as the loss. NeuralNDCG (Pobrotyn et al., 2021) achieves SOTA on several LTR benchmarks.",code:"NeuralNDCG: approximate sorted positions via soft-sort\nLoss = −NDCG̃(scores) = −Σᵢ gain(yᵢ)·approx_discount(sᵢ)"},
          ].map(m=><Card key={m.n} style={{borderColor:m.c+"33"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <div style={{fontSize:13,fontWeight:700,color:m.c}}>{m.n}</div>
              <Tag color={C.t4}>{m.y}</Tag>
            </div>
            <div style={{fontSize:12,color:C.t2,lineHeight:1.65,marginBottom:6}}>{m.d}</div>
            <Code>{m.code}</Code>
          </Card>)}
        </div>
      </>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TAB 7 — LAMBDARANK
═══════════════════════════════════════════════════════════════════════ */
function T7() {
  const [sub,setSub]=useState("insight");
  const [sel,setSel]=useState(null);
  const SUBS=[{key:"insight",icon:"⚡",label:"The insight"},{key:"math",icon:"∑",label:"Lambda math"},{key:"inspector",icon:"🔍",label:"Pair inspector"},{key:"why",label:"🎯",icon:"Why it works"}];
  const sorted=[...PRODUCTS].sort((a,b)=>{const sa=a.f.reduce((s,v)=>s+v*1.5,0);const sb=b.f.reduce((s,v)=>s+v*1.5,0);return sb-sa});
  const rels=sorted.map(d=>d.rel);
  const curN=ndcg(rels);
  const scores=sorted.map(p=>p.f.reduce((s,v)=>s+v*1.5,0));

  const lambdas=useMemo(()=>{
    const r=[];
    for(let i=0;i<sorted.length;i++) for(let j=i+1;j<sorted.length;j++){
      if(sorted[i].rel===sorted[j].rel) continue;
      const hi=sorted[i].rel>sorted[j].rel?i:j, lo=sorted[i].rel>sorted[j].rel?j:i;
      const sw=[...rels]; [sw[i],sw[j]]=[sw[j],sw[i]];
      const dN=Math.abs(ndcg(sw)-curN);
      const p=sigmoid(scores[hi]-scores[lo]);
      const rG=1-p;
      r.push({i,j,hi,lo,hD:sorted[hi],lD:sorted[lo],p,dN,rG,lam:rG*dN,swN:ndcg(sw)});
    }
    return r.sort((a,b)=>b.lam-a.lam);
  },[]);

  const maxL=Math.max(...lambdas.map(l=>l.lam),.001);
  const net=sorted.map(()=>0);
  lambdas.forEach(l=>{net[l.hi]+=l.lam; net[l.lo]-=l.lam});
  const maxN=Math.max(...net.map(Math.abs),.001);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <STitle sub="Virtual gradients weighted by ΔNDCG — no explicit loss function required" badge={{color:C.err,text:"Key breakthrough"}}>LambdaRank</STitle>
      <SubNav items={SUBS} active={sub} onChange={setSub} />

      {sub==="insight"&&<>
        <Insight type="tip" title="The core breakthrough (Burges et al., 2006)">
          NDCG is <strong style={{color:C.t1}}>not differentiable</strong> — it uses rank positions which are integer-valued step functions with zero gradient almost everywhere. So we can't just set Loss = −NDCG and compute ∂Loss/∂weights. LambdaRank's insight: <strong style={{color:C.t1}}>we don't need a loss function to define gradients</strong>. We can define the gradients directly based on what each swap would do to NDCG.
        </Insight>
        <Steps color={C.err} steps={[
          {title:"Why NDCG isn't differentiable",body:"NDCG depends on rank positions. If we change a product's score slightly, its rank doesn't change (until it crosses another product's score). So ∂NDCG/∂score = 0 almost everywhere, with undefined jumps at score crossings. Standard gradient descent can't work.",math:"NDCG = Σᵢ gain(relᵢ) / discount(rank(i))\nrank(i) = Σⱼ 1[sⱼ > sᵢ] + 1  ← not differentiable\n∂rank(i)/∂sᵢ = 0 almost everywhere"},
          {title:"The virtual gradient idea",body:"Instead of computing gradient FROM a loss, LambdaRank asks: 'For each pair (i,j) where i should rank above j, how much should we push their scores apart?' The answer: proportional to how much the swap would change NDCG. This is the 'lambda' gradient.",math:"For pair (i, j) where yᵢ > yⱼ:\nλᵢⱼ = RankNet_grad(i,j) × |ΔNDCG(i↔j)|\n     = (1 − P(i≻j)) × |NDCG_after_swap − NDCG_current|"},
          {title:"Why multiply by ΔNDCG?",body:"The ΔNDCG factor acts as an importance weight. A swap between two products at positions 1 and 2 changes NDCG more than a swap at positions 8 and 9. By weighting gradients by |ΔNDCG|, the model focuses its learning effort where it matters — the top of the ranking.",math:"Swap at positions 1↔2: ΔNDCG ≈ 0.30  ← large λ, strong gradient\nSwap at positions 8↔9: ΔNDCG ≈ 0.01  ← tiny λ, weak gradient"},
          {title:"Net gradient for each product",body:"Each product's net lambda is the sum of its lambdas over all pairs. Products that should move up in the ranking get positive net lambda (push score higher). Products that should move down get negative net lambda.",math:"Net_λᵢ = Σⱼ λᵢⱼ  (sum over all pairs involving product i)\nUpdate: sᵢ ← sᵢ + η · Net_λᵢ  [equivalent to gradient step]"},
          {title:"Theoretical justification",body:"Burges (2010) later proved that LambdaRank implicitly optimises a smooth upper bound on the NDCG loss. Specifically, if you sum all pairwise cross-entropy losses weighted by |ΔNDCG|, the gradient equals the LambdaRank gradient. So it IS optimising a loss — just not explicitly.",math:"LambdaRank gradient = ∂/∂sᵢ [Σⱼ |ΔNDCGᵢⱼ| · Cᵢⱼ]\nwhere Cᵢⱼ = pairwise cross-entropy loss for pair (i,j)"},
        ]} />
      </>}

      {sub==="math"&&<>
        <MathBox label="LambdaRank: full computation">
{`Given current ranking (products sorted by score):

For each pair (i, j) where i is ranked above j:
  s_diff = score(i) − score(j)
  P(i≻j) = σ(s_diff) = 1/(1 + e^(−s_diff))

  Swap positions i and j → compute ΔNDCG:
  NDCG_swapped = ndcg(swap(rels, i, j))
  ΔNDCG(i,j) = |NDCG_swapped − NDCG_current|

  RankNet gradient (how much to push apart):
  ranknet_grad = 1 − P(i≻j)   ← ∈ [0, 1]

  Lambda for this pair:
  λᵢⱼ = ranknet_grad × ΔNDCG(i,j)

Net lambda for product k:
  Λₖ = Σⱼ:yₖ>yⱼ λₖⱼ − Σⱼ:yₖ<yⱼ λₖⱼ

Update model scores:
  sₖ ← sₖ + η · Λₖ

Complexity: O(n²) per query (pair enumeration)
(Same as RankNet, but with better empirical performance)`}
        </MathBox>
        <Stat label="Current NDCG" value={curN.toFixed(4)} color={curN>.9?C.ok:C.warn} />
        <Card>
          <div style={{fontSize:11,color:C.t3,textTransform:"uppercase",marginBottom:8}}>Current ranking with net lambda forces</div>
          {sorted.map((p,pos)=><div key={p.id} style={{display:"grid",gridTemplateColumns:"22px 20px 1fr 58px 90px",gap:6,alignItems:"center",padding:"6px 8px",background:C.bg1,borderRadius:5,marginBottom:3}}>
            <span style={{fontSize:10,color:C.t4}}>#{pos+1}</span>
            <span style={{fontSize:13}}>{p.img}</span>
            <div><div style={{fontSize:11.5,color:C.t1,fontWeight:600}}>{p.name}</div><div style={{fontSize:9.5,color:C.t3}}>s={scores[pos].toFixed(2)}</div></div>
            <Tag color={REL_COLORS[p.rel]}>rel {p.rel}</Tag>
            <div style={{display:"flex",alignItems:"center",gap:3}}>
              <span style={{fontSize:11,color:net[pos]>=0?C.ok:C.err,fontWeight:700,width:10}}>{net[pos]>=0?"↑":"↓"}</span>
              <Bar value={Math.abs(net[pos])} max={maxN} color={net[pos]>=0?C.ok:C.err} h={8} />
              <span style={{fontSize:9,fontFamily:"monospace",color:net[pos]>=0?C.ok:C.err,width:38,textAlign:"right"}}>{net[pos].toFixed(4)}</span>
            </div>
          </div>)}
        </Card>
      </>}

      {sub==="inspector"&&<>
        <Card>
          <div style={{fontSize:11,color:C.t3,textTransform:"uppercase",marginBottom:8}}>Click any pair to see full decomposition</div>
          <div style={{maxHeight:220,overflowY:"auto"}}>
            {lambdas.map((l,idx)=><div key={idx} onClick={()=>setSel(sel===idx?null:idx)} style={{display:"grid",gridTemplateColumns:"50px 14px 50px 48px 1fr 54px",gap:4,alignItems:"center",padding:"5px 7px",borderRadius:5,cursor:"pointer",background:sel===idx?C.bg4:idx%2===0?C.bg1:"transparent",borderBottom:`1px solid ${C.bg1}`,fontSize:10.5,transition:"background .15s"}}>
              <span style={{color:C.ok,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{l.hD.img} {l.hD.name.split(" ")[0]}</span>
              <span style={{color:C.t4,textAlign:"center"}}>↔</span>
              <span style={{color:C.err,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{l.lD.img} {l.lD.name.split(" ")[0]}</span>
              <span style={{color:C.purple,fontFamily:"monospace"}}>ΔN={l.dN.toFixed(3)}</span>
              <Bar value={l.lam} max={maxL} color={l.dN>.03?C.err:C.warn} h={7} />
              <span style={{color:C.err,fontFamily:"monospace",textAlign:"right"}}>λ={l.lam.toFixed(4)}</span>
            </div>)}
          </div>
        </Card>
        {sel!==null&&lambdas[sel]&&<Card accent={C.err+"44"}>
          <div style={{fontSize:11,color:C.err,marginBottom:10,fontWeight:700}}>Decomposition: {lambdas[sel].hD.name} (pos #{lambdas[sel].hi+1}) ↔ {lambdas[sel].lD.name} (pos #{lambdas[sel].lo+1})</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:10,marginBottom:10}}>
            <div style={{background:C.bg1,borderRadius:6,padding:"8px 10px"}}>
              <div style={{fontSize:9.5,color:C.t4}}>P(hi≻lo)</div>
              <div style={{fontSize:16,fontFamily:"monospace",color:C.acc}}>{lambdas[sel].p.toFixed(4)}</div>
            </div>
            <div style={{background:C.bg1,borderRadius:6,padding:"8px 10px"}}>
              <div style={{fontSize:9.5,color:C.t4}}>RankNet grad (1−P)</div>
              <div style={{fontSize:16,fontFamily:"monospace",color:C.warn}}>{lambdas[sel].rG.toFixed(4)}</div>
            </div>
            <div style={{background:C.bg1,borderRadius:6,padding:"8px 10px"}}>
              <div style={{fontSize:9.5,color:C.t4}}>|ΔNDCG| on swap</div>
              <div style={{fontSize:16,fontFamily:"monospace",color:C.purple}}>{lambdas[sel].dN.toFixed(4)}</div>
            </div>
            <div style={{background:C.bg1,borderRadius:6,padding:"8px 10px"}}>
              <div style={{fontSize:9.5,color:C.t4}}>λ = grad × |ΔNDCG|</div>
              <div style={{fontSize:16,fontFamily:"monospace",color:C.err}}>{lambdas[sel].lam.toFixed(4)}</div>
            </div>
            <div style={{background:C.bg1,borderRadius:6,padding:"8px 10px"}}>
              <div style={{fontSize:9.5,color:C.t4}}>NDCG after swap</div>
              <div style={{fontSize:16,fontFamily:"monospace",color:lambdas[sel].swN>curN?C.ok:C.err}}>{lambdas[sel].swN.toFixed(4)}</div>
            </div>
          </div>
          <div style={{fontSize:12,color:C.t2,lineHeight:1.6}}>
            <strong style={{color:C.t1}}>Interpretation:</strong> The model currently ranks {lambdas[sel].hD.name} above {lambdas[sel].lD.name} with P(hi≻lo)={lambdas[sel].p.toFixed(2)} — {lambdas[sel].p>0.6?"confident but not certain. ":"quite uncertain. "}
            Swapping them would {lambdas[sel].swN>curN?"increase":"decrease"} NDCG by {lambdas[sel].dN.toFixed(4)}. 
            This produces a lambda of {lambdas[sel].lam.toFixed(4)} — a {lambdas[sel].lam>maxL*0.5?"strong":"weak"} gradient signal telling the model to push {lambdas[sel].hD.name}'s score higher relative to {lambdas[sel].lD.name}.
          </div>
        </Card>}
      </>}

      {sub==="why"&&<>
        <Insight type="advanced" title="Theoretical justification (Burges, 2010)">
          LambdaRank was initially proposed as a heuristic — "this gradient seems to work". Burges later proved that LambdaRank implicitly optimises a <strong style={{color:C.t1}}>smooth upper bound on 1−NDCG</strong>. The bound comes from summing RankNet losses weighted by |ΔNDCG|. So despite no explicit loss, there IS a loss being minimised — the model just doesn't compute it.
        </Insight>
        <Grid2>
          <Insight type="info" title="Why LambdaRank beats RankNet">
            In RankNet, every pair contributes equally to the gradient regardless of its NDCG impact. In LambdaRank, pairs that would improve NDCG the most get the strongest gradient signal. This focus makes training more efficient — fewer epochs needed, better final NDCG.
          </Insight>
          <Insight type="formula" title="Position discount magic">
            The position discount in NDCG (1/log₂(i+1)) means pairs involving <strong style={{color:C.t1}}>high-ranked positions have larger |ΔNDCG|</strong>. Swapping ranks 1↔2 changes NDCG more than swapping ranks 7↔8. LambdaRank automatically focuses learning on getting the top of the ranking right.
          </Insight>
        </Grid2>
        <Code title="Why NDCG isn't differentiable — illustrated">
{`# Example: changing score from 2.0 to 2.1 doesn't change rank
scores = [3.5, 2.0, 1.8, 0.9]  # ranked: A, B, C, D
scores = [3.5, 2.1, 1.8, 0.9]  # ranked: A, B, C, D  (same!)

# NDCG is constant across a range — zero gradient
# Only changes when a product "crosses" another in score

# LambdaRank approximates: "if this product's score changes,
# what WOULD the NDCG change be if ranks were re-sorted?"
# This is the |ΔNDCG| factor — a finite-difference approximation`}
        </Code>
      </>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TAB 8 — LAMBDAMART
═══════════════════════════════════════════════════════════════════════ */
function T8() {
  const [sub,setSub]=useState("gbdt");
  const [nT,setNT]=useState(1);
  const [lr,setLR]=useState(0.3);
  const [depth,setDepth]=useState(4);
  const SUBS=[{key:"gbdt",icon:"🌲",label:"GBDT primer"},{key:"algo",icon:"⚙️",label:"Algorithm"},{key:"train",icon:"📊",label:"Training sim"},{key:"code",icon:"💻",label:"Code & tips"}];

  const hist=useMemo(()=>{
    const docs=PRODUCTS.map(d=>({...d,pred:0}));
    const h=[];
    for(let t=0;t<8;t++){
      const srt=[...docs].sort((a,b)=>b.pred-a.pred);
      const rls=srt.map(d=>d.rel);
      const lam=docs.map(()=>0);
      for(let i=0;i<srt.length;i++) for(let j=i+1;j<srt.length;j++){
        if(srt[i].rel===srt[j].rel) continue;
        const hi=srt[i].rel>srt[j].rel?i:j, lo=srt[i].rel>srt[j].rel?j:i;
        const sw=[...rls]; [sw[i],sw[j]]=[sw[j],sw[i]];
        const dN=Math.abs(ndcg(sw)-ndcg(rls));
        const p=sigmoid(srt[hi].pred-srt[lo].pred);
        const hI=docs.findIndex(d=>d.id===srt[hi].id);
        const lI=docs.findIndex(d=>d.id===srt[lo].id);
        lam[hI]+=(1-p)*dN; lam[lI]-=(1-p)*dN;
      }
      docs.forEach((d,i)=>{d.pred+=lr*lam[i]});
      const po=[...docs].sort((a,b)=>b.pred-a.pred);
      h.push({tree:t+1,preds:docs.map(d=>d.pred),lams:[...lam],ndcg:ndcg(po.map(d=>d.rel)),order:po.map(d=>d.name)});
    }
    return h;
  },[lr]);

  const cur=hist[Math.min(nT-1,hist.length-1)];
  const maxP=Math.max(...hist[hist.length-1].preds.map(Math.abs),0.5);
  const maxLam=Math.max(...cur.lams.map(Math.abs),.001);

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <STitle sub="Lambda gradients + gradient-boosted decision trees = industry-standard LTR" badge={{color:C.ok,text:"Industry standard"}}>LambdaMART</STitle>
      <SubNav items={SUBS} active={sub} onChange={setSub} />

      {sub==="gbdt"&&<>
        <Insight type="tip" title="MART = Multiple Additive Regression Trees (= gradient boosting)">
          Gradient Boosting Decision Trees (GBDT) builds an ensemble of trees where each tree corrects the errors of all previous trees. It's the gradient descent algorithm applied to function space — instead of updating weights, we're adding trees.
        </Insight>
        <Steps color={C.ok} steps={[
          {title:"Decision trees: the building block",body:"A decision tree splits data based on feature thresholds. For ranking: 'If CTR > 0.10 AND review_score > 4.0, predict high relevance.' Trees naturally handle non-linear interactions and mixed feature types without any preprocessing.",math:"Tree leaf: region of feature space → constant prediction\nTree(x) = Σₗ cₗ · 1[x ∈ Rₗ]   (sum over leaves l)"},
          {title:"Gradient boosting: iterative correction",body:"We don't train one big tree. We train many small trees, each fitting the NEGATIVE gradient (residuals) of the loss from all previous trees. Adding 100 shallow trees is far better than one deep tree — it generalises better.",math:"F₀(x) = 0   (initialise predictions)\nFor m = 1, 2, ..., M:\n  1. Compute residuals: rᵢ = −∂L/∂F(xᵢ)  [negative gradient]\n  2. Fit tree hₘ to residuals {rᵢ}\n  3. Fₘ(x) = Fₘ₋₁(x) + η · hₘ(x)"},
          {title:"Why trees beat neural nets for tabular data",body:"Trees: handle categorical features natively, are invariant to feature scaling, robust to outliers, and implicitly perform feature selection. A single tree is interpretable. The ensemble is more accurate than neural nets on most tabular ranking tasks with <10K training queries.",math:"Key advantage: tree splits handle skewed distributions\nExample: CTR=0.001 vs CTR=0.01 → same split threshold\n(neural nets need log-transform; trees find split automatically)"},
          {title:"Feature importance from trees",body:"Tree-based models give feature importance for free: count how often each feature is used in splits, weighted by the NDCG gain from each split. This tells you which features the model relies on most — critical for debugging and feature engineering.",math:"Importance(fᵢ) = Σ_{splits on fᵢ} NDCG_gain_from_split\nHigh importance → the feature strongly predicts relevance"},
          {title:"Regularisation to prevent overfitting",body:"Key hyperparameters: max_depth (2–6, shallower = less overfit), min_child_samples (20–100, more = more regularised), subsample (0.5–0.8, subsample rows), colsample_bytree (0.5–1.0, subsample features). Always tune these on your validation NDCG, not training loss.",math:"Regularised objective: L + Ω(tree)\nΩ = γ·num_leaves + (λ/2)·Σ_leaves leaf_weight²\n(γ, λ penalise complex trees)"},
        ]} />
      </>}

      {sub==="algo"&&<>
        <MathBox label="LambdaMART: the complete algorithm">
{`INPUT:  Training queries Q, each with products D_q, 
        relevance labels y, feature matrix X
OUTPUT: Ensemble F = h₁ + h₂ + ... + hₘ (M trees)

INIT:   F₀(x) = 0 for all products

FOR m = 1 to M:
  FOR each query q in Q:
    1. COMPUTE LAMBDA GRADIENTS:
       a. Sort products by current score F_{m-1}(xᵢ)
       b. For each pair (i,j) with yᵢ ≠ yⱼ:
            ΔNDCG = |ndcg(swap(ranks, i, j)) − ndcg(current)|
            Pᵢⱼ   = σ(F(xᵢ) − F(xⱼ))
            λᵢⱼ   = (1 − Pᵢⱼ) · ΔNDCG
       c. Net gradient: Λᵢ = Σⱼ λᵢⱼ
       d. Net hessian:  Wᵢ = Σⱼ Pᵢⱼ(1−Pᵢⱼ)·ΔNDCG

  2. FIT REGRESSION TREE hₘ:
       Target: Λᵢ (gradient) for each product i
       Hessian-weighted split criterion:
         Gain = [Σ_L Λᵢ]² / Σ_L Wᵢ + [Σ_R Λᵢ]² / Σ_R Wᵢ
       Leaf values: cₗ = −(Σ_{i∈l} Λᵢ) / (Σ_{i∈l} Wᵢ + λ)

  3. UPDATE ENSEMBLE:
       F_m(x) = F_{m-1}(x) + η · hₘ(x)

RETURN: F_M = F₀ + η·h₁ + η·h₂ + ... + η·hₘ`}
        </MathBox>
        <Insight type="info" title="Newton's method, not just gradient descent">
          LambdaMART uses the <strong style={{color:C.t1}}>second derivative (Hessian)</strong> Wᵢ to compute leaf values. This is Newton's method in function space — faster convergence than using only first-order gradients. XGBoost made this explicit, dramatically improving convergence speed.
        </Insight>
      </>}

      {sub==="train"&&<>
        <Card style={{padding:"12px 20px"}}>
          <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:140}}><Slider label="Boosting rounds" min={1} max={8} value={nT} onChange={setNT} color={C.ok} /></div>
            <div style={{flex:1,minWidth:140}}><Slider label="Learning rate η" min={5} max={80} value={lr*100} onChange={v=>setLR(v/100)} color={C.ok} /></div>
          </div>
        </Card>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <Stat label="Trees" value={nT} color={C.ok} />
          <Stat label="NDCG" value={cur.ndcg.toFixed(4)} color={cur.ndcg>.95?C.ok:cur.ndcg>.8?C.warn:C.err} sub="ranking quality" />
          <Stat label="NDCG gain" value={`+${((cur.ndcg-hist[0].ndcg/hist[0].ndcg)*100).toFixed(1)}%`} color={C.ok} />
          <Stat label="Top product" value={cur.order[0].split(" ")[0]} color={C.acc} />
        </div>
        <Card>
          <div style={{fontSize:11,color:C.t3,textTransform:"uppercase",marginBottom:8}}>NDCG per boosting round</div>
          <div style={{display:"flex",alignItems:"flex-end",gap:4,height:90}}>
            {hist.map((h,i)=><div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              <span style={{fontSize:9,fontFamily:"monospace",color:i<nT?C.ok:C.t4}}>{h.ndcg.toFixed(2)}</span>
              <div style={{width:"100%",background:i<nT?C.ok:C.bd,borderRadius:"2px 2px 0 0",transition:"all .3s",height:`${h.ndcg*82}px`}} />
              <span style={{fontSize:9,color:C.t4}}>T{h.tree}</span>
            </div>)}
          </div>
        </Card>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Card><div style={{fontSize:10,color:C.acc,textTransform:"uppercase",marginBottom:8}}>Cumulative scores Fₘ(x) — {nT} trees</div>
            {PRODUCTS.map((p,i)=>{const v=cur.preds[i];return<div key={p.id} style={{display:"flex",alignItems:"center",gap:4,marginBottom:4}}>
              <span style={{fontSize:12}}>{p.img}</span>
              <span style={{fontSize:10,color:C.t2,width:44,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis"}}>{p.name.split(" ")[0]}</span>
              <div style={{flex:1,height:10,background:C.bg0,borderRadius:3,position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",left:"50%",top:0,width:1,height:"100%",background:C.bd2}} />
                <div style={{position:"absolute",...(v>=0?{left:"50%"}:{right:"50%"}),top:0,height:"100%",width:`${Math.abs(v)/maxP*50}%`,background:v>=0?C.ok:C.err,borderRadius:3,transition:"all .35s"}} />
              </div>
              <span style={{fontSize:9.5,fontFamily:"monospace",color:v>=0?C.ok:C.err,width:40,textAlign:"right"}}>{v.toFixed(3)}</span>
            </div>;})}
          </Card>
          <Card><div style={{fontSize:10,color:C.err,textTransform:"uppercase",marginBottom:8}}>Lambda gradients — tree {nT} targets</div>
            {PRODUCTS.map((p,i)=>{const v=cur.lams[i];return<div key={p.id} style={{display:"flex",alignItems:"center",gap:4,marginBottom:4}}>
              <span style={{fontSize:12}}>{p.img}</span>
              <span style={{fontSize:10,color:C.t2,width:44,flexShrink:0,overflow:"hidden",textOverflow:"ellipsis"}}>{p.name.split(" ")[0]}</span>
              <div style={{flex:1,height:10,background:C.bg0,borderRadius:3,position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",left:"50%",top:0,width:1,height:"100%",background:C.bd2}} />
                <div style={{position:"absolute",...(v>=0?{left:"50%"}:{right:"50%"}),top:0,height:"100%",width:`${Math.abs(v)/maxLam*50}%`,background:v>=0?C.ok:C.err,borderRadius:3,transition:"all .35s"}} />
              </div>
              <span style={{fontSize:9.5,fontFamily:"monospace",color:v>=0?C.ok:C.err,width:40,textAlign:"right"}}>{v>=0?"↑":"↓"}{Math.abs(v).toFixed(3)}</span>
            </div>;})}
            <div style={{fontSize:10,color:C.t4,marginTop:4}}>Tree {nT} fits to these gradients → corrects ranking errors</div>
          </Card>
        </div>
      </>}

      {sub==="code"&&<>
        <Grid2>
          <Code title="LightGBM (recommended — fastest)">
{`import lightgbm as lgb
import numpy as np

# Query groups: how many docs per query
# Must match order of X_train rows
group = [len(q_docs) for q in train_queries]

dtrain = lgb.Dataset(X_train, y_train, group=group)
dval   = lgb.Dataset(X_val,   y_val,   group=val_group)

params = {
  "objective":       "lambdarank",
  "metric":          "ndcg",
  "ndcg_eval_at":    [1, 5, 10],
  "learning_rate":   0.05,
  "num_leaves":      31,       # tree complexity
  "max_depth":       6,
  "min_child_samples": 20,
  "subsample":       0.8,
  "colsample_bytree": 0.8,
  "lambdarank_truncation_level": 20,  # only top-20 matter
}

model = lgb.train(
  params, dtrain, num_boost_round=500,
  valid_sets=[dval],
  callbacks=[lgb.early_stopping(50), lgb.log_evaluation(25)]
)

# Score new products
scores = model.predict(X_test)  # higher = more relevant`}
          </Code>
          <Code title="XGBoost alternative">
{`import xgboost as xgb

# XGBoost requires group info as DMatrix param
dtrain = xgb.DMatrix(X_train, y_train)
dtrain.set_group(train_group_sizes)

params = {
  "objective":     "rank:ndcg",
  "eval_metric":   "ndcg@10",
  "eta":           0.05,
  "max_depth":     6,
  "subsample":     0.8,
  "colsample_bytree": 0.8,
  "min_child_weight": 10,
  "gamma":         1.0,        # min split gain
}

model = xgb.train(
  params, dtrain, num_boost_round=500,
  evals=[(dval, "val")],
  early_stopping_rounds=50,
  verbose_eval=25
)

# Feature importance
imp = model.get_score(importance_type="gain")
for feat, score in sorted(imp.items(), key=lambda x: -x[1]):
    print(f"{feat:25s}: {score:.2f}")`}
          </Code>
        </Grid2>
        <Card>
          <div style={{fontSize:12,fontWeight:700,color:C.ok,marginBottom:10}}>Hyperparameter tuning guide</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead><tr style={{borderBottom:`1px solid ${C.bd}`}}>
                {["Parameter","Default","Recommended range","Effect"].map((h,i)=><th key={i} style={{padding:"5px 7px",color:C.t3,fontWeight:600,textAlign:"left",fontSize:10}}>{h}</th>)}
              </tr></thead>
              <tbody>{[
                ["num_boost_round","100","200–1000","More trees = more accurate (with early stopping)"],
                ["learning_rate","0.1","0.02–0.1","Lower = better generalisation, needs more trees"],
                ["num_leaves","31","15–127","Higher = more complex model, more overfit risk"],
                ["max_depth","−1","4–8","Limits tree depth; −1 = unlimited (use num_leaves instead)"],
                ["min_child_samples","20","10–100","Minimum samples in leaf; higher = more regularised"],
                ["subsample","1.0","0.6–0.9","Row sampling per tree; reduces overfit"],
                ["colsample_bytree","1.0","0.6–1.0","Feature sampling; helps with correlated features"],
                ["lambdarank_truncation","30","10–50","Only top-K positions affect gradients"],
              ].map((r,i)=><tr key={i} style={{borderBottom:`1px solid ${C.bg1}`}}>
                {r.map((c,j)=><td key={j} style={{padding:"5px 7px",color:j===0?C.acc:C.t2,fontSize:10.5,fontFamily:j===0?"monospace":"inherit"}}>{c}</td>)}
              </tr>)}</tbody>
            </table>
          </div>
        </Card>
      </>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TAB 9 — COMPARISON & BUILD GUIDE
═══════════════════════════════════════════════════════════════════════ */
function T9() {
  const [sub,setSub]=useState("compare");
  const SUBS=[{key:"compare",icon:"⚖️",label:"Comparison"},{key:"industry",icon:"🏭",label:"Industry"},{key:"build",icon:"🔧",label:"Build guide"},{key:"decide",icon:"🗺",label:"Decision guide"}];

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <STitle sub="When to use each method, real-world adoption, and a complete implementation roadmap">Comparison & Practical Guide</STitle>
      <SubNav items={SUBS} active={sub} onChange={setSub} />

      {sub==="compare"&&<>
        <Card>
          <div style={{fontSize:11,color:C.t3,textTransform:"uppercase",marginBottom:10}}>Head-to-head comparison across all methods</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:10.5}}>
              <thead><tr style={{borderBottom:`1px solid ${C.bd}`}}>
                {["Property","Pointwise","Pairwise\n(RankNet)","Listwise\n(ListNet)","Lambda-\nRank","Lambda-\nMART"].map((h,i)=><th key={i} style={{padding:"6px 6px",color:i===0?C.t3:[C.acc,C.warn,C.purple,C.err,C.ok][i-1]||C.t3,fontWeight:600,textAlign:i===0?"left":"center",fontSize:10,whiteSpace:"pre-line"}}>{h}</th>)}
              </tr></thead>
              <tbody>{[
                ["Training input","Single doc","Doc pair","Full list","Doc pair","Doc pair"],
                ["Loss function","BCE / MSE","Pairwise CE","KL divergence","No explicit loss","No explicit loss"],
                ["Optimises NDCG?","❌ Indirect","❌ Indirect","⚠️ Approx","✅ Directly","✅ Directly"],
                ["Typical model","Logistic / NN","Neural net","Neural net","Neural net","GBDT ensemble"],
                ["Training cost","O(n)","O(n²) pairs","O(n) / O(n!)","O(n²) pairs","O(n²·M trees)"],
                ["Feature handling","Any","Numeric","Numeric","Numeric","Mixed (native)"],
                ["Interpretable?","High","Low","Low","Low","Medium"],
                ["Cold start","Good (catalogue only)","Poor","Poor","Poor","Moderate"],
                ["NDCG on MSLR-WEB30K","~0.48","~0.51","~0.52","~0.54","~0.56+"],
                ["Production readiness","Simple baseline","Research / DL","Research","Research","Industry default"],
              ].map((row,ri)=><tr key={ri} style={{borderBottom:`1px solid ${C.bg1}`}}>
                {row.map((cell,ci)=><td key={ci} style={{padding:"5px 6px",color:ci===0?C.t3:C.t2,fontWeight:ci===0?600:400,textAlign:ci===0?"left":"center",fontSize:10.5}}>{cell}</td>)}
              </tr>)}</tbody>
            </table>
          </div>
        </Card>
        <Insight type="info" title="Public benchmark: MSLR-WEB30K dataset">
          Microsoft Learning to Rank dataset: 30K queries, 3.8M query-document pairs, 136 features, labels 0–4. NDCG@10 results (approximate, 2023): Pointwise LR ~0.39, XGBoost rank:pairwise ~0.48, LambdaMART ~0.52, deep LambdaMART (Neural LTR) ~0.56–0.58. For e-commerce with proprietary engagement features, LambdaMART typically achieves NDCG@10 of 0.65–0.85.
        </Insight>
      </>}

      {sub==="industry"&&<>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {[
            {co:"Amazon Product Search",c:C.warn,model:"LambdaMART + Deep Learning hybrid",feats:"300+ features: purchase history, reviews, fulfilment speed, seller rating, click-through, price, Prime eligibility",challenge:"Balance relevance with revenue (AMS — Amazon Marketing Services)",insight:"Multi-objective: blend organic relevance + sponsored product bids. A/B test every ranking change for 2+ weeks before full rollout."},
            {co:"Airbnb Search Ranking",c:C.acc,model:"LambdaMART (Gradient Boosting)",feats:"100+ features: host response rate, listing quality, price, availability, booking history, location score",challenge:"Two-sided marketplace: optimise for guest bookings AND host occupancy",insight:"Published a detailed blog post (2018) on their LTR system. Key: personalised features (user's historical preferences) dramatically improve NDCG."},
            {co:"LinkedIn Feed Ranking",c:C.purple,model:"GBM + Deep Learning (BERT for content)",feats:"Network graph features, posting time, engagement velocity, author authority, user interaction history",challenge:"Optimise dwell time, not just clicks (clicks can be clickbait)",insight:"Multi-stage: fast GBM for initial scoring, expensive BERT for top-K re-ranking. Time-decay is critical — yesterday's viral post outranks today's mediocre one."},
            {co:"Netflix Recommendations",c:C.err,model:"Two-stage: Matrix factorisation → LambdaMART/DNN",feats:"Viewing history, completion rate, rating, time of day, device, trending score",challenge:"Diverse recommendations to avoid filter bubbles; cold-start for new shows",insight:"Personalised rows (Trending Now, Because You Watched...) each have their own ranking model. The thumbnail A/B test (shown image for each title) runs separately from the ranking model."},
            {co:"Google Search",c:C.ok,model:"Evolved from LambdaMART to transformer-based (MUM/Gemini-era)",feats:"200+ signals including PageRank, BM25, user signals (PANDA/PENGUIN era), site quality, freshness",challenge:"Adversarial: SEO spammers actively try to game the ranking",insight:"Google now uses a combination of traditional LTR features AND large language model embeddings. The base algorithm is still LambdaMART-like but runs inside a multi-stage neural re-ranker."},
          ].map(item=><Card key={item.co} style={{borderColor:item.c+"33"}}>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              <div style={{width:140,flexShrink:0}}>
                <div style={{fontSize:12.5,fontWeight:700,color:item.c,marginBottom:4}}>{item.co}</div>
                <Tag color={item.c}>{item.model}</Tag>
              </div>
              <div style={{flex:1,minWidth:200,display:"flex",flexDirection:"column",gap:6}}>
                <div style={{fontSize:11,color:C.t2}}><strong style={{color:C.t3}}>Features:</strong> {item.feats}</div>
                <div style={{fontSize:11,color:C.t2}}><strong style={{color:C.warn}}>Challenge:</strong> {item.challenge}</div>
                <div style={{fontSize:11,color:C.t2}}><strong style={{color:C.ok}}>Key insight:</strong> {item.insight}</div>
              </div>
            </div>
          </Card>)}
        </div>
      </>}

      {sub==="build"&&<>
        <Insight type="tip" title="The complete roadmap: from zero to production LTR">
          This is the exact sequence used by most e-commerce teams building their first LTR system. Plan for 3–6 months for a solid first version, 12+ months for a mature system.
        </Insight>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[
            {s:"Phase 1: Baseline (Week 1–2)",c:C.acc,items:[
              {t:"Set up logging",d:"Log every search impression, click, cart, and purchase. Must include: query_id, product_id, position, user_id (hashed), timestamp, device. Use Kafka → S3 → Spark pipeline."},
              {t:"Compute baseline metrics",d:"Evaluate your current heuristic ranking (e.g., popularity sort) with NDCG@10, MRR. This is your baseline. All future models must beat this."},
              {t:"Build a simple pointwise model",d:"Feature engineer 10–20 basic features (CTR, reviews, price). Train XGBoost with logloss or rank:pairwise. This alone typically gives 5–15% NDCG improvement over heuristics."},
            ]},
            {s:"Phase 2: LambdaMART (Week 3–6)",c:C.warn,items:[
              {t:"Position debiasing",d:"Apply IPW to correct CTR for position bias. Estimate propensities via randomised traffic (show 5% of traffic at random positions, measure click rates). Or use position-as-feature trick."},
              {t:"Expand feature set",d:"Add query features (popularity, category), user features (segment, purchase history), interaction features (query-product historical CTR). Target 50–100 features."},
              {t:"Train LambdaMART",d:"Use LightGBM with lambdarank objective. Tune hyperparameters on validation NDCG. Use time-based split: train on weeks 1–8, validate on week 9, test on week 10."},
            ]},
            {s:"Phase 3: Offline evaluation (Week 7–8)",c:C.ok,items:[
              {t:"Per-query NDCG analysis",d:"Don't just look at average NDCG. Find queries where your model performs poorly (NDCG < 0.5). These are your failure modes — often cold-start products or rare queries."},
              {t:"Feature importance analysis",d:"Use LightGBM feature importance (gain-based). The top 10 features should be intuitive. If 'product_id' appears high up, you're overfitting to specific products — remove it."},
              {t:"Statistical significance test",d:"Run paired t-test on per-query NDCG between your model and baseline. Require p < 0.05 before proceeding to A/B test. With 1000+ test queries, this is usually achievable."},
            ]},
            {s:"Phase 4: Online A/B test (Week 9–12)",c:C.err,items:[
              {t:"Interleaved experiment",d:"Use Team Draft Interleaving (TDI): for each query, randomly interleave results from model A and B, then measure which model's products get clicked more. 10× more efficient than standard A/B."},
              {t:"Business metrics",d:"Track CTR, add-to-cart rate, revenue per search, conversion rate, and session bounce rate. NDCG improvement should correlate with these. If not, there's a metric-business alignment problem."},
              {t:"Rollout strategy",d:"Start with 1% traffic, check for degradation, then 5%, 10%, 50%, 100%. Monitor latency (LTR model adds 20–50ms), fallback to old system if p50 latency increases > 10%."},
            ]},
            {s:"Phase 5: Continuous improvement (Ongoing)",c:C.purple,items:[
              {t:"Model refresh cadence",d:"Retrain weekly or daily with fresh engagement data. Use warm-starting (initialise from previous model). Monitor data drift — if score distribution shifts, trigger retraining."},
              {t:"Feature evolution",d:"Add new signal types: real-time inventory (stock dropping = lower rank), reviews velocity (sudden review spike = boost), seasonal signals (headphones surge in holiday season)."},
              {t:"Deep learning upgrade",d:"When you have > 100K training queries and strong feature engineering, consider a two-tower neural network or transformer-based re-ranker. These beat LambdaMART when training data is abundant."},
            ]},
          ].map(phase=><Card key={phase.s} style={{borderColor:phase.c+"33"}}>
            <div style={{fontSize:12,fontWeight:700,color:phase.c,marginBottom:8}}>{phase.s}</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {phase.items.map(item=><div key={item.t} style={{background:C.bg1,borderRadius:6,padding:"8px 12px",borderLeft:`2px solid ${phase.c}44`}}>
                <div style={{fontSize:11.5,fontWeight:600,color:C.t1,marginBottom:2}}>{item.t}</div>
                <div style={{fontSize:11,color:C.t2,lineHeight:1.55}}>{item.d}</div>
              </div>)}
            </div>
          </Card>)}
        </div>
      </>}

      {sub==="decide"&&<>
        <Card>
          <div style={{fontSize:11,color:C.t3,textTransform:"uppercase",marginBottom:10}}>Decision guide: which method for your situation?</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {[
              {q:"Starting out, need something working fast?",a:"Pointwise XGBoost/LightGBM with logloss. 1 week to build. Beats heuristics by 10–15%.",c:C.acc},
              {q:"Have < 10K training queries?",a:"Pointwise or pairwise — listwise and LambdaMART need more data to shine. Consider feature engineering over model complexity.",c:C.acc},
              {q:"Care about relative ordering, not calibration?",a:"Switch from pointwise logloss to pairwise loss (rank:pairwise in XGBoost).",c:C.warn},
              {q:"Want to directly optimise NDCG with GBDT?",a:"LambdaMART — use LightGBM lambdarank or XGBoost rank:ndcg. This is the sweet spot for most e-commerce.",c:C.ok},
              {q:"Building a deep learning system?",a:"Start pointwise DNN → add pairwise loss → use LambdaRank gradients for final refinement.",c:C.purple},
              {q:"Have > 1M training queries and large team?",a:"Explore two-tower networks + LambdaRank re-ranker, or transformer-based models (BERT4Rec, etc.).",c:C.err},
              {q:"Need interpretability for business stakeholders?",a:"Pointwise LightGBM — can show feature importance and decision rules. Hardest models to explain are neural LTR.",c:C.acc},
              {q:"Have mixed data types (IDs, text, numerics)?",a:"LambdaMART handles this natively. Neural models need separate embedding towers for each modality.",c:C.ok},
            ].map((item,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"8px 10px",background:C.bg1,borderRadius:6,borderLeft:`3px solid ${item.c}`}}>
              <div style={{fontSize:11.5,color:C.t1,fontWeight:500}}>{item.q}</div>
              <div style={{fontSize:11.5,color:item.c}}>{item.a}</div>
            </div>)}
          </div>
        </Card>
        <Insight type="tip" title="The universal truth about production LTR">
          Almost every mature production system uses a <strong style={{color:C.t1}}>two-stage architecture</strong>: (1) a fast LambdaMART for initial re-ranking of 500–1000 candidates (runs in ~10ms), then (2) optionally a slower deep neural re-ranker for the top 50 (runs in ~50ms). The training data comes from engagement logs with position debiasing. This loops back: better model → more relevant results → more engagement → better training data → better model. The compounding effect is why investing in LTR pays dividends for years.
        </Insight>
        <Code title="The minimal production stack">
{`# Stage 1: Retrieval (Elasticsearch BM25 + dense retrieval)
candidates = retriever.search(query, top_k=500)

# Stage 2: Feature extraction from feature store
features = feature_store.batch_get(
    query_id=query_id,
    product_ids=[c.id for c in candidates]
)  # returns X: shape (500, n_features)

# Stage 3: LambdaMART scoring
scores = lgbm_model.predict(features)

# Stage 4: Sort and apply business rules
ranked = sorted(zip(scores, candidates), reverse=True)
ranked = apply_diversity(ranked, max_same_category=3)
ranked = inject_sponsored(ranked, ads_candidates)

return ranked[:20]  # return top 20 to frontend`}
        </Code>
      </>}
    </div>
  );
}
/* ════════════════════════════════════════════════════════════════════
   MAIN APP
════════════════════════════════════════════════════════════════════ */
const TABS=[
  {key:"overview",   label:"LTR overview",   color:C.acc},
  {key:"features",   label:"Feature eng.",   color:C.warn},
  {key:"metrics",    label:"Metrics",         color:C.purple},
  {key:"pointwise",  label:"Pointwise",       color:C.acc},
  {key:"pairwise",   label:"Pairwise / RankNet", color:C.warn},
  {key:"listwise",   label:"Listwise / ListNet",  color:C.purple},
  {key:"lambdarank", label:"LambdaRank",      color:C.err},
  {key:"lambdamart", label:"LambdaMART",      color:C.ok},
  {key:"compare",    label:"Comparison",      color:C.pink},
];

export default function App() {
  const [tab,setTab]=useState("overview");
  const scrollRef=useRef(null);
  useEffect(()=>{ scrollRef.current?.scrollTo(0,0); },[tab]);

  const COMPS={overview:T1,features:T2,metrics:T3,pointwise:T4,pairwise:T5,listwise:T6,lambdarank:T7,lambdamart:T8,compare:T9};
  const Comp=COMPS[tab]||T1;
  const activeColor=TABS.find(t=>t.key===tab)?.color||C.acc;

  return(
    <div style={{fontFamily:"'Segoe UI','Helvetica Neue',system-ui,sans-serif",color:C.t1,background:C.bg0,minHeight:"100vh"}}>
      {/* Header */}
      <div style={{borderBottom:`1px solid ${C.bd}`,padding:"13px 16px",background:C.bg1,position:"sticky",top:0,zIndex:10,backdropFilter:"blur(8px)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <div style={{width:8,height:8,borderRadius:2,background:activeColor,transition:"background .3s"}} />
            <h1 style={{fontSize:14,fontWeight:700,margin:0,letterSpacing:-.3,color:C.t1}}>Learning to Rank — Interactive explorer</h1>
          </div>
          <div style={{display:"flex",gap:5,marginLeft:"auto",flexWrap:"wrap"}}>
            <Tag color={C.warn}>E-commerce CTR</Tag>
            <Tag color={C.ok}>Beginner → Advanced</Tag>
            <Tag color={activeColor}>{TABS.find(t=>t.key===tab)?.label}</Tag>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{display:"flex",gap:1,padding:"5px 10px",overflowX:"auto",borderBottom:`1px solid ${C.bd}`,background:C.bg1}}>
        {TABS.map(t=><button key={t.key} onClick={()=>setTab(t.key)} style={{padding:"7px 11px",borderRadius:7,border:"none",fontSize:10.5,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",transition:"all .2s",background:tab===t.key?t.color+"18":"transparent",color:tab===t.key?t.color:C.t3,borderBottom:tab===t.key?`2px solid ${t.color}`:"2px solid transparent",letterSpacing:.1}}>{t.label}</button>)}
      </div>

      {/* Content */}
      <div ref={scrollRef} style={{padding:"18px 14px",maxWidth:820,margin:"0 auto",paddingBottom:40}}>
        <Comp />
      </div>

      {/* Footer */}
      <div style={{borderTop:`1px solid ${C.bd}`,padding:"10px 16px",textAlign:"center",fontSize:10,color:C.t4}}>
        Pointwise → RankNet → LambdaRank → LambdaMART &nbsp;|&nbsp; Listwise: ListNet · ListMLE · AdaRank &nbsp;|&nbsp; Train on engagement logs → optimise NDCG → serve rankings
      </div>
    </div>
  );
}
