import { createRequire } from 'module';
import { verifyToken } from '../middleware/auth.js';
import { supabase } from '../index.js';

const require = createRequire(import.meta.url);
const Y = require('yjs');
const syncProtocol = require('y-protocols/sync');
const awarenessProtocol = require('y-protocols/awareness');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');

const SYNC = 0;
const AWARENESS = 1;

// docId -> { ydoc, awareness, conns: Set<ws> }
const docs = new Map();
const persistTimers = new Map();

function getDoc(docId) {
  if (!docs.has(docId)) {
    const ydoc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(ydoc);
    awareness.setLocalState(null);
    docs.set(docId, { ydoc, awareness, conns: new Set() });
  }
  return docs.get(docId);
}

function send(ws, msg) {
  if (ws.readyState === 1) ws.send(msg);
}

function broadcast(docState, msg, exclude) {
  docState.conns.forEach(ws => {
    if (ws !== exclude && ws.readyState === 1) ws.send(msg);
  });
}

function schedulePersist(docId, ydoc, userId = null) {
  if (persistTimers.has(docId)) clearTimeout(persistTimers.get(docId));
  persistTimers.set(docId, setTimeout(async () => {
    try {
      const base64State = Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString('base64');
      const content = ydoc.getText('content')?.toString?.() || '';
      await supabase.from('documents').update({
        ydoc_state: base64State,
        content,
        updated_at: new Date().toISOString(),
      }).eq('id', docId);
      await supabase.from('document_history').insert({
        document_id: docId,
        user_id: userId,
        snapshot: base64State,
      });
    } catch (err) { console.error('Persist error:', err); }
  }, 2000));
}

async function loadDoc(docId) {
  const docState = getDoc(docId);
  const { ydoc } = docState;

  if (ydoc._loaded) return docState;
  ydoc._loaded = true;

  const { data } = await supabase
    .from('documents').select('ydoc_state').eq('id', docId).single();

  if (data?.ydoc_state) {
    Y.applyUpdate(ydoc, Buffer.from(data.ydoc_state, 'base64'));
    console.log(`Loaded state for ${docId}`);
  }

  // Register update broadcast ONCE per doc
  ydoc.on('update', (update, origin) => {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, SYNC);
    syncProtocol.writeUpdate(enc, update);
    const msg = encoding.toUint8Array(enc);
    // Broadcast to all conns except the origin ws
    docState.conns.forEach(ws => {
      if (ws !== origin && ws.readyState === 1) ws.send(msg);
    });
    schedulePersist(docId, ydoc, null);
  });

  return docState;
}

export function setupWebSocketServer(wss) {
  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    if (!token) { ws.close(1008, 'Missing token'); return; }

    const user = await verifyToken(token);
    if (!user) { ws.close(1008, 'Unauthorized'); return; }

    const docId = url.pathname.replace(/^\//, '');
    if (!docId) { ws.close(1008, 'Missing docId'); return; }

    const { data: doc } = await supabase
      .from('documents').select('id, owner_id, is_public').eq('id', docId).single();
    if (!doc) { ws.close(1008, 'Document not found'); return; }

    const hasAccess = doc.owner_id === user.id || doc.is_public;
    if (!hasAccess) {
      const { data: access } = await supabase
        .from('document_access').select('id')
        .eq('document_id', docId).eq('user_id', user.id).single();
      if (!access) { ws.close(1008, 'Access denied'); return; }
    }

    const docState = await loadDoc(docId);
    const { ydoc, awareness, conns } = docState;
    conns.add(ws);
    console.log(`${user.email} connected to ${docId} (${conns.size} users)`);

    // Send sync step 1
    const enc1 = encoding.createEncoder();
    encoding.writeVarUint(enc1, SYNC);
    syncProtocol.writeSyncStep1(enc1, ydoc);
    send(ws, encoding.toUint8Array(enc1));

    // Send current awareness
    const awarenessStates = awareness.getStates();
    if (awarenessStates.size > 0) {
      const encA = encoding.createEncoder();
      encoding.writeVarUint(encA, AWARENESS);
      encoding.writeVarUint8Array(encA, awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awarenessStates.keys())));
      send(ws, encoding.toUint8Array(encA));
    }

    // Track awareness client IDs for cleanup
    const wsClientIds = new Set();

    ws.on('message', (raw) => {
      try {
        const msg = new Uint8Array(raw);
        const dec = decoding.createDecoder(msg);
        const msgType = decoding.readVarUint(dec);

        if (msgType === SYNC) {
          const enc = encoding.createEncoder();
          encoding.writeVarUint(enc, SYNC);
          syncProtocol.readSyncMessage(dec, enc, ydoc, ws);
          if (encoding.length(enc) > 1) send(ws, encoding.toUint8Array(enc));
        } else if (msgType === AWARENESS) {
          const update = decoding.readVarUint8Array(dec);
          // Track new client IDs
          const decoder2 = decoding.createDecoder(update);
          const len = decoding.readVarUint(decoder2);
          for (let i = 0; i < len; i++) {
            wsClientIds.add(decoding.readVarUint(decoder2));
            decoding.readVarUint(decoder2); // clock
            decoding.readVarString(decoder2); // state JSON
          }
          awarenessProtocol.applyAwarenessUpdate(awareness, update, ws);
        }
      } catch (err) {
        console.error('Message error:', err);
      }
    });

    // Broadcast awareness updates
    awareness.on('update', ({ added, updated, removed }) => {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, AWARENESS);
      encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(awareness, [...added, ...updated, ...removed]));
      broadcast(docState, encoding.toUint8Array(enc), null);
    });

    ws.on('close', async () => {
      conns.delete(ws);
      console.log(`${user.email} disconnected from ${docId} (${conns.size} users)`);

      if (wsClientIds.size > 0) {
        awarenessProtocol.removeAwarenessStates(awareness, Array.from(wsClientIds), null);
      }

      try {
        const snapshot = Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString('base64');
        await supabase.from('document_history').insert({ document_id: docId, user_id: user.id, snapshot });
      } catch (err) { console.error('Snapshot error:', err); }

      if (conns.size === 0) {
        setTimeout(() => {
          if (docs.get(docId)?.conns.size === 0) docs.delete(docId);
        }, 30000);
      }
    });

    ws.on('error', console.error);
  });
}
