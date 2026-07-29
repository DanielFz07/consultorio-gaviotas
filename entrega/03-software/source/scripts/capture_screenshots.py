#!/usr/bin/env python3
"""
capture_screenshots.py — Toma screenshots de la app Consultorio Las Gaviotas corriendo
usando Playwright. Las guarda en .cache/screenshots/ para embeber en
el PDF de prototipo UI.

Uso:
    python3 scripts/capture_screenshots.py
"""

import os
import subprocess
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / ".cache" / "screenshots"
OUT.mkdir(parents=True, exist_ok=True)

BASE = "http://localhost:4321"

PAGES = [
    {"path": "/login", "name": "01-login", "title": "Login", "auth": False},
    {"path": "/dashboard", "name": "02-dashboard", "title": "Dashboard", "auth": True},
    {"path": "/pacientes", "name": "03-pacientes", "title": "Pacientes", "auth": True},
    {"path": "/inventario", "name": "04-inventario", "title": "Inventario", "auth": True},
    {"path": "/servicios", "name": "05-servicios", "title": "Servicios", "auth": True},
    {"path": "/facturas", "name": "06-facturacion", "title": "Facturación", "auth": True},
    {"path": "/consultas", "name": "07-consultas", "title": "Consultas", "auth": True},
    {"path": "/usuarios", "name": "08-usuarios", "title": "Usuarios", "auth": True},
]


def login(page, username="admin", password="admin123"):
    """Login as admin via API and set the cookie."""
    r = page.context.request.post(
        f"http://localhost:3001/api/auth/login",
        data={"username": username, "password": password},
        headers={"Content-Type": "application/json"},
    )
    if not r.ok:
        raise RuntimeError(f"login failed: {r.status} {r.text()}")
    data = r.json()
    # Set cookie
    page.context.add_cookies([{
        "name": "consultorio-gaviotas_token",
        "value": data["token"],
        "url": BASE,
        "httpOnly": True,
        "sameSite": "Lax",
    }])


def main():
    # Verify services are up
    try:
        import urllib.request
        urllib.request.urlopen("http://localhost:4321", timeout=2)
        urllib.request.urlopen("http://localhost:3001/api/health", timeout=2)
    except Exception as e:
        print(f"ERROR: servicios no disponibles: {e}")
        print("Iniciá docker compose up -d")
        sys.exit(1)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=2,  # retina
        )
        page = ctx.new_page()

        # Capture unauthenticated pages
        print("Capturando páginas...")
        for spec in PAGES:
            if spec["auth"]:
                # Login first
                page.goto(BASE)
                login(page)
            else:
                page.context.clear_cookies()

            page.goto(BASE + spec["path"], wait_until="networkidle")
            time.sleep(0.5)  # small wait for fonts

            out = OUT / f"{spec['name']}.png"
            page.screenshot(path=str(out), full_page=True)
            size = out.stat().st_size // 1024
            print(f"  ✓ {spec['name']}.png ({size} KB)")

        browser.close()

    print(f"\n✓ {len(PAGES)} screenshots en {OUT}")


if __name__ == "__main__":
    main()