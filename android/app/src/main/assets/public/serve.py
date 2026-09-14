#!/usr/bin/env python3
"""Static file server plus a tiny same-origin ADS-B proxy.

adsb.lol returns live aircraft JSON but does not send Access-Control-Allow-Origin,
so a browser page cannot call it directly. This proxy is the local workaround.
It does not scrape FlightRadar24 or FlightAware.

Usage:
  python3 serve.py
  python3 serve.py 8765
Then open http://localhost:8765 (or this machine's LAN IP on your phone).
"""
from __future__ import annotations

import json
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
CTX = ssl.create_default_context()
UA = "MarionWxMap/1.0 (personal; Smyth County VA)"


def http_get(url: str, timeout: float = 18.0) -> tuple[int, str, bytes]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as resp:
            return resp.status, resp.headers.get("Content-Type", "application/json"), resp.read()
    except urllib.error.HTTPError as e:
        body = e.read() if e.fp else b""
        return e.code, e.headers.get("Content-Type", "application/json") if e.headers else "application/json", body


def adsb_lol(lat: float, lon: float, dist: int) -> tuple[int, bytes]:
    url = f"https://api.adsb.lol/v2/point/{lat:.4f}/{lon:.4f}/{dist}"
    status, _ctype, body = http_get(url)
    return status, body


def opensky(lat: float, lon: float, dist_nm: int) -> tuple[int, bytes]:
    # 1 deg lat ~ 60 nm; pad a bbox around the point.
    dlat = max(0.6, dist_nm / 60.0)
    dlon = max(0.6, dist_nm / 50.0)
    url = (
        "https://opensky-network.org/api/states/all"
        f"?lamin={lat - dlat:.4f}&lomin={lon - dlon:.4f}"
        f"&lamax={lat + dlat:.4f}&lomax={lon + dlon:.4f}"
    )
    status, _ctype, body = http_get(url, timeout=20.0)
    return status, body


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/proxy/adsb":
            self._proxy_adsb(urllib.parse.parse_qs(parsed.query))
            return
        if parsed.path == "/proxy/health":
            body = json.dumps({"ok": True, "service": "marion-wx-map"}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def _proxy_adsb(self, qs: dict[str, list[str]]) -> None:
        try:
            lat = float(qs.get("lat", ["36.8344"])[0])
            lon = float(qs.get("lon", ["-81.5148"])[0])
            dist = int(float(qs.get("dist", ["150"])[0]))
        except (TypeError, ValueError):
            self.send_response(400)
            self._cors()
            body = b'{"error":"bad lat/lon/dist"}'
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        dist = max(10, min(dist, 250))
        status, body = adsb_lol(lat, lon, dist)
        source = "adsb.lol"
        if status != 200 or not body:
            os_status, os_body = opensky(lat, lon, dist)
            if os_status == 200 and os_body:
                status, body, source = os_status, os_body, "opensky"
            else:
                err = {
                    "error": "ADS-B upstream failed",
                    "adsb_lol": status,
                    "opensky": os_status,
                }
                body = json.dumps(err).encode()
                self.send_response(502)
                self.send_header("Content-Type", "application/json")
                self._cors()
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
        # Tag the source so the UI can say which feed answered.
        try:
            data = json.loads(body.decode("utf-8"))
            if isinstance(data, dict):
                data["_source"] = source
                body = json.dumps(data).encode()
        except (ValueError, UnicodeDecodeError):
            pass
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self._cors()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Marion Wx Map  http://127.0.0.1:{PORT}")
    print(f"On your phone, use this computer's LAN IP, port {PORT}.")
    print("Ctrl+C to stop.")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
