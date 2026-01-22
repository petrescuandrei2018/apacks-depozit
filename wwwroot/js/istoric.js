let logs = [];

async function loadLogs() {
    try {
        const res = await fetch('/Istoric/GetAll');
        logs = await res.json();
        render();
    } catch (e) {
        console.error('Eroare:', e);
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
}

function getActionLabel(action) {
    const labels = {
        'ADD': '➕ Adăugat',
        'DELETE': '🗑️ Șters',
        'CLEAR_ALL': '🗑️ Șters Tot',
        'ADD_MEDIA': '📷 Media Adăugat',
        'DELETE_MEDIA': '📷 Media Șters'
    };
    return labels[action] || action;
}

function render() {
    document.getElementById('count').textContent = `Total: ${logs.length} operațiuni`;
    document.getElementById('list').innerHTML = logs.map(l =>
        `<div class="log-item">
            <div class="log-info">
                <span class="log-action ${l.action}">${getActionLabel(l.action)}</span>
                <span class="log-type">[${l.entityType}]</span>
                <div class="log-entity">${l.entityInfo}</div>
            </div>
            <div class="log-date">📅 ${formatDate(l.timestamp)}</div>
        </div>`
    ).join('');
}

async function clearHistory() {
    if (confirm('Ștergi tot istoricul?')) {
        await fetch('/Istoric/Clear', { method: 'POST' });
        logs = [];
        render();
    }
}

loadLogs();