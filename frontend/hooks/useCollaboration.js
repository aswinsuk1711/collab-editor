'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { createClient } from '@/lib/supabase/client';

const COLORS = [
  { light: '#FF6B6B', dark: '#FF6B6B' },
  { light: '#4ECDC4', dark: '#4ECDC4' },
  { light: '#45B7D1', dark: '#45B7D1' },
  { light: '#96CEB4', dark: '#96CEB4' },
  { light: '#FFEAA7', dark: '#FFEAA7' },
  { light: '#DDA0DD', dark: '#DDA0DD' },
  { light: '#98D8C8', dark: '#98D8C8' },
  { light: '#F7DC6F', dark: '#F7DC6F' },
  { light: '#BB8FCE', dark: '#BB8FCE' },
  { light: '#85C1E9', dark: '#85C1E9' },
];

function getColorForClient(userId, clientId) {
  const seed = `${userId || 'anonymous'}:${clientId || 'local'}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorDef = COLORS[Math.abs(hash) % COLORS.length];
  return colorDef.light || colorDef.dark || '#7C6EFA';
}

function getTabId() {
  if (typeof window === 'undefined') return 'server-tab';
  const existing = window.sessionStorage.getItem('collab-tab-id');
  if (existing) return existing;
  const next = `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  window.sessionStorage.setItem('collab-tab-id', next);
  return next;
}

export function useCollaboration(docId, user, token, initialContent = '') {
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const permanentUserDataRef = useRef(null);
  const [status, setStatus] = useState('disconnected');
  const [awareness, setAwareness] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]);
  const [isSynced, setIsSynced] = useState(false);
  const [ydoc, setYdoc] = useState(null);
  const [provider, setProvider] = useState(null);

  useEffect(() => {
    if (!docId || !user || !token) return;

    let provider = null;
    let ydoc = null;

    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const freshToken = session?.access_token || token;

      ydoc = new Y.Doc();
      ydocRef.current = ydoc;
      setYdoc(ydoc);

      // Seed Yjs with initial content before provider connects
      if (initialContent && initialContent.trim()) {
        ydoc.getText('content').insert(0, initialContent);
      }

      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';
      const wsBaseUrl = wsUrl.split('?')[0].split('#')[0];

      provider = new WebsocketProvider(wsBaseUrl, docId, ydoc, {
        connect: true,
        WebSocketPolyfill: WebSocket,
        params: { docId, token: freshToken },
      });

      providerRef.current = provider;
      setProvider(provider);

      const tabId = getTabId();
      const awarenessUser = {
        id: `${user.id}-${tabId}`,
        name: user.user_metadata?.full_name || user.email,
        email: user.email,
        color: getColorForClient(user.id, tabId),
        tabId,
      };

      provider.awareness.setLocalStateField('user', awarenessUser);

      provider.on('status', ({ status }) => {
        setStatus(status);
        if (status === 'connected') setIsSynced(false);
      });

      provider.on('sync', (isSynced) => setIsSynced(isSynced));

      const updateUsers = () => {
        const states = Array.from(provider.awareness.getStates().entries());
        const users = states
          .filter(([, state]) => state.user)
          .map(([clientId, state]) => ({ clientId, ...state.user }));
        setActiveUsers(users);
      };

      provider.awareness.on('change', updateUsers);
      updateUsers();
      setAwareness(provider.awareness);
    })();

    return () => {
      try {
        if (provider?.awareness) {
          provider.awareness.setLocalStateField('user', null);
        }
        if (provider) {
          provider.destroy();
        }
      } catch (error) {
        console.warn('Collaboration cleanup warning:', error);
      }
      if (ydoc) ydoc.destroy();
      setYdoc(null);
      setProvider(null);
    };
  }, [docId, user, token]);

  const updateCursor = useCallback(() => {}, []);

  return {
    ydoc,
    provider,
    awareness,
    status,
    isSynced,
    activeUsers,
    updateCursor,
  };
}