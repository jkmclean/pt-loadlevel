// ===== Toast Notifications =====
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ===== Modal System =====
const Modal = {
    open(title, bodyHTML, onSave) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = bodyHTML;
        document.getElementById('modal-overlay').classList.add('active');
        this._onSave = onSave;
    },
    close() {
        document.getElementById('modal-overlay').classList.remove('active');
        this._onSave = null;
    },
    init() {
        document.getElementById('modal-close').onclick = () => this.close();
        document.getElementById('modal-cancel').onclick = () => this.close();
        document.getElementById('modal-save').onclick = () => { if (this._onSave) this._onSave(); };
        document.getElementById('modal-overlay').onclick = (e) => { if (e.target.id === 'modal-overlay') this.close(); };
    }
};

// ===== Navigation =====
function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`panel-${btn.dataset.panel}`).classList.add('active');
            refreshCurrentPanel(btn.dataset.panel);
        });
    });
    document.getElementById('btn-toggle-sidebar').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });
}

function refreshCurrentPanel(panel) {
    if (!panel) {
        const active = document.querySelector('.nav-item.active');
        panel = active ? active.dataset.panel : 'dashboard';
    }
    switch (panel) {
        case 'dashboard': renderDashboard(); break;
        case 'staff': renderStaffTable(); break;
        case 'surveys': renderSurveysTable(); break;
        case 'assignments': renderAssignments(); break;
        case 'activity': renderActivityLog(); break;
        case 'settings': renderSettings(); break;
    }
}

// ===== Chart Instances =====
let workloadChart = null;
let radarChart = null;

// ===== Dashboard Rendering =====
function renderDashboard() {
    document.getElementById('stat-total-staff').textContent = Store.staff.length;
    document.getElementById('stat-total-surveys').textContent = Store.surveys.length;
    const scores = Store.staff.map(s => Scoring.staffWorkload(s.id));
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    document.getElementById('stat-avg-workload').textContent = avg;
    document.getElementById('stat-imbalance').textContent = Scoring.imbalanceIndex() + '%';
    renderWorkloadChart();
    renderRadarChart();
    renderHotspots();
}

function renderWorkloadChart() {
    const ctx = document.getElementById('chart-workload-bar').getContext('2d');
    const labels = Store.staff.map(s => s.name);
    const scores = Store.staff.map(s => Math.round(Scoring.staffWorkload(s.id)));
    const colors = scores.map(score => {
        const level = Scoring.loadLevel(score, Store.staff.length);
        return { low: '#2ecc71', moderate: '#3498db', high: '#f39c12', critical: '#e74c3c' }[level];
    });
    if (workloadChart) workloadChart.destroy();
    workloadChart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Workload Score', data: scores, backgroundColor: colors.map(c => c + '99'), borderColor: colors, borderWidth: 2, borderRadius: 8, borderSkipped: false }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a1d2e', borderColor: '#2a3050', borderWidth: 1, titleColor: '#e8ecf4', bodyColor: '#8b92a8', padding: 12, cornerRadius: 8 } },
            scales: { y: { beginAtZero: true, grid: { color: '#2a305044' }, ticks: { color: '#8b92a8' } }, x: { grid: { display: false }, ticks: { color: '#8b92a8' } } }
        }
    });
}

function renderRadarChart() {
    const ctx = document.getElementById('chart-category-radar').getContext('2d');
    const catLabels = CATEGORIES.map(c => CATEGORY_LABELS[c]);
    const chartColors = ['#667eea', '#764ba2', '#2ecc71', '#f39c12', '#e74c3c', '#3498db'];
    const datasets = Store.staff.map((s, i) => {
        const bd = Scoring.staffCategoryBreakdown(s.id);
        return { label: s.name, data: CATEGORIES.map(c => Math.round(bd[c])), borderColor: chartColors[i % chartColors.length], backgroundColor: chartColors[i % chartColors.length] + '22', borderWidth: 2, pointBackgroundColor: chartColors[i % chartColors.length], pointRadius: 3 };
    });
    if (radarChart) radarChart.destroy();
    radarChart = new Chart(ctx, {
        type: 'radar',
        data: { labels: catLabels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: '#8b92a8', padding: 12, usePointStyle: true } } },
            scales: { r: { beginAtZero: true, grid: { color: '#2a305066' }, angleLines: { color: '#2a305066' }, pointLabels: { color: '#8b92a8', font: { size: 10 } }, ticks: { display: false } } }
        }
    });
}

function renderHotspots() {
    const container = document.getElementById('hotspots-list');
    const staffScores = Store.staff.map(s => ({ name: s.name, score: Math.round(Scoring.staffWorkload(s.id)), level: Scoring.loadLevel(Scoring.staffWorkload(s.id), Store.staff.length), surveys: Store.surveys.filter(sv => Store.assignments[sv.id] === s.id).length })).sort((a, b) => b.score - a.score);
    if (staffScores.length === 0) { container.innerHTML = '<div class="empty-state">No data yet.</div>'; return; }
    container.innerHTML = staffScores.map(s => `<div class="hotspot-item level-${s.level}"><div><span class="hotspot-name">${s.name}</span><span style="color:var(--text-muted);font-size:0.82rem;margin-left:8px;">${s.surveys} survey${s.surveys !== 1 ? 's' : ''}</span></div><span class="hotspot-score level-${s.level}">${s.score} pts</span></div>`).join('');
}

