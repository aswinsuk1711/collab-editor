const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function apiRequest(endpoint, options = {}, token) {
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }

  return res.json();
}

export async function getDocuments(token) {
  return apiRequest('/api/documents', {}, token);
}

export async function getDocument(id, token) {
  return apiRequest(`/api/documents/${id}`, {}, token);
}

export async function createDocument(title, token) {
  return apiRequest('/api/documents', { method: 'POST', body: JSON.stringify({ title }) }, token);
}

export async function updateDocument(id, data, token) {
  return apiRequest(`/api/documents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, token);
}

export async function deleteDocument(id, token) {
  return apiRequest(`/api/documents/${id}`, { method: 'DELETE' }, token);
}

export async function shareDocument(id, email, token) {
  return apiRequest(`/api/documents/${id}/share`, { method: 'POST', body: JSON.stringify({ email }) }, token);
}

export async function getDocumentHistory(id, token) {
  return apiRequest(`/api/documents/${id}/history`, {}, token);
}
