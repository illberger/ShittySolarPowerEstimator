import { orientationFactor, computePOA, spa, d2r, r2d } from './spa.js';
import { optimizeAtIndex, optimizeDay } from './optimum.js';
import { initWeatherButton, getWeather, invalidateWeather, makeDateStr } from './weather.js'

let earthGroup;
let marker, ring, arrowHelper, sunSphere, globe, sunMat, corona, coronaMat, stockholm, helsinki;
let sunLight, sunGlow;
let renderer, scene, camera;
let cloudTexture, cloudCanvas, cloudCtx;
let lastOptKey = null;
let lastSunKey = null;

let touchMode = null; // 'rotate' || 'zoom'
let lastTouchDist = 0;


function shouldSun(state){
  const key = `${state.year}-${state.month}-${state.day}-${state.hour}`;
  if (key === lastSunKey) return false;
  lastSunKey = key;
  return true;
}

function shouldRecompute(state) {
  const key = `${state.lat}-${state.lon}-${state.slope}-${state.panAzm}-${state.year}-${state.month}-${state.day}-${state.hour}`;
  if (key === lastOptKey) return false;
  lastOptKey = key;
  return true;
}

function syncPanelSliders() {
  if (!autoOpt) return;
  document.getElementById('panazm-slider').value = state.panAzm;
  document.getElementById('slope-slider').value = state.slope; 
}

/**
 * input helper
 */
function sanitize(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function latLonToVec3(lat, lon, r = 1.02) {
  const phi = d2r(90 - lat);
  const theta = d2r(-lon);

  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

function initSidebarToggle() {
  const toggle   = document.getElementById('sidebar-toggle');
  const sidebar  = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');

  function open()  { sidebar.classList.add('open');  backdrop.classList.add('open');  }
  function close() { sidebar.classList.remove('open'); backdrop.classList.remove('open'); }

  toggle.addEventListener('click', () =>
    sidebar.classList.contains('open') ? close() : open()
  );
  backdrop.addEventListener('click', close);
  document.querySelectorAll('.location-result-item').forEach(el =>
    el.addEventListener('click', close)
  );
}

// #region geocode
function initGeocoder() {
  let searchTimeout = null;
  const locSearch = document.getElementById('location-search');
  const locResults = document.getElementById('location-results');

  locSearch.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const q = locSearch.value.trim();
    if (q.length < 3) { locResults.classList.remove('open'); return; }
    searchTimeout = setTimeout(() => geocode(q), 400);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.location-search')) locResults.classList.remove('open');
  });

  async function geocode(q) {
    try {
      const sanitizedQ = q.replace(/[^a-zA-Z0-9\s,.'-]/g, '');
      if (sanitizedQ.length < 3) return;

      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(sanitizedQ)}&limit=3`);
      if (!r.ok) throw new Error(r.status);

      const data = await r.json();
      locResults.innerHTML = '';

      if (!data.length) {
        const noResults = document.createElement('div');
        noResults.className = 'location-result-item';
        noResults.textContent = 'No results';
        locResults.appendChild(noResults);
        locResults.classList.add('open');
        return;
      }

      data.forEach(item => {
        const d = document.createElement('div');
        d.className = 'location-result-item';
    
        const nameSpan = document.createElement('span');
        nameSpan.className = 'name';
        const locationName = item.display_name.split(',').slice(0, 2).join(',');
        nameSpan.textContent = locationName;
   
        const coordsSpan = document.createElement('span');
        coordsSpan.className = 'coords';
        
        const lmao = " "
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
   
        if (isNaN(lat) || isNaN(lon)) return;
        
        coordsSpan.textContent = `${lmao}, ${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
        
        d.appendChild(nameSpan);
        d.appendChild(coordsSpan);
        
        d.addEventListener('click', () => {
          setLocation(lat, lon);
          locSearch.value = locationName;
          locResults.classList.remove('open');
          runAll();
        });
        
        locResults.appendChild(d);
      });

      locResults.classList.add('open');
    } catch(e) {
      console.warn('Geocode failed:', e);
      locResults.innerHTML = '';
      const errorDiv = document.createElement('div');
      errorDiv.className = 'location-result-item';
      errorDiv.textContent = 'Search failed. Please try again.';
      locResults.appendChild(errorDiv);
      locResults.classList.add('open');
    }
  }
}
function setLocation(lat, lon) {
  document.getElementById('lat-slider').value = lat;
  document.getElementById('lon-slider').value = lon;
  document.getElementById('lat-display').textContent = lat.toFixed(2) + '°';
  document.getElementById('lon-display').textContent = lon.toFixed(2) + '°';
  setLatLon(lat, lon);
}
// #endregion

// #region 3D Scene

