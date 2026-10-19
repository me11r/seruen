// Shared, deterministic prototype. Bearings: clockwise from north; windFrom is meteorological.
const radians=d=>d*Math.PI/180;
export const airDirection=from=>(from+180)%360;
export function meters(a,b){const x=radians(b.lat-a.lat),y=radians(b.lon-a.lon);return 12742000*Math.asin(Math.sqrt(Math.sin(x/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(y/2)**2));}
export function bearing(a,b){const x=radians(b.lon-a.lon),la=radians(a.lat),lb=radians(b.lat);return (Math.atan2(Math.sin(x)*Math.cos(lb),Math.cos(la)*Math.sin(lb)-Math.sin(la)*Math.cos(lb)*Math.cos(x))*180/Math.PI+360)%360;}
export function headwind(heading,windFrom){return Math.max(0,Math.cos(radians(heading-windFrom)));}
export function segmentCost(length,heading,wind,weight=1.2){return length/75*(1+weight*(Math.min(wind.speed,15)/8)**2*headwind(heading,wind.from)**2);}
export function makeGraph(data){const nodes=new Map(data.nodes.map(n=>[n.id,n])),adj=new Map(data.nodes.map(n=>[n.id,[]]));for(const e of data.edges){const a=nodes.get(e.a),b=nodes.get(e.b);if(!a||!b)continue;const length=meters(a,b);if(e.oneway!=='-1')adj.get(e.a).push({to:e.b,way:e.way,length,heading:bearing(a,b)});if(!['yes','1','true'].includes(e.oneway))adj.get(e.b).push({to:e.a,way:e.way,length,heading:bearing(b,a)});}return {nodes,adj};}
class Heap{constructor(){this.a=[];}push(v){const a=this.a;a.push(v);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p][0]<=v[0])break;a[i]=a[p];i=p;}a[i]=v;}pop(){const a=this.a,v=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1][0]<a[j][0])j++;if(a[j][0]>=last[0])break;a[i]=a[j];i=j;}a[i]=last;}return v;}get size(){return this.a.length;}}
export function shortest(graph,start,end,wind,weight=0){const cost=new Map([[start,0]]),prev=new Map(),heap=new Heap();heap.push([0,start]);while(heap.size){const [v,n]=heap.pop();if(v!==cost.get(n))continue;if(n===end)break;for(const e of graph.adj.get(n)||[]){const d=v+segmentCost(e.length,e.heading,wind,weight);if(d<(cost.get(e.to)??Infinity)){cost.set(e.to,d);prev.set(e.to,{from:n,...e});heap.push([d,e.to]);}}}if(!cost.has(end))return null;const segments=[];let n=end;while(n!==start){const e=prev.get(n);if(!e)return null;segments.push(e);n=e.from;}segments.reverse();return {nodes:[start,...segments.map(e=>e.to)],segments};}
function measure(paths,wind){const segments=paths.flatMap((p,i)=>p.segments.map(e=>({...e,leg:i,headwind:headwind(e.heading,wind.from),against:wind.speed>=1&&headwind(e.heading,wind.from)>.5})));const length=segments.reduce((s,e)=>s+e.length,0);return {paths,segments,length,minutes:length/75,cost:segments.reduce((s,e)=>s+segmentCost(e.length,e.heading,wind),0),headwindMeters:segments.filter(e=>e.against).reduce((s,e)=>s+e.length,0)};}
export function compareRoutes(data,{start,end,speed=8,from=0,roundTrip=true}){
 if(!Number.isFinite(speed)||speed<0||speed>100||!Number.isFinite(from)||from<0||from>=360||start===end)throw Error('INVALID_WIND_INPUT');
 const graph=makeGraph(data),wind={speed,from};const out=shortest(graph,start,end,wind),back=roundTrip?shortest(graph,end,start,wind):null;if(!out||(roundTrip&&!back))throw Error('NO_ROUTE');
 const fastest=measure(roundTrip?[out,back]:[out],wind);
 // Diverse candidate paths from the real graph, not invented alternatives. No global optimality claim.
 const candidates=(a,b)=>{const unique=new Map();for(const weight of [0,.3,.7,1.2,2.5,5]){const p=shortest(graph,a,b,wind,weight);if(p)unique.set(p.nodes.join(','),p);}return [...unique.values()];};
 const outward=candidates(start,end),returning=roundTrip?candidates(end,start):[null];
 const maxLength=Math.min(fastest.length*1.25,fastest.length+300);let considered=0;let best=fastest;
 for(const a of outward)for(const b of returning){const option=measure(b?[a,b]:[a],wind);if(option.length>maxLength+.001)continue;considered++;if(option.cost<best.cost-1e-8||(Math.abs(option.cost-best.cost)<1e-8&&option.length<best.length))best=option;}
 const same=best.paths.map(p=>p.nodes.join(',')).join('|')===fastest.paths.map(p=>p.nodes.join(',')).join('|');
 return {fastest,windAware:best,same,considered,wind:{...wind,to:airDirection(from)},roundTrip,maxLength,method:{walkMetersPerMinute:75,maxExtraMeters:300,maxLengthRatio:1.25,weight:1.2,headwindThreshold:.5}};
}
