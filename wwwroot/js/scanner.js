let awbs = [];
let allAwbs = [];
let lastCount = 0;
let isScanning = false;
let currentCourier = null;
let currentAwbId = null;
let currentFilter = '';

// Lista colete de pregătit
let coleteDePregatit = [];

// Colete pregătite (istoric)
let coletePregatie = [];
let selectedDate = '';

// FUNCȚIE CENTRALIZATĂ: Refresh toate cele 3 secțiuni
async function refreshAll() {
    await Promise.all([
        loadAwbs(),
        loadColeteDePregatit(),
        loadColetePregatie(selectedDate)
    ]);
}

function startScanning(courier) {
    isScanning = true;
    currentCourier = courier;

    document.querySelectorAll('.courier-btn').forEach(btn => btn.classList.remove('active'));

    const btnId = courier === 'CARGUS' ? 'btnCargus' : courier === 'FAN' ? 'btnFan' : 'btnOlxFan';
    document.getElementById(btnId).classList.add('active');

    const label = courier === 'CARGUS' ? '🚚 CARGUS' : courier === 'FAN' ? '🚚 FAN Courier' : '🚚 OLX FAN';
    document.getElementById('activeCourierLabel').textContent = `Scanare activă: ${label}`;
    document.getElementById('activeScanner').style.display = 'flex';

    document.getElementById('awb').focus();
}

