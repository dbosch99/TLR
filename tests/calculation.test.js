import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { CATALOG } from '../data/catalog.js';
import { calculate, colebrook, friction, pipeHydraulics, waterAt, heatLoss } from '../src/physics.js';
import { analyzeNetwork } from '../src/network.js';
import { exampleProject, edge, parseProject, newProject, number } from '../src/model.js';
const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),`${a} ≠ ${b}`);
test('Ripartizione della potenza e conservazione ai nodi, incluse le tratte S-ST',()=>{
 const p=exampleProject(),r=calculate(p);assert.equal(r.ok,true);near(r.designKW,350);near(r.rows[0].powerKW,350);
 const power=(from,to)=>r.rows.find(e=>e.from===from&&e.to===to).powerKW;
 near(power('B.C.','S1')+power('B.C.','N1'),350);
 near(power('N1','S2')+power('N1','S3'),power('B.C.','N1'));
 for(const n of ['S1','S2','S3'])near(power(n,`${n}T`),r.designKW*p.demands[n]/r.net.demandKW);
 near(r.rows[0].massKgS,350/(r.cp*20));
});
test('Generatore insufficiente: le portate non vengono ridotte',()=>{
 const p=exampleProject();p.settings.generatorKW=100;const r=calculate(p);
 near(r.designKW,Object.values(p.demands).reduce((a,b)=>a+b,0));near(r.factor,1);assert.ok(r.warnings.some(x=>x.includes('insufficiente')));
});
test('Cataloghi: completezza, ordine dei diametri e dati termici validi',()=>{
 assert.equal(CATALOG.families.length,14);assert.equal(CATALOG.families.reduce((s,f)=>s+f.sizes.length,0),157);
 for(const f of CATALOG.families){assert.ok(f.roughnessMm>0);for(let i=0;i<f.sizes.length;i++){const s=f.sizes[i];assert.ok(s.innerMm>0&&s.uWmK>0);if(i)assert.ok(s.innerMm>f.sizes[i-1].innerMm);}}
});
test('Colebrook: riferimento indipendente e residuo implicito',()=>{
 near(colebrook(100000,0.0001),0.01849869370440918,1e-11);
 for(const re of [4000,1e4,1e5,1e6])for(const e of [0,0.0001,0.001]){const f=colebrook(re,e);near(1/Math.sqrt(f)+2*Math.log10(e/3.71+2.5/(re*Math.sqrt(f))),0,1e-10);}
 near(friction(1000,0.001),0.064);near(friction(2000,0.001),0.032);near(friction(2299,0.001),64/2299);near(friction(2300,0.001),colebrook(2300,0.001));near(friction(4000,0.001),colebrook(4000,0.001));
});
test('Ogni diametro scelto è il minimo ammissibile sia in mandata sia in ritorno',()=>{
 const r=calculate(exampleProject());assert.equal(r.complete,true);
 for(const e of r.rows){assert.ok(e.chosen);assert.ok(e.chosen.supply.gradientMmM<e.limit&&e.chosen.ret.gradientMmM<e.limit);
  const index=e.family.sizes.indexOf(e.chosen.size);
  if(index>0){const smaller=e.family.sizes[index-1];const losses=[[r.supplyC,e.massKgS],[r.returnC,e.massReturnKgS]].map(([t,m])=>pipeHydraulics(m,smaller.innerMm,e.family.roughnessMm,t).gradientMmM);assert.ok(Math.max(...losses)>=e.limit);}
 }
});
test('Fattore lunghezza: scala ΔH e dispersioni M+R e aggiorna il margine, senza cambiare DN o W/m',()=>{
 const p=exampleProject();p.settings.lengthFactor=1;const a=calculate(p);
 for(const factor of [1.1,1.3]){
  p.settings.lengthFactor=factor;const b=calculate(p);
  for(let i=0;i<a.rows.length;i++){
   assert.equal(a.rows[i].chosen.size.dn,b.rows[i].chosen.size.dn);
   near(b.rows[i].effectiveLengthM,a.rows[i].lengthM*factor);
   for(const key of ['pressureSupplyM','pressureReturnM'])near(b.rows[i][key],a.rows[i][key]*factor);
   for(const key of ['supplyWM','returnWM'])near(b.rows[i].thermal[key],a.rows[i].thermal[key]);
   for(const key of ['supplyKW','returnKW','totalKW'])near(b.rows[i].thermal[key],a.rows[i].thermal[key]*factor);
  }
  near(b.thermalKW,a.thermalKW*factor);
  near(b.demandWithLossKW,a.net.demandKW+a.thermalKW*factor);
  near(b.marginKW,a.marginKW-a.thermalKW*(factor-1));
 }
});
test('Dispersioni: controllo manuale indipendente e somma M+R',()=>{
 const h=heatLoss(0.2,100,80,60,10);near(h.supplyWM,14);near(h.returnWM,10);near(h.totalKW,2.4);
 const p=exampleProject(),r=calculate(p);let total=0;
 for(const e of r.rows){const expected=e.chosen.size.uWmK*e.lengthM*p.settings.lengthFactor*(r.supplyC+r.returnC-2*e.ambientC)/1000;near(e.thermal.totalKW,expected);total+=expected;}
 near(r.thermalKW,total);near(r.marginKW,p.settings.generatorKW-r.net.demandKW-total);
});
test('Cambio isolamento: dispersioni aggiornate, stesso diametro a parità di sezione interna',()=>{
 const p=exampleProject();const a=calculate(p);p.edges[1].familyId='pipe-6';const b=calculate(p);
 assert.equal(a.rows[1].chosen.size.innerMm,b.rows[1].chosen.size.innerMm);assert.ok(b.rows[1].thermal.totalKW<a.rows[1].thermal.totalKW);
});
test('Diametro massimo e limite aumentato: tutte le famiglie restano calcolabili',()=>{
 const p=exampleProject();p.settings.generatorKW=242;
 for(const familyId of ['pipe-2','pipe-3','pipe-7','pipe-8','pipe-11']){
  p.edges[0].familyId=familyId;const snapshot=JSON.stringify(p),r=calculate(p),x=r.rows[0];
  assert.equal(r.complete,true);assert.equal(x.chosen.size.dn,x.family.sizes.at(-1).dn);
  assert.equal(x.limitRaised,true);assert.equal(x.status,'limit-raised');assert.equal(x.requestedLimit,30);
  const j=Math.max(x.chosen.supply.gradientMmM,x.chosen.ret.gradientMmM);
  assert.ok(x.limit>j);assert.ok(x.limit-j<=0.010000001);assert.ok(x.limitAboveArea);
  assert.ok(Number.isFinite(r.thermalKW)&&Number.isFinite(r.marginKW)&&r.critical);
  assert.equal(JSON.stringify(p),snapshot);
 }
 p.edges[0].familyId='pipe-1';const restored=calculate(p).rows[0];
 assert.equal(restored.limitRaised,false);assert.equal(restored.limit,30);assert.equal(restored.limitAboveArea,false);
});
test('Limiti manuali confrontati con il criterio di ambito, senza alterare le impostazioni',()=>{
 const p=exampleProject();
 for(const [limit,above] of [[5,false],[10,false],[20,true]]){
  p.edges[1].limitMmM=limit;const x=calculate(p).rows[1];
  assert.equal(x.limitRaised,false);assert.equal(x.limitAboveArea,above);assert.equal(x.limit,limit);assert.equal(x.areaLimit,10);
 }
 p.edges[1].limitMmM=1e-12;const r=calculate(p);assert.equal(r.complete,true);assert.ok(r.rows[1].limitRaised);assert.equal(p.edges[1].limitMmM,1e-12);
});
test('Portata nulla in una sottostazione: esclusione esplicita, nessun NaN',()=>{
 const p=exampleProject();p.demands.S1=0;const r=calculate(p);assert.equal(r.ok,true);assert.equal(r.rows[1].status,'inactive');assert.equal(r.rows[2].status,'inactive');assert.equal(r.rows[1].chosen,null);assert.ok(Number.isFinite(r.thermalKW));
});
test('La perdita del circuito critico somma i soli rami effettivamente attraversati',()=>{
 const r=calculate(exampleProject());const expected=r.rows.filter(e=>e.served.includes(r.critical.station)).reduce((s,e)=>s+e.pressureSupplyM+e.pressureReturnM,0);near(r.critical.lossM,expected);
});
test("Aggiunta e rimozione di nodi e sottostazioni, indipendentemente dall'ordine delle righe",()=>{
 const p=exampleProject();p.edges.push(edge('N1','N2',30),edge('N2','S4',20),edge('S4','S4T',7.5));p.demands.S4=30;
 const r=calculate(p);assert.equal(r.ok,true);assert.equal(r.net.stations.length,4);near(r.rows[0].powerKW,350);
 p.edges.reverse();const reversed=calculate(p);assert.equal(reversed.ok,true);near(reversed.thermalKW,r.thermalKW);
 p.edges=p.edges.filter(e=>!['N2','S4'].includes(e.from)&&e.to!=='N2');assert.equal(calculate(p).net.stations.length,3);assert.equal(calculate(p).ok,true);
});
test('Rifiuta topologie ambigue: duplicati, maglie, nodi scollegati e terminali errati',()=>{
 for(const modify of [p=>p.edges.push({...p.edges[1],id:'duplicate'}),p=>p.edges.push(edge('N1','B.C.',3)),p=>p.edges.push(edge('N7','S8',3)),p=>p.edges[2].to='S2T',p=>p.edges[3].to='XYZ']){const p=exampleProject();modify(p);assert.equal(calculate(p).ok,false);}
 const p=exampleProject();p.edges=p.edges.filter(e=>e.to!=='S1T');assert.ok(analyzeNetwork(p).errors.some(e=>e.includes('S1-S1T')));
});
test('Dati incompleti o non fisici non producono risultati',()=>{
 assert.equal(calculate(newProject()).ok,false);
 for(const modify of [p=>p.edges[0].lengthM=null,p=>p.demands.S1=null,p=>p.settings.deltaC=0,p=>p.settings.deltaC=100,p=>p.settings.supplyC=140,p=>p.settings.lengthFactor=0.9,p=>p.settings.limits.plant=0,p=>p.settings.generatorKW=-5]){const p=exampleProject();modify(p);assert.equal(calculate(p).ok,false);}
 assert.throws(()=>waterAt(131));near(waterAt(85.5).densityKgM3,waterAt(85).densityKgM3);
});
test('Salvataggio e importazione mantengono i risultati e gli override',()=>{
 const p=exampleProject();p.edges[1].ambientC=12;p.edges[1].limitMmM=7.5;p.edges[1].familyId='pipe-6';p.name='<script>nome</script>';
 const r=calculate(p),q=parseProject(JSON.parse(JSON.stringify(p))),s=calculate(q);assert.equal(s.ok,true);near(s.thermalKW,r.thermalKW);assert.equal(q.name,p.name);assert.notEqual(q.edges[0].id,p.edges[0].id);
 assert.throws(()=>parseProject({version:2}));assert.throws(()=>parseProject({...p,edges:[{...p.edges[0],familyId:'not-a-family'}]}));assert.equal(number('1.250,50'),1250.5);assert.equal(number(''),null);assert.equal(number('NaN'),null);
});

