'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getDocuments, createDocument, deleteDocument } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import styles from './dashboard.module.css';

function DocCard({ doc, onDelete, onOpen }) {
  const [deleting, setDeleting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className={styles.docCard} onClick={() => onOpen(doc.id)}>
      <div className={styles.docIcon}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
      </div>
      <div className={styles.docInfo}>
        <h3 className={styles.docTitle}>{doc.title}</h3>
        <p className={styles.docMeta}>
          {formatDistanceToNow(new Date(doc.updated_at), { addSuffix: true })}
        </p>
      </div>
      <div className={styles.docActions} onClick={e => e.stopPropagation()}>
        <button
          className={styles.menuBtn}
          onClick={() => setShowMenu(v => !v)}
          aria-label="Document options"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.5"/>
            <circle cx="12" cy="12" r="1.5"/>
            <circle cx="12" cy="19" r="1.5"/>
          </svg>
        </button>
        {showMenu && (
          <div className={styles.dropdown}>
            <button onClick={() => onOpen(doc.id)}>Open</button>
            <button
              className={styles.danger}
              disabled={deleting}
              onClick={async () => {
                setDeleting(true);
                await onDelete(doc.id);
                setDeleting(false);
                setShowMenu(false);
              }}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, session, loading, signOut } = useAuth();
  const router = useRouter();
  const [documents, setDocuments] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/auth');
  }, [user, loading, router]);

  const loadDocuments = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const { documents } = await getDocuments(session.access_token);
      setDocuments(documents || []);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setFetching(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) loadDocuments();
  }, [session, loadDocuments]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const { document } = await createDocument(newTitle.trim(), session.access_token);
      router.push(`/editor/${document.id}`);
    } catch (err) {
      console.error('Failed to create document:', err);
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDocument(id, session.access_token);
      setDocuments(docs => docs.filter(d => d.id !== id));
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  const filtered = documents.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#7C6EFA"/>
              <path d="M8 11h16M8 16h12M8 21h8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            <span>Collabit</span>
          </div>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.userEmail}>{user?.email}</span>
          <button className={styles.signOutBtn} onClick={signOut}>Sign out</button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.topBar}>
          <div>
            <h1 className={styles.pageTitle}>My Documents</h1>
            <p className={styles.pageSubtitle}>{documents.length} document{documents.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            className={styles.createBtn}
            onClick={() => setShowCreate(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New document
          </button>
        </div>

        {showCreate && (
          <div className={styles.createForm}>
            <form onSubmit={handleCreate}>
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Document title..."
                autoFocus
                required
                className={styles.createInput}
              />
              <div className={styles.createActions}>
                <button type="submit" className={styles.createSubmit} disabled={creating}>
                  {creating ? 'Creating...' : 'Create'}
                </button>
                <button
                  type="button"
                  className={styles.createCancel}
                  onClick={() => { setShowCreate(false); setNewTitle(''); }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {documents.length > 4 && (
          <div className={styles.searchBar}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search documents..."
            />
          </div>
        )}

        {fetching ? (
          <div className={styles.loadingDocs}>
            {[1,2,3].map(i => <div key={i} className={styles.skeleton} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <h3>{search ? 'No matching documents' : 'No documents yet'}</h3>
            <p>{search ? 'Try a different search term' : 'Create your first document to get started'}</p>
            {!search && (
              <button className={styles.emptyCreate} onClick={() => setShowCreate(true)}>
                Create document
              </button>
            )}
          </div>
        ) : (
          <div className={styles.grid}>
            {filtered.map(doc => (
              <DocCard
                key={doc.id}
                doc={doc}
                onDelete={handleDelete}
                onOpen={id => router.push(`/editor/${id}`)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
