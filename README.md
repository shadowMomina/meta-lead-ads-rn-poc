<div align="center">

# ⚡ Live Leads
### Meta Lead Ads → React Native, in real time

A proof of concept: when a lead is submitted through Meta's Lead Ads Testing Tool,
it appears **instantly** in an already-open React Native screen, with no refresh and
no touch on the device.

`Node.js` · `Express` · `Socket.IO` · `Meta Graph API` · `React Native` · `TypeScript`

</div>

---

## 📑 Table of contents
1. [Demo](#-demo)
2. [How it works](#-how-it-works)
3. [Project structure](#-project-structure)
4. [Prerequisites](#-prerequisites)
5. [Setup](#-setup)
6. [Run it](#-run-it)
7. [Test with Meta's Lead Testing Tool](#-test-with-metas-lead-testing-tool)
8. [Design decisions](#-design-decisions)
9. [Security notes](#-security-notes)
10. [Troubleshooting](#-troubleshooting)
11. [Assumptions & limitations](#-assumptions--limitations)

---

## 🎬 Demo
| Video | Link |
|---|---|
| Live demo (≤ 5 min) | `<paste Loom link>` |
| Code & architecture walkthrough | `<paste Loom link>` |

---

## 🧭 How it works

```
 ┌────────────────────┐   1. lead submitted
 │ Meta Lead Testing  │──────────────────────┐
 │ Tool               │                      ▼
 └────────────────────┘          ┌───────────────────────┐
                                 │ Meta webhook (leadgen)│  sends only a lead ID
                                 └───────────┬───────────┘
                                             │ 2. POST /webhook (via HTTPS tunnel)
                                             ▼
                                 ┌───────────────────────┐
                                 │ Express backend       │
                                 │  • verifies signature │
                                 │  • ignores duplicates │
                                 └───────────┬───────────┘
                                             │ 3. GET /{leadgen_id} (Graph API)
                                             ▼
                                 ┌───────────────────────┐
                                 │ Full lead data        │  name, email, time
                                 └───────────┬───────────┘
                                             │ 4. io.emit("newLead")
                                             ▼
                                 ┌───────────────────────┐
                                 │ React Native app      │  list updates instantly
                                 └───────────────────────┘
```

**Key idea:** Meta's webhook only carries a *lead ID*, not the person's details. The
backend uses its Page access token to fetch the full lead, then pushes it to the phone
over Socket.IO. The token never leaves the server.

---

## 🗂 Project structure

```
.
├── App.tsx               # React Native screen: connects, listens, renders the list
├── server/
│   ├── server.js         # Express + Socket.IO + webhook + Graph API fetch
│   ├── .env.example      # Template for secrets (copy to .env)
│   └── package.json
├── android/              # Native Android project
├── package.json
└── README.md
```

---

## 🧰 Prerequisites
- Node.js 20+ and npm
- Android Studio with an emulator (Pixel 7 used for the demo)
- A Meta developer app (use case: *Capture & manage ad leads with Marketing API*), published
- A Facebook Page with an active Instant Form
- The app assigned as a CRM for the Page (Business Settings → Leads access)
- `cloudflared` (or ngrok) for a public HTTPS address

---

## 🔧 Setup

```bash
# 1. install dependencies
npm install
cd server && npm install && cd ..

# 2. create your secrets file
cp server/.env.example server/.env
```

Fill in `server/.env`:

| Variable | What it is |
|---|---|
| `VERIFY_TOKEN` | Any word you choose. Meta sends it back during the webhook handshake |
| `PAGE_ACCESS_TOKEN` | Page access token for your Page (used to fetch lead details) |
| `APP_SECRET` | Your Meta app secret (used to verify webhook signatures) |
| `GRAPH_VERSION` | Graph API version, e.g. `v26.0` |

> 🔒 `.env` is git-ignored. Never commit real tokens.

---

## ▶️ Run it

Use four terminals.

```bash
# Terminal 1: backend
cd server && node server.js

# Terminal 2: Metro bundler
npx react-native start
adb reverse tcp:8081 tcp:8081

# Terminal 3: app on the emulator
npx react-native run-android

# Terminal 4: public tunnel
cloudflared tunnel --protocol http2 --url http://localhost:3000
```

Then in the Meta app dashboard → **Webhooks → Page**:
1. Callback URL: `https://<your-tunnel>/webhook`
2. Verify token: the value from `.env`
3. **Verify and save**, then subscribe to **leadgen**

> The tunnel address changes every time it restarts, so update the Callback URL each time.

---

## 🧪 Test with Meta's Lead Testing Tool

1. Open `developers.facebook.com/tools/lead-ads-testing`
2. Pick your Page and form
3. Click **Delete lead**, then **Create lead**
4. Watch the app: the new lead card appears on its own
5. Click **Track status** to see Meta's delivery result

For a quick local check without Meta, open `http://localhost:3000/test-lead` and a fake
lead is pushed to the app.

---

## 🧠 Design decisions

| Decision | Why |
|---|---|
| **Socket.IO** for push | Keeps one open connection; the server can send to every connected phone instantly, and it reconnects automatically |
| **Backend fetches the lead** | The webhook only carries an ID; fetching on the server keeps the access token off the device |
| **Reply `200` before fetching** | Meta expects a quick response and retries slow ones |
| **`seen` set + `id` check in app** | Meta can send the same notification twice; duplicates are ignored on both sides |
| **Signature check (`X-Hub-Signature-256`)** | Proves the request really came from Meta |
| **`10.0.2.2` in the app** | Inside the Android emulator, `localhost` means the emulator itself; `10.0.2.2` is the host computer |
| **Tunnel** | Meta's servers can't reach `localhost`, so a temporary public HTTPS address is needed |

---

## 🔐 Security notes
- Secrets live only in `server/.env` (git-ignored); `.env.example` has empty values
- Webhook requests are rejected if the HMAC signature doesn't match `APP_SECRET`
- The verify token is checked before the handshake is accepted
- The mobile app never sees the Page access token

---

## 🛠 Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Track status: `Failed to resolve host` | Meta has an old tunnel address | Update Callback URL, **Verify and save** |
| Track status stays `Pending` | App not published / CRM not assigned | Publish the app; assign it under Leads access |
| `could not fetch lead` in server log | Expired or wrong-type token | Generate a fresh **Page** token, restart server |
| App shows *Disconnected* | Backend not running or wrong host | Start the server; check `10.0.2.2:3000` |
| `Forbidden` on `/webhook` | Verify token mismatch | Check `.env`, restart the server |

---

## 📝 Assumptions & limitations

**Assumptions**
- Development setup on an Android emulator (not a physical device)
- A temporary tunnel is acceptable for the demo
- The Page access token is short-lived and refreshed before recording
- The client confirmed in writing that AI assistance was allowed

**Limitations**
- Leads are held in memory only (cleared on restart)
- No authentication on the socket connection
- The webhook URL must be re-registered whenever the tunnel restarts

---

<div align="center">

Built by **Momina Raheel** · Meta Lead Ads + React Native assessment

</div>