// ===== Staff Panel =====
function renderStaffTable() {
    const tbody = document.getElementById('staff-table-body');
    const empty = document.getElementById('staff-empty');
    if (Store.staff.length === 0) { tbody.innerHTML = ''; empty.style.display = ''; return; }
    empty.style.display = 'none';
    const role = AllowList._currentRole;
    tbody.innerHTML = Store.staff.map(s => {
        const score = Math.round(Scoring.staffWorkload(s.id));
        const level = Scoring.loadLevel(score, Store.staff.length);
        const assigned = Store.surveys.filter(sv => Store.assignments[sv.id] === s.id).length;
        const actions = Roles.canCreateStaff(role)
            ? `<button class="btn-action" onclick="openStaffModal('${s.id}')" title="Edit">✏️</button>${Roles.canDeleteStaff(role) ? `<button class="btn-action danger" onclick="deleteStaff('${s.id}')" title="Delete">🗑️</button>` : ''}`
            : '<span style="color:var(--text-muted);font-size:0.8rem">View only</span>';
        return `<tr><td><strong>${s.name}</strong></td><td>${s.role}</td><td>${assigned}</td><td>${score}</td><td><span class="load-badge level-${level}"><span class="load-dot"></span>${Scoring.loadLevelLabel(level)}</span></td><td>${actions}</td></tr>`;
    }).join('');
}

function openStaffModal(id) {
    const staff = id ? Store.staff.find(s => s.id === id) : null;
    const html = `<div class="form-group"><label for="staff-name">Name</label><input type="text" class="form-control" id="staff-name" value="${staff ? staff.name : ''}" placeholder="e.g. Jane Smith"></div><div class="form-group"><label for="staff-role">Role</label><select class="form-control" id="staff-role"><option value="Junior Coordinator" ${staff?.role === 'Junior Coordinator' ? 'selected' : ''}>Junior Coordinator</option><option value="Coordinator" ${staff?.role === 'Coordinator' ? 'selected' : ''}>Coordinator</option><option value="Senior Coordinator" ${!staff || staff?.role === 'Senior Coordinator' ? 'selected' : ''}>Senior Coordinator</option><option value="Manager" ${staff?.role === 'Manager' ? 'selected' : ''}>Manager</option></select></div>`;
    Modal.open(id ? 'Edit Staff Member' : 'Add Staff Member', html, async () => {
        const name = document.getElementById('staff-name').value.trim();
        const role = document.getElementById('staff-role').value;
        if (!name) { showToast('Name is required', 'error'); return; }
        try {
            if (id) await Store.updateStaff(id, { name, role }); else await Store.addStaff({ name, role });
            Modal.close(); showToast(id ? 'Staff updated' : 'Staff added', 'success');
        } catch (err) { Logger.error('ui', 'Staff save failed', { id }, err); showToast('Error: ' + err.message, 'error'); }
    });
}

async function deleteStaff(id) {
    const s = Store.staff.find(x => x.id === id);
    if (confirm(`Remove ${s.name}? Their survey assignments will be unassigned.`)) {
        try { await Store.removeStaff(id); showToast('Staff removed', 'info'); } catch (err) { Logger.error('ui', 'Staff delete failed', { id }, err); showToast('Error: ' + err.message, 'error'); }
    }
}

// ===== Surveys Panel =====
function renderSurveysTable() {
    const tbody = document.getElementById('surveys-table-body');
    const empty = document.getElementById('surveys-empty');
    if (Store.surveys.length === 0) { tbody.innerHTML = ''; empty.style.display = ''; return; }
    empty.style.display = 'none';
    const role = Auth._currentRole;
    tbody.innerHTML = Store.surveys.map(s => {
        const score = Math.round(Scoring.surveyScore(s));
        const assignedTo = Store.staff.find(st => st.id === Store.assignments[s.id]);
        const typeBadge = s.surveyType ? `<span class="survey-type-badge type-${s.surveyType}">${s.surveyType === 'quantitative' ? 'Quant' : s.surveyType === 'qualitative' ? 'Qual' : 'Mixed'}</span>` : '';
        let actions = '';
        if (Roles.canEditSurvey(role)) actions += `<button class="btn-action" onclick="openSurveyModal('${s.id}')" title="Edit">✏️</button>`;
        if (Roles.canDeleteSurvey(role)) actions += `<button class="btn-action danger" onclick="deleteSurvey('${s.id}')" title="Delete">🗑️</button>`;
        if (!actions) actions = '<span style="color:var(--text-muted);font-size:0.8rem">View only</span>';
        return `<tr><td><strong>${s.name}</strong> ${typeBadge}</td><td>${s.code || '—'}</td><td>${score}</td><td>${assignedTo ? assignedTo.name : '<span style="color:var(--text-muted)">Unassigned</span>'}</td><td>${actions}</td></tr>`;
    }).join('');
}

