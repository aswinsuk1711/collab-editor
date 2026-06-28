'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { createClient } from '@/lib/supabase/client';

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9',
];

function getRandomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

export function useCollaboration(docId, user, token) {
  const ydocRef = useRef(null);
  const providerRef = useRef(null);
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
      // Always refresh session to get a non-expired token
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const freshToken = session?.access_token || token;

      ydoc = new Y.Doc();
      ydocRef.current = ydoc;
      setYdoc(ydoc);

      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';
      const wsBaseUrl = wsUrl.split('?')[0].split('#')[0];

      provider = new WebsocketProvider(wsBaseUrl, docId, ydoc, {
        connect: true,
        WebSocketPolyfill: WebSocket,
        params: { docId, token: freshToken },
      });

      providerRef.current = provider;
      setProvider(provider);

      provider.awareness.setLocalStateField('user', {
        id: user.id,
        name: user.user_metadata?.full_name || user.email,
        email: user.email,
        color: getRandomColor(),
      });

      provider.on('status', ({ status }) => {
        setStatus(status);
        if (status === 'connected') setIsSynced(false);
      });

      provider.on('sync', (isSynced) => setIsSynced(isSynced));

      const updateUsers = () => {
        const states = Array.from(provider.awareness.getStates().entries());
        const users = states
          .filter(([, state]) => state.user)
          .map(([clientId, state]) => ({ clientId, ...state.user, cursor: state.cursor }));
        setActiveUsers(users);
      };

      provider.awareness.on('change', updateUsers);
      updateUsers();
      setAwareness(provider.awareness);
    })();

    return () => {
      if (provider) {
        provider.destroy();
      }
      if (ydoc) ydoc.destroy();
      setYdoc(null);
      setProvider(null);
    };
  }, [docId, user, token]);

  const updateCursor = useCallback((position) => {
    if (providerRef.current) {
      providerRef.current.awareness.setLocalStateField('cursor', position);
    }
  }, []);

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
