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

**Free for everyone to use.** Optional donations help cover Ardean’s costs (hosting, time, tools) — this is not a paid product and not a commercial weather service.

Live map for **Marion, VA / Smyth County**: NEXRAD radar, NWS storm cells with real motion, Blitzortung lightning, and ADS-B aircraft. No Raspberry Pi, no RTL-SDR, no FlightRadar24 / FlightAware scraping.

## Important — how to run (read this)

1. **Start the local server** with `wx-map/start.bat` (Windows) or `python3 serve.py` / `serve.ps1` from the `wx-map` folder.
2. **Keep the Command Prompt / terminal window open** while you use the map. Closing that window stops the local server; the page will stop loading layers correctly (especially **Planes**).
3. To use the map again later, **run the start file again** to re-launch the local server that serves the web content.
4. Then open **http://127.0.0.1:8765** in your browser (the start script usually opens it for you).

Radar / storms / lightning can also open from `wx-map/index.html` alone; **planes need** the local server (CORS proxy for adsb.lol).

### Aircraft trails

**Refreshing the browser page clears all aircraft trails.** Trails only build while the page stays open and the Planes layer is running. Keep the tab open if you want history on the map.

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