function surveyFormHTML(s) {
    const v = (field, def = 0) => s ? (s[field] ?? def) : def;
    const vs = (field, def = '') => s ? (s[field] ?? def) : def;
    const materialTypes = ['Lyophilized', 'Liquid', 'Whole Blood', 'Glass Slides', 'Digital Images', 'Swab/Culture', 'Other'];
    const materialOpts = materialTypes.map(m => `<option value="${m}" ${vs('materialType') === m ? 'selected' : ''}>${m}</option>`).join('');
    return `
    <div class="form-row"><div class="form-group"><label>Survey Name</label><input type="text" class="form-control" id="sv-name" value="${s ? s.name : ''}" placeholder="e.g. Routine Chemistry"></div><div class="form-group"><label>Code</label><input type="text" class="form-control" id="sv-code" value="${s ? s.code || '' : ''}" placeholder="e.g. CHEM-RC"></div></div>
    <div class="form-row"><div class="form-group"><label>Survey Type</label><select class="form-control" id="sv-surveyType"><option value="quantitative" ${vs('surveyType')==='quantitative'?'selected':''}>Quantitative</option><option value="qualitative" ${vs('surveyType')==='qualitative'?'selected':''}>Qualitative</option><option value="mixed" ${vs('surveyType')==='mixed'?'selected':''}>Mixed</option></select></div><div class="form-group"><label>Material Type</label><select class="form-control" id="sv-materialType">${materialOpts}</select></div></div>
    <div class="form-section"><div class="form-section-title">🧪 Analyte Volume</div>
        <div class="form-row"><div class="form-group"><label>Analytes / Measurands</label><input type="number" class="form-control" id="sv-analytes" value="${v('analytes')}" min="0"></div><div class="form-group"><label>Challenges per Round</label><input type="number" class="form-control" id="sv-challengesPerRound" value="${v('challengesPerRound', 1)}" min="1"></div></div>
        <div class="form-group"><label>Rounds per Year</label><input type="number" class="form-control" id="sv-roundsPerYear" value="${v('roundsPerYear')}" min="0" max="12"></div>
    </div>
    <div class="form-section"><div class="form-section-title">👥 Participant Load</div>
        <div class="form-row"><div class="form-group"><label>Active Participants</label><input type="number" class="form-control" id="sv-participants" value="${v('participants')}" min="0"></div><div class="form-group"><label>Jurisdictions</label><input type="number" class="form-control" id="sv-jurisdictions" value="${v('jurisdictions')}" min="0"></div></div>
        <div class="form-row"><div class="form-group"><label>Inquiry Rate (1-5)</label><input type="number" class="form-control" id="sv-inquiryRate" value="${v('inquiryRate')}" min="0" max="5"></div><div class="form-group"><label>Corrective Actions / Year</label><input type="number" class="form-control" id="sv-correctiveActions" value="${v('correctiveActions')}" min="0"></div></div>
    </div>
    <div class="form-section"><div class="form-section-title">📊 Grading Complexity</div>
        <div class="form-row"><div class="form-group"><label>Peer Groups</label><input type="number" class="form-control" id="sv-peerGroups" value="${v('peerGroups')}" min="0"></div><div class="form-group"><label>Grading Difficulty (1-5)</label><input type="number" class="form-control" id="sv-gradingMethod" value="${v('gradingMethod')}" min="1" max="5"></div></div>
        <div class="form-group"><label>Expert Panel Required</label><select class="form-control" id="sv-expertPanelNeeded"><option value="false" ${!v('expertPanelNeeded')?'selected':''}>No</option><option value="true" ${v('expertPanelNeeded')?'selected':''}>Yes</option></select></div>
    </div>
    <div class="form-section"><div class="form-section-title">📦 Material & Shipping</div>
        <div class="form-group"><label>Shipments per Year</label><input type="number" class="form-control" id="sv-shipmentsPerYear" value="${v('shipmentsPerYear')}" min="0"></div>
        <div class="form-row"><div class="form-group"><label>Cold Chain Required</label><select class="form-control" id="sv-coldChain"><option value="false" ${!v('coldChain')?'selected':''}>No</option><option value="true" ${v('coldChain')?'selected':''}>Yes</option></select></div><div class="form-group"><label>Slide Preparation</label><select class="form-control" id="sv-slidePrep"><option value="false" ${!v('slidePrep')?'selected':''}>No</option><option value="true" ${v('slidePrep')?'selected':''}>Yes</option></select></div></div>
    </div>
    <div class="form-section"><div class="form-section-title">📜 Regulatory & Reporting</div>
        <div class="form-row"><div class="form-group"><label>Accreditation Bodies</label><input type="number" class="form-control" id="sv-accreditationBodies" value="${v('accreditationBodies')}" min="0"></div><div class="form-group"><label>Report Complexity (1-5)</label><input type="number" class="form-control" id="sv-reportComplexity" value="${v('reportComplexity')}" min="1" max="5"></div></div>
        <div class="form-row"><div class="form-group"><label>Remediation Rate (1-5)</label><input type="number" class="form-control" id="sv-remediationRate" value="${v('remediationRate')}" min="1" max="5"></div><div class="form-group"><label>Reg. Change Freq (1-5)</label><input type="number" class="form-control" id="sv-regulatoryChangeFreq" value="${v('regulatoryChangeFreq')}" min="1" max="5"></div></div>
    </div>
    <div class="form-section"><div class="form-section-title">🤝 Committee Workload</div>
        <div class="form-row"><div class="form-group"><label>Committee Meetings / Year</label><input type="number" class="form-control" id="sv-committeeMeetings" value="${v('committeeMeetings')}" min="0"></div><div class="form-group"><label>Consensus Rounds / Year</label><input type="number" class="form-control" id="sv-consensusRounds" value="${v('consensusRounds')}" min="0"></div></div>
        <div class="form-group"><label>Educational Component</label><select class="form-control" id="sv-educationalComponent"><option value="false" ${!v('educationalComponent')?'selected':''}>No</option><option value="true" ${v('educationalComponent')?'selected':''}>Yes</option></select></div>
    </div>`;
}

