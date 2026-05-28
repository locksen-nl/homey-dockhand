# Dockhand API Reference
> Samengesteld voor de ontwikkeling van de Homey Pro app  
> Dockhand versie: v1.0.29 (mei 2026)  
> Geen officiële OpenAPI/Swagger docs — endpoints handmatig gedocumenteerd via broncode en MCP-server project

---

## Inhoudsopgave
1. [Basisinfo](#basisinfo)
2. [Authenticatie](#authenticatie)
3. [Environments](#environments)
4. [Containers](#containers)
5. [Stacks](#stacks)
6. [Dashboard & Stats](#dashboard--stats)
7. [Images](#images)
8. [Netwerken](#netwerken)
9. [Volumes](#volumes)
10. [Systeem](#systeem)
11. [SSE Responses](#sse-responses)
12. [Homey App — Relevante Endpoints](#homey-app--relevante-endpoints)
13. [Bekende Valkuilen](#bekende-valkuilen)

---

## Basisinfo

| | |
|---|---|
| **Base URL** | `http://<server-ip>:3001` (of jouw poort) |
| **API prefix** | `/api` |
| **Auth methode** | Session cookie (POST /api/auth) |
| **Content-Type** | `application/json` |
| **Environment param** | `?env=<environmentId>` — **verplicht** bij bijna alle endpoints |

> ⚠️ **Belangrijk:** Zonder `?env=<id>` geven container/stack/image/network/volume endpoints lege arrays terug — geen foutmelding!

---

## Authenticatie

### Inloggen
```
POST /api/auth
```

**Request body:**
```json
{
  "username": "admin",
  "password": "jouw-wachtwoord"
}
```

**Response:** Sessie cookie wordt automatisch gezet door de server.

**Gedrag:**
- Sessie verloopt na **24 uur**
- Bij een `401` response: opnieuw inloggen
- Sla de cookie op in geheugen en meesturen bij elke volgende request

### Sessie controleren
```
GET /api/auth/session
```

**Response:**
```json
{
  "authenticated": true,
  "user": {
    "id": 1,
    "username": "admin"
  }
}
```

### Auth providers ophalen
```
GET /api/auth/providers
```

### Uitloggen
```
POST /api/auth/logout
```

---

## Environments

> Environments zijn Docker hosts die Dockhand beheert. De `id` van een environment is de `?env=` parameter die overal nodig is.

### Alle environments ophalen
```
GET /api/environments
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "local",
    "type": "local",
    "status": "connected",
    "dockerVersion": "24.0.5",
    "containerCount": 12
  }
]
```

### Specifieke environment ophalen
```
GET /api/environments/<id>
```

### Environment aanmaken
```
POST /api/environments
```

### Environment bijwerken
```
PUT /api/environments/<id>
```

### Environment verwijderen
```
DELETE /api/environments/<id>
```

### Verbinding testen
```
POST /api/environments/<id>/test
```

### Environment tijdzone ophalen/instellen
```
GET /api/environments/<id>/timezone
PUT /api/environments/<id>/timezone
```

### Metrics instellingen
```
GET /api/environments/<id>/update-check
PUT /api/environments/<id>/update-check
GET /api/environments/<id>/image-prune
PUT /api/environments/<id>/image-prune
```

---

## Containers

> Alle endpoints vereisen `?env=<environmentId>`

### Alle containers ophalen
```
GET /api/containers?env=<id>
```

**Response:**
```json
[
  {
    "id": "abc123def456",
    "name": "portainer",
    "image": "portainer/portainer-ce:latest",
    "status": "running",
    "state": "running",
    "created": 1700000000,
    "ports": [
      { "hostPort": 9000, "containerPort": 9000, "protocol": "tcp" }
    ],
    "labels": {}
  }
]
```

### Container details ophalen
```
GET /api/containers/<containerId>?env=<id>
```

### Container inspecteren (volledige Docker inspect)
```
GET /api/containers/<containerId>/inspect?env=<id>
```

### Container starten ⚡ SSE
```
POST /api/containers/<containerId>/start?env=<id>
```
> Geeft Server-Sent Events terug. Zie [SSE Responses](#sse-responses).

### Container stoppen ⚡ SSE
```
POST /api/containers/<containerId>/stop?env=<id>
```

### Container herstarten ⚡ SSE
```
POST /api/containers/<containerId>/restart?env=<id>
```

### Container pauzeren
```
POST /api/containers/<containerId>/pause?env=<id>
```

### Container hervatten
```
POST /api/containers/<containerId>/unpause?env=<id>
```

### Container hernoemen
```
POST /api/containers/<containerId>/rename?env=<id>
```
```json
{ "name": "nieuwe-naam" }
```

### Container logs ophalen
```
GET /api/containers/<containerId>/logs?env=<id>
```

**Query parameters:**
| Parameter | Type | Omschrijving |
|---|---|---|
| `tail` | number | Aantal regels (default: 100) |
| `since` | number | Unix timestamp |
| `timestamps` | boolean | Tijdstempels toevoegen |

### Container stats ophalen (realtime resources)
```
GET /api/containers/<containerId>/stats?env=<id>
```

**Response:**
```json
{
  "cpuPercent": 0.5,
  "memoryUsage": 52428800,
  "memoryLimit": 2147483648,
  "memoryPercent": 2.4,
  "networkRx": 1024,
  "networkTx": 2048,
  "blockRead": 0,
  "blockWrite": 0
}
```

### Geaggregeerde stats (alle containers)
```
GET /api/containers/stats?env=<id>
```

### Container processen ophalen (top)
```
GET /api/containers/<containerId>/top?env=<id>
```

### Beschikbare shells ophalen
```
GET /api/containers/<containerId>/shells?env=<id>
```

### Updates controleren
```
GET /api/containers/<containerId>/updates?env=<id>
```

### Uitstaande updates ophalen
```
GET /api/containers/updates?env=<id>
```

### Containers batch updaten ⚡ SSE
```
POST /api/containers/batch-update?env=<id>
```

### Container aanmaken
```
POST /api/containers?env=<id>
```

### Container verwijderen
```
DELETE /api/containers/<containerId>?env=<id>
```

### Bestandsbeheer in container
```
GET  /api/containers/<containerId>/files?env=<id>&path=/
GET  /api/containers/<containerId>/files/content?env=<id>&path=/etc/hosts
POST /api/containers/<containerId>/files?env=<id>
DELETE /api/containers/<containerId>/files?env=<id>&path=/pad/naar/bestand
```

---

## Stacks

> Alle endpoints vereisen `?env=<environmentId>`

### Alle stacks ophalen
```
GET /api/stacks?env=<id>
```

**Response:**
```json
[
  {
    "id": "mijn-stack",
    "name": "mijn-stack",
    "status": "running",
    "type": "internal",
    "containerCount": 3,
    "path": "/app/data/stacks/mijn-stack"
  }
]
```

### Stack details ophalen
```
GET /api/stacks/<stackId>?env=<id>
```

### Stack aanmaken
```
POST /api/stacks?env=<id>
```
```json
{
  "name": "mijn-stack",
  "composeContent": "services:\n  app:\n    image: nginx:latest"
}
```

### Stack starten ⚡ SSE
```
POST /api/stacks/<stackId>/start?env=<id>
```

### Stack stoppen ⚡ SSE
```
POST /api/stacks/<stackId>/stop?env=<id>
```

### Stack herstarten ⚡ SSE
```
POST /api/stacks/<stackId>/restart?env=<id>
```

### Stack neergehaald (compose down) ⚡ SSE
```
POST /api/stacks/<stackId>/down?env=<id>
```

### Stack verwijderen
```
DELETE /api/stacks/<stackId>?env=<id>
```

### Compose bestand lezen/updaten
```
GET /api/stacks/<stackId>/compose?env=<id>
PUT /api/stacks/<stackId>/compose?env=<id>
```

### Environment variabelen
```
GET /api/stacks/<stackId>/env?env=<id>
PUT /api/stacks/<stackId>/env?env=<id>
GET /api/stacks/<stackId>/env/raw?env=<id>
POST /api/stacks/<stackId>/env/validate?env=<id>
```

### Stacks scannen (filesystem)
```
GET /api/stacks/scan?env=<id>
```

### Stack adopteren (bestaande stack overnemen)
```
POST /api/stacks/adopt?env=<id>
```

---

## Dashboard & Stats

### Dashboard statistieken
```
GET /api/dashboard/stats?env=<id>
```

**Response:**
```json
{
  "containers": {
    "total": 15,
    "running": 12,
    "stopped": 2,
    "paused": 1
  },
  "images": {
    "total": 20,
    "size": 10737418240
  },
  "volumes": {
    "total": 8
  },
  "networks": {
    "total": 5
  },
  "host": {
    "cpuPercent": 12.5,
    "memoryUsed": 4294967296,
    "memoryTotal": 17179869184,
    "memoryPercent": 25.0,
    "diskUsed": 53687091200,
    "diskTotal": 500107862016
  }
}
```

### Dashboard voorkeuren
```
GET /api/dashboard/preferences
PUT /api/dashboard/preferences
```

### Activiteitsfeed
```
GET /api/activity?env=<id>
GET /api/activity/events?env=<id>
GET /api/activity/stats?env=<id>
GET /api/containers/<containerId>/activity?env=<id>
```

### Gecombineerde logs
```
GET /api/logs?env=<id>
```

---

## Images

> Alle endpoints vereisen `?env=<environmentId>`

### Alle images ophalen
```
GET /api/images?env=<id>
```

### Image details ophalen
```
GET /api/images/<imageId>?env=<id>
```

### Image history
```
GET /api/images/<imageId>/history?env=<id>
```

### Image taggen
```
POST /api/images/<imageId>/tag?env=<id>
```

### Image pullen
```
POST /api/images/pull?env=<id>
```
```json
{ "image": "nginx:latest" }
```

### Image pushen
```
POST /api/images/<imageId>/push?env=<id>
```

### Image scannen (Grype/Trivy)
```
POST /api/images/<imageId>/scan?env=<id>
```

### Image verwijderen
```
DELETE /api/images/<imageId>?env=<id>
```

---

## Netwerken

> Alle endpoints vereisen `?env=<environmentId>`

### Alle netwerken ophalen
```
GET /api/networks?env=<id>
```

### Netwerk details
```
GET /api/networks/<networkId>?env=<id>
```

### Netwerk aanmaken
```
POST /api/networks?env=<id>
```

### Netwerk verwijderen
```
DELETE /api/networks/<networkId>?env=<id>
```

### Container verbinden/verbreken
```
POST /api/networks/<networkId>/connect?env=<id>
POST /api/networks/<networkId>/disconnect?env=<id>
```

---

## Volumes

> Alle endpoints vereisen `?env=<environmentId>`

### Alle volumes ophalen
```
GET /api/volumes?env=<id>
```

### Volume details
```
GET /api/volumes/<volumeName>?env=<id>
```

### Volume aanmaken
```
POST /api/volumes?env=<id>
```

### Volume browsen
```
GET /api/volumes/<volumeName>/browse?env=<id>
```

### Volume klonen
```
POST /api/volumes/<volumeName>/clone?env=<id>
```

### Volume verwijderen
```
DELETE /api/volumes/<volumeName>?env=<id>
```

---

## Systeem

### Health check
```
GET /api/health
```

### Database health
```
GET /api/health/db
```

### Host informatie
```
GET /api/system/host
```

### Systeem informatie
```
GET /api/system/info
```

### Schijfgebruik
```
GET /api/system/disk
```

### Changelog ophalen
```
GET /api/system/changelog
```

### Algemene instellingen
```
GET /api/settings
PUT /api/settings
```

### Prometheus metrics
```
GET /api/metrics
```

### Alles prunen
```
POST /api/system/prune?env=<id>
```

---

## SSE Responses

Start, stop, restart en deploy operaties geven **Server-Sent Events** terug in plaats van gewone JSON. Dit is belangrijk voor de Homey app.

### Wat zijn SSE responses?
De server stuurt een stream van events terug. Elke regel begint met `data:` gevolgd door JSON.

### Voorbeeld SSE stroom:
```
data: {"type":"log","message":"Stopping container..."}

data: {"type":"log","message":"Container stopped"}

data: {"type":"done","success":true}
```

### Verwerken in Node.js (voor Homey app):
```javascript
const response = await fetch(`${baseUrl}/api/containers/${id}/restart?env=${envId}`, {
  method: 'POST',
  headers: { 'Cookie': sessionCookie }
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const text = decoder.decode(value);
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      if (data.type === 'done') {
        return data.success;
      }
    }
  }
}
```

---

## Homey App — Relevante Endpoints

Dit zijn de endpoints die de Homey app nodig heeft, in volgorde van implementatie:

### Fase 1 — Verbinding & Setup
| Actie | Endpoint |
|---|---|
| Inloggen | `POST /api/auth` |
| Sessie controleren | `GET /api/auth/session` |
| Environments ophalen | `GET /api/environments` |
| Health check | `GET /api/health` |

### Fase 2 — Container apparaten
| Actie | Endpoint |
|---|---|
| Containers ophalen (discovery) | `GET /api/containers?env=<id>` |
| Container status | `GET /api/containers/<id>?env=<id>` |
| Container starten | `POST /api/containers/<id>/start?env=<id>` |
| Container stoppen | `POST /api/containers/<id>/stop?env=<id>` |
| Container herstarten | `POST /api/containers/<id>/restart?env=<id>` |
| Container stats (CPU/RAM) | `GET /api/containers/<id>/stats?env=<id>` |

### Fase 3 — Dashboard widget
| Actie | Endpoint |
|---|---|
| Totaal overzicht | `GET /api/dashboard/stats?env=<id>` |
| Host metrics | `GET /api/dashboard/stats?env=<id>` → `host` object |

### Fase 4 — Flow triggers (optioneel)
| Actie | Endpoint |
|---|---|
| Updates checken | `GET /api/containers/updates?env=<id>` |
| Stacks ophalen | `GET /api/stacks?env=<id>` |

---

## Bekende Valkuilen

### 1. `?env=` altijd verplicht
Vergeten = lege array, geen foutmelding. Bouw een centrale `apiCall(path, envId)` helper die dit automatisch toevoegt.

### 2. SSE afhandeling
Start/stop/restart zijn geen gewone POST requests. Ze geven een stream terug. Gebruik `response.body.getReader()` of een SSE-library.

### 3. Sessie verloopt na 24 uur
Implementeer auto-relogin: bij een `401` response opnieuw inloggen en de request herhalen.

### 4. Container ID vs naam
De API gebruikt de volledige Docker container ID (64 tekens), niet de naam. Sla beide op bij device discovery.

### 5. Geen officiële API docs
Er is een feature request (#814 op GitHub) voor OpenAPI/Swagger. Endpoints kunnen veranderen met updates. Test altijd na een Dockhand update.

### 6. Authenticatie instellingen
Dockhand heeft auth standaard **uitgeschakeld** na installatie. Ga naar Settings → Authentication om het in te schakelen. Zonder auth werken alle API calls zonder cookie.

---

## Bronnen

- [Dockhand GitHub](https://github.com/Finsys/dockhand)
- [Dockhand Officiële Site](https://dockhand.pro)
- [Dockhand Manual](https://dockhand.pro/manual/)
- [Dockhand Docs](https://finsys-dockhand.mintlify.app/)
- [mcp-dockhand (alle endpoints gedocumenteerd)](https://github.com/strausmann/mcp-dockhand)
- [GitHub Issue #814 — OpenAPI request](https://github.com/Finsys/dockhand/issues/814)
