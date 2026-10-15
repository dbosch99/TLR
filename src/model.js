import { CATALOG } from '../data/catalog.js';
export const FAMILY = { steel: 'pipe-1', buried: 'pipe-5', floor: 'pipe-3' };
export const AREAS = { buried: 'Interrato', plant: 'Centrale / sottostazione', floor: 'Pavimento' };
export const uid = () => globalThis.crypto.randomUUID();
export const normalize = s => String(s ?? '').replace(/\s/g, '').toUpperCase();
export function number(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const s = String(value).trim().replace(/\s/g, '');
  const parsed = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(parsed) ? parsed : null;
}
export function defaultArea(from, to) {
  return from === 'C.C.' || /^S\d+$/.test(from) && to === `${from}T` ? 'plant' : 'buried';
}
export function edge(from = '', to = '', lengthM = null) {
  return { id: uid(), from, to, lengthM, area: defaultArea(from, to), familyId: null, limitMmM: null, ambientC: null };
}
export function newProject() {
  return { app: 'tlr-dimensionamento', version: 1, name: 'Nuova rete', settings: { generatorKW: 350, supplyC: 85, deltaC: 20, lengthFactor: 1.1, limits: { buried: 10, plant: 30, floor: 20 }, ambient: { buried: 10, plant: 20, floor: 20 } }, edges: [], demands: {} };
}
export function exampleProject() {
  const p = newProject(); p.name = 'Rete di esempio · 3 sottostazioni';
  p.edges = [['C.C.','B.C.',10], ['B.C.','S1',411.7401], ['S1','S1T',7.5], ['B.C.','N1',439.1017], ['N1','S2',47.4734], ['S2','S2T',7.5], ['N1','S3',404.4316], ['S3','S3T',7.5]].map(e => edge(...e));
  p.demands = { S1: 47, S2: 22.3576893982743, S3: 140.202438403418 };
  return p;
}
export function stationNames(project) {
  return [...new Set(project.edges.flatMap(e => [normalize(e.from), normalize(e.to)]).map(n => /^S[1-9]\d*T?$/.test(n) ? n.replace(/T$/, '') : '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it', { numeric: true }));
}
export function familyFor(e) { return CATALOG.families.find(f => f.id === (e.familyId || FAMILY[e.area === 'plant' ? 'steel' : e.area])); }
export function parseProject(input) {
  if (!input || input.app !== 'tlr-dimensionamento' || input.version !== 1) throw new Error('Il file non è un progetto TLR compatibile (versione 1).');
  if (!Array.isArray(input.edges) || input.edges.length > 500 || !input.settings || typeof input.demands !== 'object' || !input.demands) throw new Error('Struttura del progetto non valida.');
  const p = newProject();
  p.name = String(input.name || 'Progetto importato').slice(0, 120);
  for (const key of ['generatorKW','supplyC','deltaC','lengthFactor']) p.settings[key] = number(input.settings[key]);
  for (const area of Object.keys(AREAS)) {
    p.settings.limits[area] = number(input.settings.limits?.[area]);
    p.settings.ambient[area] = number(input.settings.ambient?.[area]);
  }
  p.edges = input.edges.map(e => {
    if (!e || !Object.hasOwn(AREAS, e.area)) throw new Error('Ambito della tratta non valido.');
    if (e.familyId && !CATALOG.families.some(f => f.id === e.familyId)) throw new Error('Il progetto usa una famiglia di tubi non disponibile.');
    return { ...edge(), from: normalize(e.from).slice(0,20), to: normalize(e.to).slice(0,20), lengthM: number(e.lengthM), area: e.area, familyId: e.familyId || null, limitMmM: number(e.limitMmM), ambientC: number(e.ambientC) };
  });
  p.demands = Object.fromEntries(stationNames(p).map(n => [n, number(Object.hasOwn(input.demands, n) ? input.demands[n] : null)]));
  return p;
}
