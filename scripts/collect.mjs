/** Reproducible, bounded OSM collection. Node >=20; no dependencies. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mapBbox = '71.394,51.084,71.425,51.102';
const endpoint = process.env.OVERPASS_URL || 'https://overpass.private.coffee/api/interpreter';
const decode = value => value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function xmlToElements(xml) {
  const attrs = s => Object.fromEntries([...s.matchAll(/([\w:]+)="([^"]*)"/g)].map(m => [m[1], decode(m[2])]));
  const nodes = new Map();
  for (const m of xml.matchAll(/<node\s+([^>]*?)(?:\/>|>[\s\S]*?<\/node>)/g)) {
    const a = attrs(m[1]); nodes.set(a.id, { lat: +a.lat, lon: +a.lon });
  }
  const elements = [];
  for (const m of xml.matchAll(/<(node|way)\s+([^>]*?[^/])>([\s\S]*?)<\/\1>/g)) {
    const a = attrs(m[2]);
    const tags = Object.fromEntries([...m[3].matchAll(/<tag\s+([^>]*?)\/>/g)].map(x => { const t = attrs(x[1]); return [t.k, t.v]; }));
    const refs = [...m[3].matchAll(/<nd\s+ref="(\d+)"\s*\/>/g)].map(x => nodes.get(x[1])).filter(Boolean);
    const center = refs.length ? { lat: (Math.min(...refs.map(p => p.lat)) + Math.max(...refs.map(p => p.lat))) / 2, lon: (Math.min(...refs.map(p => p.lon)) + Math.max(...refs.map(p => p.lon))) / 2 } : undefined;
    elements.push({ type: m[1], id: +a.id, ...(m[1] === 'node' ? nodes.get(a.id) : { center }), tags });
  }
  if (!xml.includes('<osm ') || !elements.length) throw new Error('Invalid OSM XML');
  return { elements };
}
// Small EXPO/Mega area; one request, not a global scrape.
const bbox = '51.084,71.394,51.102,71.425';
const query = `[out:json][timeout:90];(nwr["amenity"~"^(cafe|library)$"]["name"](${bbox});nwr["leisure"="park"]["name"](${bbox});nwr["tourism"~"^(museum|attraction)$"]["name"](${bbox});nwr["shop"="mall"]["name"](${bbox}););out center tags;`;
await mkdir(resolve(root, 'data'), { recursive: true });
await writeFile(resolve(root, 'data/query.overpassql'), query + '\n');
const importFile = process.argv[2];
let raw;
let importedXml = false;
if (importFile) {
  // Supports curl with OS-managed proxies or transport restrictions.
  const content = await readFile(importFile, 'utf8');
  importedXml = content.trimStart().startsWith('<');
  raw = importedXml ? xmlToElements(content) : JSON.parse(content);
} else {
  const response = await fetch(endpoint, {
    method: 'POST', body: new URLSearchParams({ data: query }),
    headers: { 'User-Agent': 'Seruen-Bulan-Hackathon/1.0 (small educational OSM snapshot)' },
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`Overpass HTTP ${response.status}; existing snapshot was not overwritten.`);
  raw = await response.json();
}
if (!Array.isArray(raw.elements) || raw.remark) throw new Error(`Invalid/incomplete Overpass response: ${raw.remark || 'missing elements'}`);
const fetchedAt = new Date().toISOString();
const categories = { cafe: 'cafe', library: 'library', park: 'park', museum: 'museum', attraction: 'attraction', mall: 'mall' };
const forbidden = new Set(['no', 'private', 'customers', 'permit', 'military']);
const places = raw.elements.flatMap(e => {
  const tags = e.tags || {};
  if (forbidden.has(tags.access) || tags.disused === 'yes' || tags.abandoned === 'yes') return [];
  const category = categories[tags.amenity] || categories[tags.leisure] || categories[tags.tourism] || categories[tags.shop];
  const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
  if (!category || !tags.name || !Number.isFinite(lat) || !Number.isFinite(lon)) return [];
  // Conservatively exclude campus POIs: public access has not been verified.
  if (lat < 51.094 && lon < 71.403) return [];
  // OSM can describe the same mall as a node and a polygon. Prefer the polygon.
  if (e.type === 'node' && category === 'mall' && raw.elements.some(other => other.type === 'way' && other.tags?.shop === 'mall' && other.center && Math.hypot((other.center.lat - lat) * 111000, (other.center.lon - lon) * 70000) < 100)) return [];
  return [{ id: `osm-${e.type}-${e.id}`, name: tags.name, lat, lon, category, tags,
    description: `${tags.name}. OSM category: ${category}. Derived from source tags; no additional amenities inferred.`,
    descriptionType: 'derived-from-osm-tags', sourceUrl: `https://www.openstreetmap.org/${e.type}/${e.id}`,
    fetchedAt, openingHours: tags.opening_hours || null }];
}).sort((a, b) => a.id.localeCompare(b.id));
if (!places.length) throw new Error('No valid POIs; existing snapshot was not overwritten.');
await writeFile(resolve(root, 'data/places.json'), JSON.stringify(places, null, 2) + '\n');
await writeFile(resolve(root, 'data/provenance.json'), JSON.stringify({
  provider: 'OpenStreetMap contributors', endpoint: importedXml ? `https://api.openstreetmap.org/api/0.6/map?bbox=${mapBbox}` : endpoint, fetchedAt,
  osmBaseTimestamp: raw.osm3s?.timestamp_osm_base ?? null,
  license: 'ODbL-1.0', licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
  attribution: '© OpenStreetMap contributors', attributionUrl: 'https://www.openstreetmap.org/copyright',
  query: importedXml ? `OSM API map bbox=${mapBbox}; local category filtering` : query, rawElementCount: raw.elements.length, recordCount: places.length,
  derivation: 'Named cafes, libraries, parks, museums, attractions and malls. Restricted access/disused records and unverified NU campus interior excluded. Duplicate mall nodes within 100m of a mall polygon excluded. Polygon coordinates are bounding-box centers, not entrances. Descriptions derived only from tags.',
  transport: importFile ? 'Imported actual OSM response via file' : 'Native Node fetch',
}, null, 2) + '\n');
console.log(`Collected ${places.length} real OSM records at ${fetchedAt}.`);
