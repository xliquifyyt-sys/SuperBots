// Super Bots online server: static game, account API, and the match websocket.
//
//   npm install
//   npm start
//   open http://localhost:8080

import { createServer } from 'http';
import { createReadStream, existsSync, statSync } from 'fs';
import { extname, join, normalize, resolve, sep } from 'path';
import { WebSocketServer } from 'ws';
import { authConfig, verifyApple, verifyGoogle } from './auth.js';
import {
  acceptFriend, addFriendRequest, createGuest, declineFriend, listNotifications, markNotificationRead,
  openDatabase, removeFriend, renameUser, searchUsers, upsertProviderUser, userByCode, userById, userByName, userByToken,
} from './db.js';
import { Hub } from './hub.js';

const ROOT = resolve(import.meta.dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp4': 'video/mp4' };

function dataFile() {
  const dir = process.env.DATA_DIR || join(ROOT, 'server', 'data');
  return process.env.DATA_FILE || join(dir, 'superbots.sqlite');
}

export function startServer({ port = Number(process.env.PORT || 8080), dataFile: file = dataFile(), staticFiles = true } = {}) {
  const db = openDatabase(file);
  const hub = new Hub(db);

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) { await handleApi(req, res, url, db, hub); return; }
      if (!staticFiles) { send(res, 404, { error: 'Not found' }); return; }
      serveStatic(url.pathname, res);
    } catch (err) {
      console.error(err);
      send(res, 500, { error: 'Server error' });
    }
  });

  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const user = userByToken(db, url.searchParams.get('token'));
    if (!user) { ws.close(4001, 'auth'); return; }
    ws.user = user;
    hub.connect(user, ws);
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (!msg || typeof msg.t !== 'string') return;
      try { hub.onMessage(ws.user, msg); } catch (err) { console.error(err); hub.send(ws, { t: 'error', message: 'Something went wrong.' }); }
    });
    ws.on('close', () => hub.disconnect(ws.user, ws));
  });

  return new Promise((resolveListen) => {
    server.listen(port, () => {
      const address = server.address();
      resolveListen({
        port: address.port,
        db, hub, server,
        close() {
          for (const lobby of hub.lobbies.values()) if (lobby.host?.timer) clearInterval(lobby.host.timer);
          wss.close();
          server.close();
          db.close();
        },
      });
    });
  });
}

