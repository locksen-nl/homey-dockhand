# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
homey app run      # Install on Homey + stream live logs (use this for development)
homey app install  # Install on Homey without logs (production-style install)
homey app build    # Compile compose files into .homeybuild/ — runs automatically on install/run
homey app publish  # Publish to the Homey App Store
homey app validate # Validate against publish requirements without publishing
```

The build output lands in `.homeybuild/` — never edit files there directly.

## Architecture

This is a **Homey SDK v3** app (Node.js, `>=12.3.0`) that integrates Dockhand (Docker management UI) into Homey. It is `platforms: ["local"]` only — widgets do not work on Homey Cloud.

### Source vs build

The Homey compose system merges source files into a final build:

| Source | Purpose |
|--------|---------|
| `.homeycompose/app.json` | Base manifest (no `drivers`/`capabilities`/`widgets` keys — those are composed) |
| `drivers/server/driver.compose.json` | Driver manifest, merged into `app.json` at build |
| `.homeycompose/capabilities/*.json` | Custom capability definitions |
| `widgets/containers/widget.compose.json` | Widget manifest |

After `homey app build`, everything is merged into `.homeybuild/app.json`. The root `app.json` (if present) is generated output — edit `.homeycompose/app.json` instead.

### Data flow

```
Dockhand REST API  (X-API-Token header, ?env=<id> query param on all container endpoints)
      ↓
lib/DockhandClient.js   — thin HTTP wrapper, native http/https
      ↓
drivers/server/device.js — polls every N seconds, stores _containers[], fires flow triggers
      ↓
drivers/server/driver.js — registers flow card handlers, autocomplete, onPair
      ↓
widgets/containers/api.js — widget backend; calls homey.app.getServerDevices()
      ↓
widgets/containers/public/ — dashboard widget UI (HTML/CSS/JS, calls Homey.api())
```

### Dockhand API

Base path: `{url}/api`. Auth via `Authorization: Bearer dh_...` header. Tokens always start with `dh_` and are generated in Dockhand under Profile (avatar) → API tokens → Generate token. `rejectUnauthorized: false` is intentional to support self-signed certificates. Key endpoints used:

- `GET /health` — connection test (no auth required)
- `GET /environments` — list environments for pairing
- `GET /containers?env={envId}` — all containers
- `POST /containers/{id}/start|stop|restart?env={envId}` — container actions

**The `?env=<envId>` query param is accepted by all container/stack/image endpoints.** The environment ID is stored in device settings as `endpoint_id`.

Dockhand is its own REST API (not a Docker proxy). Container responses use lowercase keys: `id`, `name`, `state`, `status`, `image`. There is no per-container stats endpoint — mem/cpu display is not available in the widget.

### Device lifecycle

`device.js` uses `homey.setInterval` for both the main container poll (`_pollInterval`) and the stats poll (`_statsInterval`). On each poll it diffs container states against `_prevStates` to fire `container_started`, `container_stopped`, or `container_crashed` triggers. The first poll is skipped for trigger detection to avoid spam on app restart.

When device settings change, `onSettings()` handles reconnection: changing `url`, `api_token`, or `endpoint_id` resets `_client` and triggers a fresh `_initClient()` + `_poll()`; changing `poll_interval` restarts `_startPolling()`.

### Widget

The widget frontend (`widgets/containers/public/`) polls `GET /containers` every 15 s via a recursive `setTimeout`. Containers are sorted running-first, then alphabetical. Memory and CPU usage ≥ 80% are highlighted. Container actions post to `POST /container` and trigger a refresh after 2.5 s.

`window.Homey.__()` only resolves `en` locale. All widget UI strings use a local `TRANSLATIONS` object and `t(key)` helper in `index.js`, which reads `navigator.language` to pick `nl` or `en`. Do not use `window.Homey.__()` for user-visible widget strings.

**Widget API routing** (`widgets/containers/api.js`): function names map to HTTP routes — `getContainers` → `GET /containers`, `controlContainer` → `POST /container`. The bridge to the driver is `homey.app.getServerDevices()`, implemented in `app.js`.

**Multi-device support**: `api.js` returns containers from all devices, each tagged with `deviceId` and `deviceName`. `controlContainer` accepts `deviceId` in the request body and routes to the matching device (falls back to `devices[0]`). The env-bar is only rendered when `devices.length > 1`.

### Flow cards

All flow cards are device-level (scoped to the Dockhand Server device). Registered in `driver.js#_registerFlowCards()`. Triggers: `container_started`, `container_stopped`, `container_crashed`, `server_offline`. Autocomplete for container args filters by state: "Start" shows only stopped containers, "Stop" shows only running containers.

Crash detection: a container is "crashed" when its state is `exited` and the status string contains `(` but not `(0)` (non-zero exit code). The same logic runs in both `device.js` and the widget frontend.

### Pairing

The pair flow is: `instructions` → `login` → `list_devices` (template) → `add_devices` (template).

`login.html` collects the Dockhand URL and API token, emits `validate` to the session handler in `driver.js`, which calls `GET /environments` as a connection test. On success, `list_devices` fetches environments and returns one device per environment. Environment objects are normalised with `env.id ?? env.Id` and `env.name || env.Name` to handle API response variations.

### App Store compliance notes

- `brandColor: "#14B8A6"` (teal)
- `compatibility: ">=12.3.0"` required for widgets
- `.homeychangelog.json` must be updated with each version bump
- App image sizes: `small.png` 250×175, `large.png` 500×350, `xlarge.png` 1000×700
- Widget previews: `preview-light.png` and `preview-dark.png` at 1024×1024
- Driver images in `drivers/server/assets/images/` must have white backgrounds
- Current placeholder images are copied from the Portainer app — replace before publishing
