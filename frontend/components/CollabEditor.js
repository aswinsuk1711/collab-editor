'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import { useEffect, useRef, useState } from 'react';
import { updateDocument } from '@/lib/api';

export default function CollabEditor({ ydoc, provider, user, onEditorReady, initialContent, documentId, token, isOnline, pendingSync }) {
  const userName = user?.user_metadata?.full_name || user?.email || 'Anonymous';
  const [userColor, setUserColor] = useState(getColorForUser(user?.id || ''));
  const [draftStatus, setDraftStatus] = useState('');
  const hydratedRef = useRef(false);
  const saveTimeoutRef = useRef(null);
  const lastSavedContentRef = useRef('');

  useEffect(() => {
    if (!provider?.awareness) return;

    const syncLocalColor = () => {
      const awarenessUser = provider.awareness.getLocalState()?.user;
      const nextColor = awarenessUser?.color || getColorForUser(user?.id || '');
      setUserColor((current) => (current === nextColor ? current : nextColor));
    };

    syncLocalColor();
    provider.awareness.on('change', syncLocalColor);

    return () => {
      provider.awareness.off('change', syncLocalColor);
    };
  }, [provider, user?.id]);

  const editor = useEditor({
    immediatelyRender: false,
    content: '<p></p>',
    extensions: [
      StarterKit.configure({ history: false }),
      Collaboration.configure({ document: ydoc }),
      Placeholder.configure({
        placeholder: ({ node }) => node.type.name === 'paragraph' ? 'Start writing…' : 'Write something…',
        showOnlyWhenEditable: true,
        includeChildren: false,
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: false }),
      TextStyle,
      Color,
    ],
    editorProps: {
      attributes: {
        spellcheck: 'true',
        class: 'min-h-[320px] outline-none',
      },
      transformPastedHTML: (html) => html,
      handleDOMEvents: {
        selectionchange: () => true,
      },
    },
  });

  useEffect(() => {
    if (!editor) return;

    if (!hydratedRef.current) {
      const storageKey = documentId ? `collab-draft-${documentId}` : 'collab-draft';
      const cachedDraft = typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null;

      const hasInitialContent = typeof initialContent === 'string' && initialContent.trim().length > 0;
      const hasCachedDraft = typeof cachedDraft === 'string' && cachedDraft.trim().length > 0;

      if (hasInitialContent && editor.isEmpty) {
        editor.commands.setContent(initialContent, false);
        lastSavedContentRef.current = initialContent;
      } else if (hasCachedDraft && editor.isEmpty) {
        editor.commands.setContent(cachedDraft, false);
        lastSavedContentRef.current = cachedDraft;
      } else if (editor.isEmpty) {
        editor.commands.setContent('<p></p>', false);
      }

      editor.commands.focus('end');
      hydratedRef.current = true;
    }
  }, [editor, initialContent, documentId]);

  useEffect(() => {
    if (!editor || !documentId || !token) return;

    const handleEditorUpdate = () => {
      const html = editor.getHTML();
      if (!html.trim()) return;
      if (html === lastSavedContentRef.current) return;

      if (html.length > 250000) {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(documentId ? `collab-draft-${documentId}` : 'collab-draft', html);
        }
        setDraftStatus('Document is large — syncing will resume after the next save window');
        return;
      }

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      const storageKey = documentId ? `collab-draft-${documentId}` : 'collab-draft';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, html);
      }

      if (!isOnline) {
        setDraftStatus('Offline draft saved');
      } else {
        setDraftStatus('');
      }

      saveTimeoutRef.current = setTimeout(() => {
        lastSavedContentRef.current = html;
        updateDocument(documentId, { content: html }, token).catch(console.error);
      }, 800);
    };

    editor.on('update', handleEditorUpdate);
    return () => {
      editor.off('update', handleEditorUpdate);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [editor, documentId, token, isOnline]);

  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor);
    return () => { if (onEditorReady) onEditorReady(null); };
  }, [editor, onEditorReady]);

  return (
    <div style={{ minHeight: 'calc(100vh - 180px)' }}>
      {(draftStatus || pendingSync) && (
        <div style={{ marginBottom: 12, fontSize: 12, color: '#64748b' }}>
          {draftStatus || (pendingSync ? 'Sync queued — will reconnect automatically' : '')}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

function getColorForUser(userId) {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#DDA0DD', '#85C1E9', '#F0B27A', '#82E0AA',
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
