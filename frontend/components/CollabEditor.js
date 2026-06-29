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

const USER_COLORS = [
  { light: '#FF6B6B', dark: '#FF6B6B' },
  { light: '#4ECDC4', dark: '#4ECDC4' },
  { light: '#45B7D1', dark: '#45B7D1' },
  { light: '#96CEB4', dark: '#96CEB4' },
  { light: '#DDA0DD', dark: '#DDA0DD' },
  { light: '#85C1E9', dark: '#85C1E9' },
  { light: '#F0B27A', dark: '#F0B27A' },
  { light: '#82E0AA', dark: '#82E0AA' },
];

export default function CollabEditor({ ydoc, provider, user, onEditorReady, initialContent, documentId, token, isOnline, pendingSync, permanentUserData }) {
  const userName = user?.user_metadata?.full_name || user?.email || 'Anonymous';
  const [userColor, setUserColor] = useState('#7C6EFA');
  const hydratedRef = useRef(false);
  const saveTimeoutRef = useRef(null);
  const lastSavedContentRef = useRef('');

  useEffect(() => {
    if (!provider?.awareness) return;

    const syncLocalColor = () => {
      const awarenessUser = provider.awareness.getLocalState()?.user;
      const nextColor = awarenessUser?.color || '#7C6EFA';
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
      Collaboration.configure({
        document: ydoc,
        ySyncOptions: {
          color: userColor,
          permanentUserData,
        },
      }),
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

    editor.commands.focus('end');
    hydratedRef.current = true;
  }, [editor]);

  useEffect(() => {
    if (!editor || !documentId || !token) return;

    const handleEditorUpdate = () => {
      const html = editor.getHTML();
      if (!html.trim()) return;
      if (html === lastSavedContentRef.current) return;

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

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
      <EditorContent editor={editor} />
    </div>
  );
}