test('Un criterio locale errato conserva le righe modificabili, senza totali ingannevoli',()=>{
 const p=exampleProject();p.edges[0].limitMmM=-2;const r=calculate(p);assert.equal(r.ok,true);assert.equal(r.complete,false);assert.equal(r.rows.length,8);assert.equal(r.rows[0].chosen,null);assert.equal(r.thermalKW,null);assert.ok(r.warnings.some(w=>w.includes('Correggi')));
});

test("Confronto con le 16 righe dell'Excel: portate, velocità, f e perdite unitarie",()=>{
 const fixture=JSON.parse(readFileSync(new URL('./excel-hydraulics.json',import.meta.url),'utf8'));
 const p=exampleProject();p.settings.generatorKW=fixture.generatorKW;
 const r=calculate(p);
 for(const expected of fixture.rows){
  const supply=expected.temperatureC===fixture.supplyC;
  const x=r.rows.find(x=>supply ? x.from===expected.from&&x.to===expected.to : x.from===expected.to&&x.to===expected.from);
  assert.equal(x.chosen.size.dn,expected.dn);
  const h=x.chosen[supply?'supply':'ret'];
  for(const key of ['volumeLH','velocityMS','lambda','gradientMmM'])near(h[key],expected[key],1e-7);
 }
 near(r.rows[1].pressureSupplyM,fixture.rows[1].gradientMmM*411.7401*1.1/1000,1e-7);
 near(r.thermalKW,35.88176511177961);
});
