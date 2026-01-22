// AWB Colet Admin Panel JavaScript - CU DEBUG LOGGING

let colete = [];
let currentFilter = '';
let searchQuery = '';
let currentColetId = null;

// DOM Elements
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const uploadProgress = document.getElementById('uploadProgress');
const uploadResults = document.getElementById('uploadResults');
const coleteBody = document.getElementById('coleteBody');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 AWB Colet Admin Panel initialized');
    loadColete();
    loadStats();
    setupEventListeners();
});

function setupEventListeners() {
    uploadZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);

    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files).filter(f =>
            f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
        );
        if (files.length > 0) {
            uploadFiles(files);
        }
    });

    searchInput.addEventListener('input', debounce(() => {
        searchQuery = searchInput.value;
        loadColete();
    }, 300));

    window.onclick = (event) => {
        const modal = document.getElementById('detailModal');
        if (event.target === modal) {
            closeModal();
        }
    };
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        uploadFiles(files);
    }
    e.target.value = '';
}

async function uploadFiles(files) {
    console.log(`📤 Uploading ${files.length} files...`);

    uploadProgress.style.display = 'block';
    uploadResults.style.display = 'none';
    document.getElementById('progressText').textContent = `Se procesează ${files.length} fișiere...`;
    document.getElementById('progressFill').style.width = '10%';

    const formData = new FormData();
    files.forEach(file => {
        formData.append('files', file);
    });

    try {
        document.getElementById('progressFill').style.width = '50%';

        const response = await fetch('/AwbColet/UploadPdfs', {
            method: 'POST',
            body: formData
        });

        document.getElementById('progressFill').style.width = '90%';

        if (response.ok) {
            const result = await response.json();

            // ========== DEBUG LOGGING ==========
            console.log('📦 Upload Result:', result);

            if (result.results) {
                result.results.forEach((r, index) => {
                    console.group(`📄 File ${index + 1}: ${r.fileName}`);
                    console.log('AWB:', r.awbCode);
                    console.log('Ramburs:', r.ramburs, 'RON');
                    console.log('Action:', r.action);

                    if (r.debug) {
                        console.group('🔍 DEBUG INFO:');
                        console.log('Text Length:', r.debug.textLength);
                        console.log('First 500 chars:', r.debug.first500Chars);
                        console.log('Zona Ramburs:', r.debug.zonaRamburs);
                        console.log('Toate sumele găsite:', r.debug.toateSumele);
                        console.log('Ramburs găsit:', r.debug.rambursGasit);

                        if (r.debug.log) {
                            console.group('📝 Extraction Log:');
                            r.debug.log.forEach(log => console.log(log));
                            console.groupEnd();
                        }
                        console.groupEnd();
                    }
                    console.groupEnd();
                });
            }
            // ========== END DEBUG ==========

            showUploadResults(result);
            await loadColete();
            await loadStats();
        } else {
            const errorText = await response.text();
            console.error('❌ Upload Error:', errorText);
            showError(`Eroare la upload: ${errorText}`);
        }
    } catch (error) {
        console.error('❌ Connection Error:', error);
        showError(`Eroare de conexiune: ${error.message}`);
    }

    document.getElementById('progressFill').style.width = '100%';
    setTimeout(() => {
        uploadProgress.style.display = 'none';
    }, 500);
}

function showUploadResults(result) {
    uploadResults.style.display = 'block';
    uploadResults.innerHTML = `
        <div style="margin-bottom:10px;">
            <strong>Procesate: ${result.successCount}/${result.processedFiles} fișiere</strong>
            <br><small style="color:#888;">Deschide Console (F12) pentru debug info</small>
        </div>
        ${result.results.map(r => `
            <div class="upload-result-item ${r.success ? 'success' : 'error'}">
                <span>${r.fileName}</span>
                <span>
                    ${r.success
            ? `✅ ${r.awbCode} - <strong>${r.ramburs || 0} RON</strong> (${r.action})`
            : `❌ ${r.error}`
        }
                </span>
            </div>
        `).join('')}
    `;

    // Nu auto-hide pentru a putea vedea rezultatele
    // setTimeout(() => { uploadResults.style.display = 'none'; }, 10000);
}

function showError(message) {
    uploadResults.style.display = 'block';
    uploadResults.innerHTML = `<div class="upload-result-item error">${message}</div>`;
}

async function loadColete() {
    try {
        let url = '/AwbColet/GetAll';
        const params = new URLSearchParams();

        if (searchQuery) params.append('search', searchQuery);
        if (currentFilter) params.append('status', currentFilter);

        if (params.toString()) {
            url += '?' + params.toString();
        }

        const response = await fetch(url);
        colete = await response.json();
        console.log(`📋 Loaded ${colete.length} colete`);
        renderTable();
    } catch (error) {
        console.error('Eroare la încărcarea coletelor:', error);
    }
}

async function loadStats() {
    try {
        const response = await fetch('/AwbColet/GetStats');
        const stats = await response.json();

        document.getElementById('statTotal').textContent = stats.total;
        document.getElementById('statPending').textContent = stats.pending;
        document.getElementById('statLivrat').textContent = stats.livrat;
        document.getElementById('statRamburs').textContent = stats.totalRamburs.toFixed(2);
        document.getElementById('statGreutate').textContent = stats.totalGreutate.toFixed(1);

        console.log('📊 Stats:', stats);
    } catch (error) {
        console.error('Eroare la încărcarea statisticilor:', error);
    }
}

