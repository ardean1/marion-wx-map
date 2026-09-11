# Security policy

## What Marion Wx Map is (and is not)

Marion Wx Map is a **local browser map** (static files + a tiny localhost server for the ADS-B proxy). It loads **public** weather / lightning / ADS-B feeds from **your** computer’s IP.

It is **not**:
- a commercial weather service
- a cloud app that stores your location history for the publisher
- FlightRadar24 / FlightAware scraping
- something that uses the publisher’s paid API keys

Radar, storms, and lightning are public feeds. The Planes layer uses a same-origin localhost proxy so the browser can talk to adsb.lol.

## Trust checklist for users

1. Prefer downloading from this GitHub repository (or a Release you trust).
2. Run via `wx-map/start.bat` (or `serve.py` / `serve.ps1`) so traffic stays on `http://127.0.0.1:8765`.
3. Keep the Command Prompt / terminal open while using the map; closing it stops the local server.
4. Review `serve.py` / `serve.ps1` if you want to see exactly what the ADS-B proxy does.
5. Optional Cash App tips are unrelated to runtime; the map does not phone home for payments.

## Reporting a vulnerability

Please **do not** open a public issue for security bugs.

Use GitHub’s **private vulnerability reporting** on this repository (Security tab → Report a vulnerability), or contact the maintainer via their GitHub profile if private reporting is unavailable.

Include affected commit, steps, and impact (e.g. proxy SSRF, unexpected bind beyond localhost).

## Supported versions

Only the latest `main` branch is supported for security fixes.
