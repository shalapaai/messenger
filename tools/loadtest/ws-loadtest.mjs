import * as signalR from '@microsoft/signalr';

const args = parseArgs(process.argv.slice(2));

if (args.help) {
    console.log(`Usage: node ws-loadtest.mjs [options]

  --base-url <url>     API base URL                  (default: http://localhost:8080)
  --users <n>           number of simulated clients    (default: 8)
  --duration <sec>      how long to send messages for  (default: 20)
  --rate <n>             messages per second, per user  (default: 1)
  --no-pace-auth         skip pausing for the auth rate limiter
                          (only safe if the API runs with ASPNETCORE_ENVIRONMENT=Testing)
`);
    process.exit(0);
}

const baseUrl   = args.baseUrl ?? 'http://localhost:8080';
const userCount = Number(args.users ?? 8);
const duration  = Number(args.duration ?? 20) * 1000;
const rate      = Number(args.rate ?? 1);
const paceAuth  = args.pace !== false;

const PASSWORD    = 'LoadTest123!';
const AUTH_BATCH  = 9;      // stay under the "auth" policy limit of 10 req/min per IP
const AUTH_PAUSE  = 61_000;

main().catch(err => {
    console.error('Load test failed:', err);
    process.exit(1);
});

async function main() {
    console.log(`Target: ${baseUrl}  |  users: ${userCount}  |  duration: ${duration / 1000}s  |  rate: ${rate} msg/s per user\n`);

    console.log('--- Provisioning test users ---');
    const users = [];
    for (let i = 0; i < userCount; i++) {
        if (paceAuth && i > 0 && i % AUTH_BATCH === 0) {
            console.log(`Pausing ${AUTH_PAUSE / 1000}s to respect the auth rate limit (10 req/min per IP)...`);
            await sleep(AUTH_PAUSE);
        }

        const email = `loadtest_${i}@test.local`;
        const { token } = await registerOrLogin(email, PASSWORD);
        await createUserProfile(token, `LoadTest ${i}`);
        const userId = await getUserId(token);
        users.push({ index: i, email, token, userId });
        console.log(`  user ${i}: ${email} -> ${userId}`);
    }

    console.log('\n--- Creating shared group chat ---');
    const chatId = await createGroupChat(users[0].token, users.slice(1).map(u => u.userId));
    console.log(`  chatId: ${chatId}`);

    console.log('\n--- Opening SignalR connections ---');
    const connectLatencies = [];
    const joinLatencies    = [];
    const invokeLatencies  = [];
    const deliveryLatencies = [];
    let sentCount = 0;
    let receivedCount = 0;
    let sendErrors = 0;
    const errorSamples = [];

    for (const user of users) {
        const connection = new signalR.HubConnectionBuilder()
            .withUrl(`${baseUrl}/hubs/messenger`, { accessTokenFactory: () => user.token })
            .configureLogging(signalR.LogLevel.Warning)
            .build();

        connection.on('ReceiveMessage', payload => {
            receivedCount++;
            if (payload.senderId !== user.userId) return;
            const parsed = tryParseTag(payload.content);
            if (parsed) deliveryLatencies.push(Date.now() - parsed.ts);
        });

        const t0 = Date.now();
        await connection.start();
        connectLatencies.push(Date.now() - t0);

        const t1 = Date.now();
        await connection.invoke('JoinChat', chatId);
        joinLatencies.push(Date.now() - t1);

        user.connection = connection;
    }
    console.log(`  ${users.length} connections established and joined the chat`);

    console.log(`\n--- Sending messages for ${duration / 1000}s ---`);
    const seqCounters = new Map();
    const timers = users.map(user => {
        let busy = false;
        return setInterval(async () => {
            if (busy) return;
            busy = true;
            try {
                const seq = (seqCounters.get(user.index) ?? 0) + 1;
                seqCounters.set(user.index, seq);
                const content = JSON.stringify({ tag: 'LT', idx: user.index, seq, ts: Date.now() });

                const t0 = Date.now();
                await user.connection.invoke('SendMessage', { chatId, content });
                invokeLatencies.push(Date.now() - t0);
                sentCount++;
            } catch (err) {
                sendErrors++;
                if (errorSamples.length < 5) errorSamples.push(err.message ?? String(err));
            } finally {
                busy = false;
            }
        }, 1000 / rate);
    });

    await sleep(duration);
    timers.forEach(clearInterval);

    console.log('Waiting 2s for in-flight deliveries...');
    await sleep(2000);

    for (const user of users) await user.connection.stop();

    report({
        userCount,
        connectLatencies,
        joinLatencies,
        invokeLatencies,
        deliveryLatencies,
        sentCount,
        receivedCount,
        sendErrors,
        errorSamples,
    });
}

