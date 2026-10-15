import { CATALOG } from '../data/catalog.js';
import { familyFor } from './model.js';
import { analyzeNetwork } from './network.js';
export const G = 9.81;
export function waterAt(temperatureC) {
  const values = CATALOG.water;
  if (!Number.isFinite(temperatureC) || temperatureC < values[0].temperatureC || temperatureC > values.at(-1).temperatureC) throw new Error("La temperatura dell'acqua deve essere compresa tra 0 e 130 °C.");
  // LOOKUP del workbook: ultima temperatura tabulata non superiore a quella richiesta.
  const row = values[Math.floor(temperatureC)];
  return Object.fromEntries(['densityKgM3','cpKJkgK','viscosityM2s'].map(key => [key, row[key]]));
}
export function colebrook(re, relativeRoughness) {
  let f = 0.02;
  for (let i = 0; i < 100; i++) {
    const next = 1 / (-2 * Math.log10(relativeRoughness / 3.71 + 2.5 / (re * Math.sqrt(f)))) ** 2;
    if (Math.abs(next - f) < 1e-12) return next;
    f = next;
  }
  return f;
}
export function friction(re, relativeRoughness) {
  if (re <= 0) return 0;
  if (re < 2300) return 64 / re;
  return colebrook(re, relativeRoughness);
}
export function pipeHydraulics(massKgS, innerMm, roughnessMm, temperatureC) {
  const w = waterAt(temperatureC), diameterM = innerMm / 1000;
  const volumeM3S = massKgS / w.densityKgM3, velocityMS = volumeM3S / (Math.PI * diameterM ** 2 / 4);
  const reynolds = velocityMS * diameterM / w.viscosityM2s;
  const lambda = friction(reynolds, roughnessMm / innerMm);
  const gradientMmM = lambda * velocityMS ** 2 / (2 * G * diameterM) * 1000;
  return { massKgS, volumeLH: volumeM3S * 3600000, velocityMS, reynolds, lambda, gradientMmM, gradientPaM: gradientMmM / 1000 * w.densityKgM3 * G };
}
export function heatLoss(uWmK, lengthM, supplyC, returnC, ambientC) {
  const supplyWM = uWmK * (supplyC - ambientC), returnWM = uWmK * (returnC - ambientC);
  return { uWmK, ambientC, supplyWM, returnWM, supplyKW: supplyWM * lengthM / 1000, returnKW: returnWM * lengthM / 1000, totalKW: (supplyWM + returnWM) * lengthM / 1000 };
}
export function calculate(project) {
  const net = analyzeNetwork(project), errors = [...net.errors], warnings = [], s = project.settings;
  if (!(Number.isFinite(s.generatorKW) && s.generatorKW >= 0)) errors.push('Inserisci una potenza del generatore maggiore o uguale a zero.');
  if (!(Number.isFinite(s.supplyC) && Number.isFinite(s.deltaC) && s.deltaC > 0 && s.supplyC <= 130 && s.supplyC - s.deltaC >= 0)) errors.push('Imposta mandata e ritorno tra 0 e 130 °C, con ΔT positivo.');
  if (!(Number.isFinite(s.lengthFactor) && s.lengthFactor >= 1)) errors.push('Il fattore di maggiorazione delle lunghezze deve essere almeno 1.');
  for (const area of ['plant','buried','floor']) {
    if (!(Number.isFinite(s.limits[area]) && s.limits[area] > 0)) errors.push('I limiti di perdita unitaria devono essere positivi.');
    if (!Number.isFinite(s.ambient[area])) errors.push('Inserisci tutte le temperature ambiente.');
  }
  if (errors.length) return { ok: false, errors: [...new Set(errors)], warnings, net, rows: [] };
  const designKW = Math.max(s.generatorKW, net.demandKW), factor = designKW / net.demandKW;
  const supplyC = s.supplyC, returnC = supplyC - s.deltaC;
  const cp = waterAt(supplyC).cpKJkgK, cpReturn = waterAt(returnC).cpKJkgK;
  if (s.generatorKW < net.demandKW) warnings.push("Il generatore è insufficiente per i fabbisogni inseriti. I tubi sono dimensionati sull'intera richiesta delle utenze.");
  const rows = net.edges.map(e => {
    const served = net.downstream.get(e.to), powerKW = served.reduce((sum,n) => sum + project.demands[n], 0) * factor;
    const massKgS = powerKW / (cp * s.deltaC), massReturnKgS = powerKW / (cpReturn * s.deltaC);
    const family = familyFor(e), areaLimit = s.limits[e.area], requestedLimit = e.limitMmM ?? areaLimit, ambientC = e.ambientC ?? s.ambient[e.area];
    let limit = requestedLimit, limitRaised = false;
    const criterionValid=Number.isFinite(requestedLimit)&&requestedLimit>0&&Number.isFinite(ambientC);
    if (!criterionValid) warnings.push(`Correggi il limite positivo o la temperatura ambiente di ${e.from}-${e.to}.`);
    let chosen = null, largest = null;
    if (criterionValid && powerKW > 0) for (const size of family.sizes) {
      const supply = pipeHydraulics(massKgS, size.innerMm, family.roughnessMm, supplyC), ret = pipeHydraulics(massReturnKgS, size.innerMm, family.roughnessMm, returnC);
      largest = { size, supply, ret };
      if (Math.max(supply.gradientMmM, ret.gradientMmM) < limit) { chosen = { size, supply, ret }; break; }
    }
    if (criterionValid && powerKW > 0 && !chosen && largest) {
      chosen = largest;
      const gradient = Math.max(chosen.supply.gradientMmM, chosen.ret.gradientMmM);
      limit = (Math.floor(gradient * 100) + 1) / 100;
      limitRaised = true;
      warnings.push(`${e.from}-${e.to}: selezionato il diametro massimo DN ${chosen.size.dn}; limite aumentato automaticamente da ${requestedLimit.toLocaleString('it-IT')} a ${limit.toLocaleString('it-IT')} mm c.a./m.`);
    }
    if (chosen && Math.max(chosen.supply.velocityMS, chosen.ret.velocityMS) > 2) warnings.push(`${e.from}-${e.to}: velocità superiore a 2 m/s. Il criterio di scelta applicato è la sola perdita unitaria.`);
    const transition = chosen && [chosen.supply,chosen.ret].some(p => p.reynolds > 2000 && p.reynolds < 4000);
    if (transition) warnings.push(`${e.from}-${e.to}: regime di transizione; applicato il criterio del workbook, 64/Re sotto Re = 2.300 e Colebrook da Re = 2.300.`);
    const effectiveLengthM = e.lengthM * s.lengthFactor;
    const thermal = chosen ? heatLoss(chosen.size.uWmK, effectiveLengthM, supplyC, returnC, ambientC) : null;
    return { ...e, family, limit, requestedLimit, areaLimit, limitRaised, limitAboveArea: limit > areaLimit, ambientC, served, powerKW, massKgS, massReturnKgS, chosen, thermal, effectiveLengthM, pressureSupplyM: chosen ? chosen.supply.gradientMmM / 1000 * effectiveLengthM : null, pressureReturnM: chosen ? chosen.ret.gradientMmM / 1000 * effectiveLengthM : null, status: !criterionValid ? 'unavailable' : powerKW === 0 ? 'inactive' : chosen ? limitRaised ? 'limit-raised' : 'ok' : 'unavailable' };
  });
  const complete = rows.every(r => r.status !== 'unavailable'), thermalKW = rows.reduce((sum,r) => sum + (r.thermal?.totalKW || 0), 0);
  const demandWithLossKW = complete ? net.demandKW + thermalKW : null, marginKW = complete ? s.generatorKW - demandWithLossKW : null;
  if (complete && marginKW < 0 && s.generatorKW >= net.demandKW) warnings.push('La potenza disponibile copre le utenze, ma non la somma di utenze e dispersioni termiche stimate.');
  // Il circuito critico somma soltanto le tratte appartenenti al percorso della singola utenza.
  const byId = new Map(rows.map(r => [r.id,r])), paths = net.stations.map(station => {
    let n = `${station}T`, lossM = 0, ready = true;
    while (n !== 'C.C.') { const e = net.incoming.get(n), r = byId.get(e.id); if (r.status === 'unavailable') ready = false; lossM += (r.pressureSupplyM || 0) + (r.pressureReturnM || 0); n = e.from; }
    return { station, lossM: ready ? lossM : null };
  });
  const critical = paths.every(p => p.lossM !== null) ? paths.reduce((a,b) => !a || b.lossM > a.lossM ? b : a, null) : null;
  return { ok: true, errors: [], warnings, net, rows, designKW, factor, cp, cpReturn, supplyC, returnC, totalLengthM: rows.reduce((a,r) => a+r.lengthM,0), complete, thermalKW: complete ? thermalKW : null, demandWithLossKW, marginKW, paths, critical };
}
