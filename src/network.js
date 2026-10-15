import { normalize, stationNames, AREAS, familyFor } from './model.js';
const NODE = /^(C\.C\.|B\.C\.|N[1-9]\d*|S[1-9]\d*T?)$/;
export function analyzeNetwork(project) {
  const errors = [], outgoing = new Map(), incoming = new Map(), edges = project.edges.map(e => ({ ...e, from: normalize(e.from), to: normalize(e.to) }));
  const fail = message => { if (!errors.includes(message)) errors.push(message); };
  if (!edges.length) fail('Inserisci le tratte della rete, iniziando da C.C.-B.C.');
  const seen = new Set();
  edges.forEach((e, i) => {
    const label = `Tratta ${i+1}`;
    if (!NODE.test(e.from) || !NODE.test(e.to)) fail(`${label}: usa C.C., B.C., N1, S1, S1T, ecc. (numeri senza zeri iniziali).`);
    if (e.from === e.to) fail(`${label}: i due nodi devono essere diversi.`);
    if (!(Number.isFinite(e.lengthM) && e.lengthM > 0)) fail(`${label}: inserisci una lunghezza positiva.`);
    if (!Object.hasOwn(AREAS, e.area) || !familyFor(e)) fail(`${label}: scegli un ambito e una famiglia di tubi validi.`);
    if (seen.has(`${e.from}|${e.to}`)) fail(`Collegamento ripetuto: ${e.from}-${e.to}.`);
    seen.add(`${e.from}|${e.to}`);
    if (incoming.has(e.to)) fail(`Il nodo ${e.to} riceve due collegamenti: sono ammesse solo reti ramificate senza maglie.`);
    incoming.set(e.to, e);
    if (!outgoing.has(e.from)) outgoing.set(e.from, []);
    outgoing.get(e.from).push(e);
  });
  const nodes = new Set(edges.flatMap(e => [e.from, e.to]));
  if (incoming.has('C.C.')) fail('C.C. deve essere il nodo iniziale della rete.');
  const roots = outgoing.get('C.C.') || [];
  if (edges.length && (roots.length !== 1 || roots[0].to !== 'B.C.')) fail('La rete deve iniziare con la sola tratta C.C.-B.C.');
  const active = new Set(), visited = new Set();
  function visit(n) {
    if (active.has(n)) { fail(`La rete contiene un circuito chiuso in ${n}.`); return; }
    if (visited.has(n)) return;
    active.add(n);
    for (const e of outgoing.get(n) || []) visit(e.to);
    active.delete(n); visited.add(n);
  }
  visit('C.C.');
  if ([...nodes].some(n => !visited.has(n))) fail('Sono presenti nodi scollegati dalla centrale. Verifica i collegamenti.');
  const stations = stationNames(project);
  if (edges.length && !stations.length) fail('La rete deve alimentare almeno una sottostazione S1, S2, ecc.');
  for (const n of nodes) {
    const next = outgoing.get(n) || [];
    if (/^S\d+T$/.test(n)) {
      if (next.length) fail(`${n} deve essere un punto terminale.`);
      if (incoming.get(n)?.from !== n.slice(0,-1)) fail(`${n} deve essere collegato alla sua sottostazione ${n.slice(0,-1)}.`);
    } else if (/^S\d+$/.test(n)) {
      if (next.length !== 1 || next[0].to !== `${n}T`) fail(`Aggiungi la tratta terminale ${n}-${n}T; una sottostazione non è un nodo di diramazione.`);
    } else if (!next.length) fail(`Il nodo ${n} termina senza alimentare una sottostazione.`);
  }
  for (const n of stations) if (!(Number.isFinite(project.demands[n]) && project.demands[n] >= 0)) fail(`Inserisci il fabbisogno termico di ${n} (zero è ammesso).`);
  const demandKW = stations.reduce((sum, n) => sum + (Number.isFinite(project.demands[n]) ? project.demands[n] : 0), 0);
  if (stations.length && demandKW <= 0) fail('Il fabbisogno complessivo delle sottostazioni deve essere maggiore di zero.');
  if (errors.length) return { errors, edges, stations, nodes, outgoing, incoming, demandKW };
  const downstream = new Map();
  function served(n) {
    if (downstream.has(n)) return downstream.get(n);
    const values = /^S\d+T$/.test(n) ? [n.slice(0,-1)] : [...new Set((outgoing.get(n)||[]).flatMap(e => served(e.to)))];
    downstream.set(n, values); return values;
  }
  served('C.C.');
  return { errors, edges, stations, nodes, outgoing, incoming, demandKW, downstream };
}