function gatherSurveyForm() {
    const numFields = ['analytes','challengesPerRound','roundsPerYear','participants','jurisdictions','inquiryRate','correctiveActions','peerGroups','gradingMethod','shipmentsPerYear','accreditationBodies','reportComplexity','remediationRate','regulatoryChangeFreq','committeeMeetings','consensusRounds'];
    const boolFields = ['expertPanelNeeded','coldChain','slidePrep','educationalComponent'];
    const strFields = ['surveyType','materialType'];
    const data = { name: document.getElementById('sv-name').value.trim(), code: document.getElementById('sv-code').value.trim() };
    numFields.forEach(f => { data[f] = parseFloat(document.getElementById('sv-' + f).value) || 0; });
    boolFields.forEach(f => { data[f] = document.getElementById('sv-' + f).value === 'true'; });
    strFields.forEach(f => { data[f] = document.getElementById('sv-' + f).value; });
    return data;
}

function openSurveyModal(id) {
    const survey = id ? Store.surveys.find(s => s.id === id) : null;
    Modal.open(id ? 'Edit Survey' : 'Add Survey', surveyFormHTML(survey), async () => {
        const data = gatherSurveyForm();
        if (!data.name) { showToast('Survey name is required', 'error'); return; }
        try {
            if (id) await Store.updateSurvey(id, data); else await Store.addSurvey(data);
            Modal.close(); showToast(id ? 'Survey updated' : 'Survey added', 'success');
        } catch (err) { Logger.error('ui', 'Survey save failed', { id }, err); showToast('Error: ' + err.message, 'error'); }
    });
}

async function deleteSurvey(id) {
    const s = Store.surveys.find(x => x.id === id);
    if (confirm(`Delete survey "${s.name}"?`)) {
        try { await Store.removeSurvey(id); showToast('Survey deleted', 'info'); } catch (err) { Logger.error('ui', 'Survey delete failed', { id }, err); showToast('Error: ' + err.message, 'error'); }
    }
}

// ===== Assignments Panel =====
function renderAssignments() {
    const tbody = document.getElementById('assignments-table-body');
    const empty = document.getElementById('assignments-empty');
    if (Store.surveys.length === 0) { tbody.innerHTML = ''; empty.style.display = ''; return; }
    empty.style.display = 'none';
    const canAssign = Roles.canChangeAssignments(Auth._currentRole);
    tbody.innerHTML = Store.surveys.map(sv => {
        const score = Math.round(Scoring.surveyScore(sv));
        const currentStaff = Store.assignments[sv.id] || '';
        const options = Store.staff.map(s => `<option value="${s.id}" ${currentStaff === s.id ? 'selected' : ''}>${s.name}</option>`).join('');
        const assignedName = Store.staff.find(s => s.id === currentStaff)?.name || 'Unassigned';
        const assignCell = canAssign
            ? `<select class="form-control" onchange="assignSurvey('${sv.id}', this.value)" style="min-width:160px;"><option value="">— Unassigned —</option>${options}</select>`
            : `<span>${assignedName}</span>`;
        return `<tr><td><strong>${sv.name}</strong><br><span style="color:var(--text-muted);font-size:0.82rem;">${sv.code || ''}</span></td><td>${score}</td><td>${assignCell}</td><td><span style="color:var(--text-muted);font-size:0.85rem;">${score > 60 ? '⚠️ High impact' : score > 35 ? '📊 Medium' : '✅ Light'}</span></td></tr>`;
    }).join('');
    renderWorkloadPreview();
}

async function assignSurvey(surveyId, staffId) {
    try {
        await Store.assign(surveyId, staffId || null);
        renderWorkloadPreview();
        showToast('Assignment updated', 'success');
    } catch (err) { Logger.error('ui', 'Assignment update failed', { surveyId, staffId }, err); showToast('Error: ' + err.message, 'error'); }
}