async function registerOrLogin(email, password) {
    const registerRes = await fetchWithRateLimitRetry(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    if (registerRes.ok) return { token: (await registerRes.json()).accessToken, isNew: true };
    if (registerRes.status !== 409) {
        throw new Error(`register ${email} failed: ${registerRes.status} ${await registerRes.text()}`);
    }

    const loginRes = await fetchWithRateLimitRetry(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    if (!loginRes.ok) throw new Error(`login ${email} failed: ${loginRes.status} ${await loginRes.text()}`);
    return { token: (await loginRes.json()).accessToken, isNew: false };
}

async function fetchWithRateLimitRetry(url, init, maxRetries = 2) {
    for (let attempt = 0; ; attempt++) {
        const res = await fetch(url, init);
        if (res.status !== 429 || attempt >= maxRetries) return res;
        console.log(`  429 from ${url} — waiting ${AUTH_PAUSE / 1000}s for the rate limit window to reset...`);
        await sleep(AUTH_PAUSE);
    }
}

async function createUserProfile(token, displayName) {
    const res = await fetch(`${baseUrl}/api/users/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ displayName, login: null, avatarColor: null, status: null, phone: null, city: null, department: null }),
    });
    if (!res.ok && res.status !== 409) {
        throw new Error(`create profile failed: ${res.status} ${await res.text()}`);
    }
}

async function getUserId(token) {
    const res = await fetch(`${baseUrl}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`GET /users/me failed: ${res.status} ${await res.text()}`);
    return (await res.json()).userId;
}

async function createGroupChat(creatorToken, memberIds) {
    const res = await fetch(`${baseUrl}/api/chats/group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creatorToken}` },
        body: JSON.stringify({ name: 'Load test', memberIds, avatarColor: null }),
    });
    if (!res.ok) throw new Error(`create group chat failed: ${res.status} ${await res.text()}`);
    return res.json();
}

function tryParseTag(content) {
    try {
        const obj = JSON.parse(content);
        return obj?.tag === 'LT' ? obj : null;
    } catch {
        return null;
    }
}

function report(r) {
    console.log('\n=== Results ===');
    console.log(`Users:               ${r.userCount}`);
    console.log(`Messages sent:       ${r.sentCount}`);
    console.log(`Messages received:   ${r.receivedCount}  (expected ~${r.sentCount * r.userCount} — every member receives every message)`);
    console.log(`Send errors:         ${r.sendErrors}`);
    if (r.errorSamples.length) console.log(`  sample: ${r.errorSamples.join(' | ')}`);

    printLatency('Connect (start())', r.connectLatencies);
    printLatency('Join chat (invoke JoinChat)', r.joinLatencies);
    printLatency('Send invoke round-trip (invoke SendMessage)', r.invokeLatencies);
    printLatency('End-to-end delivery (send -> own ReceiveMessage)', r.deliveryLatencies);
}

function printLatency(label, values) {
    if (values.length === 0) {
        console.log(`${label}: no data`);
        return;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    console.log(`${label}: avg=${avg.toFixed(0)}ms  p50=${percentile(sorted, 0.5)}ms  p95=${percentile(sorted, 0.95)}ms  p99=${percentile(sorted, 0.99)}ms  max=${sorted[sorted.length - 1]}ms  (n=${sorted.length})`);
}

function percentile(sortedValues, p) {
    const idx = Math.min(sortedValues.length - 1, Math.floor(p * sortedValues.length));
    return sortedValues[idx];
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function parseArgs(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--help' || arg === '-h') out.help = true;
        else if (arg === '--no-pace-auth') out.pace = false;
        else if (arg.startsWith('--')) {
            const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            out[key] = argv[++i];
        }
    }
    return out;
}
