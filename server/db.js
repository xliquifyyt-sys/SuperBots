// SQLite accounts, sessions, friends and the notification outbox.
// One file, no extra database service. Node 22's built-in node:sqlite.

import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { randomBytes, randomInt } from 'crypto';
import { DatabaseSync } from 'node:sqlite';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function openDatabase(file) {
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    create table if not exists users (
      id integer primary key,
      username text not null unique,
      friend_code text not null unique,
      provider text not null,
      provider_sub text,
      wins integer not null default 0,
      losses integer not null default 0,
      games integer not null default 0,
      created_at integer not null
    );
    create unique index if not exists users_provider on users(provider, provider_sub);
    create table if not exists sessions (
      token text primary key,
      user_id integer not null,
      created_at integer not null
    );
    create table if not exists friend_requests (
      id integer primary key,
      from_id integer not null,
      to_id integer not null,
      status text not null,
      created_at integer not null,
      unique(from_id, to_id)
    );
    create table if not exists notifications (
      id integer primary key,
      user_id integer not null,
      kind text not null,
      payload text not null,
      created_at integer not null,
      read_at integer,
      delivered_push integer not null default 0
    );
  `);
  return db;
}

export function code(len = 8) {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    friendCode: row.friend_code,
    provider: row.provider,
    wins: row.wins,
    losses: row.losses,
    games: row.games,
  };
}

export function createSession(db, userId) {
  const token = randomBytes(24).toString('hex');
  db.prepare('insert into sessions (token, user_id, created_at) values (?, ?, ?)').run(token, userId, Date.now());
  return token;
}

export function userByToken(db, token) {
  if (!token) return null;
  const row = db.prepare(`select u.* from sessions s join users u on u.id = s.user_id where s.token = ?`).get(token);
  return publicUser(row);
}

export function userById(db, id) {
  return publicUser(db.prepare('select * from users where id = ?').get(id));
}

export function userByName(db, username) {
  return publicUser(db.prepare('select * from users where username = ? collate nocase').get(username));
}

export function userByCode(db, friendCode) {
  return publicUser(db.prepare('select * from users where friend_code = ? collate nocase').get(friendCode));
}

function freshCode(db) {
  for (let i = 0; i < 8; i++) {
    const c = code(8);
    if (!db.prepare('select 1 from users where friend_code = ? collate nocase').get(c)) return c;
  }
  return code(12);
}

function uniqueUsername(db, base) {
  const root = String(base || 'player').replace(/[^A-Za-z0-9_]/g, '').slice(0, 16) || 'player';
  let name = root.length >= 3 ? root : (root + 'bot').slice(0, 16);
  let n = 1;
  while (db.prepare('select 1 from users where username = ? collate nocase').get(name)) {
    const suffix = String(++n);
    name = root.slice(0, 16 - suffix.length) + suffix;
  }
  return name;
}

export function createGuest(db, username) {
  const name = String(username || '').trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) return { error: 'Username must be 3–16 letters, numbers, or underscores.', status: 400 };
  if (userByName(db, name)) return { error: 'That username is taken.', status: 409 };
  const now = Date.now();
  db.prepare('insert into users (username, friend_code, provider, provider_sub, created_at) values (?, ?, ?, ?, ?)')
    .run(name, freshCode(db), 'guest', null, now);
  const user = userByName(db, name);
  return { user, token: createSession(db, user.id) };
}

export function upsertProviderUser(db, provider, sub, suggestedName) {
  const existing = db.prepare('select * from users where provider = ? and provider_sub = ?').get(provider, sub);
  if (existing) return { user: publicUser(existing), token: createSession(db, existing.id) };
  const username = uniqueUsername(db, suggestedName);
  db.prepare('insert into users (username, friend_code, provider, provider_sub, created_at) values (?, ?, ?, ?, ?)')
    .run(username, freshCode(db), provider, sub, Date.now());
  const user = userByName(db, username);
  return { user, token: createSession(db, user.id) };
}

export function renameUser(db, userId, username) {
  const name = String(username || '').trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) return { error: 'Username must be 3–16 letters, numbers, or underscores.', status: 400 };
  const taken = db.prepare('select id from users where username = ? collate nocase').get(name);
  if (taken && taken.id !== userId) return { error: 'That username is taken.', status: 409 };
  db.prepare('update users set username = ? where id = ?').run(name, userId);
  return { user: userById(db, userId) };
}

export function searchUsers(db, q, limit = 8) {
  const query = String(q || '').trim();
  if (query.length < 2) return [];
  const rows = db.prepare(`select * from users where username like ? collate nocase or friend_code = ? collate nocase order by username limit ?`)
    .all(`${query}%`, query, limit);
  return rows.map(publicUser);
}

export function addFriendRequest(db, fromId, toId) {
  if (fromId === toId) return { error: 'You cannot add yourself.', status: 400 };
  const existing = db.prepare('select * from friend_requests where from_id = ? and to_id = ?').get(fromId, toId);
  const reverse = db.prepare('select * from friend_requests where from_id = ? and to_id = ?').get(toId, fromId);
  if ((existing && existing.status === 'accepted') || (reverse && reverse.status === 'accepted')) return { error: 'You are already friends.', status: 409 };
  if (reverse && reverse.status === 'pending') return acceptFriend(db, fromId, reverse.id);
  if (existing && existing.status === 'pending') return { error: 'Request already sent.', status: 409 };
  if (existing) db.prepare('update friend_requests set status = ?, created_at = ? where id = ?').run('pending', Date.now(), existing.id);
  else db.prepare('insert into friend_requests (from_id, to_id, status, created_at) values (?, ?, ?, ?)').run(fromId, toId, 'pending', Date.now());
  const row = db.prepare('select * from friend_requests where from_id = ? and to_id = ?').get(fromId, toId);
  return { request: row };
}

export function acceptFriend(db, userId, requestId) {
  const row = db.prepare('select * from friend_requests where id = ?').get(requestId);
  if (!row || row.to_id !== userId || row.status !== 'pending') return { error: 'No pending request.', status: 404 };
  db.prepare('update friend_requests set status = ? where id = ?').run('accepted', requestId);
  return { request: { ...row, status: 'accepted' } };
}

export function declineFriend(db, userId, requestId) {
  const row = db.prepare('select * from friend_requests where id = ?').get(requestId);
  if (!row || (row.to_id !== userId && row.from_id !== userId)) return { error: 'No such request.', status: 404 };
  db.prepare('delete from friend_requests where id = ?').run(requestId);
  return { ok: true };
}

export function removeFriend(db, userId, otherId) {
  db.prepare('delete from friend_requests where status = ? and ((from_id = ? and to_id = ?) or (from_id = ? and to_id = ?))')
    .run('accepted', userId, otherId, otherId, userId);
  return { ok: true };
}

export function friendState(db, userId) {
  const rows = db.prepare(`
    select r.*, uf.username as from_name, uf.friend_code as from_code, ut.username as to_name, ut.friend_code as to_code
    from friend_requests r
    join users uf on uf.id = r.from_id
    join users ut on ut.id = r.to_id
    where r.from_id = ? or r.to_id = ?
  `).all(userId, userId);
  const friends = [];
  const incoming = [];
  const outgoing = [];
  for (const r of rows) {
    if (r.status === 'accepted') {
      const otherId = r.from_id === userId ? r.to_id : r.from_id;
      friends.push({ id: otherId, username: r.from_id === userId ? r.to_name : r.from_name, friendCode: r.from_id === userId ? r.to_code : r.from_code });
    } else if (r.status === 'pending' && r.to_id === userId) {
      incoming.push({ requestId: r.id, id: r.from_id, username: r.from_name, friendCode: r.from_code });
    } else if (r.status === 'pending' && r.from_id === userId) {
      outgoing.push({ requestId: r.id, id: r.to_id, username: r.to_name, friendCode: r.to_code });
    }
  }
  return { friends, incoming, outgoing };
}

export function areFriends(db, a, b) {
  const row = db.prepare(`select 1 from friend_requests where status = 'accepted' and ((from_id = ? and to_id = ?) or (from_id = ? and to_id = ?))`).get(a, b, b, a);
  return !!row;
}

export function friendIds(db, userId) {
  return friendState(db, userId).friends.map((f) => f.id);
}

// Notifications are the in-game inbox and the queue a future push worker would drain.
export function addNotification(db, userId, kind, payload) {
  const now = Date.now();
  db.prepare('insert into notifications (user_id, kind, payload, created_at) values (?, ?, ?, ?)').run(userId, kind, JSON.stringify(payload), now);
  const row = db.prepare('select * from notifications where user_id = ? order by id desc limit 1').get(userId);
  return presentNote(row);
}

export function listNotifications(db, userId) {
  return db.prepare('select * from notifications where user_id = ? order by id desc limit 30').all(userId).map(presentNote);
}

export function markNotificationRead(db, userId, id) {
  db.prepare('update notifications set read_at = ? where id = ? and user_id = ?').run(Date.now(), id, userId);
}

export function pendingPush(db) {
  return db.prepare('select * from notifications where delivered_push = 0 order by id').all().map(presentNote);
}

export function markPushed(db, id) {
  db.prepare('update notifications set delivered_push = 1 where id = ?').run(id);
}

function presentNote(row) {
  if (!row) return null;
  return { id: row.id, userId: row.user_id, kind: row.kind, payload: JSON.parse(row.payload), createdAt: row.created_at, read: !!row.read_at };
}

export function recordResult(db, userId, won) {
  db.prepare('update users set games = games + 1, wins = wins + ?, losses = losses + ? where id = ?').run(won ? 1 : 0, won ? 0 : 1, userId);
}
