import { CATALOG } from '../data/catalog.js';
import { AREAS, edge, newProject, exampleProject, stationNames, normalize, number, parseProject } from './model.js';
import { calculate } from './physics.js';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const fmt = (value, digits = 2) => Number.isFinite(value) ? value.toLocaleString('it-IT', { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: 'always' }) : '—';
const raw = value => Number.isFinite(value) ? String(value).replace('.', ',') : '';
const STORAGE = 'tlr-project-v1';
const SHORT = ['Acciaio isolato','Rame isolato','Multistrato isolato','Preisolato in PE','ECOPEX UNO PN 6 · Standard','ECOPEX UNO PN 6 · Plus','ECOPEX sanitario PN 10 · Standard','ECOPEX sanitario PN 10 · Plus','ECOPEX FORTE PN 16 · Serie 1','ECOPEX FORTE PN 16 · Serie 2','ECOALUPEX PN 10 · Standard','ECOLINE acciaio · Serie 1','ECOLINE acciaio · Serie 2','ECOLINE acciaio · Serie 3'];
let project = exampleProject(), result, undoProject = null, stationSignature = '', persistTimer, toastTimer, storageAvailable = true;
try { const saved = localStorage.getItem(STORAGE); if (saved) project = parseProject(JSON.parse(saved)); } catch { storageAvailable = false; }
const familyOptions = selected => CATALOG.families.map((f,i) => `<option value="${f.id}" ${selected === f.id ? 'selected' : ''}>${esc(SHORT[i])}</option>`).join('');
function notify(message, undo = false) {
  clearTimeout(toastTimer); $('toast').innerHTML = `${esc(message)}${undo ? '<button id="undo-action">Annulla</button>' : ''}`; $('toast').hidden = false;
  if (undo) $('undo-action').onclick = () => { if (!undoProject) return; project = undoProject; undoProject = null; renderAll(); notify('Operazione annullata.'); };
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, undo ? 14000 : 6000);
}
function backup() { undoProject = structuredClone(project); }
function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE, JSON.stringify(project)); storageAvailable = true; } catch { storageAvailable = false; }
    $('save-status').innerHTML = storageAvailable ? '<i></i> Salvato in questo browser' : '<i></i> Salva una copia del progetto';
    if (!storageAvailable) $('save-status').title = 'Il browser non consente il salvataggio automatico. Usa Salva progetto per conservare una copia.';
  }, 250);
}
function renderSettings() {
  $('project-name').value = project.name;
  for (const input of document.querySelectorAll('[data-setting]')) input.value = raw(project.settings[input.dataset.setting]);
  $('criteria').innerHTML = Object.entries(AREAS).map(([key, label]) => `<div class="criteria-row"><span>${key === 'plant' ? 'Centrale' : label}</span><input inputmode="decimal" data-limit-default="${key}" aria-label="Limite di perdita ${esc(label)} in mm c.a./m" value="${raw(project.settings.limits[key])}"><input inputmode="decimal" data-ambient-default="${key}" aria-label="Temperatura ambiente ${esc(label)} in °C" value="${raw(project.settings.ambient[key])}"></div>`).join('');
}
function renderEdges() {
  $('edges-body').innerHTML = project.edges.map(e => `<tr data-edge="${e.id}"><td><input aria-label="Nodo iniziale della tratta" data-edge-field="from" value="${esc(e.from)}" placeholder="B.C." maxlength="20" autocomplete="off" spellcheck="false"></td><td><input aria-label="Nodo finale della tratta" data-edge-field="to" value="${esc(e.to)}" placeholder="N1" maxlength="20" autocomplete="off" spellcheck="false"></td><td><input aria-label="Lunghezza della tratta in metri" data-edge-field="lengthM" value="${raw(e.lengthM)}" inputmode="decimal" placeholder="0,00" autocomplete="off"></td><td><select aria-label="Ambito della tratta" data-edge-field="area">${Object.entries(AREAS).map(([key,label]) => `<option value="${key}" ${e.area === key ? 'selected' : ''}>${label}</option>`).join('')}</select></td><td><button class="icon-button" data-delete-edge="${e.id}" aria-label="Elimina tratta ${esc(e.from)}-${esc(e.to)}" title="Elimina tratta">×</button></td></tr>`).join('');
}
function renderDemands(force = false) {
  const names = stationNames(project), signature = names.join('|');
  for (const n of names) if (!Object.hasOwn(project.demands, n)) project.demands[n] = null;
  if (!force && signature === stationSignature) return;
  stationSignature = signature;
  $('demands').innerHTML = names.length ? names.map(n => `<label class="demand-row"><span class="station-name"><i class="station-dot"></i>${esc(n)}</span><span class="unit-input"><input data-demand="${n}" aria-label="Fabbisogno ${n} in kW" inputmode="decimal" value="${raw(project.demands[n])}" placeholder="Da inserire" autocomplete="off"><span>kW</span></span></label>`).join('') : '<div class="empty-state">Inserisci una tratta che raggiunge S1.<br>Il suo fabbisogno comparirà qui.</div>';
}
function metric(label, value, unit, caption, featured = false) { return `<div class="metric ${featured ? 'featured' : ''}"><div class="metric-label">${label}</div><div class="metric-value">${value}<small>${unit}</small></div><div class="metric-caption">${caption}</div>${featured ? '<div class="metric-decoration"></div>' : ''}</div>`; }
function renderMetrics() {
  const names = stationNames(project), lengthsReady = project.edges.length && project.edges.every(e => Number.isFinite(e.lengthM) && e.lengthM > 0);
  $('metrics').innerHTML = metric('Potenza di progetto', fmt(result.designKW,1), 'kW', result.ok ? `Utenze: ${fmt(result.net.demandKW,1)} kW · utilizzo 100%` : 'Completa i dati di progetto', true) + metric('Sottostazioni', names.length, '', 'Utenze riconosciute dalla rete') + metric('Lunghezza mandata + ritorno', lengthsReady ? fmt(2 * project.edges.reduce((s,e) => s + e.lengthM,0),1) : '—', 'm', 'Lunghezza reale, senza maggiorazione') + metric('Dispersioni mandata + ritorno', fmt(result.thermalKW,2), 'kW', result.complete ? 'Alla temperatura di progetto' : 'Disponibili dopo la selezione dei tubi');
  const demandsReady = names.length && names.every(n => Number.isFinite(project.demands[n]) && project.demands[n] >= 0);
  $('demand-total').innerHTML = `<span>Fabbisogno complessivo</span><strong>${demandsReady ? fmt(result.net.demandKW,2) + ' kW' : 'Da completare'}</strong>`;
  const s = project.settings;
  $('return-temp').textContent = Number.isFinite(s.supplyC) && Number.isFinite(s.deltaC) ? `${fmt(s.supplyC-s.deltaC,1)} °C` : '—';
}
function renderDiagram() {
  if (!result.ok) { $('diagram').innerHTML = '<div class="empty-state">Lo schema si compone dai collegamenti tra i nodi.<br>Completa le tratte e i fabbisogni per visualizzare la rete.</div>'; return; }
  const positions = new Map(), depths = new Map(), rows = new Map(result.rows.map(r => [r.id,r])); let leaf = 0, maxDepth = 0;
  function place(n, depth) {
    const children = result.net.outgoing.get(n)||[];
    const ys = children.map(e => place(e.to, depth+1));
    const y = ys.length ? ys.reduce((a,b) => a+b,0)/ys.length : 42 + leaf++ * 82;
    depths.set(n, depth); positions.set(n, {x:64+depth*155,y}); maxDepth = Math.max(maxDepth,depth); return y;
  }
  place('C.C.',0); const width = 120+maxDepth*155, height = Math.max(190,leaf*82+12);
  // Linee parallele per rappresentare la coppia di tubi, senza simulare coordinate geografiche.
  const links = result.net.edges.map(e => {
    const a = positions.get(e.from), b = positions.get(e.to), mid = (a.x+b.x)/2, r=rows.get(e.id);
    const path = offset => `M ${a.x+8} ${a.y+offset} C ${mid} ${a.y+offset},${mid} ${b.y+offset},${b.x-8} ${b.y+offset}`;
    return `<path d="${path(-3)}" stroke="#39836b" fill="none" stroke-width="2"/><path d="${path(3)}" stroke="#c3936e" fill="none" stroke-width="1.5"/><text class="edge-label" x="${mid}" y="${b.y-14}" text-anchor="middle">${fmt(r.powerKW,1)} kW${r.chosen ? ` · DN ${r.chosen.size.dn}` : ''}</text>`;
  }).join('');
  const nodes = [...positions].map(([n,p]) => { const terminal=n.endsWith('T'), station=/^S\d+$/.test(n), root=n==='C.C.'; return `<circle cx="${p.x}" cy="${p.y}" r="${terminal ? 4 : root || station ? 8 : 5}" fill="${root ? '#174a3b' : terminal ? '#becdbf' : station ? '#6c9c6b' : '#fff'}" stroke="#39836b" stroke-width="${terminal ? 0 : 2}"/><text class="${terminal ? 'terminal-label' : 'node-label'}" x="${p.x}" y="${p.y+27}" text-anchor="middle">${esc(n)}</text>`; }).join('');
  $('diagram').innerHTML = `<svg viewBox="0 0 ${Math.max(700,width)} ${height}" style="min-width:${Math.max(700,width)}px" role="img" aria-label="Schema ramificato della rete con potenze e diametri di progetto">${links}${nodes}</svg>`;
}
function renderMessages() {
  const messages = result.ok ? result.warnings : result.errors;
  if (!messages.length) { $('messages').innerHTML = ''; return; }
  $('messages').innerHTML = `<div class="message ${result.ok ? '' : 'error'}"><strong>${result.ok ? 'Verifiche da considerare' : 'Completa o correggi la rete'}</strong><ul>${messages.slice(0,5).map(m => `<li>${esc(m)}</li>`).join('')}</ul>${messages.length>5 ? `<details><summary>Altri ${messages.length-5} messaggi</summary><ul>${messages.slice(5).map(m => `<li>${esc(m)}</li>`).join('')}</ul></details>` : ''}</div>`;
}
function restoreFocus(old, key, start, end) {
  if (key && !old.isConnected) {
    const target = document.querySelector(`[data-control-key="${CSS.escape(key)}"]`);
    if (target) { if(target.tagName==='INPUT')target.value=old.value;target.focus({preventScroll:true}); if (typeof start === 'number') try { target.setSelectionRange(start,end); } catch {} }
  }
}
function renderResults() {
  const active=document.activeElement, key=active?.dataset.controlKey, start=active?.selectionStart, end=active?.selectionEnd;
  $('export-csv').disabled = !result.ok;
  $('pipe-count').textContent = result.ok ? result.rows.length : project.edges.length;
  if (!result.ok) {
    const empty = '<div class="empty-state">I risultati compariranno quando la rete sarà completa.<br>Le informazioni da correggere sono indicate sopra.</div>';
    $('hydraulic-results').innerHTML=empty; $('thermal-results').innerHTML=empty; $('result-footer').innerHTML='';
    $('result-summary').textContent='Completa i dati per avviare il dimensionamento.'; return;
  }
  $('result-summary').textContent = `${result.rows.filter(r => r.chosen).length} tratte dimensionate · mandata ${fmt(result.supplyC,0)} °C / ritorno ${fmt(result.returnC,0)} °C`;
  const body = result.rows.map(r => {
    const c=r.chosen, v=c ? Math.max(c.supply.velocityMS,c.ret.velocityMS) : null, gradient=c ? Math.max(c.supply.gradientMmM,c.ret.gradientMmM) : null;
    return `<tr><td class="route">${esc(r.from)}–${esc(r.to)}<small>${esc(AREAS[r.area])}</small></td><td>${fmt(r.powerKW,2)}</td><td>${fmt(c?.supply.volumeLH,0)}<span class="minor">mandata</span></td><td><select data-result-edge="${r.id}" data-result-field="familyId" data-control-key="family-${r.id}" aria-label="Tubazione ${esc(r.from)}-${esc(r.to)}" title="${esc(r.family.name)}">${familyOptions(r.family.id)}</select></td><td>${c ? `<span class="dn">${c.size.dn}</span><span class="minor">D_i ${fmt(c.size.innerMm,1)} mm</span>` : `<span class="unavailable">${r.status==='inactive' ? 'Non attiva' : 'Non disponibile'}</span>`}</td><td>${fmt(v,2)}<span class="minor">max M/R</span></td><td><span class="${c?'pass-value':''}">${fmt(gradient,2)}</span><span class="minor">max M/R</span></td><td><input class="limit-input" inputmode="decimal" data-result-edge="${r.id}" data-result-field="limitMmM" data-control-key="limit-${r.id}" value="${raw(r.limitMmM)}" placeholder="${r.limit}" aria-label="Limite perdita ${esc(r.from)}-${esc(r.to)} in mm c.a./m" title="Vuoto: usa il criterio per ambito (${r.limit})"><span class="minor">${r.limitMmM===null ? `ambito: ${fmt(r.limit,0)}` : 'personalizzato'}</span></td><td>${fmt(c ? r.pressureSupplyM+r.pressureReturnM : null,2)}<span class="minor">M + R</span></td><td>${fmt(r.status==='inactive' ? 0 : r.thermal?.totalKW,3)}</td></tr>`;
  }).join('');
  $('hydraulic-results').innerHTML = `<div class="table-scroll"><table class="result-table"><thead><tr><th>Tratta</th><th>Potenza<span>kW</span></th><th>Portata<span>l/h</span></th><th>Tubazione</th><th>DN<span>catalogo</span></th><th>Velocità<span>m/s</span></th><th>Perdita unitaria<span>mm c.a./m</span></th><th>Limite<span>mm c.a./m</span></th><th>ΔH distribuita<span>m c.a.</span></th><th>Dispersioni<span>kW · M + R</span></th></tr></thead><tbody>${body}</tbody></table></div><div class="result-note">Scelta del <strong>diametro interno minimo</strong> con perdita unitaria inferiore al limite sia in mandata sia in ritorno. Il diametro è uguale sui due tubi. Un limite vuoto usa il valore del relativo ambito. Le perdite distribuite sono calcolate su lunghezza reale × ${fmt(project.settings.lengthFactor,2)}.</div>`;
  const thermalBody=result.rows.map(r => `<tr><td class="route">${esc(r.from)}–${esc(r.to)}<small>${fmt(r.lengthM,2)} m reali</small></td><td>${r.chosen ? r.chosen.size.dn : '—'}</td><td>${fmt(r.thermal?.uWmK,3)}</td><td><input class="ambient-input" inputmode="decimal" data-result-edge="${r.id}" data-result-field="ambientC" data-control-key="ambient-${r.id}" value="${raw(project.edges.find(e=>e.id===r.id).ambientC)}" placeholder="${r.ambientC}" aria-label="Temperatura ambiente ${esc(r.from)}-${esc(r.to)} in °C" title="Vuoto: usa la temperatura dell'ambito"><span class="minor">${project.edges.find(e=>e.id===r.id).ambientC===null ? 'da ambito' : 'personalizzata'}</span></td><td>${fmt(r.thermal?.supplyWM,2)}</td><td>${fmt(r.thermal?.returnWM,2)}</td><td>${fmt(r.thermal?.supplyKW,3)}</td><td>${fmt(r.thermal?.returnKW,3)}</td><td><strong>${fmt(r.status==='inactive' ? 0 : r.thermal?.totalKW,3)}</strong></td></tr>`).join('');
  const sumThermal = key => result.complete ? result.rows.reduce((s,r) => s+(r.thermal?.[key]||0),0) : null;
  $('thermal-results').innerHTML=`<div class="table-scroll"><table class="result-table thermal-table"><thead><tr><th>Tratta<span>lunghezza reale</span></th><th>DN</th><th>U lineare<span>W/(m K)</span></th><th>Ambiente<span>°C</span></th><th>Mandata<span>W/m</span></th><th>Ritorno<span>W/m</span></th><th>Mandata<span>kW</span></th><th>Ritorno<span>kW</span></th><th>Totale M + R<span>kW</span></th></tr></thead><tbody>${thermalBody}</tbody><tfoot><tr><td colspan="6">Dispersioni dell'intera rete</td><td>${fmt(sumThermal('supplyKW'),3)}</td><td>${fmt(sumThermal('returnKW'),3)}</td><td>${fmt(result.thermalKW,3)}</td></tr></tfoot></table></div><div class="result-note">Le dispersioni usano la <strong>lunghezza reale</strong> e il coefficiente U del tubo selezionato. Temperatura dell'acqua costante lungo la tratta; nessuna iterazione tra dispersioni e portate. Se l'ambiente è più caldo del tubo, il valore negativo rappresenta un apporto termico. Una tratta non attiva è esclusa dalla stima.</div><div class="balance"><div>Richiesta delle utenze<strong>${fmt(result.net.demandKW,2)} kW</strong></div><div>Utenze + dispersioni<strong>${fmt(result.demandWithLossKW,2)} kW</strong></div><div>Generatore disponibile<strong>${fmt(project.settings.generatorKW,2)} kW</strong></div><div>Margine termico stimato<strong class="${result.marginKW===null?'':result.marginKW>=0?'positive':'negative'}">${fmt(result.marginKW,2)} kW</strong></div></div>`;
  $('result-footer').innerHTML = `<div class="result-note">${result.critical ? `<strong>Circuito critico: ${esc(result.critical.station)}</strong> · perdite distribuite mandata + ritorno: ${fmt(result.critical.lossM,2)} m c.a.` : 'Completa la selezione dei tubi per ottenere le perdite distribuite del circuito critico.'} <span class="minor">Valvole, raccordi e scambiatori esclusi. Il risultato non è la prevalenza finale della pompa.</span></div>`;
  restoreFocus(active,key,start,end);
}
function update() {
  renderDemands(); result=calculate(project); renderMetrics();renderDiagram();renderMessages();renderResults();persist();
}
function renderAll() { renderSettings();renderEdges();renderDemands(true);update(); }
function download(text, filename, type) {
  const url=URL.createObjectURL(new Blob([text],{type})); const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const filename=()=>project.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-|-$/g,'').toLowerCase()||'rete-tlr';
