// ===== CARGUS TRACKING FUNCTIONS =====
// Adaugă acest cod la sfârșitul scanner.js sau într-un fișier separat

async function trackCargusAwb(awbCode) {
    try {
        const res = await fetch(`/Cargus/Track/${awbCode}`);
        if (!res.ok) {
            console.error('Tracking failed:', res.status);
            return null;
        }
        return await res.json();
    } catch (e) {
        console.error('Tracking error:', e);
        return null;
    }
}

async function getCargusFullInfo(awbCode) {
    try {
        const res = await fetch(`/Cargus/FullInfo/${awbCode}`);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.error('FullInfo error:', e);
        return null;
    }
}

async function syncCargusStatuses() {
    try {
        showNotification('Sincronizare...', 'info');
        const res = await fetch('/Cargus/SyncStatuses', { method: 'POST' });
        const result = await res.json();
        
        if (result.error) {
            showNotification('Eroare sincronizare', 'error');
            return;
        }
        
        showNotification(`Sincronizat: ${result.synced}/${result.total} colete`, 'success');
        refreshAll();
    } catch (e) {
        showNotification('Eroare conexiune API', 'error');
    }
}

async function downloadCargusPdf(awbCode) {
    window.open(`/Cargus/Pdf/${awbCode}`, '_blank');
}

async function showCargusTrackingModal(awbCode) {
    const modal = document.getElementById('trackingModal');
    if (!modal) {
        createTrackingModal();
    }
    
    document.getElementById('trackingModalAwb').textContent = awbCode;
    document.getElementById('trackingModalContent').innerHTML = '<div class="loading">Se încarcă...</div>';
    document.getElementById('trackingModal').style.display = 'block';
    
    const info = await getCargusFullInfo(awbCode);
    
    if (!info || (!info.local && !info.cargus?.tracking)) {
        document.getElementById('trackingModalContent').innerHTML = '<p class="error">Nu s-au găsit informații.</p>';
        return;
    }
    
    let html = '';
    
    // Local info
    if (info.local) {
        html += `
            <div class="tracking-section">
                <h4>📦 Informații Locale</h4>
                <div class="tracking-info-grid">
                    <div><strong>Destinatar:</strong> ${info.local.destinatar || '-'}</div>
                    <div><strong>Telefon:</strong> ${info.local.telefon || '-'}</div>
                    <div><strong>Ramburs:</strong> ${info.local.ramburs} RON</div>
                    <div><strong>Status DB:</strong> <span class="status-badge ${info.local.status.toLowerCase()}">${info.local.status}</span></div>
                    <div><strong>Produse:</strong> ${info.local.observatii || '-'}</div>
                </div>
            </div>
        `;
    }
    
    // Cargus tracking events
    if (info.cargus?.tracking?.events) {
        html += `
            <div class="tracking-section">
                <h4>🚚 Tracking Cargus</h4>
                ${info.cargus.tracking.confirmationName ? 
                    `<div class="confirmation">✅ Confirmat de: <strong>${info.cargus.tracking.confirmationName}</strong></div>` : ''}
                <div class="tracking-events">
                    ${info.cargus.tracking.events.map(e => `
                        <div class="tracking-event">
                            <div class="event-date">${formatDateTime(e.date)}</div>
                            <div class="event-description">${e.description}</div>
                            <div class="event-locality">${e.locality || ''}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Repayment info
    if (info.cargus?.repayment) {
        html += `
            <div class="tracking-section">
                <h4>💰 Ramburs</h4>
                <div class="tracking-info-grid">
                    <div><strong>Suma:</strong> ${info.cargus.repayment.value} RON</div>
                    <div><strong>Data încasare:</strong> ${info.cargus.repayment.date ? formatDateTime(info.cargus.repayment.date) : '-'}</div>
                    <div><strong>Data virament:</strong> ${info.cargus.repayment.deductionDate ? formatDateTime(info.cargus.repayment.deductionDate) : 'În așteptare'}</div>
                </div>
            </div>
        `;
    }
    
    // Actions
    html += `
        <div class="tracking-actions">
            <button onclick="downloadCargusPdf('${awbCode}')" class="btn-action btn-primary">📄 Descarcă PDF</button>
            <button onclick="window.open('/Cargus/Confirmation/${awbCode}', '_blank')" class="btn-action">📷 Confirmare</button>
        </div>
    `;
    
    document.getElementById('trackingModalContent').innerHTML = html;
}

function createTrackingModal() {
    const modal = document.createElement('div');
    modal.id = 'trackingModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content tracking-modal-content">
            <div class="modal-header">
                <h3>📍 Tracking AWB: <span id="trackingModalAwb"></span></h3>
                <button class="close-btn" onclick="closeTrackingModal()">×</button>
            </div>
            <div id="trackingModalContent"></div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .tracking-modal-content { max-width: 600px; max-height: 80vh; overflow-y: auto; }
        .tracking-section { margin-bottom: 20px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 10px; }
        .tracking-section h4 { color: #00d4ff; margin-bottom: 10px; }
        .tracking-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .tracking-events { max-height: 300px; overflow-y: auto; }
        .tracking-event { padding: 10px; border-left: 3px solid #00ff88; margin-bottom: 8px; background: rgba(0,255,136,0.05); }
        .event-date { color: #ffc107; font-size: 0.85rem; }
        .event-description { color: #fff; font-weight: 500; }
        .event-locality { color: #8892b0; font-size: 0.85rem; }
        .confirmation { background: rgba(0,255,136,0.15); padding: 10px; border-radius: 8px; margin-bottom: 10px; color: #00ff88; }
        .tracking-actions { display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap; }
        .tracking-actions .btn-action { flex: 1; min-width: 120px; }
        .btn-primary { background: linear-gradient(135deg, #00d4ff, #0099cc) !important; color: #fff !important; }
        .loading { text-align: center; padding: 30px; color: #00d4ff; }
        .error { text-align: center; padding: 30px; color: #ff6b6b; }
    `;
    document.head.appendChild(style);
}

function closeTrackingModal() {
    const modal = document.getElementById('trackingModal');
    if (modal) modal.style.display = 'none';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `<div class="notification-content">${message}</div>`;
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; padding: 15px 20px;
        border-radius: 12px; z-index: 9999; animation: slideIn 0.3s ease;
        background: ${type === 'success' ? 'linear-gradient(135deg, #00ff88, #00d4ff)' : 
                      type === 'error' ? 'linear-gradient(135deg, #ff6b6b, #ff4444)' :
                      'linear-gradient(135deg, #00d4ff, #0099cc)'};
        color: ${type === 'success' || type === 'error' ? '#fff' : '#1a1a2e'};
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('ro-RO', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

// Click pe AWB pentru tracking
window.addEventListener('click', (e) => {
    if (e.target.closest('.colet-awb, .awb-code, .pregatie-awb')) {
        const awbEl = e.target.closest('.colet-awb, .awb-code, .pregatie-awb');
        const text = awbEl.textContent.trim();
        const awbMatch = text.match(/\d{9,}/);
        if (awbMatch && awbMatch[0].startsWith('117')) {
            e.preventDefault();
            showCargusTrackingModal(awbMatch[0]);
        }
    }
});
