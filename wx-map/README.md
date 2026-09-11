# Marion Wx Map

Phone-friendly full-screen map for **Ardean** in **Marion, VA / Smyth County**
(`36.8344, -81.5148`). Live NEXRAD radar, NWS storm cells with real motion,
Blitzortung lightning, and ADS-B aircraft. No Raspberry Pi, no RTL-SDR, no
API keys, no FlightRadar24 / FlightAware scraping.

## How to open

### Windows (no Python needed)

Double-click `start.bat`, or in PowerShell from this folder:

```
powershell -NoProfile -ExecutionPolicy Bypass -File .\serve.ps1
```

It should open http://127.0.0.1:8765 in your browser. Planes need this step.

Radar / storms / lightning also work if you just double-click `index.html`.
Planes will error until you use `start.bat`.

### Linux / Mac (or Windows if you already have Python)

**Recommended** (needed for the Planes layer — `adsb.lol` does not send CORS
headers):

```bash
cd wx-map
python3 serve.py
```

Then:

- Desktop: [http://127.0.0.1:8765](http://127.0.0.1:8765)
- Android Chrome on the same Wi‑Fi: `http://<this-computer-LAN-IP>:8765`

`serve.py` is a static file server plus a tiny same-origin proxy at
`/proxy/adsb`. That is the CORS workaround. It does **not** scrape FR24.

Radar, Storms, and Lightning work without the proxy:

```bash
python3 -m http.server 8765
```

Opening `index.html` as a `file://` page also works for those three layers.
**Planes will error** until you use `serve.py`.

## Layers

| Toggle     | Source | Notes |
|------------|--------|--------|
| **Radar**  | [IEM NEXRAD TMS](https://mesonet.agron.iastate.edu/ogc/) `nexrad-n0q` + `nexrad-n0q-m05m`…`m55m` | CONUS base reflectivity, ~5 min cadence, 1-hour loop. CORS `*`. If IEM tiles fail, falls back to [RainViewer](https://www.rainviewer.com/api/weather-maps-api.html) past frames (max native zoom 7). |
| **Storms** | [IEM `/geojson/nexrad_attr.py`](https://mesonet.agron.iastate.edu/geojson/nexrad_attr.py) | Live NWS storm-attribute cells. Arrows use **real** `drct` / `sknt` (20 minutes of motion). Nothing is invented. CORS `*`. |
| **Lightning** | Blitzortung.org community websocket (`wss://ws1/ws7/ws8.blitzortung.org`, `{"a":111}`) | Browser websocket (not CORS-gated). Strikes in the current view, last ~8 minutes. Credit: Blitzortung.org / contributors, CC-BY-SA. HTTP GeoJSON scrape is **not** used. |
| **Planes** | [adsb.lol](https://api.adsb.lol/docs) `/v2/point/{lat}/{lon}/{dist}` | Callsign, altitude, heading, speed on click. Refresh ~12 s. OpenSky is a server-side fallback only. |

**Recenter Marion** jumps back to 36.8344, −81.5148 at zoom 9.

## APIs curl-tested (2026-08-28)

These were fetched from the build environment before the UI was wired:

```text
RainViewer maps   GET https://api.rainviewer.com/public/weather-maps.json
                  HTTP 200, CORS *, 13 past frames, hash paths

RainViewer tile   GET {host}{path}/256/6/17/24/2/1_1.png
                  HTTP 200 image/png (11 085 bytes), CORS *

IEM NEXRAD tile   GET https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q/8/70/99.png
                  HTTP 200 image/png (26 767 bytes), CORS *
                  (Marion-area z/x/y). Also: nexrad-n0q-m05m, ridge::FCX-N0Q-0.

IEM storms        GET https://mesonet.agron.iastate.edu/geojson/nexrad_attr.py
                  HTTP 200 GeoJSON, CORS *, 802 cells; FCX/GSP cells near Marion
                  with drct/sknt populated.

adsb.lol          GET https://api.adsb.lol/v2/point/36.8344/-81.5148/150
                  HTTP 200 JSON, 78 aircraft. No Access-Control-Allow-Origin
                  (browser blocked → use serve.py).

OpenSky           GET https://opensky-network.org/api/states/all?lamin=35.5&lomin=-83.5&lamax=38.2&lomax=-79.5
                  TLS connect error from this host (unexpected EOF). Not used
                  in the browser. serve.py may retry it if adsb.lol is down.

airplanes.live    GET https://api.airplanes.live/v2/point/…  → HTTP 403
                  (contact required). Not used.

adsb.fi           GET https://api.adsb.fi/v2/point/…  → HTTP 404. Not used.
```

## Limits & terms

- **IEM**: free public GIS/TMS; be polite (radar tiles cache ~5 min; storms every 2 min).
- **RainViewer**: personal/educational; mention [rainviewer.com](https://www.rainviewer.com/); rate limits (tiles ~100–500/min/IP depending on era); nowcast/satellite discontinued 2026.
- **adsb.lol**: public OpenAPI, no key today; anonymous; ~12 s polling; radius capped at 250 nm.
- **OpenSky**: anonymous bbox is allowed but rate-limited; this environment could not complete TLS, so it is only a proxy fallback.
- **Blitzortung**: non-commercial, credit the project, do not scrape map.blitzortung.org GeoJSON. Their written policy prefers apps not hitting project servers; this map uses the documented community websocket because it is the public feed that works in a browser without a paid API. If the socket is refused, the UI shows an error and does **not** invent strikes.

## What could not be done legally / technically

| Wanted | Outcome |
|--------|---------|
| OpenSky anonymous live in the browser | TLS failed here; API also has no CORS. Proxy fallback only. |
| airplanes.live / adsb.fi | 403 / 404. |
| RainViewer lightning | Not in the public weather-maps API (satellite IR empty). |
| Storm *forecast* tracks | Not provided by IEM attributes. Real cell motion (`drct`/`sknt`) is shown instead. No fake arrows. |
| FlightRadar24 / FlightAware | Intentionally unused. |
| NLDN / paid lightning APIs | Restricted / paid. Skipped. |

## Files

- `index.html` `style.css` `app.js` — single-page Leaflet app (CDN Leaflet 1.9.4).
- `serve.py` — static server + `/proxy/adsb`.
- No build step. `python3 serve.py` is enough.
