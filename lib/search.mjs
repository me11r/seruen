export const rad = x => x * Math.PI / 180;
export function distance(a,b) { const dlat=rad(b.lat-a.lat), dlon=rad(b.lon-a.lon); return 6371*2*Math.asin(Math.sqrt(Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2)); }
export function parseIntent(query, previous={}) {
 const q=query.toLowerCase(); const next={minutes:60,interest:'any',indoor:false,budget:'any',closer:false,...previous};
 const time=q.match(/(\d{1,3})\s*(?:мин|minute|min|мину|минут)/); if(time) next.minutes=Math.max(10,Math.min(180,+time[1]));
 if(/коф|coffee|cafe|кафе|оқу|study|уч[её]б/.test(q)) next.interest='cafe';
 if(/парк|park|табиғат|прогул|серуен|walk/.test(q)) next.interest='walk';
 if(/музей|museum|мұражай/.test(q)) next.interest='museum';
 if(/помещ|indoor|ішінде|ғимарат/.test(q)) next.indoor=true;
 if(/на улице|outdoor|далада/.test(q)) next.indoor=false;
 if(/дешев|арзан|cheap|бюджет|budget/.test(q)) next.budget='low';
 if(/бесплат|тегін|free|0\s*(?:₸|тенге|теңге)/.test(q)) next.budget='free';
 if(/ближе|жақын|closer/.test(q)) next.closer=true;
 if(/любое|any category|кез келген/.test(q)) next.interest='any';
 return next;
}
const terms = s => String(s).toLowerCase().match(/[\p{L}\p{N}]+/gu)||[];
export function retrieve(places,position,intent,query) {
 const queryTerms=terms(query); const docs=places.map(p=>terms([p.name,p.description,p.category,...Object.values(p.tags||{})].join(' ')));
 const df=new Map(); for(const d of docs) for(const t of new Set(d)) df.set(t,(df.get(t)||0)+1);
 const avg=docs.reduce((s,d)=>s+d.length,0)/Math.max(1,docs.length);
 return places.map((p,i)=>{
  const km=distance(position,p); const walking=Math.ceil(km*1.35/4.5*60); const visit=p.category==='museum'?35:p.category==='cafe'?20:15;
  let lexical=0; for(const t of queryTerms){const f=docs[i].filter(w=>w===t).length; if(f) lexical+=Math.log(1+(places.length-(df.get(t)||0)+.5)/((df.get(t)||0)+.5))*f*2.2/(f+1.2*(.25+.75*docs[i].length/avg));}
  return {...p,distanceKm:+km.toFixed(2),walkingMinutes:walking,visitMinutes:visit,totalMinutes:walking*2+visit,score:lexical+4/(1+km)-(intent.closer?km*3:0)+(intent.budget==='low'&&p.category==='park'?3:0)};
 }).filter(p=>p.totalMinutes<=intent.minutes && p.distanceKm<= (intent.closer?1.5:5))
 .filter(p=>intent.interest==='any'||(intent.interest==='walk'?['park','attraction','mall'].includes(p.category):p.category===intent.interest))
 .filter(p=>!intent.indoor||['cafe','museum','mall','library'].includes(p.category))
 .filter(p=>intent.budget!=='free'||p.tags?.fee==='no')
 .filter(p=>!['private','no','customers','permit'].includes(p.tags?.access))
 .sort((a,b)=>b.score-a.score).slice(0,6);
}
export const copy={
 kk:{why:'Таңдалған санатқа және уақыт шектеуіне сәйкес келеді.',idea:'Айналаға асықпай көз жүгіртіп, қысқа үзіліс жасаңыз.',cafe:'Кофе алып, оқуға уақыт бөліп көріңіз. Тыныштық пен розетканы қызметкерден нақтылаңыз.',park:'Саябақтың көпшілікке ашық бөлігінде 15 минут серуендеп, бастапқы орынға қайтыңыз.',museum:'Кіреберісте жұмыс уақытын және билет бағасын анықтап, экспозицияны көріңіз.',empty:'Осы шектеулерге сай орын табылмады. Уақытты ұзартыңыз, санатты немесе бюджетті өзгертіңіз.',summary:'Уақытқа сай жақын орындар. Әр нұсқа — жеке жоспар, орындарды бірге аралау бағыты емес.'},
 ru:{why:'Соответствует выбранной категории и ограничению времени.',idea:'Осмотритесь и сделайте небольшую паузу.',cafe:'Возьмите кофе и попробуйте немного позаниматься. Тишину и розетки уточните у сотрудников.',park:'Выделите 15 минут на прогулку по общедоступной части парка, затем возвращайтесь к начальной точке.',museum:'Уточните часы работы и стоимость входа, затем осмотрите экспозицию.',empty:'Подходящих мест с такими ограничениями не найдено. Увеличьте время, измените категорию или бюджет.',summary:'Места поблизости, подходящие по времени. Каждая карточка — отдельный план, а не общий маршрут.'},
 en:{why:'Matches your selected category and time limit.',idea:'Take a look around and enjoy a short break.',cafe:'Have a coffee and try a short study session. Ask staff about quiet seating and power outlets.',park:'Spend 15 minutes walking in the publicly accessible part of the park, then return to your starting point.',museum:'Check opening hours and admission at the entrance, then explore the exhibition.',empty:'No places match these constraints. Allow more time or change the category or budget.',summary:'Nearby places that fit your time. Each card is a separate plan, not a multi-stop route.'}
};
export function fallback(candidates,language){const t=copy[language];return {summary:candidates.length?t.summary:t.empty,recommendations:candidates.slice(0,3).map(p=>({id:p.id,why:t.why+' '+({kk:`Шамамен ${p.totalMinutes} минут, түзу қашықтық ${p.distanceKm} км.`,ru:`Около ${p.totalMinutes} минут на весь план; ${p.distanceKm} км по прямой.`,en:`About ${p.totalMinutes} minutes for the full plan; ${p.distanceKm} km in a straight line.`}[language]),idea:t[p.category]||t.idea}))};}
