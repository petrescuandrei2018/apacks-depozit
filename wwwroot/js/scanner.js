let awbs = [];
let allAwbs = [];
let lastCount = 0;
let isScanning = false;
let currentCourier = null;
let currentAwbId = null;
let currentFilter = '';
let scannerMode = 'scanner';

let coleteDePregatit = [];
let coletePregatie = [];
let selectedDate = '';

let printHistory = JSON.parse(localStorage.getItem('printHistory') || '{}');

const productImages = {
    'perie': 'https://apacks.b-cdn.net/accesorii-intro-perie.webp',
    'cleste': 'https://apacks.b-cdn.net/accesorii-intro-cleste.webp',
    'lana': 'https://apacks.b-cdn.net/lana-cerc.webp',
    'lemne': 'https://apacks.b-cdn.net/accesorii-intro-lemne.webp',
    'lemn': 'https://apacks.b-cdn.net/accesorii-intro-lemne.webp',
    'cocos': 'https://apacks.b-cdn.net/cocos3kg.webp',
    'rosii': 'https://apacks.b-cdn.net/carbuniBrichete3KGMain.webp',
    'cana': 'https://apacks.b-cdn.net/accesorii-intro-cana.webp'
};

function formatProductsWithIcons(text) {
    if (!text) return '-';
    let result = text;
    for (const [keyword, imgUrl] of Object.entries(productImages)) {
        const regex = new RegExp(`(${keyword})`, 'gi');
        result = result.replace(regex, `$1<img src="${imgUrl}" class="product-icon" alt="${keyword}">`);
    }
    return result;
}

function detectCourierFromAwb(awbCode) {
    if (!awbCode) return 'CARGUS';
    if (awbCode.startsWith('117')) return 'CARGUS';
    if (awbCode.startsWith('2') || awbCode.startsWith('3')) return 'FAN';
    return 'CARGUS';
}

function getCourierLabel(courier) {
    return { 'CARGUS': 'CARGUS', 'FAN': 'FAN', 'OLXFAN': 'OLX FAN' }[courier] || courier;
}

function getCourierThemeClass(courier) {
    return { 'CARGUS': 'theme-cargus', 'FAN': 'theme-fan', 'OLXFAN': 'theme-olxfan' }[courier] || 'theme-cargus';
}

async function refreshAll() {
    await Promise.all([
        loadAwbs(),
        loadColeteDePregatit(),
        loadColetePregatie(selectedDate)
    ]);
    await verificaMatchuri();
}

async function verificaMatchuri() {
    if (coleteDePregatit.length === 0 || allAwbs.length === 0) return;
    for (const colet of coleteDePregatit) {
        const awbScanat = allAwbs.find(a => a.code === colet.awbCode);
        if (awbScanat) {
            console.log(`Match găsit: ${colet.awbCode}`);
            await verificaSiMarcheazaAutomat(colet.awbCode);
        }
    }
}

function toggleScanSection() {
    const section = document.getElementById('scanInputSection');
    const btn = document.getElementById('toggleScanBtn');
    if (section.style.display === 'none') {
        section.style.display = 'block';
        btn.innerHTML = '▼ Ascunde Scanare';
        btn.classList.add('active');
    } else {
        section.style.display = 'none';
        btn.innerHTML = '📡 Arată Scanare';
        btn.classList.remove('active');
    }
}

function switchInputMode(mode) {
    scannerMode = mode;
    const scannerSection = document.getElementById('scannerModeSection');
    const manualSection = document.getElementById('manualModeSection');
    const btnScanner = document.getElementById('btnModeScanner');
    const btnManual = document.getElementById('btnModeManual');

    if (mode === 'scanner') {
        scannerSection.style.display = 'block';
        manualSection.style.display = 'none';
        btnScanner.classList.add('active');
        btnManual.classList.remove('active');
    } else {
        scannerSection.style.display = 'none';
        manualSection.style.display = 'block';
        btnScanner.classList.remove('active');
        btnManual.classList.add('active');
        document.getElementById('manualAwb').focus();
    }
}