function stopScanning() {
    isScanning = false;
    currentCourier = null;
    document.querySelectorAll('.courier-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('activeScanner').style.display = 'none';
}

function filterBy(courier) {
    currentFilter = courier;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    if (courier === '') {
        awbs = [...allAwbs];
    } else {
        awbs = allAwbs.filter(a => a.courier === courier);
    }
    render();
}

async function loadAwbs() {
    try {
        const res = await fetch('/Depozit/GetAll');
        allAwbs = await res.json();

        if (currentFilter === '') {
            awbs = [...allAwbs];
        } else {
            awbs = allAwbs.filter(a => a.courier === currentFilter);
        }

        if (allAwbs.length !== lastCount) {
            lastCount = allAwbs.length;
            render();
        }
    } catch (e) {
        console.error('Eroare la încărcare:', e);
    }
}

// Încarcă coletele de pregătit
async function loadColeteDePregatit() {
    try {
        const res = await fetch('/Depozit/GetColeteDePregatit');
        coleteDePregatit = await res.json();
        renderColeteDePregatit();
    } catch (e) {
        console.error('Eroare la încărcarea coletelor:', e);
    }
}

// Render lista colete de pregătit
function renderColeteDePregatit() {
    const container = document.getElementById('coleteDePregatitList');
    const countEl = document.getElementById('coleteDePregatitCount');

    if (!container) return;

    countEl.textContent = coleteDePregatit.length;

    if (coleteDePregatit.length === 0) {
        container.innerHTML = '<div class="empty-colete">✅ Toate coletele sunt pregătite!</div>';
        return;
    }

    container.innerHTML = coleteDePregatit.map(c => `
        <div class="colet-item" id="colet-${c.id}">
            <div class="colet-header">
                <span class="colet-awb">${c.awbCode}</span>
                <span class="colet-data">${c.dataAwb || '-'}</span>
            </div>
            <div class="colet-info">
                <div class="colet-destinatar">👤 ${c.destinatar || '-'}</div>
                <div class="colet-produse">📦 ${c.observatii || '-'}</div>
                <div class="colet-details">
                    <span class="colet-ramburs">💰 ${c.rambursRon} RON</span>
                    <span class="colet-greutate">⚖️ ${c.greutateKg} kg</span>
                </div>
            </div>
            <div class="colet-actions">
                <button class="btn-pregatit" onclick="marcheazaPregatit(${c.id})">✓ Pregătit</button>
            </div>
        </div>
    `).join('');
}

// Marchează colet ca pregătit (manual)
async function marcheazaPregatit(id) {
    try {
        const res = await fetch(`/Depozit/MarcheazaPregatit?id=${id}`, { method: 'POST' });
        if (res.ok) {
            const el = document.getElementById(`colet-${id}`);
            if (el) {
                el.classList.add('colet-done');
            }
            setTimeout(() => refreshAll(), 300);
        }
    } catch (e) {
        console.error('Eroare:', e);
    }
}

// NOU: Verifică și marchează automat când se scanează
async function verificaSiMarcheazaAutomat(code) {
    try {
        const res = await fetch('/Depozit/VerificaSiMarcheaza', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        const result = await res.json();

        if (result.found && result.marcat) {
            // Afișează notificare de succes
            showAutoMatchNotification(result);
            // Refresh toate listele
            refreshAll();
        }

        return result;
    } catch (e) {
        console.error('Eroare la verificare:', e);
        return { found: false };
    }
}

// NOU: Notificare când un AWB a fost găsit și marcat automat
function showAutoMatchNotification(result) {
    const notification = document.createElement('div');
    notification.className = 'auto-match-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">✅</span>
            <div class="notification-text">
                <strong>Colet marcat automat!</strong>
                <div>${result.awbCode} - ${result.destinatar}</div>
                <small>${result.observatii || ''}</small>
            </div>
        </div>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// NOU: Încarcă datele disponibile pentru dropdown
async function loadDateDisponibile() {
    try {
        const res = await fetch('/Depozit/GetDateDisponibile');
        const dates = await res.json();

        const select = document.getElementById('dateSelect');
        if (!select) return;

        select.innerHTML = dates.map(d =>
            `<option value="${d.value}" ${d.isToday ? 'selected' : ''}>${d.label}${d.isToday ? ' (Azi)' : ''}</option>`
        ).join('');

        // Setează data selectată
        if (dates.length > 0) {
            selectedDate = dates.find(d => d.isToday)?.value || dates[0].value;
        }
    } catch (e) {
        console.error('Eroare la încărcarea datelor:', e);
    }
}

// NOU: Încarcă coletele pregătite la data selectată
async function loadColetePregatie(data = null) {
    try {
        const targetDate = data || selectedDate || '';
        const url = targetDate ? `/Depozit/GetColetePregatieLaData?data=${targetDate}` : '/Depozit/GetColetePregatieLaData';

        const res = await fetch(url);
        const result = await res.json();

        coletePregatie = result.colete || [];
        renderColetePregatie(result);
    } catch (e) {
        console.error('Eroare la încărcarea coletelor pregătite:', e);
    }
}

// NOU: Handler pentru schimbarea datei
function onDateChange(event) {
    selectedDate = event.target.value;
    loadColetePregatie(selectedDate);
}

// NOU: Render coletele pregătite
function renderColetePregatie(result) {
    const container = document.getElementById('coletePregateList');
    const statsEl = document.getElementById('pregateStats');

    if (!container) return;

    // Update stats
    if (statsEl) {
        statsEl.innerHTML = `
            <span class="stat-item">📦 ${result.total} colete</span>
            <span class="stat-item">💰 ${result.totalRamburs.toFixed(2)} RON</span>
        `;
    }

    if (coletePregatie.length === 0) {
        container.innerHTML = '<div class="empty-pregatie">Niciun colet pregătit în această zi.</div>';
        return;
    }

    container.innerHTML = coletePregatie.map(c => `
        <div class="pregatie-item" id="pregatie-${c.id}">
            <div class="pregatie-header">
                <span class="pregatie-awb">${c.awbCode}</span>
                <span class="pregatie-ora">${formatTime(c.pregatitLa)}</span>
            </div>
            <div class="pregatie-info">
                <span class="pregatie-destinatar">👤 ${c.destinatar || '-'}</span>
                <span class="pregatie-produse">📦 ${c.observatii || '-'}</span>
            </div>
            <div class="pregatie-footer">
                <span class="pregatie-ramburs">💰 ${c.rambursRon} RON</span>
                <button class="btn-anuleaza" onclick="anuleazaPregatire(${c.id}, '${c.awbCode}')">↩️ Anulează</button>
            </div>
        </div>
    `).join('');
}

function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
}

function getCourierLabel(courier) {
    const labels = {
        'CARGUS': 'CARGUS',
        'FAN': 'FAN',
        'OLXFAN': 'OLX FAN'
    };
    return labels[courier] || courier;
}

function render() {
    const total = currentFilter ? `${awbs.length} (din ${allAwbs.length} total)` : awbs.length;
    document.getElementById('count').textContent = `Total: ${total} AWB-uri`;

    document.getElementById('list').innerHTML = awbs.map(a =>
        `<div class="awb">
            <div class="awb-header">
                <div class="awb-info">
                    <span class="awb-code">
                        ${a.code}
                        <span class="courier-badge ${a.courier}">${getCourierLabel(a.courier)}</span>
                        ${a.mediaCount > 0 ? `<span class="media-badge">📷 ${a.mediaCount}</span>` : ''}
                    </span>
                    <span class="awb-date">📅 ${formatDate(a.scannedAt)}</span>
                </div>
                <div class="awb-actions">
                    <button class="btn-media" onclick="openMediaModal(${a.id}, '${a.code}', ${a.mediaCount})">📷</button>
                    <button class="btn-delete" onclick="remove('${a.code}')">✕</button>
                </div>
            </div>
            ${a.media && a.media.length > 0 ? `
                <div class="awb-media-preview">
                    ${a.media.slice(0, 4).map(m =>
            m.mediaType === 'video'
                ? `<video src="${m.filePath}" onclick="window.open('${m.filePath}')"></video>`
                : `<img src="${m.filePath}" onclick="window.open('${m.filePath}')">`
        ).join('')}
                    ${a.media.length > 4 ? `<span style="padding:20px">+${a.media.length - 4}</span>` : ''}
                </div>
            ` : ''}
        </div>`
    ).join('');
}

function openMediaModal(awbId, awbCode, mediaCount) {
    currentAwbId = awbId;
    document.getElementById('modalAwbCode').textContent = `AWB: ${awbCode}`;
    document.getElementById('mediaCount').textContent = `${mediaCount}/10 fișiere încărcate`;
    document.getElementById('mediaModal').style.display = 'block';
    document.getElementById('uploadStatus').style.display = 'none';

    const awb = allAwbs.find(a => a.id === awbId);
    if (awb && awb.media && awb.media.length > 0) {
        document.getElementById('existingMedia').innerHTML = `
            <h4>Media existente:</h4>
            ${awb.media.map(m => `
                <div class="existing-media-item">
                    ${m.mediaType === 'video'
                ? `<video src="${m.filePath}" controls></video>`
                : `<img src="${m.filePath}" onclick="window.open('${m.filePath}')">`
            }
                    <button class="delete-media" onclick="deleteMedia(${m.id})">✕</button>
                </div>
            `).join('')}
        `;
    } else {
        document.getElementById('existingMedia').innerHTML = '<p style="color:#666">Nicio poză sau video încă.</p>';
    }
}

function closeModal() {
    document.getElementById('mediaModal').style.display = 'none';
    currentAwbId = null;
}

function captureMedia(type) {
    if (type === 'image') {
        document.getElementById('cameraInput').click();
    } else {
        document.getElementById('videoInput').click();
    }
}

function uploadFromGallery() {
    document.getElementById('fileInput').click();
}

function showUploadStatus(type, message) {
    const status = document.getElementById('uploadStatus');
    status.className = type;
    status.textContent = message;
    status.style.display = 'block';
}

async function handleFileSelect(event) {
    const files = event.target.files;
    if (!files.length) return;

    const awb = allAwbs.find(a => a.id === currentAwbId);
    const currentCount = awb ? awb.mediaCount : 0;

    if (currentCount + files.length > 10) {
        showUploadStatus('error', `Poți adăuga maxim ${10 - currentCount} fișiere. Ai selectat ${files.length}.`);
        event.target.value = '';
        return;
    }

    showUploadStatus('loading', 'Se încarcă fișierele...');

    const formData = new FormData();
    for (let file of files) {
        formData.append('files', file);
    }

    try {
        const res = await fetch(`/Depozit/UploadMedia?awbId=${currentAwbId}`, {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            allAwbs = await res.json();
            lastCount = allAwbs.length;

            if (currentFilter === '') {
                awbs = [...allAwbs];
            } else {
                awbs = allAwbs.filter(a => a.courier === currentFilter);
            }
            render();

            const updatedAwb = allAwbs.find(a => a.id === currentAwbId);
            if (updatedAwb) {
                openMediaModal(currentAwbId, updatedAwb.code, updatedAwb.mediaCount);
            }

            showUploadStatus('success', 'Fișiere încărcate cu succes!');
        } else {
            const errorText = await res.text();
            showUploadStatus('error', `Eroare: ${errorText}`);
        }
    } catch (e) {
        console.error('Eroare:', e);
        showUploadStatus('error', `Eroare la încărcare: ${e.message}`);
    }

    event.target.value = '';
}

async function deleteMedia(mediaId) {
    if (!confirm('Ștergi acest fișier?')) return;

    try {
        const res = await fetch(`/Depozit/DeleteMedia?mediaId=${mediaId}`, {
            method: 'POST'
        });

        if (res.ok) {
            allAwbs = await res.json();
            lastCount = allAwbs.length;

            if (currentFilter === '') {
                awbs = [...allAwbs];
            } else {
                awbs = allAwbs.filter(a => a.courier === currentFilter);
            }
            render();

            const updatedAwb = allAwbs.find(a => a.id === currentAwbId);
            if (updatedAwb) {
                openMediaModal(currentAwbId, updatedAwb.code, updatedAwb.mediaCount);
            }
        }
    } catch (e) {
        console.error('Eroare:', e);
    }
}

// MODIFICAT: Adaugă AWB și verifică automat
async function addAwb(code, courier) {
    // Mai întâi verifică și marchează automat dacă există în lista de pregătit
    await verificaSiMarcheazaAutomat(code);

    // Apoi adaugă în lista de scanate
    const res = await fetch('/Depozit/Add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, courier })
    });
    allAwbs = await res.json();
    lastCount = allAwbs.length;

    if (currentFilter === '') {
        awbs = [...allAwbs];
    } else {
        awbs = allAwbs.filter(a => a.courier === currentFilter);
    }
    render();

    // Refresh toate listele pentru sincronizare
    refreshAll();
}

async function remove(code) {
    if (!confirm(`Ștergi AWB ${code} și toate pozele asociate?\nDacă era pregătit, va reveni în lista de pregătit.`)) return;

    const res = await fetch('/Depozit/Remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
    });
    allAwbs = await res.json();
    lastCount = allAwbs.length;

    if (currentFilter === '') {
        awbs = [...allAwbs];
    } else {
        awbs = allAwbs.filter(a => a.courier === currentFilter);
    }
    render();

    // Refresh toate listele
    refreshAll();
}

async function clearAll() {
    if (confirm('Ștergi toate AWB-urile și toate pozele?')) {
        const res = await fetch('/Depozit/Clear', { method: 'POST' });
        allAwbs = [];
        awbs = [];
        lastCount = 0;
        render();
    }
}

function copyAll() {
    const text = awbs.map(a => `${a.code} (${getCourierLabel(a.courier)})`).join('\n');
    navigator.clipboard.writeText(text)
        .then(() => alert('Lista copiată!'))
        .catch(() => alert('Eroare la copiere'));
}

// Toggle secțiunea de istoric
function toggleIstoricSection() {
    const section = document.getElementById('istoricSection');
    const btn = document.getElementById('toggleIstoricBtn');

    if (section.style.display === 'none') {
        section.style.display = 'block';
        btn.textContent = '▼ Ascunde istoric';
        loadDateDisponibile();
        loadColetePregatie();
    } else {
        section.style.display = 'none';
        btn.textContent = '▶ Vezi coletele pregătite';
    }
}

// NOU: Anulează pregătirea și revine la PENDING
async function anuleazaPregatire(id, awbCode) {
    if (!confirm(`Anulezi pregătirea coletului ${awbCode}?\nVa reveni în lista de pregătit.`)) return;

    try {
        const res = await fetch(`/Depozit/RevineLaPending?id=${id}`, { method: 'POST' });
        if (res.ok) {
            // Animație
            const el = document.getElementById(`pregatie-${id}`);
            if (el) {
                el.style.opacity = '0';
                el.style.transform = 'translateX(-50px)';
            }

            // Refresh toate listele
            setTimeout(() => refreshAll(), 300);
        }
    } catch (e) {
        console.error('Eroare:', e);
        alert('Eroare la anulare');
    }
}

document.getElementById('awb').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const val = e.target.value.trim();
        if (!val) return;

        if (allAwbs.some(a => a.code === val)) {
            alert('Acest AWB există deja!');
            e.target.value = '';
            return;
        }

        const courier = isScanning && currentCourier ? currentCourier : document.getElementById('manualCourier').value;

        addAwb(val, courier);
        e.target.value = '';
        e.target.focus();
    }
});

document.getElementById('awb').addEventListener('blur', () => {
    if (isScanning) {
        setTimeout(() => {
            document.getElementById('awb').focus();
        }, 100);
    }
});

window.onclick = function (event) {
    const modal = document.getElementById('mediaModal');
    if (event.target === modal) {
        closeModal();
    }
}

// Inițializare
loadAwbs();
loadColeteDePregatit();
loadDateDisponibile();
loadColetePregatie();

// Refresh periodic - toate cele 3 secțiuni la fiecare 5 secunde
setInterval(refreshAll, 5000);