function renderWorkloadPreview() {
    const container = document.getElementById('workload-preview-bars');
    const allScores = Store.staff.map(s => ({ name: s.name, score: Math.round(Scoring.staffWorkload(s.id)) }));
    const maxScore = Math.max(...allScores.map(s => s.score), 1);
    container.innerHTML = allScores.map(s => {
        const pct = Math.round((s.score / maxScore) * 100);
        const level = Scoring.loadLevel(s.score, Store.staff.length);
        return `<div class="preview-bar-item"><div class="preview-bar-label"><span class="preview-bar-name">${s.name}</span><span class="preview-bar-score">${s.score}</span></div><div class="preview-bar-track"><div class="preview-bar-fill level-${level}" style="width:${pct}%"></div></div></div>`;
    }).join('');
}

// ===== What-If Simulator (Multi-Reassignment) =====
let whatIfRowCounter = 0;

function initWhatIf() {
    document.getElementById('btn-what-if').onclick = () => {
        const panel = document.getElementById('what-if-panel');
        panel.style.display = panel.style.display === 'none' ? '' : 'none';
        if (panel.style.display !== 'none') {
            whatIfRowCounter = 0;
            document.getElementById('whatif-rows').innerHTML = '';
            document.getElementById('whatif-results').style.display = 'none';
            document.getElementById('btn-whatif-apply').style.display = 'none';
            addWhatIfRow();
        }
    };
    document.getElementById('btn-close-what-if').onclick = () => { document.getElementById('what-if-panel').style.display = 'none'; };
    document.getElementById('btn-whatif-add-row').onclick = addWhatIfRow;
    document.getElementById('btn-whatif-preview').onclick = previewWhatIf;
    document.getElementById('btn-whatif-apply').onclick = applyWhatIf;
}

function addWhatIfRow() {
    whatIfRowCounter++;
    const rowId = 'whatif-row-' + whatIfRowCounter;
    const container = document.getElementById('whatif-rows');
    const surveyOptions = '<option value="">Select survey...</option>' + Store.surveys.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    const staffOptions = '<option value="">Select staff...</option>' + Store.staff.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

    const row = document.createElement('div');
    row.className = 'whatif-row';
    row.id = rowId;
    row.innerHTML = `
        <span class="row-number">${whatIfRowCounter}</span>
        <div class="form-group">
            <label>Survey</label>
            <select class="form-control whatif-survey-select" data-row="${rowId}" onchange="onWhatIfSurveyChange(this)">${surveyOptions}</select>
        </div>
        <div class="form-group">
            <label>Currently</label>
            <select class="form-control whatif-from-display" disabled><option>—</option></select>
        </div>
        <span class="what-if-arrow">➡️</span>
        <div class="form-group">
            <label>Reassign To</label>
            <select class="form-control whatif-to-select">${staffOptions}</select>
        </div>
        <button class="btn-remove-row" onclick="removeWhatIfRow('${rowId}')" title="Remove">🗑️</button>
    `;
    container.appendChild(row);

    // Hide results when rows change
    document.getElementById('whatif-results').style.display = 'none';
    document.getElementById('btn-whatif-apply').style.display = 'none';
}

function onWhatIfSurveyChange(selectEl) {
    const row = selectEl.closest('.whatif-row');
    const fromDisplay = row.querySelector('.whatif-from-display');
    const surveyId = selectEl.value;
    const current = Store.assignments[surveyId];
    const staff = Store.staff.find(s => s.id === current);
    fromDisplay.innerHTML = staff ? `<option>${staff.name}</option>` : '<option>Unassigned</option>';
}

function removeWhatIfRow(rowId) {
    const row = document.getElementById(rowId);
    if (row) row.remove();
    // Renumber remaining rows
    document.querySelectorAll('.whatif-row').forEach((r, i) => {
        r.querySelector('.row-number').textContent = i + 1;
    });
    document.getElementById('whatif-results').style.display = 'none';
    document.getElementById('btn-whatif-apply').style.display = 'none';
}

function gatherWhatIfReassignments() {
    const rows = document.querySelectorAll('.whatif-row');
    const reassignments = [];
    for (const row of rows) {
        const surveyId = row.querySelector('.whatif-survey-select').value;
        const toId = row.querySelector('.whatif-to-select').value;
        if (surveyId && toId) {
            const survey = Store.surveys.find(s => s.id === surveyId);
            reassignments.push({ surveyId, toId, surveyName: survey ? survey.name : surveyId });
        }
    }
    return reassignments;
}

