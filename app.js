// ===== State Management =====
const Store = {
    _data: { staff: [], surveys: [], assignments: {}, weights: { analyteVolume: 25, participantLoad: 20, gradingComplexity: 20, materialShipping: 15, regulatoryReporting: 12, committeeWork: 8 } },
    load() {
        const saved = localStorage.getItem('pt-loadlevel');
        if (saved) {
            this._data = JSON.parse(saved);
            // Migrate old weights to new dimensions if needed
            if (this._data.weights && this._data.weights.technical !== undefined) {
                this._data.weights = { analyteVolume: 25, participantLoad: 20, gradingComplexity: 20, materialShipping: 15, regulatoryReporting: 12, committeeWork: 8 };
                this.save();
            }
        }
        else this.loadSampleData();
    },
    save() { localStorage.setItem('pt-loadlevel', JSON.stringify(this._data)); },
    get staff() { return this._data.staff; },
    get surveys() { return this._data.surveys; },
    get assignments() { return this._data.assignments; },
    get weights() { return this._data.weights; },
    addStaff(s) { s.id = crypto.randomUUID(); this._data.staff.push(s); this.save(); },
    updateStaff(id, s) { const i = this._data.staff.findIndex(x => x.id === id); if (i >= 0) { this._data.staff[i] = { ...this._data.staff[i], ...s }; this.save(); } },
    removeStaff(id) {
        this._data.staff = this._data.staff.filter(x => x.id !== id);
        Object.keys(this._data.assignments).forEach(k => { if (this._data.assignments[k] === id) delete this._data.assignments[k]; });
        this.save();
    },
    addSurvey(s) { s.id = crypto.randomUUID(); this._data.surveys.push(s); this.save(); },
    updateSurvey(id, s) { const i = this._data.surveys.findIndex(x => x.id === id); if (i >= 0) { this._data.surveys[i] = { ...this._data.surveys[i], ...s }; this.save(); } },
    removeSurvey(id) { this._data.surveys = this._data.surveys.filter(x => x.id !== id); delete this._data.assignments[id]; this.save(); },
    assign(surveyId, staffId) { if (staffId) this._data.assignments[surveyId] = staffId; else delete this._data.assignments[surveyId]; this.save(); },
    setWeights(w) { this._data.weights = w; this.save(); },
    clearAll() { this._data = { staff: [], surveys: [], assignments: {}, weights: { analyteVolume: 25, participantLoad: 20, gradingComplexity: 20, materialShipping: 15, regulatoryReporting: 12, committeeWork: 8 } }; this.save(); },
    exportJSON() { return JSON.stringify(this._data, null, 2); },
    importJSON(json) { this._data = JSON.parse(json); this.save(); },

    loadSampleData() {
        this._data.staff = [
            { id: 's1', name: 'Sarah Chen', role: 'Senior Coordinator' },
            { id: 's2', name: 'Mike Thompson', role: 'Coordinator' },
            { id: 's3', name: 'Priya Patel', role: 'Junior Coordinator' },
            { id: 's4', name: 'David Wilson', role: 'Senior Coordinator' },
            { id: 's5', name: 'Emma Rodriguez', role: 'Coordinator' },
            { id: 's6', name: 'James Liu', role: 'Coordinator' }
        ];
        // Survey fields: name, code, surveyType, materialType,
        // Analyte Volume: analytes, challengesPerRound, roundsPerYear
        // Participant Load: participants, jurisdictions, inquiryRate(1-5), correctiveActions
        // Grading Complexity: peerGroups, gradingMethod(1-5), expertPanelNeeded(bool)
        // Material & Shipping: shipmentsPerYear, coldChain(bool), slidePrep(bool)
        // Regulatory & Reporting: accreditationBodies, reportComplexity(1-5), remediationRate(1-5), regulatoryChangeFreq(1-5)
        // Committee Workload: committeeMeetings, consensusRounds, educationalComponent(bool)
        const mk = (id, name, code, d) => ({ id, name, code, ...d });
        this._data.surveys = [
            // ── Chemistry ──
            mk('v1', 'Routine Chemistry', 'CHEM-RC', {
                surveyType: 'quantitative', materialType: 'Lyophilized',
                analytes: 35, challengesPerRound: 3, roundsPerYear: 6,
                participants: 400, jurisdictions: 13, inquiryRate: 4, correctiveActions: 40,
                peerGroups: 15, gradingMethod: 3, expertPanelNeeded: false,
                shipmentsPerYear: 2400, coldChain: false, slidePrep: false,
                accreditationBodies: 3, reportComplexity: 4, remediationRate: 3, regulatoryChangeFreq: 3,
                committeeMeetings: 2, consensusRounds: 0, educationalComponent: false
            }),
            mk('v2', 'Blood Gas & Oximetry', 'CHEM-BG', {
                surveyType: 'quantitative', materialType: 'Liquid',
                analytes: 12, challengesPerRound: 3, roundsPerYear: 6,
                participants: 350, jurisdictions: 13, inquiryRate: 3, correctiveActions: 25,
                peerGroups: 8, gradingMethod: 3, expertPanelNeeded: false,
                shipmentsPerYear: 2100, coldChain: true, slidePrep: false,
                accreditationBodies: 2, reportComplexity: 3, remediationRate: 2, regulatoryChangeFreq: 2,
                committeeMeetings: 1, consensusRounds: 0, educationalComponent: false
            }),
            mk('v3', 'Urinalysis Dipstick', 'CHEM-UDIP', {
                surveyType: 'mixed', materialType: 'Liquid',
                analytes: 10, challengesPerRound: 2, roundsPerYear: 4,
                participants: 380, jurisdictions: 13, inquiryRate: 3, correctiveActions: 20,
                peerGroups: 5, gradingMethod: 2, expertPanelNeeded: false,
                shipmentsPerYear: 1520, coldChain: false, slidePrep: false,
                accreditationBodies: 2, reportComplexity: 2, remediationRate: 2, regulatoryChangeFreq: 1,
                committeeMeetings: 1, consensusRounds: 0, educationalComponent: false
            }),
            mk('v4', 'Urine Chemistry', 'CHEM-UC', {
                surveyType: 'quantitative', materialType: 'Liquid',
                analytes: 15, challengesPerRound: 2, roundsPerYear: 4,
                participants: 250, jurisdictions: 10, inquiryRate: 2, correctiveActions: 15,
                peerGroups: 8, gradingMethod: 3, expertPanelNeeded: false,
                shipmentsPerYear: 1000, coldChain: false, slidePrep: false,
                accreditationBodies: 2, reportComplexity: 3, remediationRate: 2, regulatoryChangeFreq: 2,
                committeeMeetings: 1, consensusRounds: 0, educationalComponent: false
            }),
            mk('v5', 'B-Type Natriuretic Peptide', 'CHEM-BNP', {
                surveyType: 'quantitative', materialType: 'Lyophilized',
                analytes: 2, challengesPerRound: 2, roundsPerYear: 4,
                participants: 150, jurisdictions: 10, inquiryRate: 3, correctiveActions: 10,
                peerGroups: 4, gradingMethod: 2, expertPanelNeeded: false,
                shipmentsPerYear: 600, coldChain: false, slidePrep: false,
                accreditationBodies: 2, reportComplexity: 2, remediationRate: 2, regulatoryChangeFreq: 2,
                committeeMeetings: 0, consensusRounds: 0, educationalComponent: false
            }),
            mk('v6', 'Fecal Occult Blood', 'CHEM-FOB', {
                surveyType: 'qualitative', materialType: 'Other',
                analytes: 1, challengesPerRound: 5, roundsPerYear: 4,
                participants: 300, jurisdictions: 13, inquiryRate: 2, correctiveActions: 15,
                peerGroups: 3, gradingMethod: 2, expertPanelNeeded: false,
                shipmentsPerYear: 1200, coldChain: false, slidePrep: false,
                accreditationBodies: 2, reportComplexity: 2, remediationRate: 3, regulatoryChangeFreq: 1,
                committeeMeetings: 1, consensusRounds: 0, educationalComponent: false
            }),
            mk('v7', 'Hemoglobin A1c', 'CHEM-A1C', {
                surveyType: 'quantitative', materialType: 'Whole Blood',
                analytes: 1, challengesPerRound: 3, roundsPerYear: 4,
                participants: 350, jurisdictions: 13, inquiryRate: 3, correctiveActions: 18,
                peerGroups: 6, gradingMethod: 3, expertPanelNeeded: false,
                shipmentsPerYear: 1400, coldChain: true, slidePrep: false,
                accreditationBodies: 2, reportComplexity: 3, remediationRate: 2, regulatoryChangeFreq: 2,
                committeeMeetings: 1, consensusRounds: 0, educationalComponent: false
            }),
            // ── Hematology ──
            mk('v8', 'CBC & Leukocyte Differential', 'HEMA-LD', {
                surveyType: 'quantitative', materialType: 'Whole Blood',
                analytes: 22, challengesPerRound: 3, roundsPerYear: 6,
                participants: 400, jurisdictions: 13, inquiryRate: 4, correctiveActions: 35,
                peerGroups: 12, gradingMethod: 4, expertPanelNeeded: false,
                shipmentsPerYear: 2400, coldChain: true, slidePrep: false,
                accreditationBodies: 3, reportComplexity: 5, remediationRate: 3, regulatoryChangeFreq: 3,
                committeeMeetings: 2, consensusRounds: 0, educationalComponent: false
            }),
            mk('v9', 'Peripheral Blood Film', 'MORP-VSB', {
                surveyType: 'qualitative', materialType: 'Glass Slides',
                analytes: 8, challengesPerRound: 5, roundsPerYear: 3,
                participants: 200, jurisdictions: 13, inquiryRate: 3, correctiveActions: 12,
                peerGroups: 1, gradingMethod: 5, expertPanelNeeded: true,
                shipmentsPerYear: 0, coldChain: false, slidePrep: true,
                accreditationBodies: 2, reportComplexity: 4, remediationRate: 3, regulatoryChangeFreq: 1,
                committeeMeetings: 3, consensusRounds: 3, educationalComponent: true
            }),
            mk('v10', 'Erythrocyte Sedimentation Rate', 'HEMA-SR', {
                surveyType: 'quantitative', materialType: 'Whole Blood',
                analytes: 1, challengesPerRound: 2, roundsPerYear: 4,
                participants: 300, jurisdictions: 13, inquiryRate: 2, correctiveActions: 10,
                peerGroups: 3, gradingMethod: 2, expertPanelNeeded: false,
                shipmentsPerYear: 1200, coldChain: true, slidePrep: false,
                accreditationBodies: 2, reportComplexity: 2, remediationRate: 2, regulatoryChangeFreq: 1,
                committeeMeetings: 0, consensusRounds: 0, educationalComponent: false
            }),
            mk('v11', 'Fetal-Maternal Hemorrhage', 'HEMA-FMH', {
                surveyType: 'mixed', materialType: 'Whole Blood',
                analytes: 2, challengesPerRound: 2, roundsPerYear: 3,
                participants: 120, jurisdictions: 10, inquiryRate: 2, correctiveActions: 6,
                peerGroups: 3, gradingMethod: 3, expertPanelNeeded: false,
                shipmentsPerYear: 360, coldChain: true, slidePrep: false,
                accreditationBodies: 2, reportComplexity: 3, remediationRate: 2, regulatoryChangeFreq: 1,
                committeeMeetings: 1, consensusRounds: 1, educationalComponent: false
            }),
            // ── Coagulation ──
            mk('v12', 'Routine Coagulation', 'COAG', {
                surveyType: 'mixed', materialType: 'Lyophilized',
                analytes: 7, challengesPerRound: 3, roundsPerYear: 6,
                participants: 380, jurisdictions: 13, inquiryRate: 4, correctiveActions: 30,
                peerGroups: 10, gradingMethod: 4, expertPanelNeeded: false,
                shipmentsPerYear: 2280, coldChain: false, slidePrep: false,
                accreditationBodies: 3, reportComplexity: 4, remediationRate: 3, regulatoryChangeFreq: 3,
                committeeMeetings: 2, consensusRounds: 1, educationalComponent: false
            }),
            // ── Immunology ──
            mk('v13', 'Immunology & CRP', 'IMGY', {
                surveyType: 'quantitative', materialType: 'Lyophilized',
                analytes: 8, challengesPerRound: 2, roundsPerYear: 4,
                participants: 250, jurisdictions: 13, inquiryRate: 3, correctiveActions: 18,
                peerGroups: 6, gradingMethod: 3, expertPanelNeeded: false,
                shipmentsPerYear: 1000, coldChain: false, slidePrep: false,
                accreditationBodies: 2, reportComplexity: 3, remediationRate: 2, regulatoryChangeFreq: 2,
                committeeMeetings: 1, consensusRounds: 0, educationalComponent: false
            }),
            // ── Endocrinology ──
            mk('v14', 'Endocrinology & Tumour Markers', 'ENDO-A', {
                surveyType: 'quantitative', materialType: 'Lyophilized',
                analytes: 28, challengesPerRound: 2, roundsPerYear: 4,
                participants: 300, jurisdictions: 13, inquiryRate: 4, correctiveActions: 25,
                peerGroups: 12, gradingMethod: 3, expertPanelNeeded: false,
                shipmentsPerYear: 1200, coldChain: false, slidePrep: false,
                accreditationBodies: 3, reportComplexity: 4, remediationRate: 3, regulatoryChangeFreq: 3,
                committeeMeetings: 2, consensusRounds: 0, educationalComponent: false
            }),
            // ── Drug Monitoring ──
            mk('v15', 'Drug Monitoring', 'DRUG', {
                surveyType: 'quantitative', materialType: 'Lyophilized',
                analytes: 18, challengesPerRound: 2, roundsPerYear: 4,
                participants: 200, jurisdictions: 10, inquiryRate: 2, correctiveActions: 12,
                peerGroups: 8, gradingMethod: 3, expertPanelNeeded: false,
                shipmentsPerYear: 800, coldChain: false, slidePrep: false,
                accreditationBodies: 2, reportComplexity: 3, remediationRate: 2, regulatoryChangeFreq: 2,
                committeeMeetings: 1, consensusRounds: 0, educationalComponent: false
            }),
            mk('v16', 'Urine Drugs of Abuse', 'DRUG-UA', {
                surveyType: 'qualitative', materialType: 'Liquid',
                analytes: 12, challengesPerRound: 1, roundsPerYear: 4,
                participants: 280, jurisdictions: 13, inquiryRate: 3, correctiveActions: 18,
                peerGroups: 4, gradingMethod: 3, expertPanelNeeded: false,
                shipmentsPerYear: 1120, coldChain: false, slidePrep: false,
                accreditationBodies: 2, reportComplexity: 3, remediationRate: 3, regulatoryChangeFreq: 2,
                committeeMeetings: 1, consensusRounds: 0, educationalComponent: false
            }),
            // ── Bacteriology / Microbiology ──
            mk('v17', 'Bacteriology Gram Stain', 'BACT-DGS', {
                surveyType: 'qualitative', materialType: 'Glass Slides',
                analytes: 5, challengesPerRound: 5, roundsPerYear: 3,
                participants: 250, jurisdictions: 13, inquiryRate: 3, correctiveActions: 15,
                peerGroups: 1, gradingMethod: 4, expertPanelNeeded: true,
                shipmentsPerYear: 0, coldChain: false, slidePrep: true,
                accreditationBodies: 2, reportComplexity: 3, remediationRate: 3, regulatoryChangeFreq: 1,
                committeeMeetings: 3, consensusRounds: 3, educationalComponent: true
            }),
            mk('v18', 'Molecular Microbiology STI', 'MOLE-STI', {
                surveyType: 'qualitative', materialType: 'Swab/Culture',
                analytes: 3, challengesPerRound: 3, roundsPerYear: 3,
                participants: 180, jurisdictions: 13, inquiryRate: 3, correctiveActions: 8,
                peerGroups: 2, gradingMethod: 3, expertPanelNeeded: true,
                shipmentsPerYear: 540, coldChain: true, slidePrep: false,
                accreditationBodies: 2, reportComplexity: 3, remediationRate: 2, regulatoryChangeFreq: 3,
                committeeMeetings: 2, consensusRounds: 2, educationalComponent: false
            }),
            // ── Virology ──
            mk('v19', 'Virology - HIV', 'VIRO-HIV', {
                surveyType: 'qualitative', materialType: 'Liquid',
                analytes: 2, challengesPerRound: 3, roundsPerYear: 3,
                participants: 220, jurisdictions: 13, inquiryRate: 3, correctiveActions: 12,
                peerGroups: 3, gradingMethod: 3, expertPanelNeeded: true,
                shipmentsPerYear: 660, coldChain: true, slidePrep: false,
                accreditationBodies: 2, reportComplexity: 3, remediationRate: 2, regulatoryChangeFreq: 2,
                committeeMeetings: 2, consensusRounds: 2, educationalComponent: false
            }),
            mk('v20', 'SARS-CoV-2', 'VIRO-COV', {
                surveyType: 'qualitative', materialType: 'Swab/Culture',
                analytes: 1, challengesPerRound: 3, roundsPerYear: 4,
                participants: 350, jurisdictions: 13, inquiryRate: 5, correctiveActions: 30,
                peerGroups: 4, gradingMethod: 3, expertPanelNeeded: true,
                shipmentsPerYear: 1400, coldChain: true, slidePrep: false,
                accreditationBodies: 3, reportComplexity: 3, remediationRate: 3, regulatoryChangeFreq: 5,
                committeeMeetings: 4, consensusRounds: 2, educationalComponent: false
            }),
            // ── Flow Cytometry ──
            mk('v21', 'Leukocyte Immunophenotyping', 'FLOW-HD', {
                surveyType: 'quantitative', materialType: 'Whole Blood',
                analytes: 15, challengesPerRound: 2, roundsPerYear: 3,
                participants: 120, jurisdictions: 10, inquiryRate: 3, correctiveActions: 8,
                peerGroups: 4, gradingMethod: 4, expertPanelNeeded: true,
                shipmentsPerYear: 360, coldChain: true, slidePrep: false,
                accreditationBodies: 2, reportComplexity: 5, remediationRate: 2, regulatoryChangeFreq: 2,
                committeeMeetings: 2, consensusRounds: 1, educationalComponent: false
            }),
            // ── Genetics ──
            mk('v22', 'Cytogenetics G-banding', 'GENE-CG', {
                surveyType: 'qualitative', materialType: 'Glass Slides',
                analytes: 5, challengesPerRound: 3, roundsPerYear: 3,
                participants: 60, jurisdictions: 8, inquiryRate: 2, correctiveActions: 5,
                peerGroups: 1, gradingMethod: 5, expertPanelNeeded: true,
                shipmentsPerYear: 0, coldChain: false, slidePrep: true,
                accreditationBodies: 2, reportComplexity: 5, remediationRate: 2, regulatoryChangeFreq: 2,
                committeeMeetings: 3, consensusRounds: 3, educationalComponent: true
            }),
            // ── Point-of-Care Testing ──
            mk('v23', 'POCT Glucose', 'POCT-GLU', {
                surveyType: 'quantitative', materialType: 'Liquid',
                analytes: 1, challengesPerRound: 2, roundsPerYear: 4,
                participants: 400, jurisdictions: 13, inquiryRate: 3, correctiveActions: 25,
                peerGroups: 3, gradingMethod: 2, expertPanelNeeded: false,
                shipmentsPerYear: 1600, coldChain: false, slidePrep: false,
                accreditationBodies: 2, reportComplexity: 2, remediationRate: 3, regulatoryChangeFreq: 1,
                committeeMeetings: 1, consensusRounds: 0, educationalComponent: false
            }),
            mk('v24', 'POCT Coagulation INR', 'POCT-INR', {
                surveyType: 'quantitative', materialType: 'Liquid',
                analytes: 1, challengesPerRound: 2, roundsPerYear: 4,
                participants: 200, jurisdictions: 13, inquiryRate: 3, correctiveActions: 12,
                peerGroups: 3, gradingMethod: 2, expertPanelNeeded: false,
                shipmentsPerYear: 800, coldChain: false, slidePrep: false,
                accreditationBodies: 2, reportComplexity: 2, remediationRate: 2, regulatoryChangeFreq: 2,
                committeeMeetings: 0, consensusRounds: 0, educationalComponent: false
            }),
            // ── Transfusion Medicine ──
            mk('v25', 'Transfusion Medicine', 'TMED-AAU', {
                surveyType: 'mixed', materialType: 'Whole Blood',
                analytes: 6, challengesPerRound: 3, roundsPerYear: 4,
                participants: 180, jurisdictions: 13, inquiryRate: 4, correctiveActions: 15,
                peerGroups: 5, gradingMethod: 4, expertPanelNeeded: true,
                shipmentsPerYear: 720, coldChain: true, slidePrep: false,
                accreditationBodies: 3, reportComplexity: 4, remediationRate: 3, regulatoryChangeFreq: 3,
                committeeMeetings: 3, consensusRounds: 2, educationalComponent: false
            }),
            // ── Cytology ──
            mk('v26', 'Cytology Non-Gynecological', 'CYTO-NG', {
                surveyType: 'qualitative', materialType: 'Glass Slides',
                analytes: 4, challengesPerRound: 5, roundsPerYear: 2,
                participants: 150, jurisdictions: 10, inquiryRate: 2, correctiveActions: 8,
                peerGroups: 1, gradingMethod: 5, expertPanelNeeded: true,
                shipmentsPerYear: 0, coldChain: false, slidePrep: true,
                accreditationBodies: 2, reportComplexity: 4, remediationRate: 3, regulatoryChangeFreq: 1,
                committeeMeetings: 4, consensusRounds: 4, educationalComponent: true
            }),
            // ── Pathology ──
            mk('v27', 'Pathology Educational', 'PATH-E', {
                surveyType: 'qualitative', materialType: 'Digital Images',
                analytes: 6, challengesPerRound: 5, roundsPerYear: 2,
                participants: 100, jurisdictions: 8, inquiryRate: 2, correctiveActions: 4,
                peerGroups: 1, gradingMethod: 5, expertPanelNeeded: true,
                shipmentsPerYear: 0, coldChain: false, slidePrep: false,
                accreditationBodies: 2, reportComplexity: 3, remediationRate: 1, regulatoryChangeFreq: 1,
                committeeMeetings: 4, consensusRounds: 4, educationalComponent: true
            })
        ];
        // Intentionally imbalanced: Sarah has the heavy hitters, Emma/Priya are light
        this._data.assignments = {
            v1: 's1', v2: 's1', v8: 's1', v12: 's1', v14: 's1',  // Sarah: Routine Chem, Blood Gas, CBC, Coag, Endo (5 high-volume surveys)
            v3: 's4', v7: 's4', v10: 's4', v25: 's4',             // David: Urinalysis, A1c, ESR, Transfusion (4 surveys)
            v15: 's2', v16: 's2', v19: 's2', v20: 's2',           // Mike: Drug Mon, Urine Drugs, HIV, SARS-CoV-2 (4 surveys)
            v4: 's6', v5: 's6', v6: 's6', v13: 's6', v18: 's6',  // James: Urine Chem, BNP, FOB, Immunology, Mol Micro (5 surveys but lighter)
            v9: 's3', v17: 's3', v26: 's3',                       // Priya: Blood Film, Gram Stain, Cytology (3 qualitative surveys)
            v11: 's5', v22: 's5', v23: 's5', v24: 's5',           // Emma: FMH, Genetics, POCT Glucose, POCT INR (4 light surveys)
            v21: 's4', v27: 's3'                                   // overflow: Flow Cyt → David, Pathology → Priya
        };
        this._data.weights = { analyteVolume: 25, participantLoad: 20, gradingComplexity: 20, materialShipping: 15, regulatoryReporting: 12, committeeWork: 8 };
        this.save();
    }
};

// ===== Scoring Engine =====
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
                // Composite: analytes × challenges × frequency — the "throughput" of data
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
                // Survey type multiplier: qualitative=1.0, mixed=0.7, quantitative=0.4
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
