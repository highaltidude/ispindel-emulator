import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(join(__dirname, '..', 'public')));

const state = {
  running: false,
  targetUrl: 'http://host.docker.internal:8080',
  deviceName: 'FermentOS-Test',
  deviceId: 12345678,
  intervalSeconds: 30,
  og: 1.065,
  fg: 1.012,
  currentGravity: 1.065,
  temperature: 20.0,
  battery: 4.1,
  fermentationStartedAt: null,
  lastSentAt: null,
  lastResponse: null,
  totalReadingsSent: 0,
};

function celsiusToFahrenheit(c) { return Math.round((c * 9/5 + 32) * 10) / 10; }
function fahrenheitToCelsius(f) { return Math.round((f - 32) * 5/9 * 10) / 10; }

function computeGravity(og, fg, elapsedMs) {
  const multiplier = parseFloat(process.env.TIME_MULTIPLIER || '100');
  const elapsedSimulatedMs = elapsedMs * multiplier;
  const totalFermentMs = 7 * 24 * 60 * 60 * 1000;
  const progress = Math.min(elapsedSimulatedMs / totalFermentMs, 1.0);
  const curve = 1 - Math.exp(-4 * progress);
  const gravity = og - (og - fg) * curve;
  return Math.round(gravity * 10000) / 10000;
}

function gravityToAngle(gravity, og, fg) {
  const progress = (gravity - og) / (fg - og);
  return Math.round((75 - progress * 50 + (Math.random() - 0.5) * 0.5) * 10) / 10;
}

let secondsSinceLastSend = 0;

async function sendReading() {
  if (state.fermentationStartedAt) {
    const elapsed = Date.now() - state.fermentationStartedAt;
    state.currentGravity = computeGravity(state.og, state.fg, elapsed);
  }

  const jitter = (Math.random() - 0.5) * 0.6;
  const temperature = Math.round((state.temperature + jitter) * 10) / 10;
  const angle = gravityToAngle(state.currentGravity, state.og, state.fg);

  const payload = {
    name: state.deviceName,
    ID: state.deviceId,
    angle,
    temperature,
    battery: state.battery,
    gravity: state.currentGravity,
    interval: state.intervalSeconds,
    RSSI: -72,
  };

  const url = `${state.targetUrl}/api/integrations/ispindel`;
  const timestamp = Date.now();

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.text();
    state.lastResponse = { status: res.status, body, timestamp, ok: res.ok };
  } catch (err) {
    state.lastResponse = { status: null, body: err.message, timestamp, ok: false };
  }

  state.lastSentAt = timestamp;
  state.totalReadingsSent += 1;

  return payload;
}

setInterval(async () => {
  if (!state.running) return;
  secondsSinceLastSend += 1;
  if (secondsSinceLastSend >= state.intervalSeconds) {
    secondsSinceLastSend = 0;
    await sendReading();
  }
}, 1000);

app.get('/api/state', (_req, res) => {
  res.json({ ...state, temperatureF: celsiusToFahrenheit(state.temperature) });
});

app.post('/api/start', (_req, res) => {
  state.running = true;
  if (!state.fermentationStartedAt) {
    state.fermentationStartedAt = Date.now();
  }
  secondsSinceLastSend = state.intervalSeconds;
  res.json({ ok: true });
});

app.post('/api/stop', (_req, res) => {
  state.running = false;
  res.json({ ok: true });
});

app.post('/api/config', (req, res) => {
  const { targetUrl, deviceName, intervalSeconds, og, fg, temperature } = req.body;
  if (targetUrl !== undefined) state.targetUrl = targetUrl;
  if (deviceName !== undefined) state.deviceName = deviceName;
  if (intervalSeconds !== undefined) state.intervalSeconds = Number(intervalSeconds);
  if (og !== undefined) state.og = Number(og);
  if (fg !== undefined) state.fg = Number(fg);
  if (temperature !== undefined) state.temperature = fahrenheitToCelsius(Number(temperature));
  res.json({ ok: true });
});

app.post('/api/override-gravity', (req, res) => {
  const { gravity } = req.body;
  if (gravity === undefined) return res.status(400).json({ error: 'gravity required' });
  state.currentGravity = Number(gravity);
  state.fermentationStartedAt = null;
  res.json({ ok: true });
});

app.post('/api/reset', (_req, res) => {
  state.currentGravity = state.og;
  state.fermentationStartedAt = Date.now();
  state.totalReadingsSent = 0;
  secondsSinceLastSend = 0;
  res.json({ ok: true });
});

app.post('/api/send-now', async (_req, res) => {
  const payload = await sendReading();
  secondsSinceLastSend = 0;
  res.json({ ok: true, payload });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`iSpindel Emulator running on port ${PORT}`);
});