function previewWhatIf() {
    const reassignments = gatherWhatIfReassignments();
    if (reassignments.length === 0) {
        showToast('Fill in at least one complete reassignment (survey + target staff)', 'error');
        return;
    }

    // Check for duplicate surveys
    const surveyIds = reassignments.map(r => r.surveyId);
    if (new Set(surveyIds).size !== surveyIds.length) {
        showToast('Same survey selected in multiple rows — remove duplicates', 'error');
        return;
    }

    // Calculate before scores
    const beforeScores = {};
    Store.staff.forEach(s => { beforeScores[s.id] = Math.round(Scoring.staffWorkload(s.id)); });

    // Build temp assignments with ALL reassignments applied
    const tempAssignments = { ...Store.assignments };
    reassignments.forEach(r => { tempAssignments[r.surveyId] = r.toId; });

    // Calculate after scores
    const afterScores = {};
    Store.staff.forEach(s => { afterScores[s.id] = Math.round(Scoring.staffWorkload(s.id, tempAssignments)); });

    // Render comparison
    const renderCol = (scores, changeScores, label) => {
        return `<h4>${label}</h4>` + Store.staff.map(s => {
            const diff = changeScores ? changeScores[s.id] - scores[s.id] : 0;
            const diffHTML = diff !== 0 ? `<span class="score-change ${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '+' : ''}${diff}</span>` : '';
            return `<div class="what-if-score-row"><span class="name">${s.name}</span><span class="score">${changeScores ? changeScores[s.id] : scores[s.id]}${diffHTML}</span></div>`;
        }).join('');
    };

    // Summary line
    const changeCount = reassignments.length;
    const affectedStaff = new Set();
    reassignments.forEach(r => { affectedStaff.add(r.toId); const from = Store.assignments[r.surveyId]; if (from) affectedStaff.add(from); });

    document.getElementById('whatif-before').innerHTML = renderCol(beforeScores, null, `Current (${changeCount} change${changeCount > 1 ? 's' : ''} planned)`);
    document.getElementById('whatif-after').innerHTML = renderCol(beforeScores, afterScores, `After All Reassignments (${affectedStaff.size} staff affected)`);
    document.getElementById('whatif-results').style.display = '';
    document.getElementById('btn-whatif-apply').style.display = '';
}

async function applyWhatIf() {
    const reassignments = gatherWhatIfReassignments();
    for (const r of reassignments) { await Store.assign(r.surveyId, r.toId); }
    showToast(`${reassignments.length} reassignment${reassignments.length > 1 ? 's' : ''} applied!`, 'success');
    document.getElementById('what-if-panel').style.display = 'none';
    renderDashboard();
}

// ===== Settings =====
function renderSettings() {
    const w = Store.weights;
    CATEGORIES.forEach(cat => {
        document.getElementById(`weight-${cat}`).value = w[cat];
        document.getElementById(`weight-val-${cat}`).textContent = w[cat] + '%';
    });
    updateWeightTotal();
    renderOrgManagement();
    renderUserManagement();
}

// ===== Org Picker (Sidebar) =====
async function renderOrgPicker() {
    const picker = document.getElementById('org-picker');
    const select = document.getElementById('org-select');
    const allOrgs = await FirestoreStore.listOrgs();
    const userOrgs = UserManager.getUserOrgs();
    const availableOrgs = UserManager._isSuperAdmin
        ? allOrgs
        : allOrgs.filter(o => userOrgs.some(uo => uo.orgId === o.id));

    if (availableOrgs.length <= 1 && !UserManager._isSuperAdmin) {
        picker.style.display = 'none';
        return;
    }

    picker.style.display = '';
    select.innerHTML = availableOrgs.map(o =>
        `<option value="${o.id}" ${o.id === Auth._currentOrgId ? 'selected' : ''}>${o.name}</option>`
    ).join('');

    select.onchange = () => Auth.switchOrg(select.value);
}

// ===== Org Management (Super Admin) =====
async function renderOrgManagement() {
    const card = document.getElementById('org-management-card');
    if (!UserManager._isSuperAdmin) { card.style.display = 'none'; return; }
    card.style.display = '';
    const orgs = await FirestoreStore.listOrgs();
    const tbody = document.getElementById('org-table-body');
    tbody.innerHTML = orgs.map(o => {
        const created = o.createdAt ? new Date(o.createdAt.seconds * 1000).toLocaleDateString() : '—';
        const isCurrent = o.id === Auth._currentOrgId;
        const badge = isCurrent ? ' <span style="color:var(--accent-primary);font-size:0.75rem;">● Active</span>' : '';
        return `<tr><td><strong>${o.name}</strong>${badge}</td><td style="color:var(--text-muted)">${created}</td><td><button class="btn-action danger" onclick="deleteOrg('${o.id}', '${o.name}')" title="Delete">🗑️</button></td></tr>`;
    }).join('');

    document.getElementById('btn-add-org').onclick = async () => {
        const nameInput = document.getElementById('add-org-name');
        const name = nameInput.value.trim();
        if (!name) { showToast('Organization name is required', 'error'); return; }
        try {
            const orgId = await FirestoreStore.createOrg(name, Auth.currentUser.email);
            await UserManager.setRoleForOrg(Auth.currentUser.email, orgId, 'admin');
            nameInput.value = '';
            renderOrgManagement();
            renderOrgPicker();
            showToast(`Organization "${name}" created`, 'success');
        } catch (err) { Logger.error('ui', 'Org create failed', { name }, err); showToast('Error: ' + err.message, 'error'); }
    };
}