async function loadCountries() {
  try {
    const r = await fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson');
    const geo = await r.json();
    const mat = new THREE.LineBasicMaterial({color:0x4488aa,transparent:false,opacity:0.3});
    geo.features.forEach(feature=>{  // root field
      const geom=feature.geometry;  // {blabla:..., coordinates:{[],[],[]}... }
      const polys=geom.type==='Polygon'?[geom.coordinates]:geom.coordinates; // {[],[],[]}
      polys.forEach(poly=>{
        poly.forEach(ring=>{
          const points=ring.map(([lon,lat])=>latLonToVec3(lat,lon,1.002));
          earthGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),mat));
        });
      });
    });
  } catch(e) {
    console.warn('Failed to load country borders:', e);
  }
}

// #region CLOUD
/*
function updateCloudTexture(localHour, utcOffset) {
  const w = cloudCanvas.width;
  const h = cloudCanvas.height;
  cloudCtx.clearRect(0, 0, w, h);

  // Fuck this
  // const clouds = getCloudState(localHour, utcOffset);
  console.log(clouds);
  if (!clouds.length) { cloudTexture.needsUpdate = true; return; }

  const spreadDeg = GRID_RES * 3.0;
  const spreadX = (spreadDeg / 360) * w;
  const spreadY = (spreadDeg / 180) * h;

  for (const c of clouds) {
    const alpha = (c.cloud ?? 0) / 100;
    if (alpha <= 0.01) continue;

    const cx = ((c.lon + 180) / 360) * w;
    const cy = ((90 - c.lat) / 180) * h;

    const grad = cloudCtx.createRadialGradient(cx, cy, 0, cx, cy, spreadX);
    grad.addColorStop(0,   `rgba(255, 255, 255, ${alpha})`);
    grad.addColorStop(0.6, `rgba(255, 255, 255, ${alpha * 0.5})`);
    grad.addColorStop(1,   `rgba(255, 255, 255, 0)`);

    cloudCtx.fillStyle = grad;
    cloudCtx.beginPath();
    cloudCtx.ellipse(cx, cy, spreadX, spreadY, 0, 0, Math.PI * 2);
    cloudCtx.fill();
  }

  cloudTexture.needsUpdate = true;
}
  */
// #endregion

/**
 * Main 3D entry point
 */
