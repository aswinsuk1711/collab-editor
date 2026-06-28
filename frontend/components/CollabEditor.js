'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { useEffect } from 'react';

export default function CollabEditor({ ydoc, provider, user, onEditorReady }) {
  const userName = user?.user_metadata?.full_name || user?.email || 'Anonymous';

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable built-in history since Yjs handles it
        history: false,
      }),
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider,
        user: {
          name: userName,
          color: getColorForUser(user?.id || ''),
        },
      }),
      Placeholder.configure({
        placeholder: 'Start writing… or just press / for commands',
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: false }),
    ],
    editorProps: {
      attributes: {
        spellcheck: 'true',
      },
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
    return () => {
      if (onEditorReady) onEditorReady(null);
    };
  }, [editor, onEditorReady]);

  return (
    <div style={{ minHeight: 'calc(100vh - 180px)' }}>
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
