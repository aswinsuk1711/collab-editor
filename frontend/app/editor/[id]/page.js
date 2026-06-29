'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { useAuth } from '@/hooks/useAuth';
import { getDocument, updateDocument, shareDocument, getDocumentHistory } from '@/lib/api';
import { useCollaboration } from '@/hooks/useCollaboration';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import CollabEditor from '@/components/CollabEditor';
import PresenceBar from '@/components/PresenceBar';
import Toolbar from '@/components/Toolbar';
import styles from './editor.module.css';

export default function EditorPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, session, loading } = useAuth();

  const [document, setDocument] = useState(null);
  const [docLoading, setDocLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [titleSaving, setTitleSaving] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [editor, setEditor] = useState(null);
  const [restoringHistory, setRestoringHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState('idle');

  const { isOnline, pendingSync } = useOfflineSync();

  const {
    ydoc,
    provider,
    awareness,
    status,
    isSynced,
    activeUsers,
    permanentUserData,
  } = useCollaboration(id, user, session?.access_token, document?.content || '');

  // Load document metadata
  useEffect(() => {
    if (!loading && !user) router.push('/auth');
  }, [user, loading, router]);

  useEffect(() => {
    if (!session?.access_token || !id) return;
    getDocument(id, session.access_token)
      .then(({ document }) => {
        setDocument(document);
        setTitle(document.title);
        setDocLoading(false);
      })
      .catch(() => router.push('/dashboard'));
  }, [session, id, router]);

  const handleTitleChange = async (newTitle) => {
    setTitle(newTitle);
    if (!session?.access_token) return;
    setTitleSaving(true);
    try {
      await updateDocument(id, { title: newTitle }, session.access_token);
    } finally {
      setTimeout(() => setTitleSaving(false), 1000);
    }
  };

  const handleSave = async () => {
    if (!editor || !session?.access_token || !id) return;

    setSaving(true);
    setSaveState('saving');
    try {
      const html = editor.getHTML();
      await updateDocument(id, { content: html }, session.access_token);
      setDocument(prev => prev ? { ...prev, content: html } : prev);
      setSaveState('saved');
    } catch (err) {
      console.error('Failed to save document:', err);
      setSaveState('failed');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async (e) => {
    e.preventDefault();
    if (!shareEmail.trim()) return;
    setShareStatus('sharing');
    try {
      await shareDocument(id, shareEmail.trim(), session.access_token);
      setShareStatus('success');
      setShareEmail('');
      setTimeout(() => setShareStatus(''), 2500);
    } catch (err) {
      setShareStatus('error:' + err.message);
    }
  };

  const loadHistory = async () => {
    setShowHistory(true);
    try {
      const { history } = await getDocumentHistory(id, session.access_token);
      setHistory(history);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const restoreHistoryEntry = async (entry) => {
    if (!ydoc || !editor || !session?.access_token) return;

    try {
      setRestoringHistory(true);
      const updateBytes = Uint8Array.from(atob(entry.snapshot), (char) => char.charCodeAt(0));
      const snapshotDoc = new Y.Doc();
      Y.applyUpdate(snapshotDoc, updateBytes);
      const restoredHtml = snapshotDoc.getText('content').toString() || '<p></p>';

      ydoc.transact(() => {
        Y.applyUpdate(ydoc, updateBytes);
      });
      editor.commands.setContent(restoredHtml, false);
      await updateDocument(id, { content: restoredHtml }, session.access_token);
      setShowHistory(false);
    } catch (err) {
      console.error('Failed to restore history:', err);
    } finally {
      setRestoringHistory(false);
    }
  };

  const connectionColor = status === 'connected'
    ? 'var(--success)'
    : status === 'connecting'
    ? 'var(--warning)'
    : 'var(--text-muted)';

  if (loading || docLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Top header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => router.push('/dashboard')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>

          <div className={styles.titleArea}>
            <input
              className={styles.titleInput}
              value={title}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="Untitled document"
            />
            {titleSaving && (
              <span className={styles.savingBadge}>Saving...</span>
            )}
          </div>
        </div>

        <div className={styles.headerCenter}>
          <div className={styles.statusDot} style={{ background: connectionColor }} />
          <span className={styles.statusText}>
            {!isOnline
              ? 'Offline — changes saved locally'
              : pendingSync
              ? 'Syncing...'
              : status === 'connected'
              ? isSynced ? 'Synced' : 'Syncing...'
              : status === 'connecting'
              ? 'Connecting...'
              : 'Disconnected'}
          </span>
        </div>

        <div className={styles.headerRight}>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={saving}
            data-save-state={saveState}
          >
            {saving ? 'Saving...' : saveState === 'saved' ? 'Saved' : saveState === 'failed' ? 'Save failed' : 'Save'}
          </button>
          <button className={styles.historyBtn} onClick={loadHistory}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 .49-4.51"/>
            </svg>
            History
          </button>
          <button className={styles.shareBtn} onClick={() => setShowShare(v => !v)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Share
          </button>
        </div>
      </header>

      {/* Presence bar */}
      <PresenceBar activeUsers={activeUsers} />

      {/* Toolbar */}
      {editor && <Toolbar editor={editor} />}

      {/* Main editor */}
      <div className={styles.editorContainer}>
        <div className={styles.editorWrapper}>
          {ydoc && provider && (
<CollabEditor
               key={ydoc.guid}
               ydoc={ydoc}
               provider={provider}
               user={user}
               onEditorReady={setEditor}
               initialContent={document?.content || ''}
               documentId={id}
               token={session?.access_token}
               isOnline={isOnline}
               pendingSync={pendingSync}
               permanentUserData={permanentUserData}
             />
          )}
        </div>
      </div>

      {/* Share panel */}
      {showShare && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>Share document</h3>
            <button onClick={() => setShowShare(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <p className={styles.panelDesc}>Invite someone to collaborate on this document.</p>
          <form onSubmit={handleShare} className={styles.shareForm}>
            <input
              type="email"
              value={shareEmail}
              onChange={e => setShareEmail(e.target.value)}
              placeholder="colleague@example.com"
              required
            />
            <button type="submit" disabled={shareStatus === 'sharing'}>
              {shareStatus === 'sharing' ? 'Inviting...' : 'Invite'}
            </button>
          </form>
          {shareStatus === 'success' && (
            <p className={styles.shareSuccess}>✓ Invitation sent</p>
          )}
          {shareStatus.startsWith('error:') && (
            <p className={styles.shareError}>{shareStatus.replace('error:', '')}</p>
          )}
          <div className={styles.linkShare}>
            <p className={styles.panelDesc}>Or share via link:</p>
            <button
              className={styles.copyLink}
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
              </svg>
              Copy link
            </button>
          </div>
        </div>
      )}

      {/* History panel */}
      {showHistory && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3>Document history</h3>
            <button onClick={() => setShowHistory(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          {history.length === 0 ? (
            <p className={styles.panelDesc}>No history snapshots yet.</p>
          ) : (
            <ul className={styles.historyList}>
              {history.map(entry => (
                <li key={entry.id} className={styles.historyItem}>
                  <div className={styles.historyDot} />
                  <div>
                    <p className={styles.historyUser}>
                      {entry.profiles?.email || 'Unknown user'}
                    </p>
                    <p className={styles.historyTime}>
                      {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </div>
                  <button
                    className={styles.restoreBtn}
                    onClick={() => restoreHistoryEntry(entry)}
                    disabled={restoringHistory}
                  >
                    {restoringHistory ? 'Restoring...' : 'Restore'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