function focusScanInput() {
    const scanInput = document.getElementById('scanInput');
    scanInput.setAttribute('inputmode', 'none');
    scanInput.placeholder = 'Ați selectat scannerul!';
    scanInput.classList.add('scanner-active');
    scanInput.focus();
    scanInput.value = '';
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

    const section = document.getElementById('scanInputSection');
    const btn = document.getElementById('toggleScanBtn');
    section.style.display = 'block';
    btn.innerHTML = '▼ Ascunde Scanare';
    btn.classList.add('active');

    if (scannerMode === 'scanner') focusScanInput();
}

function stopScanning() {
    isScanning = false;
    currentCourier = null;
    document.querySelectorAll('.courier-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('activeScanner').style.display = 'none';

    const scanInput = document.getElementById('scanInput');
    scanInput.placeholder = 'Apasă Scanează';
    scanInput.classList.remove('scanner-active');
}

function filterBy(courier) {
    currentFilter = courier;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    awbs = courier === '' ? [...allAwbs] : allAwbs.filter(a => a.courier === courier);
    render();
}

async function loadAwbs() {
    try {
        const res = await fetch('/Depozit/GetAll');
        allAwbs = await res.json();
        awbs = currentFilter === '' ? [...allAwbs] : allAwbs.filter(a => a.courier === currentFilter);
        if (allAwbs.length !== lastCount) {
            lastCount = allAwbs.length;
            render();
        }
    } catch (e) {
        console.error('Eroare la încărcare:', e);
    }
}

async function loadColeteDePregatit() {
    try {
        const res = await fetch('/Depozit/GetColeteDePregatit');
        coleteDePregatit = await res.json();
        renderColeteDePregatit();
    } catch (e) {
        console.error('Eroare la încărcarea coletelor:', e);
    }
}

function renderColeteDePregatit() {
    const container = document.getElementById('coleteDePregatitList');
    const countEl = document.getElementById('coleteDePregatitCount');
    if (!container) return;

    countEl.textContent = coleteDePregatit.length;

    if (coleteDePregatit.length === 0) {
        container.innerHTML = '<div class="empty-colete">✅ Toate coletele sunt pregătite!</div>';
        return;
    }

    container.innerHTML = coleteDePregatit.map(c => {
        const courier = c.curier || detectCourierFromAwb(c.awbCode);
        const themeClass = getCourierThemeClass(courier);
        return `
        <div class="colet-item ${themeClass}" id="colet-${c.id}" data-awb="${c.awbCode}">
            <div class="colet-header">
                <span class="colet-awb">
                    ${c.awbCode}
                    <span class="courier-badge ${courier}">${getCourierLabel(courier)}</span>
                </span>
                <span class="colet-data">${c.dataAwb || '-'}</span>
            </div>
            <div class="colet-info">
                <div class="colet-destinatar">👤 ${c.destinatar || '-'}</div>
                <div class="colet-produse">${formatProductsWithIcons(c.observatii)}</div>
                <div class="colet-details">
                    <span class="colet-ramburs">💰 ${c.rambursRon} RON</span>
                    <span class="colet-greutate">⚖️ ${c.greutateKg} kg</span>
                </div>
            </div>
            <div class="colet-actions">
                ${c.caleFisier ? `<button class="btn-print" onclick="printAwb('${c.awbCode}', '${c.caleFisier}')" title="Printează AWB">🖨️</button>` : ''}
                <button class="btn-pregatit" onclick="marcheazaPregatit(${c.id})">✓ Pregătit</button>
            </div>
        </div>
    `}).join('');
}

function printAwb(awbCode, caleFisier) {
    const now = new Date();
    const key = `print_${awbCode}`;
    if (printHistory[key]) {
        const lastPrint = new Date(printHistory[key]);
        const formatted = lastPrint.toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        if (!confirm(`⚠️ Ați mai apăsat pe PRINT pentru acest AWB!\n\nUltima dată: ${formatted}\n\nContinuați cu printarea?`)) return;
    }
    printHistory[key] = now.toISOString();
    localStorage.setItem('printHistory', JSON.stringify(printHistory));
    const printWindow = window.open(caleFisier, '_blank');
    if (printWindow) printWindow.onload = function () { setTimeout(() => printWindow.print(), 500); };
}

function toggleFullscreen() {
    const section = document.querySelector('.colete-section');
    const btn = document.getElementById('btnFullscreen');
    section.classList.toggle('fullscreen-mode');
    document.body.classList.toggle('fullscreen-active');
    btn.innerHTML = section.classList.contains('fullscreen-mode') ? '✕ Închide' : '⛶ Fullscreen';
}

async function marcheazaPregatit(id) {
    try {
        const res = await fetch(`/Depozit/MarcheazaPregatit?id=${id}`, { method: 'POST' });
        if (res.ok) {
            const el = document.getElementById(`colet-${id}`);
            if (el) el.classList.add('colet-done');
            setTimeout(() => refreshAll(), 300);
        }
    } catch (e) { console.error('Eroare:', e); }
}

async function verificaSiMarcheazaAutomat(code) {
    try {
        const res = await fetch('/Depozit/VerificaSiMarcheaza', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        const result = await res.json();
        if (result.found && result.marcat) {
            showAutoMatchNotification(result);
            const coletEl = document.querySelector(`.colet-item[data-awb="${code}"]`);
            if (coletEl) coletEl.classList.add('colet-done');
            setTimeout(() => refreshAll(), 500);
        }
        return result;
    } catch (e) { console.error('Eroare la verificare:', e); return { found: false }; }
}

function showAutoMatchNotification(result) {
    const notification = document.createElement('div');
    notification.className = 'auto-match-notification';
    notification.innerHTML = `<div class="notification-content"><span class="notification-icon">✅</span><div class="notification-text"><strong>Colet marcat automat!</strong><div>${result.awbCode} - ${result.destinatar}</div><small>${result.observatii || ''}</small></div></div>`;
    document.body.appendChild(notification);
    setTimeout(() => { notification.classList.add('fade-out'); setTimeout(() => notification.remove(), 300); }, 3000);
}

async function loadDateDisponibile() {
    try {
        const res = await fetch('/Depozit/GetDateDisponibile');
        const dates = await res.json();
        const select = document.getElementById('dateSelect');
        if (!select) return;
        select.innerHTML = dates.map(d => `<option value="${d.value}" ${d.isToday ? 'selected' : ''}>${d.label}${d.isToday ? ' (Azi)' : ''}</option>`).join('');
        if (dates.length > 0) selectedDate = dates.find(d => d.isToday)?.value || dates[0].value;
    } catch (e) { console.error('Eroare la încărcarea datelor:', e); }
}

async function loadColetePregatie(data = null) {
    try {
        const targetDate = data || selectedDate || '';
        const url = targetDate ? `/Depozit/GetColetePregatieLaData?data=${targetDate}` : '/Depozit/GetColetePregatieLaData';
        const res = await fetch(url);
        const result = await res.json();
        coletePregatie = result.colete || [];
        renderColetePregatie(result);
        if (coletePregatie.length > 0) {
            const section = document.getElementById('istoricSection');
            const btn = document.getElementById('toggleIstoricBtn');
            if (section && section.style.display === 'none') {
                section.style.display = 'block';
                btn.textContent = '▼ Ascunde istoric';
            }
        }
    } catch (e) { console.error('Eroare la încărcarea coletelor pregătite:', e); }
}

function onDateChange(event) {
    selectedDate = event.target.value;
    loadColetePregatie(selectedDate);
}

function renderColetePregatie(result) {
    const container = document.getElementById('coletePregateList');
    const statsEl = document.getElementById('pregateStats');
    if (!container) return;

    if (statsEl) {
        statsEl.innerHTML = `<span class="stat-item">📦 ${result.total} colete</span><span class="stat-item">💰 ${result.totalRamburs.toFixed(2)} RON</span>`;
    }

    if (coletePregatie.length === 0) {
        container.innerHTML = '<div class="empty-pregatie">Niciun colet pregătit în această zi.</div>';
        return;
    }

    container.innerHTML = coletePregatie.map(c => {
        const courier = c.curier || detectCourierFromAwb(c.awbCode);
        const themeClass = getCourierThemeClass(courier);
        return `
        <div class="pregatie-item ${themeClass}" id="pregatie-${c.id}">
            <div class="pregatie-header">
                <span class="pregatie-awb">
                    ${c.awbCode}
                    <span class="courier-badge ${courier}">${getCourierLabel(courier)}</span>
                </span>
                <span class="pregatie-ora">${formatTime(c.pregatitLa)}</span>
            </div>
            <div class="pregatie-info">
                <span class="pregatie-destinatar">👤 ${c.destinatar || '-'}</span>
                <span class="pregatie-produse">${formatProductsWithIcons(c.observatii)}</span>
            </div>
            <div class="pregatie-footer">
                <span class="pregatie-ramburs">💰 ${c.rambursRon} RON</span>
                <button class="btn-anuleaza" onclick="anuleazaPregatire(${c.id}, '${c.awbCode}')">↩️ Anulează</button>
            </div>
        </div>
    `}).join('');
}

function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function render() {
    const total = currentFilter ? `${awbs.length} (din ${allAwbs.length} total)` : awbs.length;
    document.getElementById('count').textContent = `Total: ${total} AWB-uri`;

    document.getElementById('list').innerHTML = awbs.map(a => {
        const themeClass = getCourierThemeClass(a.courier);
        return `
        <div class="awb ${themeClass}">
            <div class="awb-header">
                <div class="awb-info">
                    <span class="awb-code">
                        ${a.code}
                        <span class="courier-badge ${a.courier}">${getCourierLabel(a.courier)}</span>
                        ${a.mediaCount > 0 ? `<span class="media-badge">📷 ${a.mediaCount}</span>` : ''}
                    </span>
                    ${a.coletInfo ? `
                        <div class="awb-colet-info">
                            <div class="awb-destinatar">👤 ${a.coletInfo.destinatar || '-'}</div>
                            <div class="awb-produse">${formatProductsWithIcons(a.coletInfo.observatii)}</div>
                            <div class="awb-colet-details">
                                <span class="awb-pret">💰 ${a.coletInfo.rambursRon || 0} RON</span>
                                <span class="awb-greutate">⚖️ ${a.coletInfo.greutateKg || 0} kg</span>
                            </div>
                        </div>
                    ` : ''}
                    <span class="awb-date">📅 ${formatDate(a.scannedAt)}</span>
                </div>
                <div class="awb-actions">
                    <button class="btn-media" onclick="openMediaModal(${a.id}, '${a.code}', ${a.mediaCount}); event.preventDefault(); return false;">📷</button>
                    <button class="btn-delete" onclick="remove('${a.code}')">✕</button>
                </div>
            </div>
            ${a.media && a.media.length > 0 ? `
                <div class="awb-media-preview">
                    ${a.media.slice(0, 4).map(m => m.mediaType === 'video' ? `<video src="${m.filePath}" onclick="window.open('${m.filePath}')"></video>` : `<img src="${m.filePath}" onclick="window.open('${m.filePath}')">`).join('')}
                    ${a.media.length > 4 ? `<span style="padding:20px">+${a.media.length - 4}</span>` : ''}
                </div>
            ` : ''}
        </div>
    `}).join('');
}

function openMediaModal(awbId, awbCode, mediaCount) {
    currentAwbId = awbId;
    document.getElementById('modalAwbCode').textContent = `AWB: ${awbCode}`;
    document.getElementById('mediaCount').textContent = `${mediaCount}/10 fișiere încărcate`;
    document.getElementById('mediaModal').style.display = 'block';
    document.getElementById('uploadStatus').style.display = 'none';
    document.activeElement.blur();

    const awb = allAwbs.find(a => a.id === awbId);
    if (awb && awb.media && awb.media.length > 0) {
        document.getElementById('existingMedia').innerHTML = `<h4>Media existente:</h4>${awb.media.map(m => `<div class="existing-media-item">${m.mediaType === 'video' ? `<video src="${m.filePath}" controls></video>` : `<img src="${m.filePath}" onclick="window.open('${m.filePath}')">`}<button class="delete-media" onclick="deleteMedia(${m.id})">✕</button></div>`).join('')}`;
    } else {
        document.getElementById('existingMedia').innerHTML = '<p style="color:#666">Nicio poză sau video încă.</p>';
    }
}

function closeModal() { document.getElementById('mediaModal').style.display = 'none'; currentAwbId = null; }
function captureMedia(type) { document.getElementById(type === 'image' ? 'cameraInput' : 'videoInput').click(); }
function uploadFromGallery() { document.getElementById('fileInput').click(); }
function showUploadStatus(type, message) { const status = document.getElementById('uploadStatus'); status.className = type; status.textContent = message; status.style.display = 'block'; }

async function handleFileSelect(event) {
    const files = event.target.files;
    if (!files.length) return;
    const awb = allAwbs.find(a => a.id === currentAwbId);
    const currentCount = awb ? awb.mediaCount : 0;
    if (currentCount + files.length > 10) { showUploadStatus('error', `Poți adăuga maxim ${10 - currentCount} fișiere.`); event.target.value = ''; return; }
    showUploadStatus('loading', 'Se încarcă fișierele...');
    const formData = new FormData();
    for (let file of files) formData.append('files', file);
    try {
        const res = await fetch(`/Depozit/UploadMedia?awbId=${currentAwbId}`, { method: 'POST', body: formData });
        if (res.ok) {
            allAwbs = await res.json();
            lastCount = allAwbs.length;
            awbs = currentFilter === '' ? [...allAwbs] : allAwbs.filter(a => a.courier === currentFilter);
            render();
            const updatedAwb = allAwbs.find(a => a.id === currentAwbId);
            if (updatedAwb) openMediaModal(currentAwbId, updatedAwb.code, updatedAwb.mediaCount);
            showUploadStatus('success', 'Fișiere încărcate cu succes!');
        } else { showUploadStatus('error', `Eroare: ${await res.text()}`); }
    } catch (e) { showUploadStatus('error', `Eroare: ${e.message}`); }
    event.target.value = '';
}

async function deleteMedia(mediaId) {
    if (!confirm('Ștergi acest fișier?')) return;
    try {
        const res = await fetch(`/Depozit/DeleteMedia?mediaId=${mediaId}`, { method: 'POST' });
        if (res.ok) {
            allAwbs = await res.json();
            lastCount = allAwbs.length;
            awbs = currentFilter === '' ? [...allAwbs] : allAwbs.filter(a => a.courier === currentFilter);
            render();
            const updatedAwb = allAwbs.find(a => a.id === currentAwbId);
            if (updatedAwb) openMediaModal(currentAwbId, updatedAwb.code, updatedAwb.mediaCount);
        }
    } catch (e) { console.error('Eroare:', e); }
}

async function addAwb(code, courier) {
    if (allAwbs.some(a => a.code === code)) { showDuplicateWarning(code); return; }
    await verificaSiMarcheazaAutomat(code);
    const res = await fetch('/Depozit/Add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, courier }) });
    const result = await res.json();
    if (result.error) { showDuplicateWarning(code); return; }
    allAwbs = result;
    lastCount = allAwbs.length;
    awbs = currentFilter === '' ? [...allAwbs] : allAwbs.filter(a => a.courier === currentFilter);
    render();
    refreshAll();
}

function showDuplicateWarning(code) {
    const notification = document.createElement('div');
    notification.className = 'duplicate-warning';
    notification.innerHTML = `<div class="notification-content"><span class="notification-icon">⚠️</span><div class="notification-text"><strong>AWB duplicat!</strong><div>${code} există deja în sistem</div></div></div>`;
    document.body.appendChild(notification);
    setTimeout(() => { notification.classList.add('fade-out'); setTimeout(() => notification.remove(), 300); }, 3000);
}

async function remove(code) {
    if (!confirm(`Ștergi AWB ${code}?`)) return;
    const res = await fetch('/Depozit/Remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
    allAwbs = await res.json();
    lastCount = allAwbs.length;
    awbs = currentFilter === '' ? [...allAwbs] : allAwbs.filter(a => a.courier === currentFilter);
    render();
    refreshAll();
}

async function clearAll() {
    if (confirm('Ștergi toate AWB-urile?')) {
        await fetch('/Depozit/Clear', { method: 'POST' });
        allAwbs = []; awbs = []; lastCount = 0; render();
    }
}

function copyAll() {
    navigator.clipboard.writeText(awbs.map(a => `${a.code} (${getCourierLabel(a.courier)})`).join('\n'))
        .then(() => alert('Lista copiată!')).catch(() => alert('Eroare'));
}

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

async function anuleazaPregatire(id, awbCode) {
    if (!confirm(`Anulezi pregătirea coletului ${awbCode}?`)) return;
    try {
        const res = await fetch(`/Depozit/RevineLaPending?id=${id}`, { method: 'POST' });
        if (res.ok) {
            const el = document.getElementById(`pregatie-${id}`);
            if (el) { el.style.opacity = '0'; el.style.transform = 'translateX(-50px)'; }
            setTimeout(() => refreshAll(), 300);
        }
    } catch (e) { console.error('Eroare:', e); alert('Eroare'); }
}

document.getElementById('scanInput').addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val && val.length >= 10) {
        if (allAwbs.some(a => a.code === val)) { showDuplicateWarning(val); e.target.value = ''; return; }
        addAwb(val, isScanning && currentCourier ? currentCourier : 'CARGUS');
        e.target.value = '';
    }
});

document.getElementById('scanInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const val = e.target.value.trim();
        if (!val) return;
        if (allAwbs.some(a => a.code === val)) { showDuplicateWarning(val); e.target.value = ''; return; }
        addAwb(val, isScanning && currentCourier ? currentCourier : 'CARGUS');
        e.target.value = '';
    }
});

