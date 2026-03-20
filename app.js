// ===== Store — Thin wrapper around FirestoreStore =====
// Store provides the same API the UI layer expects, delegating to FirestoreStore
const Store = {
    get staff() { return FirestoreStore.staff; },
    get surveys() { return FirestoreStore.surveys; },
    get assignments() { return FirestoreStore.assignments; },
    get weights() { return FirestoreStore.weights; },

    async addStaff(s) { await FirestoreStore.addStaff(s); },
    async updateStaff(id, s) { await FirestoreStore.updateStaff(id, s); },
    async removeStaff(id) { await FirestoreStore.removeStaff(id); },
    async addSurvey(s) { await FirestoreStore.addSurvey(s); },
    async updateSurvey(id, s) { await FirestoreStore.updateSurvey(id, s); },
    async removeSurvey(id) { await FirestoreStore.removeSurvey(id); },
    async assign(surveyId, staffId) { await FirestoreStore.assign(surveyId, staffId); },
    async setWeights(w) { await FirestoreStore.setWeights(w); },
    async clearAll() { await FirestoreStore.clearAllData(); },
    async loadSampleData() { await FirestoreStore.loadSampleData(); },
    exportJSON() { return FirestoreStore.exportJSON(); },
    async importJSON(json) { await FirestoreStore.importJSON(json); },
};

// ===== Scoring Engine (pure — no storage, just math) =====
const CATEGORIES = ['analyteVolume', 'participantLoad', 'gradingComplexity', 'materialShipping', 'regulatoryReporting', 'committeeWork'];
const CATEGORY_LABELS = { analyteVolume: 'Analyte Volume', participantLoad: 'Participant Load', gradingComplexity: 'Grading Complexity', materialShipping: 'Material & Shipping', regulatoryReporting: 'Regulatory & Reporting', committeeWork: 'Committee Work' };
const CATEGORY_ICONS = { analyteVolume: '🧪', participantLoad: '👥', gradingComplexity: '📊', materialShipping: '📦', regulatoryReporting: '📜', committeeWork: '🤝' };

const Scoring = {
    MAXES: {
        analytes: 40, challengesPerRound: 5, roundsPerYear: 12,
        participants: 500, jurisdictions: 15, inquiryRate: 5, correctiveActions: 50,
        peerGroups: 20, gradingMethod: 5,
        shipmentsPerYear: 3000,
        accreditationBodies: 5, reportComplexity: 5, remediationRate: 5, regulatoryChangeFreq: 5,
        committeeMeetings: 6, consensusRounds: 5
    },

    norm(val, max) { return Math.min((val || 0) / max, 1); },

    categoryScore(survey, category) {
        const n = this.norm.bind(this);
        const M = this.MAXES;
        switch (category) {
            case 'analyteVolume': {
                const raw = (survey.analytes || 0) * (survey.challengesPerRound || 1) * (survey.roundsPerYear || 1);
                const maxRaw = M.analytes * M.challengesPerRound * M.roundsPerYear;
                return Math.min(raw / maxRaw, 1) * 100;
            }
            case 'participantLoad':
                return (n(survey.participants, M.participants) * 0.35 +
                        n(survey.jurisdictions, M.jurisdictions) * 0.25 +
                        n(survey.inquiryRate, M.inquiryRate) * 0.20 +
                        n(survey.correctiveActions, M.correctiveActions) * 0.20) * 100;
            case 'gradingComplexity': {
                const typeMultiplier = survey.surveyType === 'qualitative' ? 1.0 : survey.surveyType === 'mixed' ? 0.7 : 0.4;
                const expertBonus = survey.expertPanelNeeded ? 0.3 : 0;
                return (n(survey.peerGroups, M.peerGroups) * 0.25 +
                        n(survey.gradingMethod, M.gradingMethod) * 0.25 +
                        typeMultiplier * 0.25 +
                        expertBonus * 0.25) * 100;
            }
            case 'materialShipping': {
                const coldBonus = survey.coldChain ? 0.3 : 0;
                const slideBonus = survey.slidePrep ? 0.25 : 0;
                return (n(survey.shipmentsPerYear, M.shipmentsPerYear) * 0.45 +
                        coldBonus * 0.25 +
                        slideBonus * 0.30) * 100;
            }
            case 'regulatoryReporting':
                return (n(survey.accreditationBodies, M.accreditationBodies) * 0.25 +
                        n(survey.reportComplexity, M.reportComplexity) * 0.30 +
                        n(survey.remediationRate, M.remediationRate) * 0.25 +
                        n(survey.regulatoryChangeFreq, M.regulatoryChangeFreq) * 0.20) * 100;
            case 'committeeWork': {
                const eduBonus = survey.educationalComponent ? 0.25 : 0;
                return (n(survey.committeeMeetings, M.committeeMeetings) * 0.40 +
                        n(survey.consensusRounds, M.consensusRounds) * 0.35 +
                        eduBonus * 0.25) * 100;
            }
            default: return 0;
        }
    },

    surveyScore(survey) {
        const w = Store.weights;
        const total = CATEGORIES.reduce((sum, cat) => sum + (w[cat] || 0), 0);
        if (total === 0) return 0;
        return CATEGORIES.reduce((sum, cat) => sum + this.categoryScore(survey, cat) * ((w[cat] || 0) / total), 0);
    },

    staffWorkload(staffId, assignmentsOverride) {
        const assignments = assignmentsOverride || Store.assignments;
        return Store.surveys.filter(s => assignments[s.id] === staffId).reduce((sum, s) => sum + this.surveyScore(s), 0);
    },

    staffCategoryBreakdown(staffId) {
        const result = {};
        CATEGORIES.forEach(cat => {
            result[cat] = Store.surveys.filter(s => Store.assignments[s.id] === staffId).reduce((sum, s) => sum + this.categoryScore(s, cat), 0);
        });
        return result;
    },

    loadLevel(score, staffCount) {
        if (staffCount === 0) return 'low';
        const allScores = Store.staff.map(s => this.staffWorkload(s.id));
        const max = Math.max(...allScores, 1);
        const pct = score / max;
        if (pct >= 0.85) return 'critical';
        if (pct >= 0.65) return 'high';
        if (pct >= 0.35) return 'moderate';
        return 'low';
    },

    loadLevelLabel(level) {
        return { low: 'Low', moderate: 'Moderate', high: 'High', critical: 'Critical' }[level] || 'N/A';
    },

    imbalanceIndex() {
        const scores = Store.staff.map(s => this.staffWorkload(s.id));
        if (scores.length < 2) return 0;
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
        if (mean === 0) return 0;
        const stddev = Math.sqrt(scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length);
        return Math.round((stddev / mean) * 100);
    }
};