function csvCell(value) {
  const s=typeof value==='number'?fmt(value,6).replace(/\./g,''):String(value??'');
  const safe=typeof value!=='number' && /^[=+@-]/.test(s)?`'${s}`:s;
  return `"${safe.replace(/"/g,'""')}"`;
}
function exportCSV() {
  if (!result.ok) return;
  const header=['Da','A','Ambito','Lunghezza reale [m]','Lunghezza idraulica per tubo [m]','Potenza [kW]','Portata massica [kg/s]','Portata mandata [l/h]','Portata ritorno [l/h]','Tubazione','DN','Diametro interno [mm]','Velocità mandata [m/s]','Velocità ritorno [m/s]','Perdita unitaria mandata [mm c.a./m]','Perdita unitaria ritorno [mm c.a./m]','Limite [mm c.a./m]','Perdita distribuita M+R [m c.a.]','U [W/(m K)]','Temperatura ambiente [°C]','Dispersioni mandata [kW]','Dispersioni ritorno [kW]','Dispersioni totali [kW]','Stato'];
  const lines=result.rows.map(r=>[r.from,r.to,AREAS[r.area],r.lengthM,r.effectiveLengthM,r.powerKW,r.massKgS,r.chosen?.supply.volumeLH,r.chosen?.ret.volumeLH,r.family.name,r.chosen?.size.dn,r.chosen?.size.innerMm,r.chosen?.supply.velocityMS,r.chosen?.ret.velocityMS,r.chosen?.supply.gradientMmM,r.chosen?.ret.gradientMmM,r.limit,r.chosen?r.pressureSupplyM+r.pressureReturnM:null,r.thermal?.uWmK,r.ambientC,r.thermal?.supplyKW,r.thermal?.returnKW,r.status==='inactive'?0:r.thermal?.totalKW,r.status==='ok'?'Selezionato':r.status==='inactive'?'Non attiva':'Diametro non disponibile']);
  download('\uFEFF'+[header,...lines].map(row=>row.map(csvCell).join(';')).join('\r\n'),`${filename()}-risultati.csv`,'text/csv;charset=utf-8');notify('Risultati esportati in CSV.');
}
$('project-name').addEventListener('input', e => { project.name=e.target.value;persist(); });
document.querySelector('.sidebar').addEventListener('input', e => {
  const {setting,limitDefault,ambientDefault}=e.target.dataset;
  if (setting) project.settings[setting]=number(e.target.value);
  else if (limitDefault) project.settings.limits[limitDefault]=number(e.target.value);
  else if (ambientDefault) project.settings.ambient[ambientDefault]=number(e.target.value);
  else return;
  update();
});
$('edges-body').addEventListener('input', e => {
  const field=e.target.dataset.edgeField;
  if (!field || field==='area') return;
  const item=project.edges.find(x=>x.id===e.target.closest('tr').dataset.edge);
  item[field]=field==='lengthM'?number(e.target.value):normalize(e.target.value);e.target.closest('tr').querySelector('[data-delete-edge]').setAttribute('aria-label',`Elimina tratta ${item.from}-${item.to}`);update();
});
$('edges-body').addEventListener('change', e => {
  const field=e.target.dataset.edgeField;if (!field) return;
  const item=project.edges.find(x=>x.id===e.target.closest('tr').dataset.edge);
  if (field==='area') { item.area=e.target.value;item.familyId=null;item.limitMmM=null;item.ambientC=null;update(); }
  else if(field==='from'||field==='to') { e.target.value=item[field];if(item.from==='C.C.' || /^S\d+$/.test(item.from)&&item.to===`${item.from}T`) { item.area='plant';e.target.closest('tr').querySelector('select').value='plant';update(); } }
});
$('edges-body').addEventListener('click', e => {
  const button=e.target.closest('[data-delete-edge]');if(!button)return;
  backup();project.edges=project.edges.filter(x=>x.id!==button.dataset.deleteEdge);renderEdges();update();notify('Tratta eliminata.',true);
});
$('add-edge').onclick=()=>{project.edges.push(edge(project.edges.length?'':'C.C.',project.edges.length?'':'B.C.',null));renderEdges();update();$('edges-body').lastElementChild.querySelector('input').focus();};
$('demands').addEventListener('input',e=>{if(!e.target.dataset.demand)return;project.demands[e.target.dataset.demand]=number(e.target.value);update();});
function resultInput(e) {
  const {resultEdge,resultField}=e.target.dataset;if(!resultEdge)return;
  const item=project.edges.find(x=>x.id===resultEdge);
  const value=resultField==='familyId'?e.target.value:number(e.target.value);
  item[resultField]=value;update();
}
$('hydraulic-results').addEventListener('input',resultInput);
$('hydraulic-results').addEventListener('change',e=>{if(e.target.tagName==='SELECT')resultInput(e);});
$('thermal-results').addEventListener('input',resultInput);
$('new-project').onclick=()=>{backup();project=newProject();renderAll();notify('Nuovo progetto creato.',true);};
$('load-example').onclick=()=>{backup();project=exampleProject();renderAll();notify('Rete di esempio caricata.',true);};
$('save-project').onclick=()=>{download(JSON.stringify(project,null,2),`${filename()}.json`,'application/json');notify('Copia del progetto salvata.');};
$('open-project').onclick=()=>$('project-file').click();
$('project-file').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try {if(file.size>2*1024*1024)throw new Error('Il file supera il limite di 2 MB.');const parsed=parseProject(JSON.parse(await file.text()));backup();project=parsed;renderAll();notify('Progetto aperto.',true);} catch(error){notify(`Impossibile aprire il progetto: ${error.message}`);} finally {e.target.value='';}
});
$('export-csv').onclick=exportCSV;
function showTab(thermal,focus=false) {
  for (const key of ['hydraulic','thermal']) {const selected=(key==='thermal')===thermal;const tab=$(`tab-${key}`);tab.setAttribute('aria-selected',selected);tab.tabIndex=selected?0:-1;$(`panel-${key}`).hidden=!selected;if(selected&&focus)tab.focus();}
}
$('tab-hydraulic').onclick=()=>showTab(false);$('tab-thermal').onclick=()=>showTab(true);
document.querySelector('.result-tabs').addEventListener('keydown',e=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();showTab(e.key==='End'?true:e.key==='Home'?false:$('tab-thermal').getAttribute('aria-selected')!=='true',true);}});
const dialog=$('method-dialog');
for(const id of ['method-button','footer-method']) $(id).onclick=()=>dialog.showModal();
for(const id of ['close-method','method-done']) $(id).onclick=()=>dialog.close();
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
$('catalog-info').textContent=`14 famiglie e 157 diametri, estratti il 15/10/2026 da "${CATALOG.metadata.source}". Coefficienti termici lineari e rugosità provengono dallo stesso file.`;
renderAll();
