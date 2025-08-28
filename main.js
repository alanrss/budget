const $ = (q, el=document) => el.querySelector(q);
const $$ = (q, el=document) => Array.from(el.querySelectorAll(q));
const fmt = (n, cur) => new Intl.NumberFormat('en-US', { style:'currency', currency: cur }).format(Number(n||0));

const state = {
  type: 'week',
  periodStart: null,
  currency: 'USD',
  budget: 0,
  entries: [],
  note: ''
};

function startOfWeek(d){
  const date = new Date(d);
  const day = date.getDay(); // 0 Sun - 6 Sat
  const diff = date.getDate() - day + 1; // Monday as start
  const monday = new Date(date.setDate(diff));
  monday.setHours(0,0,0,0);
  return monday;
}
function startOfMonth(d){
  const date = new Date(d);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function periodKey(date, type){
  if(type === 'month'){
    const d = startOfMonth(date);
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    return `month-${y}-${m}`;
  } else {
    const d = startOfWeek(date);
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const da = String(d.getDate()).padStart(2,'0');
    return `week-${y}-${m}-${da}`;
  }
}

function save(){
  const key = periodKey(state.periodStart || new Date(), state.type);
  const payload = { ...state, entries: getEntriesFromDOM() };
  localStorage.setItem(key, JSON.stringify(payload));
}

function load(date, type){
  const key = periodKey(date, type);
  const raw = localStorage.getItem(key);
  if(raw){
    const data = JSON.parse(raw);
    state.periodStart = new Date(data.periodStart || date);
    state.currency = data.currency || 'USD';
    state.budget = Number(data.budget||0);
    state.entries = data.entries || [];
    state.note = data.note || '';
    state.type = data.type || type;
  }else{
    state.periodStart = type === 'month' ? startOfMonth(date) : startOfWeek(date);
    state.currency = 'USD';
    state.budget = 0;
    state.entries = [];
    state.note = '';
    state.type = type;
  }
  renderAll();
}

function renderAll(){
  // Controls
  $('#type').value = state.type;
  $('#periodStart').value = toInputDate(state.periodStart);
  $('#currency').value = state.currency;
  $('#budget').value = state.budget || '';
  $('#quickNote').value = state.note || '';

  // Period label
  let label;
  if(state.type === 'month') {
    const start = new Date(state.periodStart);
    const end = new Date(start.getFullYear(), start.getMonth()+1, 0);
    label = `Month: ${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
  } else {
    const start = new Date(state.periodStart);
    const end = new Date(start); end.setDate(end.getDate()+6);
    label = `Week: ${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
  }
  $('#periodLabel').textContent = label;

  // Rows
  const tbody = $('#tbody');
  tbody.innerHTML = '';
  if(state.entries.length === 0){ addRow(); }
  else{
    for(const e of state.entries){ addRow(e); }
  }
  recalc();
}

function toInputDate(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}

function dayOptions(){
  if(state.type === 'month') {
    const start = startOfMonth(state.periodStart);
    const end = new Date(start.getFullYear(), start.getMonth()+1, 0);
    const days = (end.getDate() - start.getDate()) + 1;
    return Array.from({length: days}, (_,i)=>{
      const d = new Date(start); d.setDate(d.getDate()+i);
      return { label: d.toLocaleDateString(undefined,{ weekday:'short', month:'short', day:'numeric'}), value: toInputDate(d)};
    });
  } else {
    const start = startOfWeek(state.periodStart);
    return Array.from({length:7}, (_,i)=>{
      const d = new Date(start); d.setDate(d.getDate()+i);
      return { label: d.toLocaleDateString(undefined,{ weekday:'short', month:'short', day:'numeric'}), value: toInputDate(d)};
    });
  }
}

function addRow(data={}){
  const tpl = $('#rowTemplate').content.cloneNode(true);
  const tr = tpl.querySelector('tr');
  const daySel = tpl.querySelector('.day');
  const desc = tpl.querySelector('.desc');
  const cat = tpl.querySelector('.cat');
  const pay = tpl.querySelector('.pay');
  const amt = tpl.querySelector('.amt');

  // Populate day options
  daySel.innerHTML = '';
  for(const opt of dayOptions()){
    const o = document.createElement('option');
    o.value = opt.value; o.textContent = opt.label; daySel.appendChild(o);
  }

  // Set values if provided
  if(data.day) daySel.value = data.day;
  if(data.desc) desc.value = data.desc;
  if(data.cat) cat.value = data.cat;
  if(data.pay) pay.value = data.pay;
  if(data.amt!=null) amt.value = data.amt;

  // Events
  tr.addEventListener('input', ()=>{ recalc(); save(); });
  tr.querySelector('[data-action="delete"]').addEventListener('click', ()=>{ tr.remove(); recalc(); save(); });

  $('#tbody').appendChild(tr);
}

function getEntriesFromDOM(){
  return $$('#tbody tr').map(tr => ({
    day: tr.querySelector('.day').value,
    desc: tr.querySelector('.desc').value.trim(),
    cat: tr.querySelector('.cat').value,
    pay: tr.querySelector('.pay').value,
    amt: Number(tr.querySelector('.amt').value || 0)
  }));
}

function recalc(){
  const rows = getEntriesFromDOM();
  const total = rows.reduce((s,r)=> s + (Number(r.amt)||0), 0);
  const budget = Number($('#budget').value || 0);

  // KPIs
  $('#totalSpent').textContent = fmt(total, state.currency);
  $('#entriesCount').textContent = rows.length;

  // Avg per day (only days with entries count)
  const daysUsed = new Set(rows.filter(r=>r.amt>0).map(r=>r.day)).size || 1;
  $('#avgPerDay').textContent = fmt(total / daysUsed, state.currency);

  // Remaining
  const remaining = Math.max(0, budget - total);
  $('#remaining').textContent = fmt(remaining, state.currency);

  // Progress bar & donut
  const pct = budget>0 ? Math.min(100, Math.round((total / budget)*100)) : 0;
  $('#progressBar').style.width = pct + '%';
  $('#progressPct').textContent = pct + '%';
  const deg = Math.round((pct/100)*360);
  $('#donut').style.setProperty('--p', deg + 'deg');
  $('#donutLabel').textContent = pct + '%';

  // Visual warnings
  const pb = $('#progressBar');
  pb.style.background = pct < 80 ? `linear-gradient(90deg, var(--brand), var(--brand-2))` : pct < 100 ? `linear-gradient(90deg, var(--warning), #f59e0b)` : `linear-gradient(90deg, var(--danger), #ef4444)`;
}

// Export CSV
function exportCSV(){
  const rows = getEntriesFromDOM();
  const header = ['date','description','category','method','amount'];
  const data = [header.join(','), ...rows.map(r => [r.day, esc(r.desc), r.cat, r.pay, r.amt].join(','))].join('\n');
  const blob = new Blob([data], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${periodKey(state.periodStart, state.type)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function esc(text){
  const t = String(text||'');
  if(t.includes(',') || t.includes('"')){
    return '"' + t.replace(/"/g,'""') + '"';
  }
  return t;
}

// Import CSV
function importCSV(file){
  const reader = new FileReader();
  reader.onload = (e)=>{
    const text = e.target.result;
    const lines = text.split(/\r?\n/).filter(Boolean);
    const body = lines.slice(1).map(line=>{
      const cols = parseCSV(line);
      return { day: cols[0], desc: cols[1], cat: cols[2], pay: cols[3], amt: Number(cols[4]||0) };
    });
    state.entries = body; renderAll(); save();
  };
  reader.readAsText(file);
}

function parseCSV(line){
  const result = [];
  let cur = ''; let inQ = false;
  for(let i=0;i<line.length;i++){
    const ch = line[i];
    if(ch==='"'){
      if(inQ && line[i+1]==='"'){ cur+='"'; i++; }
      else inQ = !inQ;
    } else if(ch===',' && !inQ){ result.push(cur); cur=''; }
    else cur+=ch;
  }
  result.push(cur);
  return result;
}

// Events wiring
$('#addRowBtn').addEventListener('click', ()=>{ addRow(); save(); });
$('#exportBtn').addEventListener('click', exportCSV);
$('#importBtn').addEventListener('click', ()=> $('#importCsv').click());
$('#importCsv').addEventListener('change', (e)=>{
  const file = e.target.files[0]; if(file) importCSV(file);
  e.target.value='';
});

$('#clearBtn').addEventListener('click', ()=>{
  if(confirm('Are you sure you want to clear all entries for this period?')){
    state.entries = []; renderAll(); save();
  }
});

$('#type').addEventListener('change', (e)=>{
  state.type = e.target.value;
  if(state.type === 'month') {
    state.periodStart = startOfMonth(state.periodStart || new Date());
  } else {
    state.periodStart = startOfWeek(state.periodStart || new Date());
  }
  load(state.periodStart, state.type);
});
$('#periodStart').addEventListener('change', (e)=>{
  state.periodStart = new Date(e.target.value);
  load(state.periodStart, state.type);
});
$('#currency').addEventListener('change', (e)=>{ state.currency = e.target.value; recalc(); save(); });
$('#budget').addEventListener('input', ()=>{ recalc(); save(); });
$('#quickNote').addEventListener('input', (e)=>{ state.note = e.target.value; save(); });

// Init
(function init(){
  const now = new Date();
  state.type = 'week';
  state.periodStart = startOfWeek(now);
  load(state.periodStart, state.type);
})();