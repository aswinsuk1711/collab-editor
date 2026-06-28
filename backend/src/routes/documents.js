import { supabase } from '../index.js';
import { authMiddleware } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

export function setupDocumentRoutes(app) {
  // Get all documents for the authenticated user
  app.get('/api/documents', authMiddleware, async (req, res) => {
    try {
      const { data: owned, error: ownedError } = await supabase
        .from('documents')
        .select('id, title, created_at, updated_at, owner_id')
        .eq('owner_id', req.user.id)
        .order('updated_at', { ascending: false });

      if (ownedError) throw ownedError;

      // Also get documents the user has access to
      const { data: shared, error: sharedError } = await supabase
        .from('document_access')
        .select('document_id, documents(id, title, created_at, updated_at, owner_id)')
        .eq('user_id', req.user.id);

      if (sharedError) throw sharedError;

      const sharedDocs = shared?.map(s => s.documents).filter(Boolean) || [];

      // Merge and deduplicate
      const allDocIds = new Set(owned.map(d => d.id));
      const uniqueShared = sharedDocs.filter(d => !allDocIds.has(d.id));

      res.json({ documents: [...owned, ...uniqueShared] });
    } catch (err) {
      console.error('Get documents error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get a single document
  app.get('/api/documents/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;

      const { data: doc, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !doc) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Check access
      const hasAccess = doc.owner_id === req.user.id || doc.is_public;
      if (!hasAccess) {
        const { data: access } = await supabase
          .from('document_access')
          .select('id')
          .eq('document_id', id)
          .eq('user_id', req.user.id)
          .single();

        if (!access) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      res.json({ document: doc });
    } catch (err) {
      console.error('Get document error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Create a new document
  app.post('/api/documents', authMiddleware, async (req, res) => {
    try {
      const { title } = req.body;
      const id = uuidv4();

      const { data: doc, error } = await supabase
        .from('documents')
        .insert({
          id,
          title: title || 'Untitled Document',
          owner_id: req.user.id,
          content: '',
          ydoc_state: null,
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({ document: doc });
    } catch (err) {
      console.error('Create document error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Update document metadata (title)
  app.patch('/api/documents/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { title } = req.body;

      // Check ownership
      const { data: doc } = await supabase
        .from('documents')
        .select('owner_id')
        .eq('id', id)
        .single();

      if (!doc || doc.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Only the owner can update document metadata' });
      }

      const { data: updated, error } = await supabase
        .from('documents')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json({ document: updated });
    } catch (err) {
      console.error('Update document error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Delete document
  app.delete('/api/documents/:id', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;

      const { data: doc } = await supabase
        .from('documents')
        .select('owner_id')
        .eq('id', id)
        .single();

      if (!doc || doc.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Only the owner can delete the document' });
      }

      await supabase.from('document_access').delete().eq('document_id', id);
      await supabase.from('document_history').delete().eq('document_id', id);
      const { error } = await supabase.from('documents').delete().eq('id', id);

      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      console.error('Delete document error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Share document
  app.post('/api/documents/:id/share', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { email } = req.body;

      // Verify ownership
      const { data: doc } = await supabase
        .from('documents')
        .select('owner_id')
        .eq('id', id)
        .single();

      if (!doc || doc.owner_id !== req.user.id) {
        return res.status(403).json({ error: 'Only the owner can share documents' });
      }

      // Find user by email
      const { data: users, error: userError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', email)
        .single();

      if (userError || !users) {
        return res.status(404).json({ error: 'User not found' });
      }

      await supabase
        .from('document_access')
        .upsert({ document_id: id, user_id: users.id });

      res.json({ success: true, sharedWith: users.email });
    } catch (err) {
      console.error('Share document error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get document history
  app.get('/api/documents/:id/history', authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { data, error } = await supabase
        .from('document_history')
        .select('id, created_at, user_id, snapshot, profiles(email)')
        .eq('document_id', id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      res.json({ history: data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
