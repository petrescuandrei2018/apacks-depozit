let awbs = [];
let allAwbs = [];
let lastCount = 0;
let isScanning = false;
let currentCourier = null;
let currentAwbId = null;
let currentFilter = '';

function startScanning(courier) {
    isScanning = true;
    currentCourier = courier;

    // Dezactivează toate butoanele
    document.querySelectorAll('.courier-btn').forEach(btn => btn.classList.remove('active'));

    // Activează butonul curent
    const btnId = courier === 'CARGUS' ? 'btnCargus' : courier === 'FAN' ? 'btnFan' : 'btnOlxFan';
    document.getElementById(btnId).classList.add('active');

    // Afișează indicatorul
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

        // Aplică filtrul curent
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

async function addAwb(code, courier) {
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
}

async function remove(code) {
    if (!confirm(`Ștergi AWB ${code} și toate pozele asociate?`)) return;

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

document.getElementById('awb').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const val = e.target.value.trim();
        if (!val) return;

        // Verifică dacă există deja în allAwbs (nu în awbs filtrat)
        if (allAwbs.some(a => a.code === val)) {
            alert('Acest AWB există deja!');
            e.target.value = '';
            return;
        }

        // Dacă scanăm, folosim curierul activ, altfel cel din dropdown
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

loadAwbs();
setInterval(loadAwbs, 3000);