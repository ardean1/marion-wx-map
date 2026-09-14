```
 __        ____  __  __  __
 \ \      / /\ \/ / |  \/  | __ _ _ __
  \ \ /\ / /  \  /  | |\/| |/ _` | '_ \
   \ V  V /   /  \  | |  | | (_| | |_) |
    \_/\_/   /_/\_\ |_|  |_|\__,_| .__/
                                  |_|
         Marion · VA · Live layers
```

# Marion Wx Map

<p align="center"><img src="docs/logo.png" alt="Marion Wx Map logo" width="220"></p>

**Free for everyone to use.** Optional donations help cover Ardean’s costs (hosting, time, tools) — this is not a paid product and not a commercial weather service.

Live map for **Marion, VA / Smyth County**: NEXRAD radar, NWS storm cells with real motion, Blitzortung lightning, and ADS-B aircraft. No Raspberry Pi, no RTL-SDR, no FlightRadar24 / FlightAware scraping.

## New in this build

- **Aircraft trails** clear when a plane leaves the visible map (also re-clipped on pan/zoom). No more leftover scribbles off-screen.
- **ZIP box** in the left panel: enter a 5-digit US ZIP and Go (or Enter) to recenter. Marion home pin stays put; **Recenter Marion** jumps back home. Invalid ZIPs show an error — coordinates are never invented.

## Windows — download, run, and close (start here)

### 1. Download
1. Open the GitHub page in your browser.
2. Click the green **Code** button.
3. Click **Download ZIP**.
4. Save the ZIP somewhere easy, like your **Desktop** or **Downloads**.

### 2. Extract and keep the folder
1. Right-click the ZIP → **Extract All...** (or open it and drag the inner folder out).
2. Put the extracted folder somewhere permanent, for example your Desktop:
   - Desktop\marion-wx-map
3. Open that folder until you see the **wx-map** folder inside (with `start.bat`).

### 3. Launch
1. Open the **wx-map** folder.
2. Double-click **start.bat**.
3. A black **Command Prompt** window opens — **leave it open**.
4. Your browser should open http://127.0.0.1:8765 (if not, paste that address yourself).

You do **not** need Python on Windows. You do **not** need admin rights for a normal home PC.

### 4. Close properly
1. Close the **browser tab** for the map (optional but tidy).
2. Click the **Command Prompt** window that is running the map.
3. Press **Ctrl+C**, or click the **X** on that window.
4. That stops the local server. To use the map again later, double-click **start.bat** again.

**Tips:** Aircraft trails erase when planes leave the map view (or after pan/zoom). Use the **ZIP** box to recenter on a US ZIP; **Recenter Marion** jumps home. If planes fail, make sure the Command Prompt is still open and you are on http://127.0.0.1:8765 (not a file:// page).


## What you can click (drill-down)

Turn a layer on in the left panel, then **click a marker** on the map. A popup opens with live fields from that feed (nothing invented). Radar tiles themselves are not clickable for cell detail — use the **Storms** layer for that.

### Aircraft (Planes)
Click a plane icon (callsign sits under the arrow). You get:

| Field | Meaning |
|-------|---------|
| **Callsign** | Flight ID / ATC callsign when broadcast (e.g. `AAL123`). If missing, the ADS-B hex id is shown instead. |
| **Alt** | Barometric (or geometric) altitude, or **ground** if the aircraft reports on the ground. |
| **Speed** | Ground speed when available. |
| **Heading** | Track / true heading in degrees. |
| **Hex** | Mode S / ADS-B ICAO address (24-bit hex). |
| **Type** | Aircraft type code or description when the feed provides it; **registration / tail number** appears after `·` when the feed includes it (field `r` from adsb.lol). |

On-map label already shows callsign, altitude, and speed. Colored trails follow each aircraft while in view and clear when they leave the map (or after pan/zoom).

### Storm cells (Storms)
Click a colored storm circle (or its motion arrow). Cells below ~40 dBZ are hidden unless they carry TVS/MESO. Nearby duplicate tracks from multiple radars are merged. Popup shows:

| Field | Meaning |
|-------|---------|
| **Storm id · radars** | NWS storm attribute id and which NEXRAD site(s) reported it (e.g. FCX, GSP). |
| **Max dBZ** | Peak reflectivity in the cell (marker color scales with this). |
| **Top** | Echo top height in thousands of feet (kft). |
| **VIL** | Vertically Integrated Liquid (storm intensity / water content proxy). |
| **Motion toward** | Direction the cell is moving **toward** (degrees) and speed in knots. Arrow on the map is ~20 minutes of that motion. |
| **Hail POH · size** | Probability of Hail (%) and estimated max hail size (inches) from the attributes feed. |
| **TVS / MESO** | Tornado Vortex Signature and Mesocyclone flags (`NONE` when clear). Thicker ring on the marker when TVS is present. |
| **Valid** | Timestamp of the attribute product. |

### Lightning
Click a strike dot. You get:

- Local time of the strike (**America/New_York**)
- Approximate lat / lon (3 decimal places)
- Credit line: Blitzortung.org

Strikes are kept for roughly the last **8 minutes** in the current map view.

### Home pin
Click the Marion marker: **Marion, VA · Smyth County**.

### Not a drill-down
- **Radar** imagery is a looping tile layer (IEM NEXRAD, RainViewer fallback). Pan/zoom and play/pause the loop; there is no per-pixel storm popup on the radar alone.
- Layer toggles, **ZIP** recenter, **Recenter Marion**, and fold controls are UI only.


## Data sources (radar, aircraft, and more)

| Layer | Source |
|-------|--------|
| **Radar** | [Iowa Environmental Mesonet (IEM)](https://mesonet.agron.iastate.edu/ogc/) NEXRAD TMS (`nexrad-n0q` loop); [RainViewer](https://www.rainviewer.com/) fallback tiles |
| **Storms** | IEM [NWS storm attributes](https://mesonet.agron.iastate.edu/geojson/nexrad_attr.py) (real `drct` / `sknt` motion) |
| **Lightning** | [Blitzortung.org](https://www.blitzortung.org/) community websocket (credit contributors; non-commercial use of their data) |
| **Aircraft (ADS-B)** | [adsb.lol](https://api.adsb.lol/docs) via local `/proxy/adsb`; OpenSky is a server-side fallback only |
| **Basemap** | Esri Canvas Dark Gray |

Be polite to free public APIs. Do not scrape FlightRadar24 or FlightAware.

## Cost / API keys

**This app does not use Ardean’s (or anyone’s) paid API keys.** There is no Grok Bot, Cursor, OpenAI, Google Maps billing, or similar session tied to the publisher.

Anyone who runs it uses **their own computer** and hits **public free feeds** (IEM, RainViewer, Blitzortung, adsb.lol) from **their own IP**. Running a copy does not create usage charges for the author.

Optional Cash App tips are only if you choose to help with his costs — the map stays free either way.

## Trust & security

- Runs **locally** in your browser / on your LAN (`127.0.0.1`)
- Uses **public** weather and ADS-B feeds from **your** IP — no publisher API keys
- Does **not** scrape FlightRadar24 or FlightAware
- See [SECURITY.md](SECURITY.md) for the policy and how to report vulnerabilities privately
- Prefer this GitHub repo (or Releases) as the download source

## Optional support

Tips are **100% optional**.

| Method | Handle |
|--------|--------|
| Cash App | [$AnthonyDean16](https://cash.app/$AnthonyDean16) |

## License

App code: [MIT](LICENSE). Third-party data feeds keep their own terms.

## Privacy

Runs in your browser / on your LAN. No account required for the map itself.

## Credits

Built by **Tony Dean** (Ardean), Marion / Smyth County, Virginia.

Assisted by **Grok Bot** — AI teammates with their own computer: [https://x.ai/bot](https://x.ai/bot) · download: [https://cursor.com/download/bot](https://cursor.com/download/bot)
