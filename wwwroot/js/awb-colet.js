// AWB Colet Admin Panel JavaScript

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
            showUploadResults(result);
            await loadColete();
            await loadStats();
        } else {
            const errorText = await response.text();
            showError(`Eroare la upload: ${errorText}`);
        }
    } catch (error) {
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
    } catch (error) {
        console.error('Eroare la încărcarea statisticilor:', error);
    }
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
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

    // Render cu data-label pentru responsive și data adăugare
    coleteBody.innerHTML = colete.map((c, index) => `
    <tr>
        <td data-label="#">${index + 1}</td>
        <td data-label="Data AWB" title="${c.dataAwb || ''}">${c.dataAwb || '-'}</td>
        <td data-label="AWB" class="awb-code" onclick="showDetails(${c.id})">${c.awbCode || '-'}</td>
        <td data-label="Destinatar">${c.destinatar || '-'}</td>
        <td data-label="Produse" class="full-text-cell">${c.observatii || '-'}</td>
        <td data-label="Ramburs" class="ramburs ${c.rambursRon === 0 ? 'zero' : ''}">${c.rambursRon} RON</td>
        <td data-label="Telefon">${c.telefon || '-'}</td>
        <td data-label="Greutate">${c.greutateKg} kg</td>
        <td data-label="Status"><span class="status-badge ${c.status.toLowerCase()}">${getStatusLabel(c.status)}</span></td>
        <td data-label="Adăugat" class="data-adaugare" title="Data încărcare în sistem">${formatDateTime(c.createdAt)}</td>
        <td data-label="Acțiuni">
            <div class="table-actions">
                <button class="btn-view" onclick="showDetails(${c.id})" title="Detalii">👁️</button>
                <button class="btn-status" onclick="changeStatus(${c.id}, '${c.status}')" title="Schimbă status">✓</button>
                <button class="btn-delete" onclick="deleteColet(${c.id})" title="Șterge">✕</button>
            </div>
        </td>
    </tr>
`).join('');
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
        <div class="detail-row"><span class="detail-label">AWB:</span><span class="detail-value awb-code">${colet.awbCode}</span></div>
        <div class="detail-row"><span class="detail-label">Data AWB:</span><span class="detail-value">${colet.dataAwb || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Adăugat în sistem:</span><span class="detail-value">${formatDateTime(colet.createdAt)}</span></div>
        <div class="detail-row"><span class="detail-label">Destinatar:</span><span class="detail-value">${colet.destinatar || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Produse:</span><span class="detail-value full-text-cell">${colet.observatii || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Ramburs:</span><span class="detail-value ramburs">${colet.rambursRon} RON</span></div>
        <div class="detail-row"><span class="detail-label">Telefon:</span><span class="detail-value">${colet.telefon || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Adresa:</span><span class="detail-value">${colet.adresa || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Cod poștal:</span><span class="detail-value">${colet.codPostal || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Greutate:</span><span class="detail-value">${colet.greutateKg} kg</span></div>
        <div class="detail-row"><span class="detail-label">Serviciu:</span><span class="detail-value">${colet.serviciu || '-'}</span></div>
        <div class="detail-row"><span class="detail-label">Expeditor:</span><span class="detail-value">${colet.expeditor || '-'}</span></div>
        ${colet.caleFisier ? `<div class="detail-row"><span class="detail-label">PDF:</span><span class="detail-value"><a href="${colet.caleFisier}" target="_blank" style="color:#00d4ff;">📄 Deschide PDF</a></span></div>` : ''}
    `;
    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('detailModal').style.display = 'none';
    currentColetId = null;
}

function changeStatus(id, currentStatus) {
    const nextStatus = { 'PENDING': 'LIVRAT', 'LIVRAT': 'RETURNAT', 'RETURNAT': 'PENDING' };
    updateStatus(id, nextStatus[currentStatus] || 'LIVRAT');
}

async function updateStatus(id, status) {
    try {
        const response = await fetch(`/AwbColet/UpdateStatus?id=${id}&status=${status}`, { method: 'POST' });
        if (response.ok) {
            await loadColete();
            await loadStats();
            if (currentColetId === id) showDetails(id);
        }
    } catch (error) { console.error(error); }
}

async function deleteColet(id) {
    const colet = colete.find(c => c.id === id);
    if (!colet || !confirm(`Ștergi coletul AWB ${colet.awbCode}?`)) return;
    try {
        const response = await fetch(`/AwbColet/Delete?id=${id}`, { method: 'POST' });
        if (response.ok) {
            await loadColete();
            await loadStats();
            closeModal();
        }
    } catch (error) { console.error(error); }
}

async function clearAll() {
    if (!confirm('Ștergi TOATE coletele? Acțiune ireversibilă!') || !confirm('Ești absolut sigur?')) return;
    try {
        const response = await fetch('/AwbColet/Clear', { method: 'POST' });
        if (response.ok) {
            await loadColete();
            await loadStats();
        }
    } catch (error) { console.error(error); }
}

function exportData() {
    window.location.href = '/AwbColet/ExportExcel';
}

setInterval(() => { loadStats(); }, 30000);