async function deleteOrg(orgId, name) {
    if (!confirm(`Delete organization "${name}" and ALL its data? This cannot be undone.`)) return;
    try {
        await FirestoreStore.deleteOrg(orgId);
        renderOrgManagement();
        renderOrgPicker();
        showToast(`Organization "${name}" deleted`, 'info');
    } catch (err) { Logger.error('ui', 'Org delete failed', { orgId, name }, err); showToast('Error: ' + err.message, 'error'); }
}

// ===== User Management (Per-Org) =====
async function renderUserManagement() {
    const card = document.getElementById('user-management-card');
    const canManage = Roles.canManageUsers(Auth._currentRole) || UserManager._isSuperAdmin;
    if (!canManage) { card.style.display = 'none'; return; }
    card.style.display = '';
    const orgId = Auth._currentOrgId;
    if (!orgId) return;
    const users = await UserManager.listOrgUsers(orgId);
    const tbody = document.getElementById('user-table-body');
    const currentEmail = Auth.currentUser?.email?.toLowerCase();
    tbody.innerHTML = users.map(u => {
        const isSelf = u.email.toLowerCase() === currentEmail;
        const roleColors = { admin: 'var(--accent-primary)', editor: '#2ecc71', viewer: 'var(--text-muted)' };
        const roleLabel = `<span style="color:${roleColors[u.role] || roleColors.viewer};font-weight:600;">${Roles.LABELS[u.role] || 'Viewer'}</span>`;
        const roleSelect = isSelf ? roleLabel : `<select class="form-control" style="min-width:100px;padding:4px 8px;font-size:0.82rem;" onchange="changeUserRole('${u.email}', this.value)"><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option><option value="editor" ${u.role==='editor'?'selected':''}>Editor</option><option value="viewer" ${u.role==='viewer'||!u.role?'selected':''}>Viewer</option></select>`;
        const removeBtn = isSelf ? '<span style="color:var(--text-muted);font-size:0.8rem;">You</span>' : `<button class="btn-action danger" onclick="removeAuthorizedUser('${u.email}')" title="Remove">🗑️</button>`;
        return `<tr><td>${u.email}</td><td>${roleSelect}</td><td>${removeBtn}</td></tr>`;
    }).join('');
}

