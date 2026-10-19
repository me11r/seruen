#!/usr/bin/env python3
"""Bounded OSM footway extraction. No inferred connections or straight-line shortcuts."""
import argparse, json, urllib.request, urllib.parse, xml.etree.ElementTree as ET, math, datetime, pathlib, collections
ROOT=pathlib.Path(__file__).resolve().parent.parent
BBOX=[51.09,71.411,51.099,71.425]
QUERY='[out:xml][timeout:60];way["highway"~"^(footway|pedestrian|path|steps)$"](51.09,71.411,51.099,71.425);(._;>;);out body;'
p=argparse.ArgumentParser();p.add_argument('--input');p.add_argument('--source',default='https://overpass.private.coffee/api/interpreter');p.add_argument('--fetched-at');a=p.parse_args()
if a.input: raw=pathlib.Path(a.input).read_bytes()
else:
 req=urllib.request.Request(a.source,data=urllib.parse.urlencode({'data':QUERY}).encode(),headers={'User-Agent':'Seruen-Bulan/1.0 bounded walking prototype'})
 raw=urllib.request.urlopen(req,timeout=90).read()
r=ET.fromstring(raw)
if r.find('remark') is not None:raise ValueError('Incomplete OSM response')
tags=lambda el:{t.attrib['k']:t.attrib['v'] for t in el.findall('tag')}
forbidden={'private','no','customers','permit','military','destination'}
nodes={};blocked=set()
for n in r.findall('node'):
 id=n.attrib['id'];t=tags(n)
 nodes[id]={'id':id,'lat':float(n.attrib['lat']),'lon':float(n.attrib['lon'])}
 if t.get('access') in forbidden or t.get('foot') in forbidden or (t.get('barrier') in {'gate','fence','wall','turnstile'} and t.get('foot') not in {'yes','designated'}):blocked.add(id)
def inside(n):return BBOX[0]<=n['lat']<=BBOX[2] and BBOX[1]<=n['lon']<=BBOX[3]
edges=[];ways={};seen=set()
for w in r.findall('way'):
 t=tags(w);wid=w.attrib['id']
 if t.get('highway') not in {'footway','pedestrian','path','steps'} or t.get('area')=='yes' or t.get('indoor')=='yes' or t.get('access') in forbidden or t.get('foot') in forbidden or t.get('construction') or t.get('disused')=='yes':continue
 refs=[n.attrib['ref'] for n in w.findall('nd')]
 for x,y in zip(refs,refs[1:]):
  if x==y or x not in nodes or y not in nodes or x in blocked or y in blocked or not inside(nodes[x]) or not inside(nodes[y]):continue
  key=tuple(sorted([x,y]))
  if key in seen:continue
  seen.add(key);edges.append({'a':x,'b':y,'way':wid,'oneway':t.get('oneway:foot','no')});ways[wid]={'id':wid,'tags':t,'sourceUrl':f'https://www.openstreetmap.org/way/{wid}'}
adj=collections.defaultdict(list)
for e in edges:adj[e['a']].append(e['b']);adj[e['b']].append(e['a'])
components=[];seen=set()
for n in adj:
 if n in seen:continue
 todo=[n];comp=set()
 while todo:
  v=todo.pop()
  if v in seen:continue
  seen.add(v);comp.add(v);todo.extend(adj[v])
 components.append(comp)
keep=max(components,key=len)
edges=[e for e in edges if e['a'] in keep and e['b'] in keep];ways={e['way']:ways[e['way']] for e in edges}
anchors=[]
for id,lat,lon in [('west',51.0938,71.412),('east',51.0938,71.4225),('north',51.0975,71.417),('south',51.091,71.418)]:
 n=min((nodes[k] for k in keep),key=lambda n:(n['lat']-lat)**2+((n['lon']-lon)*.63)**2)
 anchors.append({'id':id,'node':n['id'],'lat':n['lat'],'lon':n['lon']})
result={'bbox':BBOX,'fetchedAt':a.fetched_at or datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':a.source,'query':QUERY,'license':'ODbL-1.0','attribution':'© OpenStreetMap contributors','coverage':'EXPO pedestrian network only; no NU campus interior','nodes':[nodes[k] for k in sorted(keep)],'edges':edges,'ways':list(ways.values()),'anchors':anchors,'validation':{'connectedComponentsBeforeSelection':len(components),'keptLargestComponent':True,'inventedEdges':0,'fieldSurvey':False}}
out=ROOT/'data/wind';out.mkdir(exist_ok=True)
(out/'network.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')))
(out/'query.overpassql').write_text(QUERY+'\n')
print(json.dumps({'nodes':len(keep),'edges':len(edges),'ways':len(ways),'anchors':anchors,'components':len(components)}))
