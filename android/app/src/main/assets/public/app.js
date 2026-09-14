/* Marion / Smyth County weather + ADS-B map. Public feeds only. */
(() => {
  const MARION = { lat: 36.8344, lon: -81.5148 };
  const DEFAULT_ZOOM = 9;

  const IEM_TMS = "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0";
  const IEM_STORMS = "https://mesonet.agron.iastate.edu/geojson/nexrad_attr.py";
  const ADSB_DIRECT = "https://api.adsb.lol/v2/point";
  const RV_MAPS = "https://api.rainviewer.com/public/weather-maps.json";

  const RADAR_LAYERS = [];
  for (let m = 55; m >= 5; m -= 5) {
    RADAR_LAYERS.push(`nexrad-n0q-m${String(m).padStart(2, "0")}m`);
  }
  RADAR_LAYERS.push("nexrad-n0q");

  const BLITZ_WS = [
    "wss://ws1.blitzortung.org",
    "wss://ws7.blitzortung.org",
    "wss://ws8.blitzortung.org",
  ];

  const $ = (id) => document.getElementById(id);
  const statusEl = $("status");
  const flags = { radar: "ok", storms: "ok", lightning: "ok", planes: "ok" };

  function setStatus(key, kind, text) {
    flags[key] = kind;
    let li = document.getElementById("st-" + key);
    if (!li) {
      li = document.createElement("li");
      li.id = "st-" + key;
      statusEl.appendChild(li);
    }
    li.className = kind;
    li.textContent = text;
  }

  const map = L.map("map", {
    zoomControl: true,
    attributionControl: true,
  }).setView([MARION.lat, MARION.lon], DEFAULT_ZOOM);

  L.control.zoom({ position: "bottomright" }).addTo(map);
  map.zoomControl.remove();

  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    {
      attribution: "Tiles &copy; Esri",
      maxZoom: 16,
    }
  ).addTo(map);
  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 16, opacity: 0.9 }
  ).addTo(map);

  const homeIcon = L.divIcon({
    className: "bolt",
    html: '<div style="width:12px;height:12px;border-radius:50%;background:#6ee0ff;border:2px solid #fff;box-shadow:0 0 8px #6ee0ff"></div>',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
  L.marker([MARION.lat, MARION.lon], { icon: homeIcon, zIndexOffset: 200 })
    .bindPopup("<strong>Marion, VA</strong><br>Smyth County")
    .addTo(map);

  /* ---------- Radar (IEM NEXRAD loop, RainViewer fallback) ---------- */
  const radarGroup = L.layerGroup().addTo(map);
  let radarTiles = [];
  let radarIndex = RADAR_LAYERS.length - 1;
  let radarTimer = null;
  let radarPlaying = true;
  let radarMode = "iem";
  let radarBust = Math.floor(Date.now() / 300000);
  let iemErrors = 0;

  function iemUrl(layerName) {
    const bust = layerName === "nexrad-n0q" ? `?t=${radarBust}` : "";
    return `${IEM_TMS}/${layerName}/{z}/{x}/{y}.png${bust}`;
  }

  function buildIemRadar() {
    radarGroup.clearLayers();
    radarTiles = RADAR_LAYERS.map((name, i) => {
      const layer = L.tileLayer(iemUrl(name), {
        opacity: 0,
        pane: "overlayPane",
        maxZoom: 18,
        attribution: '<a href="https://mesonet.agron.iastate.edu/ogc/">IEM NEXRAD</a>',
      });
      layer.on("tileerror", () => {
        iemErrors += 1;
        if (iemErrors === 8 && radarMode === "iem") {
          setStatus("radar", "warn", "IEM radar tiles failing — trying RainViewer…");
          startRainViewer();
        }
      });
      layer.addTo(radarGroup);
      return layer;
    });
    showRadarFrame(radarIndex);
  }

  function minutesAgoForIndex(i) {
    if (i === RADAR_LAYERS.length - 1) return 0;
    return 55 - i * 5;
  }

  function fmtRadarTime(minsAgo) {
    const d = new Date(Date.now() - minsAgo * 60000);
    return d.toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function showRadarFrame(i) {
    radarIndex = i;
    radarTiles.forEach((ly, idx) => ly.setOpacity(idx === i && $("ly-radar").checked ? 0.72 : 0));
    $("radar-slider").value = String(i);
    const ago = minutesAgoForIndex(i);
    $("radar-time").textContent = radarMode === "iem"
      ? (ago === 0 ? `${fmtRadarTime(0)} ET` : `−${ago}m`)
      : $("radar-time").textContent;
  }

  function playRadar() {
    stopRadar();
    radarPlaying = true;
    $("btn-play").textContent = "❚❚";
    radarTimer = setInterval(() => {
      if (!radarTiles.length) return;
      let next = radarIndex + 1;
      if (next >= radarTiles.length) next = 0;
      showRadarFrame(next);
      if (next === radarTiles.length - 1) {
        /* linger on latest frame */
        clearInterval(radarTimer);
        radarTimer = setTimeout(playRadar, 1200);
      }
    }, 420);
  }

  function stopRadar() {
    radarPlaying = false;
    $("btn-play").textContent = "▶";
    if (radarTimer) {
      clearInterval(radarTimer);
      clearTimeout(radarTimer);
      radarTimer = null;
    }
  }

  $("radar-slider").max = String(RADAR_LAYERS.length - 1);
  $("radar-slider").addEventListener("input", (e) => {
    stopRadar();
    showRadarFrame(Number(e.target.value));
  });
  $("btn-play").addEventListener("click", () => {
    if (radarPlaying) stopRadar();
    else {
      playRadar();
    }
  });

  async function startRainViewer() {
    radarMode = "rainviewer";
    stopRadar();
    radarGroup.clearLayers();
    radarTiles = [];
    try {
      const res = await fetch(RV_MAPS);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const host = data.host;
      const frames = (data.radar && data.radar.past) || [];
      if (!frames.length) throw new Error("no past frames");
      radarTiles = frames.map((fr, i) => {
        const url = `${host}${fr.path}/256/{z}/{x}/{y}/2/1_1.png`;
        const layer = L.tileLayer(url, {
          opacity: 0,
          maxNativeZoom: 7,
          maxZoom: 18,
          attribution: '<a href="https://www.rainviewer.com/">RainViewer</a>',
        });
        layer._rvTime = fr.time;
        layer.addTo(radarGroup);
        return layer;
      });
      $("radar-slider").max = String(radarTiles.length - 1);
      radarIndex = radarTiles.length - 1;
      const origShow = showRadarFrame;
      /* wrap time label for RV unix timestamps */
      radarTiles.forEach((ly) => {
        ly.on("add", () => {});
      });
      showRadarFrame = function (i) {
        radarIndex = i;
        radarTiles.forEach((ly, idx) => ly.setOpacity(idx === i && $("ly-radar").checked ? 0.72 : 0));
        $("radar-slider").value = String(i);
        const t = radarTiles[i] && radarTiles[i]._rvTime;
        $("radar-time").textContent = t
          ? new Date(t * 1000).toLocaleTimeString("en-US", {
              timeZone: "America/New_York",
              hour: "numeric",
              minute: "2-digit",
            }) + " ET"
          : "—";
      };
      showRadarFrame(radarIndex);
      if ($("ly-radar").checked) playRadar();
      setStatus("radar", "ok", `Radar: RainViewer (${frames.length} frames, zoom≤7)`);
    } catch (err) {
      setStatus("radar", "err", `Radar failed: ${err.message}`);
    }
  }

  buildIemRadar();
  playRadar();
  setStatus("radar", "ok", "Radar: IEM NEXRAD CONUS (5‑min loop)");

  setInterval(() => {
    if (radarMode !== "iem" || !$("ly-radar").checked) return;
    radarBust = Math.floor(Date.now() / 300000);
    const last = radarTiles[radarTiles.length - 1];
    if (last) last.setUrl(iemUrl("nexrad-n0q"));
  }, 5 * 60 * 1000);

  $("ly-radar").addEventListener("change", () => {
    const on = $("ly-radar").checked;
    $("radar-ctl").style.opacity = on ? "1" : "0.4";
    if (on) {
      showRadarFrame(radarIndex);
      if (radarPlaying || $("btn-play").textContent === "▶") playRadar();
    } else {
      radarTiles.forEach((ly) => ly.setOpacity(0));
      stopRadar();
    }
  });

  /* ---------- Storm cells (IEM NEXRAD attributes + real motion) ---------- */
  const stormGroup = L.layerGroup().addTo(map);

  function destPoint(lat, lon, bearingDeg, distKm) {
    const R = 6371;
    const br = (bearingDeg * Math.PI) / 180;
    const φ1 = (lat * Math.PI) / 180;
    const λ1 = (lon * Math.PI) / 180;
    const φ2 = Math.asin(
      Math.sin(φ1) * Math.cos(distKm / R) +
        Math.cos(φ1) * Math.sin(distKm / R) * Math.cos(br)
    );
    const λ2 =
      λ1 +
      Math.atan2(
        Math.sin(br) * Math.sin(distKm / R) * Math.cos(φ1),
        Math.cos(distKm / R) - Math.sin(φ1) * Math.sin(φ2)
      );
    return [ (φ2 * 180) / Math.PI, (λ2 * 180) / Math.PI ];
  }

  function dbzColor(z) {
    if (z >= 60) return "#ff00ff";
    if (z >= 50) return "#ff0000";
    if (z >= 40) return "#ffff00";
    if (z >= 30) return "#00ff00";
    return "#01a0f6";
  }

  function stormScore(p) {
    const z = Number(p.max_dbz) || 0;
    const tvs = p.tvs && p.tvs !== "NONE" ? 80 : 0;
    const meso = p.meso && p.meso !== "NONE" ? 40 : 0;
    return z + tvs + meso;
  }

  function isSevereCell(p) {
    return (p.tvs && p.tvs !== "NONE") || (p.meso && p.meso !== "NONE");
  }

  /* Several NEXRAD sites track the same cell. Collapse copies within MERGE_M. */
  const STORM_MERGE_M = 10000;
  const STORM_MIN_DBZ = 40;

  function dedupeStorms(features, bounds) {
    const picked = [];
    for (const f of features || []) {
      if (!f.geometry || !f.geometry.coordinates) continue;
      const [lon, lat] = f.geometry.coordinates;
      if (!bounds.contains([lat, lon])) continue;
      const p = f.properties || {};
      const z = Number(p.max_dbz) || 0;
      if (z < STORM_MIN_DBZ && !isSevereCell(p)) continue;
      let hit = null;
      for (const c of picked) {
        if (map.distance([c.lat, c.lon], [lat, lon]) < STORM_MERGE_M) {
          hit = c;
          break;
        }
      }
      if (!hit) {
        picked.push({ lat, lon, p, radars: [p.nexrad].filter(Boolean) });
      } else {
        if (p.nexrad && hit.radars.indexOf(p.nexrad) === -1) hit.radars.push(p.nexrad);
        if (stormScore(p) > stormScore(hit.p)) {
          hit.lat = lat;
          hit.lon = lon;
          hit.p = p;
        }
      }
    }
    return picked;
  }

  async function loadStorms() {
    if (!$("ly-storms").checked) return;
    try {
      const res = await fetch(IEM_STORMS);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const gj = await res.json();
      stormGroup.clearLayers();
      const b = map.getBounds().pad(0.35);
      const cells = dedupeStorms(gj.features, b);
      let n = 0;
      let arrows = 0;
      for (const cell of cells) {
        const { lat, lon, p } = cell;
        n += 1;
        const z = Number(p.max_dbz) || 0;
        const color = dbzColor(z);
        const r = Math.max(5, Math.min(14, z / 5));
        const marker = L.circleMarker([lat, lon], {
          radius: r,
          color,
          weight: p.tvs && p.tvs !== "NONE" ? 3 : 1.5,
          fillColor: color,
          fillOpacity: 0.35,
        });
        const drct = Number(p.drct);
        const sknt = Number(p.sknt);
        if (Number.isFinite(drct) && Number.isFinite(sknt) && sknt > 0) {
          /* IEM drct is meteorological: direction the cell is coming FROM.
             Arrow must point the other way (where it is headed). */
          const heading = (drct + 180) % 360;
          const km = (sknt * 1.852) * (20 / 60); /* 20 minutes of motion */
          const dest = destPoint(lat, lon, heading, km);
          L.polyline([[lat, lon], dest], {
            color,
            weight: 2,
            opacity: 0.85,
          }).addTo(stormGroup);
          const tip = destPoint(dest[0], dest[1], heading + 150, Math.min(2.2, km * 0.25));
          const tip2 = destPoint(dest[0], dest[1], heading - 150, Math.min(2.2, km * 0.25));
          L.polygon([dest, tip, tip2], {
            color,
            fillColor: color,
            fillOpacity: 0.9,
            weight: 1,
          }).addTo(stormGroup);
          arrows += 1;
        }
        const radarList = (cell.radars && cell.radars.length ? cell.radars.join(", ") : (p.nexrad || ""));
        marker.bindPopup(`
          <strong>Storm ${p.storm_id || "?"} · ${radarList}</strong>
          <div class="popup-kv">
            <span>Max dBZ</span><span>${p.max_dbz ?? "—"}</span>
            <span>Top</span><span>${p.top ?? "—"} kft</span>
            <span>VIL</span><span>${p.vil ?? "—"}</span>
            <span>Motion toward</span><span>${Number.isFinite(drct) ? ((drct + 180) % 360) + "°" : "—"} at ${Number.isFinite(sknt) ? sknt + " kt" : "—"}</span>
            <span>Hail POH</span><span>${p.poh ?? "—"}% · size ${p.max_size ?? "—"} in</span>
            <span>TVS / MESO</span><span>${p.tvs || "NONE"} / ${p.meso || "NONE"}</span>
            <span>Valid</span><span>${p.valid || "—"}</span>
          </div>`);
        marker.addTo(stormGroup);
      }
      const when = gj.generated_at || "live";
      setStatus(
        "storms",
        "ok",
        `Storms: ${n} in view (${arrows} with motion) · ${when}`
      );
    } catch (err) {
      stormGroup.clearLayers();
      setStatus("storms", "err", `Storms failed: ${err.message}`);
    }
  }

  $("ly-storms").addEventListener("change", () => {
    if ($("ly-storms").checked) loadStorms();
    else stormGroup.clearLayers();
  });
  let stormMoveTimer = null;
  map.on("moveend", () => {
    if (!$("ly-storms").checked) return;
    clearTimeout(stormMoveTimer);
    stormMoveTimer = setTimeout(loadStorms, 500);
  });
  loadStorms();
  setInterval(loadStorms, 120 * 1000);

  /* ---------- Lightning (Blitzortung community websocket) ---------- */
  const lightningGroup = L.layerGroup().addTo(map);
  const strikes = []; /* {lat,lon,t,marker} */
  let ws = null;
  let wsIdx = 0;
  let wsRetry = 0;
  let strikeCount = 0;

  function lzwDecode(input) {
    const dict = {};
    const chars = Array.from(input);
    if (!chars.length) return "";
    let c = chars[0];
    let f = c;
    const out = [c];
    let h = 256;
    let o = h;
    for (let i = 1; i < chars.length; i++) {
      const code = chars[i].charCodeAt(0);
      const a = h > code ? chars[i] : dict[code] !== undefined ? dict[code] : f + c;
      out.push(a);
      c = a.charAt(0);
      dict[o] = f + c;
      o += 1;
      f = a;
    }
    return out.join("");
  }

  function ageColor(ageMs) {
    if (ageMs < 30_000) return "#fff7c2";
    if (ageMs < 120_000) return "#ffe14a";
    if (ageMs < 300_000) return "#ff9f1a";
    return "#ff4d4d";
  }

  function pruneStrikes() {
    const cutoff = Date.now() - 8 * 60 * 1000;
    for (let i = strikes.length - 1; i >= 0; i--) {
      if (strikes[i].t < cutoff) {
        lightningGroup.removeLayer(strikes[i].marker);
        strikes.splice(i, 1);
      } else {
        const age = Date.now() - strikes[i].t;
        strikes[i].marker.setStyle({
          color: ageColor(age),
          fillColor: ageColor(age),
          opacity: Math.max(0.25, 1 - age / (8 * 60 * 1000)),
          fillOpacity: Math.max(0.15, 0.8 - age / (8 * 60 * 1000)),
        });
      }
    }
  }

  function addStrike(lat, lon, t) {
    if (!$("ly-lightning").checked) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const b = map.getBounds().pad(0.15);
    if (!b.contains([lat, lon])) return;
    const now = Date.now();
    const ts = t && t > 1e12 ? (t > 1e15 ? t / 1e6 : t) : now;
    const marker = L.circleMarker([lat, lon], {
      radius: 4,
      color: ageColor(0),
      fillColor: "#fff",
      fillOpacity: 0.9,
      weight: 1.5,
    }).bindPopup(
      `<strong>Lightning</strong><br>${new Date(ts).toLocaleTimeString("en-US", {
        timeZone: "America/New_York",
      })} ET<br>${lat.toFixed(3)}, ${lon.toFixed(3)}<br><small>Blitzortung.org</small>`
    );
    marker.addTo(lightningGroup);
    strikes.push({ lat, lon, t: ts, marker });
    strikeCount += 1;
    if (strikes.length > 800) {
      const old = strikes.shift();
      lightningGroup.removeLayer(old.marker);
    }
  }

  function parseStrike(obj) {
    if (!obj || typeof obj !== "object") return;
    const lat = obj.lat ?? obj.latitude;
    const lon = obj.lon ?? obj.lng ?? obj.longitude;
    const t = obj.time ?? obj.t;
    addStrike(Number(lat), Number(lon), t);
  }

  function connectLightning() {
    if (!$("ly-lightning").checked) return;
    if (ws) {
      try { ws.close(); } catch (_) {}
      ws = null;
    }
    const url = BLITZ_WS[wsIdx % BLITZ_WS.length];
    try {
      ws = new WebSocket(url);
    } catch (err) {
      setStatus("lightning", "err", `Lightning WS blocked: ${err.message}`);
      return;
    }
    ws.binaryType = "arraybuffer";
    ws.onopen = () => {
      wsRetry = 0;
      ws.send('{"a":111}');
      setStatus("lightning", "ok", "Lightning: Blitzortung live (in view, last ~8 min)");
    };
    ws.onmessage = (ev) => {
      try {
        let raw;
        if (typeof ev.data === "string") raw = ev.data;
        else raw = new TextDecoder("latin1").decode(ev.data);
        const decoded = lzwDecode(raw);
        const obj = JSON.parse(decoded);
        if (Array.isArray(obj)) obj.forEach(parseStrike);
        else parseStrike(obj);
      } catch (_) {
        /* keep-alives / incomplete frames */
      }
    };
    ws.onerror = () => {
      setStatus("lightning", "warn", "Lightning socket error — retrying…");
    };
    ws.onclose = () => {
      wsIdx += 1;
      wsRetry += 1;
      if (!$("ly-lightning").checked) return;
      if (wsRetry > 8) {
        setStatus(
          "lightning",
          "err",
          "Lightning unavailable (Blitzortung websocket failed). Not faking strikes."
        );
        return;
      }
      setTimeout(connectLightning, Math.min(15000, 1000 * wsRetry));
    };
  }

  $("ly-lightning").addEventListener("change", () => {
    if ($("ly-lightning").checked) {
      connectLightning();
    } else {
      if (ws) try { ws.close(); } catch (_) {}
      ws = null;
      lightningGroup.clearLayers();
      strikes.length = 0;
      setStatus("lightning", "ok", "Lightning off");
    }
  });
  connectLightning();
  setInterval(() => {
    pruneStrikes();
    if ($("ly-lightning").checked && flags.lightning !== "err") {
      setStatus(
        "lightning",
        "ok",
        `Lightning: ${strikes.length} in memory · ${strikeCount} received`
      );
    }
  }, 15000);

  /* ---------- ADS-B aircraft ---------- */
  const trailGroup = L.layerGroup().addTo(map);
  const planeGroup = L.layerGroup().addTo(map);
  const planeMarkers = new Map();
  const planeTrails = new Map();
  const TRAIL_MAX = 40;

  function altColor(alt) {
    if (alt == null || alt === "ground") return "#9aa8c2";
    const a = Number(alt);
    if (a < 3000) return "#6dffb0";
    if (a < 10000) return "#6ee0ff";
    if (a < 25000) return "#ffe14a";
    return "#ff9f1a";
  }

  function planeSvg(color) {
    return `<svg viewBox="0 0 10 12" width="10" height="12" xmlns="http://www.w3.org/2000/svg">
      <path fill="${color}" stroke="#070b14" stroke-width="0.8"
        d="M5 0.6 L9.6 11.2 L5 8.4 L0.4 11.2 Z"/></svg>`;
  }

  function pushTrail(id, lat, lon, color) {
    const bounds = map.getBounds();
    const pt = [lat, lon];
    if (!bounds.contains(pt)) {
      dropTrail(id);
      return;
    }
    let tr = planeTrails.get(id);
    if (!tr) {
      const line = L.polyline([pt], {
        color,
        weight: 2,
        opacity: 0.75,
        lineJoin: "round",
        interactive: false,
      }).addTo(trailGroup);
      tr = { line, pts: [pt] };
      planeTrails.set(id, tr);
      return;
    }
    tr.pts = tr.pts.filter((p) => bounds.contains(p));
    const last = tr.pts.length ? tr.pts[tr.pts.length - 1] : null;
    const moved = last ? map.distance(last, pt) : 999;
    if (last && moved < 40) {
      tr.line.setLatLngs(tr.pts);
      tr.line.setStyle({ color });
      return;
    }
    tr.pts.push(pt);
    if (tr.pts.length > TRAIL_MAX) tr.pts.splice(0, tr.pts.length - TRAIL_MAX);
    tr.line.setLatLngs(tr.pts);
    tr.line.setStyle({ color });
  }

  function dropTrail(id) {
    const tr = planeTrails.get(id);
    if (!tr) return;
    trailGroup.removeLayer(tr.line);
    planeTrails.delete(id);
  }

  function clipTrailsToBounds() {
    const bounds = map.getBounds();
    for (const id of [...planeTrails.keys()]) {
      const tr = planeTrails.get(id);
      if (!tr) continue;
      const mk = planeMarkers.get(id);
      const planeOnMap = !!(mk && bounds.contains(mk.getLatLng()));
      tr.pts = tr.pts.filter((pt) => bounds.contains(pt));
      if (!planeOnMap) {
        dropTrail(id);
        continue;
      }
      if (tr.pts.length < 2) {
        if (tr.pts.length === 0) {
          dropTrail(id);
        } else {
          tr.line.setLatLngs(tr.pts);
        }
        continue;
      }
      tr.line.setLatLngs(tr.pts);
    }
  }

  function clearPlanes() {
    planeGroup.clearLayers();
    trailGroup.clearLayers();
    planeMarkers.clear();
    planeTrails.clear();
  }

  function fmtAlt(alt) {
    if (alt == null || alt === "") return "—";
    if (alt === "ground") return "ground";
    const n = Number(alt);
    if (!Number.isFinite(n)) return String(alt);
    return Math.round(n).toLocaleString() + " ft";
  }

  function fmtGs(gs) {
    if (gs == null || gs === "") return "—";
    const n = Number(gs);
    if (!Number.isFinite(n)) return "—";
    return Math.round(n) + " kt";
  }

  function planeLabelHtml(call, alt, gs, onGround) {
    const a = onGround ? "gnd" : fmtAlt(alt);
    const s = fmtGs(gs);
    const safeCall = String(call).replace(/[<>&]/g, "");
    return `<div class="plane-mark">
      <div class="plane-rot">__SVG__</div>
      <div class="plane-label"><span class="cs">${safeCall}</span><span class="meta">${a} · ${s}</span></div>
    </div>`;
  }

  function viewRadiusNm() {
    const c = map.getCenter();
    const ne = map.getBounds().getNorthEast();
    const m = map.distance(c, ne);
    return Math.min(250, Math.max(50, Math.ceil(m / 1852)));
  }

  function isNativeCapacitor() {
    try {
      const Cap = window.Capacitor;
      return !!(Cap && typeof Cap.isNativePlatform === "function" && Cap.isNativePlatform());
    } catch (_) {
      return false;
    }
  }

  function isLocalDesktopServer() {
    const host = location.hostname;
    return (
      (location.protocol === "http:" || location.protocol === "https:") &&
      (host === "127.0.0.1" || host === "localhost")
    );
  }

  async function fetchJson(url) {
    // On Capacitor, CapacitorHttp (enabled in capacitor.config) patches fetch so
    // HTTPS calls to adsb.lol bypass WebView CORS. Desktop still uses /proxy/adsb.
    const CapHttp =
      (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp) ||
      null;
    if (isNativeCapacitor() && CapHttp && typeof CapHttp.request === "function") {
      const resp = await CapHttp.request({
        url,
        method: "GET",
        headers: { Accept: "application/json", "User-Agent": "MarionWxMap/1.0" },
      });
      const status = resp.status;
      let data = resp.data;
      if (typeof data === "string") {
        try {
          data = JSON.parse(data);
        } catch (_) {
          /* leave as string */
        }
      }
      return { ok: status >= 200 && status < 300, status, data };
    }
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return { ok: false, status: res.status, data: null };
    return { ok: true, status: res.status, data: await res.json() };
  }

  async function fetchAdsB(lat, lon, dist) {
    const directUrl = `${ADSB_DIRECT}/${lat.toFixed(4)}/${lon.toFixed(4)}/${dist}`;

    // Android / iOS Capacitor WebView: no local Python proxy — call adsb.lol over HTTPS.
    if (isNativeCapacitor()) {
      const { ok, status, data } = await fetchJson(directUrl);
      if (!ok) throw new Error(`adsb.lol HTTP ${status}`);
      if (data && data.error) throw new Error(data.error);
      return { data, via: "adsb.lol (Capacitor)" };
    }

    // Windows / desktop browser: require start.bat local proxy (CORS workaround).
    if (!isLocalDesktopServer() || location.protocol === "file:") {
      throw new Error("open via start.bat (address must be http://127.0.0.1:8765)");
    }
    try {
      const h = await fetch("/proxy/health", { cache: "no-store" });
      if (!h.ok) throw new Error("local server health " + h.status);
    } catch (e) {
      throw new Error("start.bat is not serving. Close extra windows, run start.bat, use http://127.0.0.1:8765");
    }
    const qs = `lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&dist=${dist}`;
    const url = `/proxy/adsb?${qs}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && data.error) throw new Error(data.error);
      const src = (data && data._source) || "adsb.lol via local proxy";
      return { data, via: src };
    } catch (err) {
      throw new Error(err.message || String(err));
    }
  }

  function normalizeAircraft(data) {
    if (Array.isArray(data.ac)) return data.ac;
    if (Array.isArray(data.aircraft)) return data.aircraft;
    if (Array.isArray(data.states)) {
      return data.states.map((s) => ({
        hex: s[0],
        flight: s[1],
        lon: s[5],
        lat: s[6],
        alt_baro: s[7] != null ? Math.round(s[7] * 3.28084) : null,
        gs: s[9] != null ? Math.round(s[9] * 1.94384) : null,
        track: s[10],
        on_ground: s[8],
      }));
    }
    return [];
  }

  async function loadPlanes() {
    if (!$("ly-planes").checked) return;
    const c = map.getCenter();
    const dist = viewRadiusNm();
    try {
      const { data, via } = await fetchAdsB(c.lat, c.lng, dist);
      const ac = normalizeAircraft(data);
      if (ac.length === 0 && planeMarkers.size > 0) {
        setStatus("planes", "warn", "Planes: empty refresh, keeping last positions");
        return;
      }
      const seen = new Set();
      let drawn = 0;
      for (const a of ac) {
        const lat = Number(a.lat);
        const lon = Number(a.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const id = a.hex || a.icao24 || `${lat},${lon}`;
        seen.add(id);
        const track = Number(a.track ?? a.heading ?? a.true_heading) || 0;
        const alt = a.alt_baro ?? a.alt_geom ?? a.alt;
        const gs = a.gs ?? a.speed;
        const call = (a.flight || a.callsign || "").toString().trim() || id.toUpperCase();
        const onGnd = !!(a.on_ground || alt === "ground");
        const color = altColor(onGnd ? "ground" : alt);
        const label = planeLabelHtml(call, alt, gs, onGnd).replace(
          "__SVG__",
          `<div style="transform:rotate(${track}deg)">${planeSvg(color)}</div>`
        );
        const icon = L.divIcon({
          className: "plane-wrap",
          html: label,
          iconSize: [88, 36],
          iconAnchor: [44, 6],
        });
        const html = `
          <strong>${call}</strong>
          <div class="popup-kv">
            <span>Callsign</span><span>${call}</span>
            <span>Alt</span><span>${onGnd ? "ground" : fmtAlt(alt)}</span>
            <span>Speed</span><span>${fmtGs(gs)}</span>
            <span>Heading</span><span>${Number.isFinite(track) ? Math.round(track) + "°" : "—"}</span>
            <span>Hex</span><span>${(a.hex || "—").toString().toUpperCase()}</span>
            <span>Type</span><span>${a.t || a.desc || "—"} ${a.r ? "· " + a.r : ""}</span>
          </div>`;
        pushTrail(id, lat, lon, color);
        if (planeMarkers.has(id)) {
          const mk = planeMarkers.get(id);
          mk.setLatLng([lat, lon]);
          mk.setIcon(icon);
          mk.setPopupContent(html);
        } else {
          const mk = L.marker([lat, lon], { icon, zIndexOffset: 400 });
          mk.bindPopup(html);
          mk.addTo(planeGroup);
          planeMarkers.set(id, mk);
        }
        drawn += 1;
      }
      for (const [id, mk] of planeMarkers) {
        if (!seen.has(id)) {
          planeGroup.removeLayer(mk);
          planeMarkers.delete(id);
          dropTrail(id);
        }
      }
      setStatus("planes", "ok", `Planes: ${drawn} · ${via} · ${dist} nm`);
    } catch (err) {
      const msg = String(err.message || err);
      const cors =
        /failed to fetch|cors|networkerror|load failed/i.test(msg) ||
        msg === "Failed to fetch";
      if (cors && planeMarkers.size === 0) {
        setStatus(
          "planes",
          "err",
          isNativeCapacitor()
            ? "Planes: network/ADS-B request failed on device."
            : "Planes: use start.bat and http://127.0.0.1:8765 (not a file:// page)."
        );
      } else {
        setStatus(
          "planes",
          "warn",
          `Planes refresh failed (${msg}). Keeping last positions.`
        );
      }
    }
  }

  $("ly-planes").addEventListener("change", () => {
    if ($("ly-planes").checked) loadPlanes();
    else {
      clearPlanes();
      setStatus("planes", "ok", "Planes off");
    }
  });
  loadPlanes();
  setInterval(loadPlanes, 12 * 1000);

  /* ---------- UX ---------- */
  map.on("moveend zoomend", () => {
    clipTrailsToBounds();
  });

  async function goZip() {
    const raw = ($("zip-input").value || "").trim();
    if (!/^\d{5}$/.test(raw)) {
      setStatus("zip", "err", "Enter a 5-digit ZIP");
      return;
    }
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${raw}`, { cache: "no-store" });
      if (!res.ok) {
        setStatus("zip", "err", "ZIP not found");
        return;
      }
      const data = await res.json();
      const place = data && Array.isArray(data.places) ? data.places[0] : null;
      if (!place) {
        setStatus("zip", "err", "ZIP not found");
        return;
      }
      const lat = Number(place.latitude);
      const lon = Number(place.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        setStatus("zip", "err", "ZIP not found");
        return;
      }
      const z = map.getZoom();
      const zoom = z >= 7 && z <= 14 ? z : DEFAULT_ZOOM;
      map.setView([lat, lon], zoom);
      const name = place["place name"] || raw;
      const st = place["state abbreviation"] || "";
      setStatus(
        "zip",
        "ok",
        `Centered on ${raw} · ${name}${st ? ", " + st : ""}`
      );
    } catch (_) {
      setStatus("zip", "err", "ZIP not found");
    }
  }

  $("btn-zip").addEventListener("click", () => {
    goZip();
  });
  $("zip-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      goZip();
    }
  });

  $("btn-marion").addEventListener("click", () => {
    map.setView([MARION.lat, MARION.lon], DEFAULT_ZOOM);
    setStatus("zip", "ok", "Centered on Marion, VA");
  });
  $("btn-fold").addEventListener("click", () => {
    const folded = $("hud").classList.toggle("folded");
    $("btn-fold").textContent = folded ? "▸" : "▾";
    $("btn-fold").setAttribute("aria-expanded", folded ? "false" : "true");
  });
})();
