# Marion Wx Map

**Free for everyone to use.** Optional donations help cover Ardean’s costs (hosting, time, tools) — this is not a paid product and not a commercial weather service.

Live map for **Marion, VA / Smyth County**: NEXRAD radar, NWS storm cells with real motion, Blitzortung lightning, and ADS-B aircraft. No Raspberry Pi, no RTL-SDR, no FlightRadar24 / FlightAware scraping.

## Run it

**Windows:** from the `wx-map` folder, double-click `start.bat` (or run `serve.ps1`) → http://127.0.0.1:8765

**Linux / Mac:**

```bash
cd wx-map
python3 serve.py
```

Radar / storms / lightning also work from `wx-map/index.html`; **planes need** the local server (CORS proxy for adsb.lol).

## Cost / API keys

**This app does not use Ardean’s (or anyone’s) paid API keys.** There is no Grok Bot, Cursor, OpenAI, Google Maps billing, or similar session tied to the publisher.

Anyone who runs it uses **their own computer** and hits **public free feeds** (IEM, RainViewer, Blitzortung, adsb.lol) from **their own IP**. Your running a copy does not create usage charges for the author.

Optional Cash App tips are only if you choose to help with his costs — the map stays free either way.

## Optional support

Tips are **100% optional**.

| Method | Handle |
|--------|--------|
| Cash App | [$AnthonyDean16](https://cash.app/$AnthonyDean16) |

## Credits & data

| Layer | Source |
|-------|--------|
| Radar | Iowa Environmental Mesonet (IEM) NEXRAD TMS; RainViewer fallback |
| Storms | IEM NWS storm attributes (real `drct` / `sknt`) |
| Lightning | Blitzortung.org community feed (credit contributors; non-commercial use of their data) |
| Planes | adsb.lol (local proxy); OpenSky fallback in server only |
| Basemap | Esri |

Be polite to free public APIs. Do not scrape FlightRadar24 or FlightAware.

## License

App code: [MIT](LICENSE). Third-party data feeds keep their own terms.

## Privacy

Runs in your browser / on your LAN. No account required for the map itself.