function renderTable() {
    if (colete.length === 0) {
        coleteBody.innerHTML = '';
        emptyState.style.display = 'block';
        document.querySelector('.table-wrapper').style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';
    document.querySelector('.table-wrapper').style.display = 'block';

    coleteBody.innerHTML = colete.map((c, index) => `
        <tr>
            <td>${index + 1}</td>
            <td class="awb-code" onclick="showDetails(${c.id})">${c.awbCode || '-'}</td>
            <td>${c.destinatar || '-'}</td>
            <td title="${c.observatii || ''}">${truncate(c.observatii, 30)}</td>
            <td class="ramburs ${c.rambursRon === 0 ? 'zero' : ''}">${c.rambursRon} RON</td>
            <td>${c.telefon || '-'}</td>
            <td>${c.greutateKg} kg</td>
            <td>
                <span class="status-badge ${c.status.toLowerCase()}">${getStatusLabel(c.status)}</span>
            </td>
            <td>
                <div class="table-actions">
                    <button class="btn-view" onclick="showDetails(${c.id})" title="Detalii">👁️</button>
                    <button class="btn-status" onclick="changeStatus(${c.id}, '${c.status}')" title="Schimbă status">✓</button>
                    <button class="btn-delete" onclick="deleteColet(${c.id})" title="Șterge">✕</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function truncate(str, length) {
    if (!str) return '-';
    return str.length > length ? str.substring(0, length) + '...' : str;
}

function getStatusLabel(status) {
    const labels = {
        'PENDING': 'În așteptare',
        'LIVRAT': 'Livrat',
        'RETURNAT': 'Returnat'
    };
    return labels[status] || status;
}

function filterByStatus(status) {
    currentFilter = status;

    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    loadColete();
}

function showDetails(id) {
    const colet = colete.find(c => c.id === id);
    if (!colet) return;

    currentColetId = id;

    const modal = document.getElementById('detailModal');
    const content = document.getElementById('modalContent');

    content.innerHTML = `
        <div class="detail-row">
            <span class="detail-label">AWB:</span>
            <span class="detail-value awb-code">${colet.awbCode}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Destinatar:</span>
            <span class="detail-value">${colet.destinatar || '-'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Produse:</span>
            <span class="detail-value">${colet.observatii || '-'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Ramburs:</span>
            <span class="detail-value ramburs">${colet.rambursRon} RON</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Telefon:</span>
            <span class="detail-value">${colet.telefon || '-'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Adresa:</span>
            <span class="detail-value">${colet.adresa || '-'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Cod poștal:</span>
            <span class="detail-value">${colet.codPostal || '-'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Greutate:</span>
            <span class="detail-value">${colet.greutateKg} kg</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Data AWB:</span>
            <span class="detail-value">${colet.dataAwb || '-'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Serviciu:</span>
            <span class="detail-value">${colet.serviciu || '-'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Expeditor:</span>
            <span class="detail-value">${colet.expeditor || '-'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Status:</span>
            <span class="detail-value">
                <select class="status-select" onchange="updateStatus(${id}, this.value)">
                    <option value="PENDING" ${colet.status === 'PENDING' ? 'selected' : ''}>În așteptare</option>
                    <option value="LIVRAT" ${colet.status === 'LIVRAT' ? 'selected' : ''}>Livrat</option>
                    <option value="RETURNAT" ${colet.status === 'RETURNAT' ? 'selected' : ''}>Returnat</option>
                </select>
            </span>
        </div>
        ${colet.caleFisier ? `
            <div class="detail-row">
                <span class="detail-label">PDF:</span>
                <span class="detail-value">
                    <a href="${colet.caleFisier}" target="_blank" style="color:#00d4ff;">📄 Deschide PDF</a>
                </span>
            </div>
        ` : ''}
    `;

    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('detailModal').style.display = 'none';
    currentColetId = null;
}

function changeStatus(id, currentStatus) {
    const nextStatus = {
        'PENDING': 'LIVRAT',
        'LIVRAT': 'RETURNAT',
        'RETURNAT': 'PENDING'
    };

    updateStatus(id, nextStatus[currentStatus] || 'LIVRAT');
}

async function updateStatus(id, status) {
    try {
        const response = await fetch(`/AwbColet/UpdateStatus?id=${id}&status=${status}`, {
            method: 'POST'
        });

        if (response.ok) {
            await loadColete();
            await loadStats();

            if (currentColetId === id) {
                showDetails(id);
            }
        }
    } catch (error) {
        console.error('Eroare la actualizarea statusului:', error);
    }
}

async function deleteColet(id) {
    const colet = colete.find(c => c.id === id);
    if (!colet) return;

    if (!confirm(`Ștergi coletul AWB ${colet.awbCode}?`)) return;

    try {
        const response = await fetch(`/AwbColet/Delete?id=${id}`, {
            method: 'POST'
        });

        if (response.ok) {
            await loadColete();
            await loadStats();
            closeModal();
        }
    } catch (error) {
        console.error('Eroare la ștergere:', error);
    }
}

async function clearAll() {
    if (!confirm('Ștergi TOATE coletele? Această acțiune este ireversibilă!')) return;
    if (!confirm('Ești absolut sigur?')) return;

    try {
        const response = await fetch('/AwbColet/Clear', {
            method: 'POST'
        });

        if (response.ok) {
            await loadColete();
            await loadStats();
        }
    } catch (error) {
        console.error('Eroare la ștergere:', error);
    }
}

function exportData() {
    window.location.href = '/AwbColet/ExportExcel';
}

setInterval(() => {
    loadStats();
}, 30000);