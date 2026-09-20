'use strict';

const Share = (() => {
  const API = 'https://webcraft-api-s4gr.onrender.com';

  async function api(path, opts = {}) {
    const r = await fetch(API + path, opts);
    let j = null;
    try { j = await r.json(); } catch (e) { j = {}; }
    if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
    return j;
  }

  function uploadWorld(payload) {
    return api('/api/worlds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  function fetchWorld(code) {
    return api('/api/worlds/' + encodeURIComponent(String(code).toLowerCase()));
  }

  function fetchRecent(limit = 6) {
    return api('/api/worlds?limit=' + limit);
  }

  function fetchStats() {
    return api('/api/stats');
  }

  return { API, uploadWorld, fetchWorld, fetchRecent, fetchStats };
})();