async function handleApi(req, res, url, db, hub) {
  const path = url.pathname;
  if (req.method === 'GET' && path === '/api/config') { send(res, 200, authConfig()); return; }

  if (req.method === 'POST' && path === '/api/auth/guest') {
    const body = await readJson(req);
    const result = createGuest(db, body.username);
    send(res, result.error ? result.status : 200, result.error ? { error: result.error } : { token: result.token, user: result.user });
    return;
  }
  if (req.method === 'POST' && path === '/api/auth/google') {
    const body = await readJson(req);
    const verified = await verifyGoogle(body.idToken);
    if (verified.error) { send(res, verified.status, { error: verified.error }); return; }
    const result = upsertProviderUser(db, 'google', verified.sub, body.username || verified.suggested);
    send(res, 200, result);
    return;
  }
  if (req.method === 'POST' && path === '/api/auth/apple') {
    const body = await readJson(req);
    const verified = await verifyApple(body.identityToken);
    if (verified.error) { send(res, verified.status, { error: verified.error }); return; }
    const result = upsertProviderUser(db, 'apple', verified.sub, body.username || verified.suggested);
    send(res, 200, result);
    return;
  }

  const user = userByToken(db, bearer(req));
  if (!user) { send(res, 401, { error: 'Sign in required.' }); return; }

  if (req.method === 'GET' && path === '/api/me') { send(res, 200, { user }); return; }
  if (req.method === 'PATCH' && path === '/api/me') {
    const body = await readJson(req);
    const result = renameUser(db, user.id, body.username);
    send(res, result.error ? result.status : 200, result.error ? { error: result.error } : { user: result.user });
    return;
  }
  if (req.method === 'GET' && path === '/api/users/search') { send(res, 200, { users: searchUsers(db, url.searchParams.get('q')) }); return; }
  if (req.method === 'GET' && path.startsWith('/api/users/name/')) {
    send(res, 200, { user: userByName(db, decodeURIComponent(path.slice('/api/users/name/'.length))) });
    return;
  }
  if (req.method === 'GET' && path.startsWith('/api/users/code/')) {
    send(res, 200, { user: userByCode(db, decodeURIComponent(path.slice('/api/users/code/'.length))) });
    return;
  }
  if (req.method === 'GET' && path === '/api/friends') { send(res, 200, hub.socialView(user.id)); return; }
  if (req.method === 'POST' && path === '/api/friends') {
    const body = await readJson(req);
    const other = body.friendCode ? userByCode(db, body.friendCode) : userByName(db, body.username);
    if (!other) { send(res, 404, { error: 'No player with that name or friend code.' }); return; }
    const result = addFriendRequest(db, user.id, other.id);
    if (result.error) { send(res, result.status, { error: result.error }); return; }
    if (result.request && result.request.status === 'pending') {
      hub.notify(other.id, 'friend_request', { requestId: result.request.id, fromId: user.id, fromName: user.username });
    }
    hub.pushFriends(user.id);
    hub.pushFriends(other.id);
    send(res, 200, { ok: true });
    return;
  }
  const friendAction = path.match(/^\/api\/friends\/(\d+)\/(accept|decline)$/);
  if (req.method === 'POST' && friendAction) {
    const requestId = Number(friendAction[1]);
    const result = friendAction[2] === 'accept' ? acceptFriend(db, user.id, requestId) : declineFriend(db, user.id, requestId);
    if (result.error) { send(res, result.status, { error: result.error }); return; }
    hub.pushFriends(user.id);
    if (result.request) hub.pushFriends(result.request.from_id === user.id ? result.request.to_id : result.request.from_id);
    send(res, 200, { ok: true });
    return;
  }
  const friendDelete = path.match(/^\/api\/friends\/(\d+)$/);
  if (req.method === 'DELETE' && friendDelete) {
    removeFriend(db, user.id, Number(friendDelete[1]));
    hub.pushFriends(user.id);
    hub.pushFriends(Number(friendDelete[1]));
    send(res, 200, { ok: true });
    return;
  }
  if (req.method === 'GET' && path === '/api/notifications') { send(res, 200, { notifications: listNotifications(db, user.id) }); return; }
  const noteRead = path.match(/^\/api\/notifications\/(\d+)\/read$/);
  if (req.method === 'POST' && noteRead) {
    markNotificationRead(db, user.id, Number(noteRead[1]));
    send(res, 200, { ok: true });
    return;
  }
  if (req.method === 'GET' && path.startsWith('/api/users/') && path !== '/api/users/search') {
    const id = Number(path.slice('/api/users/'.length));
    send(res, 200, { user: userById(db, id) });
    return;
  }
  send(res, 404, { error: 'Not found' });
}

function serveStatic(pathname, res) {
  const rel = (pathname === '/' ? 'index.html' : pathname).replace(/^\/+/, '');
  const file = resolve(ROOT, normalize(rel));
  const blocked = file.startsWith(join(ROOT, 'server')) || file.startsWith(join(ROOT, 'node_modules')) || file.includes(`${join(ROOT, '.env')}`);
  if ((file !== ROOT && !file.startsWith(ROOT + sep)) || blocked) {
    send(res, 404, { error: 'Not found' });
    return;
  }
  if (!existsSync(file) || !statSync(file).isFile()) { send(res, 404, { error: 'Not found' }); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
  createReadStream(file).pipe(res);
}

function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

function readJson(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      if (!chunks.length) { resolveBody({}); return; }
      try { resolveBody(JSON.parse(Buffer.concat(chunks).toString())); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(json);
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename);
if (isDirect) {
  const port = Number(process.env.PORT || 8080);
  startServer({ port }).then((app) => {
    console.log(`Super Bots online at http://localhost:${app.port}`);
  });
}