function initGlobe() {
  const container = document.getElementById('globe-container');
  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 100);
  camera.position.set(0, 0, 3);

  earthGroup = new THREE.Group();
  scene.add(earthGroup);
  const texCanvas = document.createElement('canvas');
  texCanvas.width=1024; texCanvas.height=512;
  const tc = texCanvas.getContext('2d');
  tc.fillStyle='#0d2b4e';
  tc.fillRect(0,0,1024,512);
  tc.strokeStyle='rgba(100,150,255,0.08)';
  tc.lineWidth=1;
  for(let i=0;i<12;i++){const x=i/12*1024;tc.beginPath();tc.moveTo(x,0);tc.lineTo(x,512);tc.stroke();}
  for(let i=0;i<6;i++){const y=i/6*512;tc.beginPath();tc.moveTo(0,y);tc.lineTo(1024,y);tc.stroke();}

  globe = new THREE.Mesh(
    new THREE.SphereGeometry(1.0,64,64), // 1
    new THREE.MeshPhongMaterial({map:new THREE.CanvasTexture(texCanvas),shininess:15,specular:new THREE.Color(0x112244)})
  );
  earthGroup.add(globe);
  earthGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(1.03,32,32),
    new THREE.MeshPhongMaterial({color:0x3366ff,transparent:true,opacity:0.06,side:THREE.FrontSide})
  ));

  marker = new THREE.Mesh(new THREE.SphereGeometry(0.015,12,12), new THREE.MeshBasicMaterial({color:0xff4444}));
  ring = new THREE.Mesh(new THREE.TorusGeometry(0.03,0.006,8,32), new THREE.MeshBasicMaterial({color:0xff4444,transparent:true,opacity:0.7}));
  arrowHelper = new THREE.ArrowHelper(new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,0), 0.4, 0x6c8fff, 0.08, 0.06);
  earthGroup.add(marker);
  earthGroup.add(ring);
  earthGroup.add(arrowHelper);

  scene.add(new THREE.AmbientLight(0x334466, 1));
  sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
  sunGlow = new THREE.DirectionalLight(0xffdd88, 0.3);
  scene.add(sunLight);
  scene.add(sunGlow);

  // #region cloudShiet
  /*
  cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = 1024;
  cloudCanvas.height = 512;
  cloudCtx = cloudCanvas.getContext('2d');
  cloudCtx.fillStyle = "rgba(255,255,255,0.2)";
  cloudCtx.fillRect(0, 0, 1024, 512);
  cloudTexture = new THREE.CanvasTexture(cloudCanvas);
  cloudTexture.needsUpdate = true;
  const cloudMat = new THREE.MeshStandardMaterial({
    map: cloudTexture,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    roughness: 1.0,
    metalness: 0.0,
  });
  const cloudMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 64, 64),
    cloudMat
  );
  earthGroup.add(cloudMesh);
  */
  // #endregion cloudShiet
  
  sunMat = new THREE.MeshBasicMaterial({color:0xffdd44});
  sunSphere = new THREE.Mesh(new THREE.SphereGeometry(0.1,16,16), sunMat);
  coronaMat = new THREE.MeshBasicMaterial({color:0xffaa00,transparent:true,opacity:0.4});
  corona = new THREE.Mesh(new THREE.TorusGeometry(0.14,0.02,8,32), coronaMat);
  scene.add(sunSphere);
  scene.add(corona);

  stockholm = new THREE.Mesh(
    new THREE.SphereGeometry(0.005, 5, 5),
    new THREE.MeshBasicMaterial({ color: 0x00ff00 })
  );
  helsinki = new THREE.Mesh(
    new THREE.SphereGeometry(0.005, 5, 5),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
  );
  earthGroup.add(stockholm, helsinki);

  // #region controls
  let orbitTheta = 0;
  let orbitPhi = 0.3;
  let isDragging = false;
  let prevMouse = {x:0, y:0};
  let orbitRadius = 3;

  // ZOOM CONSTANTS
  const MIN_RADIUS = 1.5;
  const MAX_RADIUS = 8;

  function updateCamera() {
    camera.position.set(
      orbitRadius * Math.sin(orbitPhi) * Math.sin(orbitTheta),
      orbitRadius * Math.cos(orbitPhi),
      orbitRadius * Math.sin(orbitPhi) * Math.cos(orbitTheta)
    );
    camera.lookAt(0, 0, 0);
  }

  function bindGlobeControls(renderer, {
  updateCamera,
  MIN_RADIUS,
  MAX_RADIUS
  }) {

    let prevMouse = { x: 0, y: 0 };
    let isDragging = false;

    function getTouchDist(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    renderer.domElement.addEventListener('mousedown', (e) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    });

    renderer.domElement.addEventListener('mousemove', (e) => {
      if (!isDragging || touchMode) return;

      orbitTheta -= (e.clientX - prevMouse.x) * 0.005;
      orbitPhi   += (e.clientY - prevMouse.y) * 0.005;

      orbitPhi = Math.max(0.05, Math.min(Math.PI - 0.05, orbitPhi));

      prevMouse = { x: e.clientX, y: e.clientY };
      updateCamera();
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    renderer.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();

      orbitRadius += e.deltaY * 0.005;
      orbitRadius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, orbitRadius));

      updateCamera();
    }, { passive: false });

    renderer.domElement.addEventListener('touchstart', (e) => {

      if (e.touches.length === 1) {
        touchMode = 'rotate';
        isDragging = true;

        prevMouse = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
        };
      }

      if (e.touches.length === 2) {
        touchMode = 'zoom';
        isDragging = false;

        lastTouchDist = getTouchDist(e.touches);
      }

    }, { passive: true });
    renderer.domElement.addEventListener('touchmove', (e) => {

      // ROTATE
      if (touchMode === 'rotate' && e.touches.length === 1) {

        orbitTheta -= (e.touches[0].clientX - prevMouse.x) * 0.005;
        orbitPhi   += (e.touches[0].clientY - prevMouse.y) * 0.005;

        orbitPhi = Math.max(0.05, Math.min(Math.PI - 0.05, orbitPhi));

        prevMouse = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
        };

        updateCamera();
      }
      if (touchMode === 'zoom' && e.touches.length === 2) {

        const dist = getTouchDist(e.touches);
        const delta = dist - lastTouchDist;

        orbitRadius -= delta * 0.01;
        orbitRadius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, orbitRadius));

        lastTouchDist = dist;
        updateCamera();
      }

      e.preventDefault();

    }, { passive: false });
    renderer.domElement.addEventListener('touchend', () => {
      isDragging = false;
      touchMode = null;
    });
  }

  bindGlobeControls(renderer, {
    updateCamera,
    MIN_RADIUS,
    MAX_RADIUS
  });
  updateCamera();

  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  const stopAnim = document.getElementById('ov-rotates')
  let animFlag = true;
  stopAnim.addEventListener('change', function() {
    if (this.checked) {animFlag = true;} else {animFlag = false;}
  });
  stopAnim.dispatchEvent(new Event('change'));

  function animate() {
    requestAnimationFrame(animate);
    if (!isDragging && animFlag) {
      orbitTheta += 0.0007;
      updateCamera();
    } else {
    }
    renderer.render(scene, camera);
  }
  animate();
  // #endregion
  loadCountries();
  
}
// #endregion 3D SCENE

