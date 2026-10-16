const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const http = require('http');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const { VERIFY_TOKEN, PAGE_ACCESS_TOKEN, APP_SECRET } = process.env;
const GRAPH_VERSION = process.env.GRAPH_VERSION || 'v23.0';

// Keep the raw request body so we can check Meta's signature later
app.use(
    express.json({
        verify: (req, res, buf) => {
            req.rawBody = buf;
        },
    }),
);

app.get('/', (req, res) => {
    res.send('Backend is running');
});

io.on('connection', (socket) => {
    console.log('client connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('client disconnected:', socket.id);
    });
});

function broadcastLead(lead) {
    io.emit('newLead', lead);
}

// ---- Webhook step 1: Meta's one-time address check ----
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('webhook verified');
        return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
});

// ---- Check the request really came from Meta ----
function isValidSignature(req) {
    if (!APP_SECRET) {
        console.warn('APP_SECRET not set: skipping signature check');
        return true;
    }
    const header = req.get('X-Hub-Signature-256') || '';
    const expected =
        'sha256=' +
        crypto
            .createHmac('sha256', APP_SECRET)
            .update(req.rawBody || '')
            .digest('hex');
    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---- Fetch the full lead from the Graph API ----
async function fetchLead(leadgenId) {
    const url =
        `https://graph.facebook.com/${GRAPH_VERSION}/${leadgenId}` +
        `?access_token=${encodeURIComponent(PAGE_ACCESS_TOKEN)}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Graph API returned ${response.status}`);
    }
    const data = await response.json();

    // Meta returns fields as [{ name: 'email', values: ['a@b.com'] }, ...]
    const fields = {};
    for (const item of data.field_data || []) {
        fields[item.name] = (item.values || [])[0];
    }

    return {
        id: data.id || leadgenId,
        name:
            fields.full_name ||
            [fields.first_name, fields.last_name].filter(Boolean).join(' ') ||
            'Unknown',
        email: fields.email || 'no email',
        createdAt: data.created_time || new Date().toISOString(),
    };
}

// ---- Webhook step 2: a lead notification arrives ----
const seen = new Set(); // remembers lead IDs so duplicates are ignored

app.post('/webhook', (req, res) => {
    console.log('webhook POST received:', JSON.stringify(req.body));
    if (!isValidSignature(req)) {
        return res.sendStatus(403);
    }
    res.sendStatus(200); // reply fast so Meta doesn't retry

    for (const entry of req.body.entry || []) {
        for (const change of entry.changes || []) {
            if (change.field !== 'leadgen') continue;
            const leadgenId = change.value && change.value.leadgen_id;
            if (!leadgenId || seen.has(leadgenId)) continue;

            seen.add(leadgenId);
            fetchLead(leadgenId)
                .then(broadcastLead)
                .catch((err) => {
                    console.error('could not fetch lead:', err.message);
                    seen.delete(leadgenId); // allow a retry
                });
        }
    }
});

// Development-only fake lead
let counter = 0;
app.get('/test-lead', (req, res) => {
    counter += 1;
    const lead = {
        id: `test-${Date.now()}-${counter}`,
        name: `Test Lead ${counter}`,
        email: `test${counter}@example.com`,
        createdAt: new Date().toISOString(),
    };
    broadcastLead(lead);
    res.send(`Sent ${lead.id}`);
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});