async function addAuthorizedUser() {
    const emailInput = document.getElementById('add-user-email');
    const roleSelect = document.getElementById('add-user-role');
    const email = emailInput.value.trim();
    const role = roleSelect.value;
    if (!email) { showToast('Enter an email address', 'error'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Invalid email format', 'error'); return; }
    try {
        await UserManager.ensureUserDoc(email);
        await UserManager.setRoleForOrg(email, Auth._currentOrgId, role);
        emailInput.value = '';
        roleSelect.value = 'viewer';
        renderUserManagement();
        showToast(`${email} added as ${Roles.LABELS[role]}`, 'success');
    } catch (err) {
        Logger.error('ui', 'Add user failed', { email, role }, err);
        showToast(err.message, 'error');
    }
}

async function removeAuthorizedUser(email) {
    if (!confirm(`Remove ${email} from this organization?`)) return;
    try {
        await UserManager.removeUserFromOrg(email, Auth._currentOrgId);
        renderUserManagement();
        showToast(`${email} removed`, 'info');
    } catch (err) {
        Logger.error('ui', 'Remove user failed', { email }, err);
        showToast('Failed to remove user: ' + err.message, 'error');
    }
}

async function changeUserRole(email, newRole) {
    try {
        await UserManager.setRoleForOrg(email, Auth._currentOrgId, newRole);
        renderUserManagement();
        showToast(`Role updated to ${Roles.LABELS[newRole]}`, 'success');
    } catch (err) {
        Logger.error('ui', 'Role change failed', { email, newRole }, err);
        showToast('Failed to update role: ' + err.message, 'error');
    }
}

function initSettings() {
    document.querySelectorAll('.weight-slider').forEach(slider => {
        slider.addEventListener('input', async () => {
            const cat = slider.dataset.category;
            document.getElementById(`weight-val-${cat}`).textContent = slider.value + '%';
            const w = {};
            CATEGORIES.forEach(c => { w[c] = parseInt(document.getElementById(`weight-${c}`).value); });
            await Store.setWeights(w);
            updateWeightTotal();
        });
    });
    document.getElementById('btn-export-data').onclick = () => {
        const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'loadlevel-data.json'; a.click();
        showToast('Data exported', 'success');
    };
    document.getElementById('btn-import-data').onclick = () => document.getElementById('import-file-input').click();
    document.getElementById('import-file-input').onchange = (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => { try { await Store.importJSON(ev.target.result); showToast('Data imported', 'success'); renderDashboard(); } catch (err) { Logger.error('ui', 'Data import failed', null, err); showToast('Invalid JSON', 'error'); } };
        reader.readAsText(file);
    };
    document.getElementById('btn-clear-data').onclick = async () => { if (confirm('Clear ALL data in this organization?')) { await Store.clearAll(); showToast('Data cleared', 'info'); } };
    document.getElementById('btn-load-sample').onclick = async () => { if (confirm('Load sample data? Replaces current data.')) { await Store.loadSampleData(); showToast('Sample data loaded', 'success'); } };
    document.getElementById('btn-add-user').onclick = addAuthorizedUser;
    document.getElementById('add-user-email').addEventListener('keydown', (e) => { if (e.key === 'Enter') addAuthorizedUser(); });
}

function updateWeightTotal() {
    const total = CATEGORIES.reduce((sum, c) => sum + parseInt(document.getElementById(`weight-${c}`).value), 0);
    const el = document.getElementById('weight-total');
    el.innerHTML = `Total: <strong>${total}%</strong>${total !== 100 ? ' <span style="color:var(--color-danger);">⚠️ Should be 100%</span>' : ' ✅'}`;
    el.className = 'weight-total' + (total !== 100 ? ' invalid' : '');
}

// ===== Activity Log =====
const AUDIT_ACTION_META = {
    'survey.created':    { icon: '📋', verb: 'created survey' },
    'survey.updated':    { icon: '✏️', verb: 'updated survey' },
    'survey.deleted':    { icon: '🗑️', verb: 'deleted survey' },
    'staff.created':     { icon: '👤', verb: 'added staff member' },
    'staff.updated':     { icon: '✏️', verb: 'updated staff member' },
    'staff.deleted':     { icon: '🗑️', verb: 'removed staff member' },
    'assignment.changed':{ icon: '🔗', verb: 'changed assignment' },
    'weights.updated':   { icon: '⚖️', verb: 'updated category weights' },
    'data.cleared':      { icon: '🧹', verb: 'cleared all data' },
    'data.sampleLoaded': { icon: '🔄', verb: 'loaded sample data' },
    'data.imported':     { icon: '📤', verb: 'imported data' },
    'user.roleChanged':  { icon: '🔐', verb: 'changed user role' },
    'user.removed':      { icon: '🚫', verb: 'removed user' },
    'org.created':       { icon: '🏢', verb: 'created organization' },
    'org.deleted':       { icon: '🗑️', verb: 'deleted organization' },
};

function _auditDetailsText(action, details) {
    if (!details) return '';
    switch (action) {
        case 'survey.created': case 'survey.updated': case 'survey.deleted':
            return details.name ? `"${details.name}"${details.code ? ` (${details.code})` : ''}` : '';
        case 'staff.created': case 'staff.updated': case 'staff.deleted':
            return details.name ? `"${details.name}"${details.role ? ` — ${details.role}` : ''}` : '';
        case 'assignment.changed':
            return `${details.survey || '?'}: ${details.from} → ${details.to}`;
        case 'data.sampleLoaded': case 'data.imported':
            return `${details.surveyCount || details.surveys || 0} surveys, ${details.staffCount || details.staff || 0} staff`;
        case 'user.roleChanged':
            return `${details.email} → ${details.role}`;
        case 'user.removed':
            return details.email || '';
        default:
            return '';
    }
}

function _relativeTime(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
}

async function renderActivityLog() {
    const feed = document.getElementById('activity-feed');
    feed.innerHTML = '<div class="empty-state">Loading activity...</div>';
    try {
        const entries = await FirestoreStore.getAuditLog(100);
        if (entries.length === 0) {
            feed.innerHTML = '<div class="empty-state">No activity recorded yet. Actions like creating surveys and staff will appear here.</div>';
            return;
        }
        feed.innerHTML = entries.map(e => {
            const meta = AUDIT_ACTION_META[e.action] || { icon: '📝', verb: e.action };
            const detail = _auditDetailsText(e.action, e.details);
            const time = _relativeTime(e.timestamp);
            return `<div class="activity-entry">
                <div class="activity-icon">${meta.icon}</div>
                <div class="activity-body">
                    <div class="activity-text">
                        <strong>${e.user || 'system'}</strong> ${meta.verb}${detail ? ` — <span class="activity-detail">${detail}</span>` : ''}
                    </div>
                    <div class="activity-time">${time}</div>
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        Logger.error('ui', 'Activity log render failed', null, err);
        feed.innerHTML = '<div class="empty-state">Failed to load activity log.</div>';
    }
}

// ===== Role-Based UI Gating =====
function applyRoleRestrictions() {
    const role = Auth._currentRole;

    // Show/hide Add buttons
    document.getElementById('btn-add-staff').style.display = Roles.canCreateStaff(role) ? '' : 'none';
    document.getElementById('btn-add-survey').style.display = Roles.canCreateSurvey(role) ? '' : 'none';

    // Settings restrictions
    document.querySelectorAll('.weight-slider').forEach(s => {
        s.disabled = !Roles.canEditSettings(role);
        s.style.opacity = Roles.canEditSettings(role) ? '' : '0.5';
    });
    document.getElementById('btn-export-data').style.display = Roles.canExportImportData(role) ? '' : 'none';
    document.getElementById('btn-import-data').style.display = Roles.canExportImportData(role) ? '' : 'none';
    document.getElementById('btn-clear-data').style.display = Roles.canClearData(role) ? '' : 'none';
    document.getElementById('btn-load-sample').style.display = Roles.canClearData(role) ? '' : 'none';
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
});
