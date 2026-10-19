export const WEATHER_URL='https://api.open-meteo.com/v1/forecast?latitude=51.094&longitude=71.418&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=UTC';
export function parseWeather(body,now=Date.now()){
 const c=body.current,u=body.current_units;const at=Date.parse(c?.time+'Z');
 if(u?.wind_speed_10m!=='m/s'||u?.wind_direction_10m!=='°'||!Number.isFinite(c?.wind_speed_10m)||c.wind_speed_10m<0||c.wind_speed_10m>100||!Number.isFinite(c?.wind_direction_10m)||c.wind_direction_10m<0||c.wind_direction_10m>360||!Number.isFinite(at)||Math.abs(now-at)>90*60000)throw Error('WEATHER_INVALID_OR_STALE');
 return {speed:c.wind_speed_10m,from:c.wind_direction_10m%360,at:new Date(at).toISOString(),fetchedAt:new Date(now).toISOString(),source:'Open-Meteo',sourceUrl:'https://open-meteo.com/',kind:'forecast',heightMeters:10,location:{lat:51.094,lon:71.418}};
}
let cached=null,inflight=null;
export async function getWeather(){if(cached&&Date.now()-cached.cachedAt<10*60000)return cached.value;if(inflight)return inflight;inflight=(async()=>{const r=await fetch(WEATHER_URL,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('WEATHER_UNAVAILABLE');const value=parseWeather(await r.json());cached={value,cachedAt:Date.now()};return value;})();try{return await inflight;}finally{inflight=null;}}