// #region date and time
// user-agent
function detectTimezone() {
  return -new Date().getTimezoneOffset() / 60;
}
function formatTimeString(hoursDecimal) {
  let clamped = hoursDecimal;
  if (clamped < 0) clamped = 0;
  if (clamped >= 24) clamped = 23.999999;
  
  const totalSeconds = Math.round(clamped * 3600);
  const h = Math.min(Math.floor(totalSeconds / 3600), 23);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDateString(year, month, day) {
  const dateObj = new Date(year, month - 1, day);
  return dateObj.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
}

function formatDateTimeString(year, month, day, hoursDecimal) {
  return `${formatDateString(year, month, day)} ${formatTimeString(hoursDecimal)}`;
}

function getDecimalHours(date) {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

function formatTimezone(tz) {
  const sign = tz >= 0 ? '+' : '';
  const hours = Math.floor(Math.abs(tz));
  const minutes = Math.round((Math.abs(tz) - hours) * 60);
  if (minutes === 0) {
    return `UTC${sign}${hours}`;
  } else {
    return `UTC${sign}${hours}:${String(minutes).padStart(2, '0')}`;
  }
}

function populateTimezoneSelect() {
  const select = document.getElementById('tz-select');
  select.innerHTML = '';
  const specialLabels = {
    '-12': 'UTC-12',
    '-11': 'UTC-11',
    '-10': 'UTC-10',
    '-9': 'UTC-9',
    '-8': 'UTC-8 (Pacific)',
    '-7': 'UTC-7 (Mountain)',
    '-6': 'UTC-6 (Central)',
    '-5': 'UTC-5 (Eastern)',
    '-4': 'UTC-4',
    '-3.5': 'UTC-3:30 (Newfoundland)',
    '-3': 'UTC-3',
    '-2': 'UTC-2',
    '-1': 'UTC-1',
    '0': 'UTC (GMT)',
    '1': 'UTC+1 (CET)',
    '2': 'UTC+2 (EET)',
    '3': 'UTC+3',
    '3.5': 'UTC+3:30 (Iran)',
    '4': 'UTC+4',
    '4.5': 'UTC+4:30 (Afghanistan)',
    '5': 'UTC+5',
    '5.5': 'UTC+5:30 (India)',
    '5.75': 'UTC+5:45 (Nepal)',
    '6': 'UTC+6',
    '6.5': 'UTC+6:30 (Myanmar)',
    '7': 'UTC+7',
    '8': 'UTC+8 (China)',
    '8.5': 'UTC+8:30 (North Korea)',
    '8.75': 'UTC+8:45 (Australia/Eucla)',
    '9': 'UTC+9 (Japan)',
    '9.5': 'UTC+9:30 (Australia/Central)',
    '10': 'UTC+10 (Australia/East)',
    '10.5': 'UTC+10:30 (Lord Howe)',
    '11': 'UTC+11',
    '12': 'UTC+12',
    '12.75': 'UTC+12:45 (Chatham Islands)',
    '13': 'UTC+13',
    '14': 'UTC+14'
  };
  
  const steps = [0, 0.25, 0.5, 0.75];
  const offsets = [];
  
  for (let tz = -12; tz <= 14; tz += 0.25) {
  
    const rounded = Math.round(tz * 100) / 100;
    offsets.push(rounded);
  }
  const uniqueOffsets = [...new Set(offsets)];
  
  uniqueOffsets.forEach(tz => {
    const option = document.createElement('option');
    option.value = tz;
    
    let label = specialLabels[tz.toString()];
    
    if (!label) {
      const sign = tz >= 0 ? '+' : '';
      const absTz = Math.abs(tz);
      const hours = Math.floor(absTz);
      const minutes = Math.round((absTz - hours) * 60);
      if (minutes === 0) {
        label = `UTC${sign}${hours}`;
      } else {
        label = `UTC${sign}${hours}:${String(minutes).padStart(2, '0')}`;
      }
    }
    
    option.textContent = label;
    select.appendChild(option);
  });
  const detected = detectTimezone();
  const rounded = Math.round(detected * 4) / 4;
  select.value = rounded;
  state.tz = rounded;
  const tzDisplay = document.getElementById('tz-display');
  if (tzDisplay) {
    tzDisplay.textContent = formatTimezone(rounded);
  } else {
    // console.log("HELLO")
  }
  document.getElementById('tz-select').addEventListener('change', function() {
    state.tz = parseFloat(this.value);
    const _tzDisplay = document.getElementById('tz-display');
    if (_tzDisplay) {
      _tzDisplay.textContent = formatTimezone(state.tz);
    }
    runAll();
  });
}
// #endregion

// state
const now = new Date();
const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
const state = {
  lat: 57.71,
  lon: 11.97,
  elev: 20,
  tz: detectTimezone(),
  date: dateStr,
  year: now.getFullYear(),
  month: now.getMonth() + 1,
  day: now.getDate(),
  hour: getDecimalHours(now),
  deltaT: 69,
  deltaUt1: 0,
  pressure: 1013,
  temp: 15,
  slope: 30,
  panAzm: 180,
  pnom: 375,
  pcount: 24,
  eff: 0.80,
  atmosRefract: 0.5667,
  chartMode: 'power',
  panelArea: 1.7,
  powerMode: 'stc',
  modEff: 0.20,
  cloudCover: -1,// !!!
};

/**
 * UPDATES STATE
 * @param {*} id 
 * @param {string} key 
 * @param {*} display 
 * @param {*} fmt 
 * @param {*} init 
 * @returns 
 */
function bindSlider(id, key, display, fmt, init=true, step=null) {
  const sl = document.getElementById(id);
  if (!sl) {
    // console.log("[Warn], missing in DOM: ", id);
    return
  }
  if (step !== null) {
    sl.step = step;
  }

  const dp = document.getElementById(display);
  const update = () => {
    // Edge case
    if (id === 'panazm-slider' || id === 'slope-slider') {
      if (autoOpt) {
        document.getElementById('ov-opt').checked = false;
        autoOpt = false;
      }
    }
    // TODO: make a function called "setState" which takes a dict, pass in key + sl.value. Hook it up to all setters of states
    if (id === 'lat-slider') {
      setLatLon(parseFloat(sl.value), null);
    } else if (id === 'lon-slider') {
      setLatLon(null, parseFloat(sl.value));
    } else {
      state[key] = parseFloat(sl.value);
    }
    if (dp) dp.textContent = fmt(state[key]);
    runAll();
  };
  sl.addEventListener('input', update);
  if (init && state[key] !== undefined) {
    sl.value = state[key];
    if (dp) dp.textContent = fmt(state[key]);
  }
}

function updatePill() {
  const pill = document.querySelector('.sun-overlay .pill');
  if (!pill) return;
  
  pill.textContent = formatDateTimeString(
    state.year,
    state.month,
    state.day,
    state.hour
  );
}

function initTimeSlider() {
  const timeSlider = document.getElementById('time-slider');
  const timeDisplay = document.getElementById('time-display');
  
  if (!timeSlider || !timeDisplay) return;
 
  timeSlider.value = state.hour;
  timeDisplay.textContent = formatTimeString(state.hour);

  timeSlider.addEventListener('input', function() {
    state.hour = parseFloat(this.value);
    timeDisplay.textContent = formatTimeString(state.hour);
    runAll();
  });
}

function initSliders() {
  bindSlider('lat-slider', 'lat', 'lat-display', v => v.toFixed(2) + '°', true, 0.1);
  bindSlider('lon-slider', 'lon', 'lon-display', v => v.toFixed(2) + '°', true, 0.1);
  bindSlider('elev-slider', 'elev', 'elev-display', v => v.toFixed(0) + ' m');

  // bindSlider('dt-slider', 'deltaT', 'dt-display', v => v.toFixed(0) + ' s');
  bindSlider('slope-slider', 'slope', 'slope-display', v => v.toFixed(0) + '°');
  bindSlider('panazm-slider', 'panAzm', 'panazm-display', v => v.toFixed(0) + '°');
  bindSlider('pcount-slider', 'pcount', 'pcount-display', v => v.toFixed(0));
  bindSlider('eff-slider', 'eff', 'eff-display', v => (v * 100).toFixed(0) + '%');
  
  bindSlider('pnom-slider', 'pnom', 'pnom-display', v => v.toFixed(0) + ' W');
  bindSlider('area-slider', 'panelArea', 'area-display', v => v.toFixed(1) + ' m²');

  bindSlider('area-slider2', 'panelArea', 'area-display2', v => v.toFixed(1) + ' m²');
  bindSlider('mod-eff-slider', 'modEff', 'mod-eff-display', v => (v * 100).toFixed(0) + '%');
  bindSlider('pnom-slider2', 'pnom', 'pnom-display2', v => v.toFixed(0) + ' W');
  initTimeSlider();
}

function initChartBtns() {
  ['zenith','altitude','power','azimuth','optimum'].forEach(tab=>{
    document.getElementById('tab-'+tab).addEventListener('click',()=>{
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      document.getElementById('tab-'+tab).classList.add('active');
      state.chartMode=tab;
      drawChart(lastDayData);//
    });
  });
}


const chartCanvas=document.getElementById('chart-canvas');
const ctx=chartCanvas.getContext('2d');

/**
 * Array of dicts with hourly cadence {res, power, orientation_factor}
 */
let lastDayData=[];

function resizeChart(){
  const panel=document.querySelector('.chart-panel');
  chartCanvas.width=panel.clientWidth;
  chartCanvas.height=panel.clientHeight;
  drawChart(lastDayData);
}
window.addEventListener('resize',resizeChart);

function drawSeries(ctx, vals, color, minV, range, pad, iW, iH) {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  vals.forEach((v, i) => {
    const x = pad.left + (i / 24) * iW;
    const y = pad.top + iH - ((v - minV) / range) * iH;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawDot(ctx, vals, color, minV, range, pad, iW, iH) {
  const curIdx = Math.min(Math.floor(state.hour), 23);
  if (curIdx >= vals.length) return;
  const cx = pad.left + (curIdx / 24) * iW;
  const cy = pad.top + iH - ((vals[curIdx] - minV) / range) * iH;
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawGrid(pad, iW, iH, minV, maxV, range, unit) {
  const W = chartCanvas.width, H = chartCanvas.height;
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + iH - (i / 4) * iH;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + iW, y);
    ctx.stroke();
    const v = minV + (i / 4) * range;
    ctx.fillStyle = 'rgba(136,136,160,0.8)';
    ctx.font = '10px Inter,system-ui,sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(v.toFixed(0) + unit, pad.left - 4, y + 3);
  }
  ctx.fillStyle = 'rgba(136,136,160,0.8)';
  ctx.font = '10px Inter,system-ui,sans-serif';
  ctx.textAlign = 'center';
  [0, 6, 12, 18, 24].forEach(h => {
    const x = pad.left + (h / 24) * iW;
    ctx.fillText(h + ':00', x, H - 6);
  });
  const curX = pad.left + (state.hour / 24) * iW;
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(curX, pad.top);
  ctx.lineTo(curX, pad.top + iH);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawAreaFill(ctx, vals, color, minV, range, pad, iW, iH) {
  ctx.beginPath();
  vals.forEach((v, i) => {
    const x = pad.left + (i / 24) * iW;
    const y = pad.top + iH - ((v - minV) / range) * iH;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.lineTo(pad.left + iW, pad.top + iH);
  ctx.lineTo(pad.left, pad.top + iH);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + iH);
  grad.addColorStop(0, color + '44');
  grad.addColorStop(1, color + '00');
  ctx.fillStyle = grad;
  ctx.fill();
}


/**
 * 
 * @param {Array} data  // len=24 [{spa: {,,,,,,,,,,}, power: float, of: float}] 
 * @returns 
 */
function drawChart(data) {
  if (!data.length) return;
  const W = chartCanvas.width, H = chartCanvas.height;
  ctx.clearRect(0, 0, W, H);
  const pad = {top:10, right:20, bottom:30, left:42};
  const iW = W - pad.left - pad.right, iH = H - pad.top - pad.bottom;

  if (state.chartMode === 'optimum') {
    const optData = optimizeDay(lastDayData);
    const tiltVals = optData.map(d => d.optTilt);
    const azmVals  = optData.map(d => d.optAzm);
    drawGrid(pad, iW, iH, 0, 360, 360, '°');
    drawAreaFill(ctx, tiltVals, '#ff9f43', 0, 360, pad, iW, iH);
    drawSeries(ctx, tiltVals, '#ff9f43', 0, 360, pad, iW, iH);
    drawSeries(ctx, azmVals,  '#a29bfe', 0, 360, pad, iW, iH);
    drawDot(ctx, tiltVals, '#ff9f43', 0, 360, pad, iW, iH);
    drawDot(ctx, azmVals,  '#a29bfe', 0, 360, pad, iW, iH);
    document.getElementById('chart-legend').innerHTML = `
      <span><span class="legend-dot" style="background:#ff9f43"></span>Optimal tilt</span>
      <span><span class="legend-dot" style="background:#a29bfe"></span>Optimal azimuth</span>`;
    return;
  }

  let key, color, unit, label;
  switch (state.chartMode) {
    case 'zenith':   key='zenith';   color='#6c8fff'; unit='°'; label='Zenith angle';    break;
    case 'altitude': key='altitude'; color='#4ecb71'; unit='°'; label='Altitude';        break;
    case 'power':    key='power';    color='#ff9f43'; unit='W'; label='Estimated power'; break;
    case 'azimuth':  key='azimuth';  color='#a29bfe'; unit='°'; label='Azimuth';         break;
  }
  document.getElementById('chart-legend').innerHTML =
    `<span><span class="legend-dot" style="background:${color}"></span>${label}</span>`;

  const vals = data.map(d => d[key]);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const range = maxV - minV || 1;

  drawGrid(pad, iW, iH, minV, maxV, range, unit);
  drawAreaFill(ctx, vals, color, minV, range, pad, iW, iH);
  drawSeries(ctx, vals, color, minV, range, pad, iW, iH);
  drawDot(ctx, vals, color, minV, range, pad, iW, iH);
}

function frHrToHms(fh){
  if(fh<0||fh>24)return '—';
  const h=Math.floor(fh),m=Math.floor((fh-h)*60),s=Math.round(((fh-h)*60-m)*60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// #region power


/**
 * Total array output at a given time
 */
function computePower(res, weather) {
 
  const poa = computePOA(weather, res.incidence, state.slope, res.zenith);
  const systemEff = state.eff;
  
  let power;
  
  if (state.powerMode === 'stc') {
    const powerPerPanel = state.pnom * (poa / 1000) * systemEff;
    power = powerPerPanel * state.pcount;
  } else {
    const moduleEff = state.modEff;
    const panelArea = state.panelArea;
    const powerPerPanel = poa * panelArea * moduleEff * systemEff;
    power = powerPerPanel * state.pcount;
  }
  
  const of = orientationFactor(res.azimuth, state.panAzm, res.zenith, state.slope);

  return { power: Math.max(0, power), poa: poa, of: of};
}

function initPowerModeToggle() {
  const toggles = document.querySelectorAll('.mode-toggle');
  const stcFields = document.getElementById('stc-fields');
  const areaFields = document.getElementById('area-fields');
  toggles.forEach(toggle => {
    toggle.addEventListener('click', function() {
      toggles.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      state.powerMode = this.dataset.mode;
      if (state.powerMode === 'stc') {
        stcFields.style.display = 'block';
        areaFields.style.display = 'none';
      } else {
        stcFields.style.display = 'none';
        areaFields.style.display = 'block';
      }
      runAll();
    });
  });
}
// #endregion


/**
 * FML
 */
async function runAll(){
  const dayData=[];
  const dateStr = makeDateStr(state.year, state.month, state.day);
  for(let h=0;h<24;h++){
    const res=spa(state.year, state.month, state.day, h, 0, 0, state.tz, state.lat, 
              state.lon, state.elev, state.pressure, state.temp,
              state.slope, state.panAzm, state.deltaT, 
              state.deltaUt1, state.atmosRefract);
    // TODO: granularity
    const weather = getWeather(state.lat, state.lon, h, state.tz, dateStr);
    const { power, poa } = computePower(res, weather);
    // console.log('power hour', h, ':', power, 'poa:', poa);
    dayData.push({
    ...res,
    power,
    weather
    });
  }
  lastDayData=dayData;
  const midRes=dayData[12];
  const isPolarDay = midRes.sunrise <= -99990 && midRes.altitude > 0;
  const isPolarNight = midRes.sunrise <= -99990 && midRes.altitude <= 0
  document.getElementById('s-sunrise').textContent = isPolarDay ? 'Polar day' : isPolarNight ? 'Polar night' : frHrToHms(midRes.sunrise);
  document.getElementById('s-sunset').textContent = isPolarDay ? 'Polar day' : isPolarNight ? 'Polar night' : frHrToHms(midRes.sunset);
  document.getElementById('s-noon').textContent = isPolarDay ? frHrToHms(midRes.suntransit) : isPolarNight ? '—' : frHrToHms(midRes.suntransit)
  updatePill();
  resizeChart();
  updateObsPosition(dateStr);
}

function updateSP(res) {
  
  const ra  = -d2r(res.alpha);
  const dec = d2r(res.delta);
  const sunDirECI = new THREE.Vector3(
    Math.cos(dec) * Math.cos(ra),
    Math.sin(dec),
    Math.cos(dec) * Math.sin(ra)
  ).normalize();

  const sunPos = sunDirECI.multiplyScalar(2.8);
  sunSphere.position.copy(sunPos);
  corona.position.copy(sunPos);
  sunLight.position.copy(sunPos);
  sunGlow.position.copy(sunPos);
  const altRad = d2r(res.altitude);
  const sunAlpha = THREE.MathUtils.clamp(Math.sin(altRad), 0, 1);

  sunMat.opacity = sunAlpha;
  coronaMat.opacity = sunAlpha * 0.4;
}

function updateSPUI(res, power, of) {
  document.getElementById('s-zenith').textContent=res.zenith.toFixed(1)+'°';
  document.getElementById('s-azimuth').textContent=res.azimuth.toFixed(1)+'°';
  document.getElementById('s-altitude').textContent=res.altitude.toFixed(1)+'°';
  document.getElementById('s-factor').textContent=("");
  document.getElementById('s-power').innerHTML=power.toFixed(0)+' <span class="stat-unit">W</span>';
  document.getElementById('ov-zenith').textContent=res.zenith.toFixed(2)+'°';
  document.getElementById('ov-azimuth').textContent=res.azimuth.toFixed(2)+'°';
  document.getElementById('ov-altitude').textContent=res.altitude.toFixed(2)+'°';
}

/**
 * @private
 * @param {} lat 
 * @param {*} lon 
 */
function setLatLon(lat=null, lon=null) {
  let _lat, _lon;
  if (lat === null) {
    _lat = state.lat;
  } else {
    _lat = Math.min(Math.max(lat, -90.0), 90.0);
  }
  if (lon === null) {
    _lon = state.lon;
  } else {
    _lon = Math.min(Math.max(lon, -180.0), 180.0);
  }
  state.lat = _lat;
  state.lon = _lon;
  //console.log("Set lat to: ", state.lat, ".\nSet lon to: ", state.lon);
}

function updateWeatherUI(state, weatherReady) {
  const el = document.getElementById('weather-indicator');

  if (!weatherReady) {
    el.textContent = 'Clear-sky model';
    el.style.color = 'var(--text2)';
  } else {
    el.textContent = `${state.cloudCover ?? 0}% cloud cover`;
    el.style.color = 'var(--success)';
  }
}

/**
 * Always run
 */
function updateObsPosition(dateStr) {

  let cloudCover,dhi,dni,ghi,pressure,temp; // placeholders
  const h = Math.floor(state.hour), m = Math.round((state.hour-h)*60);

  const weather = getWeather(state.lat, state.lon, h, state.tz, dateStr);
  // ugly code FML
  if (weather) {
    temp = weather['temp'];
    pressure = weather['pressure'];
    cloudCover = weather['cloudCover']; // int [0,100]
    if (temp !== null && temp !== undefined) {
      state.temp = temp;
    } else {
      state.temp = 15;
    }
    if (pressure !== null && pressure !== undefined) {
      state.pressure = pressure;
    } else {
      state.pressure = 1013;
    }
    if (cloudCover !== null && cloudCover >= 0 && cloudCover !== undefined) {
      state.cloudCover = cloudCover;
    } // only decorative val
  } 
  const res = spa(state.year,state.month,state.day,h,m,0,
      state.tz,state.lat,state.lon,state.elev,state.pressure,
      state.temp,state.slope, state.panAzm,
      state.deltaT,state.deltaUt1,state.atmosRefract);
  if (autoOpt && shouldRecompute(state)) {
    const opt = optimizeAtIndex(lastDayData, h);
    state.slope = Math.min(Math.max(opt.optTilt, 0), 90);
    state.panAzm = Math.min(Math.max(opt.optAzm, 0), 360);
    syncPanelSliders();
  }
  
  // screw yuo guys
  // updateCloudTexture(h, state.tz);

  const { power, poa, of } = computePower(res, weather);

  const pos = latLonToVec3(state.lat, state.lon);
  const up = pos.clone().normalize();
  const east = new THREE.Vector3(-Math.sin(d2r(state.lon)), 0, Math.cos(d2r(state.lon))).normalize();
  const north = new THREE.Vector3().crossVectors(up, east).normalize();
  marker.position.copy(pos);
  ring.position.copy(pos);
  ring.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), up);
  const slopeRad = d2r(state.slope);
  const pAzmRad  = d2r(state.panAzm);
  const panelDir = new THREE.Vector3()
    .addScaledVector(north, Math.sin(slopeRad) * Math.cos(pAzmRad))
    .addScaledVector(up,    Math.cos(slopeRad))
    .addScaledVector(east,  Math.sin(slopeRad) * Math.sin(pAzmRad))
    .normalize();
    
  arrowHelper.position.copy(pos);
  arrowHelper.setDirection(panelDir);
  arrowHelper.setColor(new THREE.Color(poa > 0 ? 0x6c8fff : 0x444444));
  updateEarthRotation(res);
  updateSP(res);
  updateSPUI(res, power, of);
  drawChart(lastDayData);
  updateWeatherUI(state, !!weather);
}

function updateEarthRotation(res) {
  const gst = d2r(res.nu); 
  earthGroup.rotation.set(0, +gst, 0); 
}

function initDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;
  
  document.getElementById('date-input').value = dateStr;
  state.date = dateStr;
  state.year = year;
  state.month = parseInt(month);
  state.day = parseInt(day);

  
  document.getElementById('date-input').addEventListener('change', function(e) {
    const parts = e.target.value.split('-');
    state.date = e.target.value;
    state.year = parseInt(parts[0]);
    state.month = parseInt(parts[1]);
    state.day = parseInt(parts[2]);
    invalidateWeather();
    runAll();
  });
}


/**
 * Automatically 'optimizes' the panel vector for the current hour (hourly cadence)
 */
let autoOpt = true;
function initShittyOptimizer() {
  var optAnim = document.getElementById('ov-opt')
  optAnim.addEventListener('change', function() {
    if (this.checked) {autoOpt = true;} else {autoOpt = false;}
    runAll();
  });
}


function testShittyCoordinateSystem() {
  function latLonToVec3Geo(lat, lon, r = 1.02) {
    const phi = d2r(90 - lat);
    const theta = d2r(lon);

    return new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  }
  stockholm.position.copy(latLonToVec3(59.32, 18.05));
  helsinki.position.copy(latLonToVec3(60.16, 24.93));
}

function test() {
  const markerWorld = new THREE.Vector3();
  marker.getWorldPosition(markerWorld);
  const sunWorld = new THREE.Vector3();
  sunSphere.getWorldPosition(sunWorld);
  const dir = sunWorld.clone().sub(markerWorld).normalize();
  const raycaster = new THREE.Raycaster(
    markerWorld,
    dir,
    0,
    markerWorld.distanceTo(sunWorld)
  );
  const hits = raycaster.intersectObject(globe, true);
  // console.log(hits.length ? "Earth blocks sun" : "Sun visible");
}

function initShittyApp() {
  initChartBtns();
  initGlobe();
  initGeocoder();
  initDate();
  initPowerModeToggle();
  initSliders();
  // populateTimezoneSelect();
  resizeChart();
  initShittyOptimizer();
  initSidebarToggle();

  initWeatherButton(runAll, () => state);
  runAll();
}
initShittyApp();