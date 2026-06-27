
const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE  = 'https://archive-api.open-meteo.com/v1/archive';
const MAX_MEMORY_CELLS = 50;

const weatherCache = new Map(); // (key:str, hourly[24])
let currentWeatherKey = null;   // the active lat/lon/date key(str)

function makeKey(lat, lon, dateStr) {
  return `${lat.toFixed(4)},${lon.toFixed(4)},${dateStr}`;
}

export function makeDateStr(year, month, day) {
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function evictMemory() {
  while (weatherCache.size > MAX_MEMORY_CELLS) {
    const oldestKey = weatherCache.keys().next().value;
    weatherCache.delete(oldestKey);
  }
}

/**
 * One-shot fetch for exact lat/lon
 */
async function fetchWeatherExact(lat, lon, year, month, day) {
  const dateStr  = makeDateStr(year, month, day);
  const today    = new Date(); today.setHours(0,0,0,0);
  const diffDays = Math.round((new Date(year, month-1, day) - today) / 86400000);
  const baseUrl  = diffDays < -5 ? ARCHIVE : FORECAST;

  const url = `${baseUrl}?latitude=${lat}&longitude=${lon}`
    + `&hourly=direct_normal_irradiance,diffuse_radiation,shortwave_radiation,temperature_2m,surface_pressure,cloud_cover`
    + `&start_date=${dateStr}&end_date=${dateStr}&timezone=UTC`;

  const r = await fetch(url);
  if (!r.ok) throw new Error(`Open-Meteo ${r.status}`);
  const data = await r.json();
  const h = data.hourly;

  return h.time.map((_, i) => ({
    dni:        h.direct_normal_irradiance[i] ?? 0,
    dhi:        h.diffuse_radiation[i]        ?? 0,
    ghi:        h.shortwave_radiation[i]      ?? 0,
    temp:       h.temperature_2m[i]           ?? 15,
    pressure:   h.surface_pressure[i]         ?? 1013,
    cloudCover: h.cloud_cover[i]              ?? null,
  }));
}

/**
 * Synchronous memread (fuck browsers)
 */
export function getWeather(lat, lon, localHour, utcOffset, dateStr) {
  const key = makeKey(lat, lon, dateStr);
  const hourly = weatherCache.get(key);
  if (!hourly) return null;
  const utcHour = ((localHour - Math.round(utcOffset)) % 24 + 24) % 24;
  return hourly[utcHour] ?? null;
}

/**
 * Clear weatherCache on date change 
 */
export function invalidateWeather() {
  weatherCache.clear();
  currentWeatherKey = null;
  setWeatherButton('idle');
}

/**
 * Button states
 */
function setWeatherButton(state, msg = '') {
  const btn = document.getElementById('weather-btn');
  const err = document.getElementById('weather-btn-error');
  if (!btn) return;

  switch (state) {
    case 'idle':
      btn.disabled = false;
      btn.textContent = 'Adjust by weather';
      btn.style.opacity = '1';
      if (err) err.textContent = '';
      break;
    case 'loading':
      btn.disabled = true;
      btn.textContent = '⟳ Fetching…';
      btn.style.opacity = '0.6';
      if (err) err.textContent = '';
      break;
    case 'done':
      btn.disabled = false;
      btn.textContent = `${msg}`;
      btn.style.opacity = '1';
      if (err) err.textContent = '';
      break;
    case 'error':
      btn.disabled = false;
      btn.textContent = 'Adjust by weather';
      btn.style.opacity = '1';
      if (err) err.textContent = msg;
      break;
  }
}

/**
 * 
 */
export function initWeatherButton(runAll, getState) {
  const btn = document.getElementById('weather-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const state = getState();
    const dateStr = makeDateStr(state.year, state.month, state.day);
    const key = makeKey(state.lat, state.lon, dateStr);
    if (weatherCache.has(key)) {
      setWeatherButton('done', key);
      return;
    }

    setWeatherButton('loading');
    try {
      const hourly = await fetchWeatherExact(
        state.lat, state.lon,
        state.year, state.month, state.day
      );
      weatherCache.set(key, hourly);
      currentWeatherKey = key;
      evictMemory();
      setWeatherButton('done', key);
      await runAll();
    } catch(e) {
      console.error('Weather fetch failed:', e);
      setWeatherButton('error', e.message.includes('429')
        ? 'Rate limited, try again in a minute'
        : `Failed: ${e.message}`
      );
    }
  });
}