// client.js — frontend logic that calls backend endpoints
const tabBtns = document.querySelectorAll('.tab-btn');
const tabs = document.querySelectorAll('.tab');

tabBtns.forEach(b=>{
  b.addEventListener('click', ()=>{
    tabBtns.forEach(x=>x.classList.remove('active'));
    tabs.forEach(t=>t.classList.remove('active'));
    b.classList.add('active');
    document.getElementById(b.dataset.tab).classList.add('active');
  });
});

// utility fetch wrapper
async function api(path, opts = {}) {
  try {
    const res = await fetch(path, opts);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status} ${text}`);
    }
    return await res.json();
  } catch (err) {
    console.error("API error:", err);
    throw err;
  }
}

// Overview refresh
document.getElementById('refreshOverview').addEventListener('click', async ()=>{
  await refreshOverview();
});

async function refreshOverview(){
  try {
    // activity log
    const logEl = document.getElementById('activityLog');
    const res = await api('/api/activity-log').catch(()=>null);
    if (res && res.log) {
      logEl.innerHTML = res.log.map(l=>`<p>${l}</p>`).join('');
    } else {
      logEl.innerHTML = '<p>Geen activiteiten gevonden.</p>';
    }

    // income
    const inc = await api('/api/income').catch(()=>null);
    if (inc && inc.total != null) {
      document.getElementById('incomeTotal').textContent = `€${parseFloat(inc.total).toFixed(2)}`;
      document.getElementById('incomeMonth').textContent = `€${parseFloat(inc.month).toFixed(2)}`;
    }

    // channels
    await loadChannels();
  } catch (e) {
    console.warn('refreshOverview error', e);
  }
}

// Channels
async function loadChannels(){
  const el = document.getElementById('channelsList');
  const res = await api('/api/channels').catch(()=>({channels:[]}));
  if (res.channels && res.channels.length) {
    el.innerHTML = res.channels.map(c=>`<div class="channel-row"><b>${c.name}</b> (${c.lang}) • status: ${c.status || 'idle'} <button onclick="connectChannel('${c.id}')">Connect</button></div>`).join('');
    // fill select for video generation
    const sel = document.getElementById('videoChannelSelect');
    sel.innerHTML = res.channels.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  } else {
    el.innerHTML = '<p>Geen kanalen. Maak er een met "Maak kanaal".</p>';
    const sel = document.getElementById('videoChannelSelect');
    sel.innerHTML = '<option value="">(geen kanalen)</option>';
  }
}

document.getElementById('createChannelBtn').addEventListener('click', async ()=>{
  const name = document.getElementById('newChannelName').value.trim();
  const lang = document.getElementById('newChannelLang').value;
  if (!name) return alert('Vul een kanaalnaam in.');
  await api('/api/channels', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, lang }) });
  document.getElementById('newChannelName').value = '';
  await loadChannels();
});

// Connect channel (placeholder)
async function connectChannel(id){
  alert('Connector: volg OAuth flow in YouTube tab om dit kanaal te autoriseren. ID: ' + id);
}

// YouTube auth & video generation
document.getElementById('authYoutubeBtn').addEventListener('click', async ()=>{
  try {
    const r = await api('/api/get-youtube-auth-url');
    if (r.url) window.open(r.url, '_blank');
  } catch(e){ alert('Fout bij ophalen auth-url: ' + e.message); }
});

document.getElementById('genVideoBtn').addEventListener('click', async ()=>{
  const prompt = document.getElementById('videoTitlePrompt').value.trim();
  const channelId = document.getElementById('videoChannelSelect').value;
  if (!prompt || !channelId) return alert('Vul onderwerp en kies een kanaal.');
  document.getElementById('videoGenResult').textContent = 'Genereren...';
  try {
    const r = await api('/api/generate-video', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ prompt, channelId })});
    document.getElementById('videoGenResult').textContent = JSON.stringify(r, null, 2);
    await refreshOverview();
  } catch (e) {
    document.getElementById('videoGenResult').textContent = 'Fout: ' + e.message;
  }
});

// Force upload
document.getElementById('forceUploadBtn').addEventListener('click', async ()=>{
  try {
    const r = await api('/api/upload-ready', { method:'POST' });
    document.getElementById('youtubeStatus').textContent = 'Upload resultaat: ' + (r.ok ? 'OK' : JSON.stringify(r));
    await refreshOverview();
  } catch (e) {
    document.getElementById('youtubeStatus').textContent = 'Upload fout: ' + e.message;
  }
});

// Affiliate scan
document.getElementById('scanAffiliateBtn').addEventListener('click', async ()=>{
  const q = document.getElementById('affSearch').value.trim();
  if (!q) return alert('Vul een zoekterm in.');
  document.getElementById('affiliateResults').textContent = 'Scannen...';
  try {
    const r = await api('/api/affiliate-ideas?q=' + encodeURIComponent(q));
    document.getElementById('affiliateResults').textContent = JSON.stringify(r, null, 2);
  } catch (e) {
    document.getElementById('affiliateResults').textContent = 'Fout: ' + e.message;
  }
});

// POD create
document.getElementById('createPodBtn').addEventListener('click', async ()=>{
  const title = document.getElementById('podTitle').value.trim();
  const prompt = document.getElementById('podPrompt').value.trim();
  if (!title || !prompt) return alert('Vul titel + prompt in.');
  document.getElementById('podResult').textContent = 'Aanmaken...';
  try {
    const r = await api('/api/pod/create', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title, prompt })});
    document.getElementById('podResult').textContent = JSON.stringify(r, null, 2);
    await refreshOverview();
  } catch (e) {
    document.getElementById('podResult').textContent = 'Fout: ' + e.message;
  }
});

// Social draft
document.getElementById('postSocialBtn').addEventListener('click', async ()=>{
  const text = document.getElementById('socialText').value.trim();
  if (!text) return alert('Vul caption in.');
  document.getElementById('socialResult').textContent = 'Aanmaken...';
  try {
    const r = await api('/api/social/schedule', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text })});
    document.getElementById('socialResult').textContent = JSON.stringify(r, null, 2);
  } catch (e) {
    document.getElementById('socialResult').textContent = 'Fout: ' + e.message;
  }
});

// Alerts & worker
document.getElementById('runWorkerBtn').addEventListener('click', async ()=>{
  try {
    await api('/api/worker-run', { method:'POST' });
    alert('Worker gestart (1 tick). Check Alerts tab.');
    await loadAlerts();
    await refreshOverview();
  } catch (e) {
    alert('Worker error: ' + e.message);
  }
});

async function loadAlerts(){
  const res = await api('/api/alerts').catch(()=>({alerts:[]}));
  const list = document.getElementById('alertsList');
  if (res.alerts && res.alerts.length) {
    list.innerHTML = res.alerts.map(a=>`<div class="alert-row"><b>${a.title}</b><div>${a.text}</div><button onclick="markDone('${a.id}')">Klaar</button></div>`).join('');
  } else {
    list.innerHTML = '<p>Geen acties op dit moment.</p>';
  }
}
window.markDone = async function(id){
  await api('/api/alerts/done', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id })});
  await loadAlerts();
  await refreshOverview();
}

// Settings save (frontend local only)
document.getElementById('saveNotifyBtn').addEventListener('click', ()=>{
  const mail = document.getElementById('notifyEmail').value.trim();
  if (!mail) return alert('Vul e-mail in.');
  localStorage.setItem('notifyEmail', mail);
  document.getElementById('settingsMsg').textContent = 'E-mail opgeslagen in browser (ook op server instellen!).';
});

// initial load
(async ()=>{
  document.getElementById('notifyEmail').value = localStorage.getItem('notifyEmail') || '';
  await refreshOverview();
  await loadChannels();
  await loadAlerts();
})();
