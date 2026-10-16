# ⚡ Live Leads: Meta Lead Ads → React Native

When a lead is submitted through Meta's **Lead Ads Testing Tool**, it appears
**instantly** in an already-open React Native screen. No refresh, no touch on the device.

**Stack:** Node.js · Express · Socket.IO · Meta Graph API · React Native · TypeScript

## 🎬 Demo
- Live demo (≤ 5 min): `<paste link>`
- Code & architecture walkthrough: `<paste link>`

## 🧭 How it works

```
Lead Testing Tool → Meta webhook (leadgen, sends only a lead ID)
        → Express backend (/webhook, public through an HTTPS tunnel)
        → Graph API call fetches the full lead (name, email, time)
        → Socket.IO event "newLead"
        → React Native screen adds it to the list
```

Meta's webhook carries only a **lead ID**. The backend uses its Page access token to
fetch the lead's details, then pushes it to the app. The token never reaches the phone.

## 🗂 Structure

```
README.md
MetaLeadPoC/
├── App.tsx            # React Native screen: connects, listens, renders leads
├── android/           # Native Android project
└── server/
    ├── server.js      # Express + Socket.IO + webhook + Graph API fetch
    └── .env.example   # Template for secrets
```

## 🔧 Setup

Requirements: Node.js, Android Studio with an emulator, a published Meta app
(use case *Capture & manage ad leads*), a Facebook Page with an active lead form,
the app assigned as CRM under Business Settings → Leads access, and `cloudflared`.

```bash
cd MetaLeadPoC
npm install
cd server && npm install && cd ..
copy server\.env.example server\.env      # Windows
```

Fill in `server/.env`:

| Variable | Purpose |
|---|---|
| `VERIFY_TOKEN` | Any word you choose; Meta sends it back in the webhook handshake |
| `PAGE_ACCESS_TOKEN` | Page token used to fetch lead details |
| `APP_SECRET` | Used to verify webhook signatures |
| `GRAPH_VERSION` | Graph API version, e.g. `v26.0` |

## ▶️ Run

From the `MetaLeadPoC` folder, in four terminals:

```bash
cd server && node server.js                                   # 1. backend
npx react-native start && adb reverse tcp:8081 tcp:8081       # 2. Metro
npx react-native run-android --active-arch-only               # 3. app on emulator
cloudflared tunnel --protocol http2 --url http://localhost:3000   # 4. public tunnel
```

In the Meta dashboard → **Webhooks → Page**: Callback URL `https://<tunnel>/webhook`,
your verify token, **Verify and save**, then subscribe to **leadgen**.
The tunnel address changes on every restart, so update the Callback URL each time.

## 🧪 Test

1. Open `developers.facebook.com/tools/lead-ads-testing`, pick the Page and form.
2. Click **Delete lead**, then **Create lead**.
3. The lead card appears in the app on its own. **Track status** shows the delivery result.

Local shortcut: `http://localhost:3000/test-lead` pushes a fake lead.

## 🧠 Key decisions
- **Socket.IO**: one open connection, instant push, automatic reconnect.
- **Reply `200` first**, then fetch the lead, because Meta retries slow responses.
- **Duplicates**: a `seen` set on the server and an `id` check in the app.
- **Signature check** (`X-Hub-Signature-256`) proves the request came from Meta.
- **`10.0.2.2`** is how the Android emulator reaches the host computer.
- **Secrets** live only in `server/.env` (git-ignored).

## 📝 Assumptions & limitations
- Runs on an Android emulator with a temporary tunnel; the Page token is short-lived.
- Leads are kept in memory only, and the socket has no authentication.
- The client confirmed in writing that AI assistance was allowed.

---
Built by **Momina Raheel**
