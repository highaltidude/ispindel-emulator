# iSpindel Emulator

A standalone Docker tool for testing FermentOS locally. It emulates a physical [iSpindel](https://github.com/universam1/iSpindel) Wi-Fi hydrometer device, sending realistic HTTP POST payloads to a target FermentOS instance on a configurable interval.

**This is NOT part of the FermentOS monorepo.** It is a developer utility that lives alongside it.

---

## Quick Start

```bash
cd ispindel-emulator
docker compose up --build
```

Then open **http://localhost:3001** in your browser.

---

## Pointing it at FermentOS

| Environment | Target URL |
|---|---|
| Docker Desktop (Mac/Windows) | `http://host.docker.internal:8080` |
| Linux Docker | `http://<your-host-ip>:8080` |

Set the Target URL in the left config panel and click **Apply Config**.

> The `extra_hosts: host.docker.internal:host-gateway` entry in `docker-compose.yml` enables `host.docker.internal` on Linux. Docker Desktop handles this automatically on Mac and Windows.

---

## TIME_MULTIPLIER

The `TIME_MULTIPLIER` env var compresses simulated fermentation time.

- Default: `100`
- At `100x`, 7 days of fermentation completes in about **100 minutes** of real time
- At `1x`, the gravity curve runs at true real-time speed (7 days)
- Set it in `docker-compose.yml` or pass it with `-e TIME_MULTIPLIER=500`

Gravity follows a realistic exponential decay curve (fast drop early, slow finish) from OG → FG over the simulated fermentation period.

---

## UI Walkthrough

### Left Panel — Configuration
- **Target FermentOS URL** — where to POST readings
- **Device Name** — the `name` field sent in the payload
- **Send Interval** — how often to send readings (seconds, minimum 5)
- **OG / FG** — original and final gravity for the fermentation curve
- **Temperature** — base temperature; small random jitter (±0.3°F) is added per reading to simulate sensor noise
- Click **Apply Config** to push changes to the server without restarting

### Center Panel — Controls & Telemetry
- **START / STOP** — begins or pauses the automatic send loop; the fermentation clock starts on first START
- **Send Now** — fires one reading immediately regardless of running state
- **Reset to OG** — resets current gravity back to OG and restarts the fermentation clock
- Live telemetry polls every second: gravity, tilt angle, temperature, battery, reading count, last sent time, and a fermentation progress bar

### Right Panel — Override & Log
- **Manual Gravity Override** — set current gravity to any value directly; this detaches it from the fermentation curve until the next Reset
- **Last Response** — shows the HTTP status and body from the most recent POST to FermentOS
- **Activity Log** — last 20 events with timestamps, newest at top

---

## iSpindel Payload Format

The emulator POSTs to `{targetUrl}/api/integrations/ispindel` with this body:

```json
{
  "name": "FermentOS-Test",
  "ID": 12345678,
  "angle": 45.2,
  "temperature": 68.0,
  "battery": 4.1,
  "gravity": 1.048,
  "interval": 30,
  "RSSI": -72
}
```

This matches the payload format sent by a real iSpindel device.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | HTTP port for the emulator UI and API |
| `TIME_MULTIPLIER` | `100` | Fermentation time compression factor |

---

## Testing Without FermentOS

Use `nc` (netcat) on the host to inspect raw payloads:

```bash
# Mac/Linux
nc -l 8080

# Then set Target URL to http://host.docker.internal:8080 and hit Send Now
```