document.getElementById('scanInput').addEventListener('blur', () => {
    if (isScanning) {
        setTimeout(() => { const scanInput = document.getElementById('scanInput'); scanInput.setAttribute('inputmode', 'none'); scanInput.focus(); }, 100);
    } else {
        const scanInput = document.getElementById('scanInput');
        scanInput.placeholder = 'Apasă Scanează';
        scanInput.classList.remove('scanner-active');
    }
});

document.getElementById('manualAwb').addEventListener('keypress', (e) => { if (e.key === 'Enter') submitManualAwb(); });

function submitManualAwb() {
    const input = document.getElementById('manualAwb');
    const val = input.value.trim();
    if (!val) return;
    if (allAwbs.some(a => a.code === val)) { showDuplicateWarning(val); input.value = ''; return; }
    addAwb(val, isScanning && currentCourier ? currentCourier : 'CARGUS');
    input.value = '';
    input.focus();
}

window.onclick = function (event) { if (event.target === document.getElementById('mediaModal')) closeModal(); }
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.querySelector('.colete-section.fullscreen-mode')) toggleFullscreen(); });

async function init() {
    await loadAwbs();
    await loadColeteDePregatit();
    await loadDateDisponibile();
    await loadColetePregatie();
}

init();
setInterval(refreshAll, 3000);