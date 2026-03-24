// ===== Firestore Data Layer =====
// Organization-scoped CRUD with real-time listeners

const FirestoreStore = {
    _orgId: null,
    _listeners: [],  // active onSnapshot unsubscribers
    _cache: { surveys: [], staff: [], assignments: {}, weights: {} },
    _onUpdate: null, // callback for real-time updates

    get orgId() { return this._orgId; },
    get surveys() { return this._cache.surveys; },
    get staff() { return this._cache.staff; },
    get assignments() { return this._cache.assignments; },
    get weights() { return this._cache.weights; },

    defaultWeights() {
        return { analyteVolume: 25, participantLoad: 20, gradingComplexity: 20, materialShipping: 15, regulatoryReporting: 12, committeeWork: 8 };
    },

    // ===== Organization Management =====

    async createOrg(name, adminEmail) {
        Logger.info('db', 'Creating organization', { name, adminEmail });
        const docRef = await db.collection('organizations').add({
            name,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: adminEmail,
            branding: { displayName: '', accentColor: '', logoUrl: '' }
        });
        // Set default weights
        await db.collection('organizations').doc(docRef.id)
            .collection('settings').doc('weights')
            .set(this.defaultWeights());
        Logger.info('db', 'Organization created', { orgId: docRef.id, name });
        return docRef.id;
    },

    async listOrgs() {
        const snap = await db.collection('organizations').get();
        const orgs = [];
        snap.forEach(doc => orgs.push({ id: doc.id, ...doc.data() }));
        return orgs;
    },

    async renameOrg(orgId, newName) {
        await db.collection('organizations').doc(orgId).update({ name: newName });
    },

    async updateOrgBranding(orgId, branding) {
        await db.collection('organizations').doc(orgId).update({ branding });
        this.writeAuditEntry('org.branding', { orgId, ...branding });
        Logger.info('db', 'Org branding updated', { orgId, branding });
    },

    async getOrgBranding(orgId) {
        const doc = await db.collection('organizations').doc(orgId).get();
        return doc.exists ? (doc.data().branding || {}) : {};
    },

    async sendInvitationEmail(recipientEmail, orgName, roleName, invitedBy) {
        await db.collection('mail').add({
            to: recipientEmail,
            message: {
                subject: `You've been invited to ${orgName} on LoadLevel`,
                html: `
                    <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #1a1d23; color: #e0e0e0; border-radius: 12px;">
                        <h2 style="color: #818cf8; margin: 0 0 16px;">Welcome to LoadLevel</h2>
                        <p>You've been invited to <strong style="color: #fff;">${orgName}</strong> as <strong style="color: #818cf8;">${roleName}</strong>.</p>
                        <p style="margin: 24px 0;">
                            <a href="https://pt-loadlevel.web.app" style="display: inline-block; padding: 12px 28px; background: #818cf8; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">Sign In to LoadLevel</a>
                        </p>
                        <p style="font-size: 0.85rem; color: #999;">Use Google Sign-In with <strong>${recipientEmail}</strong> to get started.</p>
                        <hr style="border: none; border-top: 1px solid #2a2d35; margin: 24px 0;">
                        <p style="font-size: 0.8rem; color: #666;">Invited by ${invitedBy}</p>
                    </div>
                `
            }
        });
        Logger.info('db', 'Invitation email queued', { to: recipientEmail, orgName, role: roleName });
    },

    async getPlatformStats() {
        const orgs = await this.listOrgs();
        const allUsers = await db.collection('users').get().catch(() => ({ docs: [] }));
        const stats = { totalOrgs: orgs.length, totalUsers: 0, totalSurveys: 0, totalStaff: 0, orgs: [] };
        for (const org of orgs) {
            const [surveysSnap, staffSnap] = await Promise.all([
                db.collection('organizations').doc(org.id).collection('surveys').get(),
                db.collection('organizations').doc(org.id).collection('staff').get()
            ]);
            // Count users by checking their organizations array
            let userCount = 0;
            allUsers.docs.forEach(doc => {
                const data = doc.data();
                if (data.organizations && data.organizations.some(o => o.orgId === org.id)) {
                    userCount++;
                }
            });
            const orgStats = {
                id: org.id, name: org.name,
                surveys: surveysSnap.size, staff: staffSnap.size,
                users: userCount,
                createdAt: org.createdAt
            };
            stats.totalSurveys += orgStats.surveys;
            stats.totalStaff += orgStats.staff;
            stats.totalUsers += orgStats.users;
            stats.orgs.push(orgStats);
        }
        return stats;
    },

    async deleteOrg(orgId) {
        Logger.warn('db', 'Deleting organization and all data', { orgId });
        // Delete subcollections first
        const collections = ['surveys', 'staff', 'assignments'];
        for (const col of collections) {
            const snap = await db.collection('organizations').doc(orgId).collection(col).get();
            const batch = db.batch();
            snap.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
        // Delete settings
        await db.collection('organizations').doc(orgId).collection('settings').doc('weights').delete().catch(() => {});
        // Delete org doc
        await db.collection('organizations').doc(orgId).delete();
        Logger.info('db', 'Organization deleted', { orgId });
    },

    // ===== Load Organization (with real-time listeners) =====

    async loadOrg(orgId, onUpdate) {
        // Unsubscribe from previous listeners
        this.unsubscribe();
        this._orgId = orgId;
        this._onUpdate = onUpdate;
        this._cache = { surveys: [], staff: [], assignments: {}, weights: this.defaultWeights() };

        const orgRef = db.collection('organizations').doc(orgId);
        Logger.time('loadOrg:' + orgId);

        // Real-time: Surveys
        this._listeners.push(
            orgRef.collection('surveys').onSnapshot(snap => {
                this._cache.surveys = [];
                snap.forEach(doc => this._cache.surveys.push({ id: doc.id, ...doc.data() }));
                if (this._onUpdate) this._onUpdate('surveys');
            }, err => {
                Logger.error('db', 'Surveys listener failed', { orgId }, err);
            })
        );

        // Real-time: Staff
        this._listeners.push(
            orgRef.collection('staff').onSnapshot(snap => {
                this._cache.staff = [];
                snap.forEach(doc => this._cache.staff.push({ id: doc.id, ...doc.data() }));
                if (this._onUpdate) this._onUpdate('staff');
            }, err => {
                Logger.error('db', 'Staff listener failed', { orgId }, err);
            })
        );

        // Real-time: Assignments (single doc with all mappings)
        this._listeners.push(
            orgRef.collection('settings').doc('assignments').onSnapshot(doc => {
                this._cache.assignments = doc.exists ? doc.data() : {};
                if (this._onUpdate) this._onUpdate('assignments');
            }, err => {
                Logger.error('db', 'Assignments listener failed', { orgId }, err);
            })
        );

        // Real-time: Weights
        this._listeners.push(
            orgRef.collection('settings').doc('weights').onSnapshot(doc => {
                this._cache.weights = doc.exists ? doc.data() : this.defaultWeights();
                if (this._onUpdate) this._onUpdate('weights');
            }, err => {
                Logger.error('db', 'Weights listener failed', { orgId }, err);
            })
        );

        // Wait for initial data to load
        await Promise.all([
            orgRef.collection('surveys').get(),
            orgRef.collection('staff').get(),
            orgRef.collection('settings').doc('assignments').get(),
            orgRef.collection('settings').doc('weights').get()
        ]);
        Logger.timeEnd('loadOrg:' + orgId);
    },

    unsubscribe() {
        this._listeners.forEach(unsub => unsub());
        this._listeners = [];
    },

    // ===== Audit Log =====

    writeAuditEntry(action, details) {
        if (!this._orgId) return;
        const user = (typeof Auth !== 'undefined' && Auth.currentUser)
            ? Auth.currentUser.email.toLowerCase()
            : 'system';
        db.collection('organizations').doc(this._orgId)
            .collection('auditLog').add({
                action,
                user,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                details: details || {}
            }).catch(err => Logger.error('db', 'Audit write failed', { action }, err));
    },

    async getAuditLog(limit = 100) {
        if (!this._orgId) return [];
        const snap = await db.collection('organizations').doc(this._orgId)
            .collection('auditLog')
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();
        const entries = [];
        snap.forEach(doc => entries.push({ id: doc.id, ...doc.data() }));
        return entries;
    },

    // ===== Snapshots =====

    async takeSnapshot(label) {
        if (!this._orgId) throw new Error('No org loaded');
        const user = (typeof Auth !== 'undefined' && Auth.currentUser)
            ? Auth.currentUser.email.toLowerCase() : 'system';

        const staffScores = this._cache.staff.map(s => {
            const score = Math.round(Scoring.staffWorkload(s.id));
            const level = Scoring.loadLevel(score, this._cache.staff.length);
            return { name: s.name, score, level: Scoring.loadLevelLabel(level) };
        }).sort((a, b) => b.score - a.score);

        const scores = staffScores.map(s => s.score);
        const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

        const snapshot = {
            label: label || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            takenBy: user,
            stats: {
                staffCount: this._cache.staff.length,
                surveyCount: this._cache.surveys.length,
                avgWorkload: avg,
                imbalanceIndex: Scoring.imbalanceIndex()
            },
            staffScores
        };

        const docRef = await db.collection('organizations').doc(this._orgId)
            .collection('snapshots').add(snapshot);
        this.writeAuditEntry('snapshot.taken', { label: snapshot.label });
        Logger.info('db', 'Snapshot taken', { id: docRef.id, label: snapshot.label });
        return docRef.id;
    },

    async getSnapshots(limit = 50) {
        if (!this._orgId) return [];
        const snap = await db.collection('organizations').doc(this._orgId)
            .collection('snapshots')
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();
        const entries = [];
        snap.forEach(doc => entries.push({ id: doc.id, ...doc.data() }));
        return entries;
    },

    async deleteSnapshot(id) {
        if (!this._orgId) throw new Error('No org loaded');
        await db.collection('organizations').doc(this._orgId)
            .collection('snapshots').doc(id).delete();
        this.writeAuditEntry('snapshot.deleted', { id });
        Logger.info('db', 'Snapshot deleted', { id });
    },

    // ===== Survey CRUD =====

    async addSurvey(data) {
        if (!this._orgId) throw new Error('No org loaded');
        const docRef = await db.collection('organizations').doc(this._orgId)
            .collection('surveys').add(data);
        this.writeAuditEntry('survey.created', { id: docRef.id, name: data.name, code: data.code });
        return docRef.id;
    },

    async updateSurvey(surveyId, data) {
        if (!this._orgId) throw new Error('No org loaded');
        await db.collection('organizations').doc(this._orgId)
            .collection('surveys').doc(surveyId).update(data);
        this.writeAuditEntry('survey.updated', { id: surveyId, name: data.name, code: data.code });
    },

    async removeSurvey(surveyId) {
        if (!this._orgId) throw new Error('No org loaded');
        const survey = this._cache.surveys.find(s => s.id === surveyId);
        await db.collection('organizations').doc(this._orgId)
            .collection('surveys').doc(surveyId).delete();
        // Also remove assignment
        await this.assign(surveyId, null);
        this.writeAuditEntry('survey.deleted', { id: surveyId, name: survey?.name });
    },

    // ===== Staff CRUD =====

    async addStaff(data) {
        if (!this._orgId) throw new Error('No org loaded');
        const docRef = await db.collection('organizations').doc(this._orgId)
            .collection('staff').add(data);
        this.writeAuditEntry('staff.created', { id: docRef.id, name: data.name, role: data.role });
        return docRef.id;
    },

    async updateStaff(staffId, data) {
        if (!this._orgId) throw new Error('No org loaded');
        await db.collection('organizations').doc(this._orgId)
            .collection('staff').doc(staffId).update(data);
        this.writeAuditEntry('staff.updated', { id: staffId, name: data.name, role: data.role });
    },

    async removeStaff(staffId) {
        if (!this._orgId) throw new Error('No org loaded');
        const staff = this._cache.staff.find(s => s.id === staffId);
        await db.collection('organizations').doc(this._orgId)
            .collection('staff').doc(staffId).delete();
        // Remove any assignments pointing to this staff
        const updated = { ...this._cache.assignments };
        let changed = false;
        Object.keys(updated).forEach(k => {
            if (updated[k] === staffId) { delete updated[k]; changed = true; }
        });
        if (changed) {
            await db.collection('organizations').doc(this._orgId)
                .collection('settings').doc('assignments').set(updated);
        }
        this.writeAuditEntry('staff.deleted', { id: staffId, name: staff?.name });
    },

    // ===== Assignments =====

    async assign(surveyId, staffId) {
        if (!this._orgId) throw new Error('No org loaded');
        const ref = db.collection('organizations').doc(this._orgId)
            .collection('settings').doc('assignments');
        const survey = this._cache.surveys.find(s => s.id === surveyId);
        const prevStaff = this._cache.staff.find(s => s.id === this._cache.assignments[surveyId]);
        const newStaff = this._cache.staff.find(s => s.id === staffId);
        if (staffId) {
            await ref.set({ [surveyId]: staffId }, { merge: true });
        } else {
            await ref.update({ [surveyId]: firebase.firestore.FieldValue.delete() });
        }
        this.writeAuditEntry('assignment.changed', {
            survey: survey?.name || surveyId,
            from: prevStaff?.name || 'Unassigned',
            to: newStaff?.name || 'Unassigned'
        });
    },

    // ===== Weights =====

    async setWeights(weights) {
        if (!this._orgId) throw new Error('No org loaded');
        await db.collection('organizations').doc(this._orgId)
            .collection('settings').doc('weights').set(weights);
        this.writeAuditEntry('weights.updated', weights);
    },

    // ===== Bulk Operations =====

    async clearAllData() {
        if (!this._orgId) throw new Error('No org loaded');
        Logger.warn('db', 'Clearing all org data', { orgId: this._orgId });
        const orgRef = db.collection('organizations').doc(this._orgId);
        // Delete all surveys
        const surveySnap = await orgRef.collection('surveys').get();
        const batch1 = db.batch();
        surveySnap.forEach(doc => batch1.delete(doc.ref));
        await batch1.commit();
        // Delete all staff
        const staffSnap = await orgRef.collection('staff').get();
        const batch2 = db.batch();
        staffSnap.forEach(doc => batch2.delete(doc.ref));
        await batch2.commit();
        // Reset assignments and weights
        await orgRef.collection('settings').doc('assignments').set({});
        await orgRef.collection('settings').doc('weights').set(this.defaultWeights());
        this.writeAuditEntry('data.cleared', {});
    },

    async loadSampleData() {
        if (!this._orgId) throw new Error('No org loaded');
        // Clear first
        await this.clearAllData();

        const orgRef = db.collection('organizations').doc(this._orgId);

        // Staff
        const staffMap = {};
        const staffData = [
            { name: 'Sarah Chen', role: 'Senior Coordinator' },
            { name: 'Mike Thompson', role: 'Coordinator' },
            { name: 'Priya Patel', role: 'Junior Coordinator' },
            { name: 'David Wilson', role: 'Senior Coordinator' },
            { name: 'Emma Rodriguez', role: 'Coordinator' },
            { name: 'James Liu', role: 'Coordinator' }
        ];
        const staffKeys = ['s1', 's2', 's3', 's4', 's5', 's6'];
        for (let i = 0; i < staffData.length; i++) {
            const ref = await orgRef.collection('staff').add(staffData[i]);
            staffMap[staffKeys[i]] = ref.id;
        }

        // Surveys
        const surveyMap = {};
        const surveys = _getSampleSurveys();
        for (const s of surveys) {
            const oldId = s._oldId;
            delete s._oldId;
            const ref = await orgRef.collection('surveys').add(s);
            surveyMap[oldId] = ref.id;
        }

        // Assignments
        const oldAssignments = {
            v1: 's1', v2: 's1', v8: 's1', v12: 's1', v14: 's1',
            v3: 's4', v7: 's4', v10: 's4', v25: 's4',
            v15: 's2', v16: 's2', v19: 's2', v20: 's2',
            v4: 's6', v5: 's6', v6: 's6', v13: 's6', v18: 's6',
            v9: 's3', v17: 's3', v26: 's3',
            v11: 's5', v22: 's5', v23: 's5', v24: 's5',
            v21: 's4', v27: 's3'
        };
        const assignments = {};
        Object.entries(oldAssignments).forEach(([surveyKey, staffKey]) => {
            if (surveyMap[surveyKey] && staffMap[staffKey]) {
                assignments[surveyMap[surveyKey]] = staffMap[staffKey];
            }
        });
        await orgRef.collection('settings').doc('assignments').set(assignments);
        this.writeAuditEntry('data.sampleLoaded', { surveyCount: surveys.length, staffCount: staffData.length });
    },

    // ===== Export / Import =====

    exportJSON() {
        return JSON.stringify({
            surveys: this._cache.surveys,
            staff: this._cache.staff,
            assignments: this._cache.assignments,
            weights: this._cache.weights
        }, null, 2);
    },

    async importJSON(json) {
        Logger.info('db', 'Importing data from JSON', { orgId: this._orgId });
        const data = JSON.parse(json);
        await this.clearAllData();
        const orgRef = db.collection('organizations').doc(this._orgId);
        // Import staff
        const staffMap = {};
        for (const s of (data.staff || [])) {
            const oldId = s.id;
            const { id, ...rest } = s;
            const ref = await orgRef.collection('staff').add(rest);
            staffMap[oldId] = ref.id;
        }
        // Import surveys
        const surveyMap = {};
        for (const s of (data.surveys || [])) {
            const oldId = s.id;
            const { id, ...rest } = s;
            const ref = await orgRef.collection('surveys').add(rest);
            surveyMap[oldId] = ref.id;
        }
        // Import assignments (remap IDs)
        const assignments = {};
        Object.entries(data.assignments || {}).forEach(([sId, stId]) => {
            const newSurveyId = surveyMap[sId] || sId;
            const newStaffId = staffMap[stId] || stId;
            assignments[newSurveyId] = newStaffId;
        });
        await orgRef.collection('settings').doc('assignments').set(assignments);
        // Import weights
        if (data.weights) {
            await orgRef.collection('settings').doc('weights').set(data.weights);
        }
        this.writeAuditEntry('data.imported', {
            surveys: (data.surveys || []).length,
            staff: (data.staff || []).length
        });
    }
};

// ===== User Manager (replaces AllowList) =====
const UserManager = {
    _currentUser: null,   // { email, orgs: [{orgId, role}] }
    _currentRole: 'viewer',
    _isSuperAdmin: false,

    SUPER_ADMIN_COLLECTION: 'superAdmins',

    async loadUser(email) {
        const lower = email.toLowerCase();
        const doc = await db.collection('users').doc(lower).get();
        if (doc.exists) {
            this._currentUser = { email: lower, ...doc.data() };
        } else {
            this._currentUser = null;
        }
        // Check super admin
        const saDoc = await db.collection(this.SUPER_ADMIN_COLLECTION).doc(lower).get();
        this._isSuperAdmin = saDoc.exists;
        return this._currentUser;
    },

    isAllowed(email) {
        return this._currentUser !== null || this._isSuperAdmin;
    },

    getUserOrgs() {
        if (!this._currentUser) return [];
        return this._currentUser.organizations || [];
    },

    getRoleForOrg(orgId) {
        if (this._isSuperAdmin) return 'admin';
        const orgs = this.getUserOrgs();
        const entry = orgs.find(o => o.orgId === orgId);
        return entry ? entry.role : null;
    },

    async setRoleForOrg(email, orgId, role) {
        const lower = email.toLowerCase();
        const docRef = db.collection('users').doc(lower);
        const doc = await docRef.get();
        let orgs = doc.exists ? (doc.data().organizations || []) : [];
        const idx = orgs.findIndex(o => o.orgId === orgId);
        if (idx >= 0) {
            orgs[idx].role = role;
        } else {
            orgs.push({ orgId, role });
        }
        await docRef.set({ organizations: orgs, lastUpdated: new Date().toISOString() }, { merge: true });
        FirestoreStore.writeAuditEntry('user.roleChanged', { email: lower, role });
    },

    async removeUserFromOrg(email, orgId) {
        const lower = email.toLowerCase();
        const docRef = db.collection('users').doc(lower);
        const doc = await docRef.get();
        if (!doc.exists) return;
        let orgs = doc.data().organizations || [];
        orgs = orgs.filter(o => o.orgId !== orgId);
        await docRef.update({ organizations: orgs });
        FirestoreStore.writeAuditEntry('user.removed', { email: lower });
    },

    async listOrgUsers(orgId) {
        // Query all users who have this orgId in their organizations array
        const snap = await db.collection('users').get();
        const users = [];
        snap.forEach(doc => {
            const data = doc.data();
            const orgEntry = (data.organizations || []).find(o => o.orgId === orgId);
            if (orgEntry) {
                users.push({ email: doc.id, role: orgEntry.role, ...data });
            }
        });
        return users;
    },

    async seedSuperAdmin(email) {
        const lower = email.toLowerCase();
        // Check if any super admins exist
        const snap = await db.collection(this.SUPER_ADMIN_COLLECTION).get();
        if (snap.empty) {
            await db.collection(this.SUPER_ADMIN_COLLECTION).doc(lower).set({
                addedAt: new Date().toISOString()
            });
            // Also create user doc
            await db.collection('users').doc(lower).set({
                organizations: [],
                lastUpdated: new Date().toISOString()
            }, { merge: true });
            this._isSuperAdmin = true;
            Logger.info('auth', 'Seeded first super admin', { email: lower });
        }
    },

    async ensureUserDoc(email) {
        const lower = email.toLowerCase();
        const docRef = db.collection('users').doc(lower);
        const doc = await docRef.get();
        if (!doc.exists) {
            await docRef.set({ organizations: [], lastUpdated: new Date().toISOString() });
        }
    }
};

// ===== Sample Survey Data Factory =====
function _getSampleSurveys() {
    const mk = (oldId, name, code, d) => ({ _oldId: oldId, name, code, ...d });
    return [
        mk('v1', 'Routine Chemistry', 'CHEM-RC', { surveyType: 'quantitative', materialType: 'Lyophilized', analytes: 35, challengesPerRound: 3, roundsPerYear: 6, participants: 400, jurisdictions: 13, inquiryRate: 4, correctiveActions: 40, peerGroups: 15, gradingMethod: 3, expertPanelNeeded: false, shipmentsPerYear: 2400, coldChain: false, slidePrep: false, accreditationBodies: 3, reportComplexity: 4, remediationRate: 3, regulatoryChangeFreq: 3, committeeMeetings: 2, consensusRounds: 0, educationalComponent: false }),
        mk('v2', 'Blood Gas & Oximetry', 'CHEM-BG', { surveyType: 'quantitative', materialType: 'Liquid', analytes: 12, challengesPerRound: 3, roundsPerYear: 6, participants: 350, jurisdictions: 13, inquiryRate: 3, correctiveActions: 25, peerGroups: 8, gradingMethod: 3, expertPanelNeeded: false, shipmentsPerYear: 2100, coldChain: true, slidePrep: false, accreditationBodies: 2, reportComplexity: 3, remediationRate: 2, regulatoryChangeFreq: 2, committeeMeetings: 1, consensusRounds: 0, educationalComponent: false }),
        mk('v3', 'Urinalysis Dipstick', 'CHEM-UDIP', { surveyType: 'mixed', materialType: 'Liquid', analytes: 10, challengesPerRound: 2, roundsPerYear: 4, participants: 380, jurisdictions: 13, inquiryRate: 3, correctiveActions: 20, peerGroups: 5, gradingMethod: 2, expertPanelNeeded: false, shipmentsPerYear: 1520, coldChain: false, slidePrep: false, accreditationBodies: 2, reportComplexity: 2, remediationRate: 2, regulatoryChangeFreq: 1, committeeMeetings: 1, consensusRounds: 0, educationalComponent: false }),
        mk('v4', 'Urine Chemistry', 'CHEM-UC', { surveyType: 'quantitative', materialType: 'Liquid', analytes: 15, challengesPerRound: 2, roundsPerYear: 4, participants: 250, jurisdictions: 10, inquiryRate: 2, correctiveActions: 15, peerGroups: 8, gradingMethod: 3, expertPanelNeeded: false, shipmentsPerYear: 1000, coldChain: false, slidePrep: false, accreditationBodies: 2, reportComplexity: 3, remediationRate: 2, regulatoryChangeFreq: 2, committeeMeetings: 1, consensusRounds: 0, educationalComponent: false }),
        mk('v5', 'B-Type Natriuretic Peptide', 'CHEM-BNP', { surveyType: 'quantitative', materialType: 'Lyophilized', analytes: 2, challengesPerRound: 2, roundsPerYear: 4, participants: 150, jurisdictions: 10, inquiryRate: 3, correctiveActions: 10, peerGroups: 4, gradingMethod: 2, expertPanelNeeded: false, shipmentsPerYear: 600, coldChain: false, slidePrep: false, accreditationBodies: 2, reportComplexity: 2, remediationRate: 2, regulatoryChangeFreq: 2, committeeMeetings: 0, consensusRounds: 0, educationalComponent: false }),
        mk('v6', 'Fecal Occult Blood', 'CHEM-FOB', { surveyType: 'qualitative', materialType: 'Other', analytes: 1, challengesPerRound: 5, roundsPerYear: 4, participants: 300, jurisdictions: 13, inquiryRate: 2, correctiveActions: 15, peerGroups: 3, gradingMethod: 2, expertPanelNeeded: false, shipmentsPerYear: 1200, coldChain: false, slidePrep: false, accreditationBodies: 2, reportComplexity: 2, remediationRate: 3, regulatoryChangeFreq: 1, committeeMeetings: 1, consensusRounds: 0, educationalComponent: false }),
        mk('v7', 'Hemoglobin A1c', 'CHEM-A1C', { surveyType: 'quantitative', materialType: 'Whole Blood', analytes: 1, challengesPerRound: 3, roundsPerYear: 4, participants: 350, jurisdictions: 13, inquiryRate: 3, correctiveActions: 18, peerGroups: 6, gradingMethod: 3, expertPanelNeeded: false, shipmentsPerYear: 1400, coldChain: true, slidePrep: false, accreditationBodies: 2, reportComplexity: 3, remediationRate: 2, regulatoryChangeFreq: 2, committeeMeetings: 1, consensusRounds: 0, educationalComponent: false }),
        mk('v8', 'CBC & Leukocyte Differential', 'HEMA-LD', { surveyType: 'quantitative', materialType: 'Whole Blood', analytes: 22, challengesPerRound: 3, roundsPerYear: 6, participants: 400, jurisdictions: 13, inquiryRate: 4, correctiveActions: 35, peerGroups: 12, gradingMethod: 4, expertPanelNeeded: false, shipmentsPerYear: 2400, coldChain: true, slidePrep: false, accreditationBodies: 3, reportComplexity: 5, remediationRate: 3, regulatoryChangeFreq: 3, committeeMeetings: 2, consensusRounds: 0, educationalComponent: false }),
        mk('v9', 'Peripheral Blood Film', 'MORP-VSB', { surveyType: 'qualitative', materialType: 'Glass Slides', analytes: 8, challengesPerRound: 5, roundsPerYear: 3, participants: 200, jurisdictions: 13, inquiryRate: 3, correctiveActions: 12, peerGroups: 1, gradingMethod: 5, expertPanelNeeded: true, shipmentsPerYear: 0, coldChain: false, slidePrep: true, accreditationBodies: 2, reportComplexity: 4, remediationRate: 3, regulatoryChangeFreq: 1, committeeMeetings: 3, consensusRounds: 3, educationalComponent: true }),
        mk('v10', 'Erythrocyte Sedimentation Rate', 'HEMA-SR', { surveyType: 'quantitative', materialType: 'Whole Blood', analytes: 1, challengesPerRound: 2, roundsPerYear: 4, participants: 300, jurisdictions: 13, inquiryRate: 2, correctiveActions: 10, peerGroups: 3, gradingMethod: 2, expertPanelNeeded: false, shipmentsPerYear: 1200, coldChain: true, slidePrep: false, accreditationBodies: 2, reportComplexity: 2, remediationRate: 2, regulatoryChangeFreq: 1, committeeMeetings: 0, consensusRounds: 0, educationalComponent: false }),
        mk('v11', 'Fetal-Maternal Hemorrhage', 'HEMA-FMH', { surveyType: 'mixed', materialType: 'Whole Blood', analytes: 2, challengesPerRound: 2, roundsPerYear: 3, participants: 120, jurisdictions: 10, inquiryRate: 2, correctiveActions: 6, peerGroups: 3, gradingMethod: 3, expertPanelNeeded: false, shipmentsPerYear: 360, coldChain: true, slidePrep: false, accreditationBodies: 2, reportComplexity: 3, remediationRate: 2, regulatoryChangeFreq: 1, committeeMeetings: 1, consensusRounds: 1, educationalComponent: false }),
        mk('v12', 'Routine Coagulation', 'COAG', { surveyType: 'mixed', materialType: 'Lyophilized', analytes: 7, challengesPerRound: 3, roundsPerYear: 6, participants: 380, jurisdictions: 13, inquiryRate: 4, correctiveActions: 30, peerGroups: 10, gradingMethod: 4, expertPanelNeeded: false, shipmentsPerYear: 2280, coldChain: false, slidePrep: false, accreditationBodies: 3, reportComplexity: 4, remediationRate: 3, regulatoryChangeFreq: 3, committeeMeetings: 2, consensusRounds: 1, educationalComponent: false }),
        mk('v13', 'Immunology & CRP', 'IMGY', { surveyType: 'quantitative', materialType: 'Lyophilized', analytes: 8, challengesPerRound: 2, roundsPerYear: 4, participants: 250, jurisdictions: 13, inquiryRate: 3, correctiveActions: 18, peerGroups: 6, gradingMethod: 3, expertPanelNeeded: false, shipmentsPerYear: 1000, coldChain: false, slidePrep: false, accreditationBodies: 2, reportComplexity: 3, remediationRate: 2, regulatoryChangeFreq: 2, committeeMeetings: 1, consensusRounds: 0, educationalComponent: false }),
        mk('v14', 'Endocrinology & Tumour Markers', 'ENDO-A', { surveyType: 'quantitative', materialType: 'Lyophilized', analytes: 28, challengesPerRound: 2, roundsPerYear: 4, participants: 300, jurisdictions: 13, inquiryRate: 4, correctiveActions: 25, peerGroups: 12, gradingMethod: 3, expertPanelNeeded: false, shipmentsPerYear: 1200, coldChain: false, slidePrep: false, accreditationBodies: 3, reportComplexity: 4, remediationRate: 3, regulatoryChangeFreq: 3, committeeMeetings: 2, consensusRounds: 0, educationalComponent: false }),
        mk('v15', 'Drug Monitoring', 'DRUG', { surveyType: 'quantitative', materialType: 'Lyophilized', analytes: 18, challengesPerRound: 2, roundsPerYear: 4, participants: 200, jurisdictions: 10, inquiryRate: 2, correctiveActions: 12, peerGroups: 8, gradingMethod: 3, expertPanelNeeded: false, shipmentsPerYear: 800, coldChain: false, slidePrep: false, accreditationBodies: 2, reportComplexity: 3, remediationRate: 2, regulatoryChangeFreq: 2, committeeMeetings: 1, consensusRounds: 0, educationalComponent: false }),
        mk('v16', 'Urine Drugs of Abuse', 'DRUG-UA', { surveyType: 'qualitative', materialType: 'Liquid', analytes: 12, challengesPerRound: 1, roundsPerYear: 4, participants: 280, jurisdictions: 13, inquiryRate: 3, correctiveActions: 18, peerGroups: 4, gradingMethod: 3, expertPanelNeeded: false, shipmentsPerYear: 1120, coldChain: false, slidePrep: false, accreditationBodies: 2, reportComplexity: 3, remediationRate: 3, regulatoryChangeFreq: 2, committeeMeetings: 1, consensusRounds: 0, educationalComponent: false }),
        mk('v17', 'Bacteriology Gram Stain', 'BACT-DGS', { surveyType: 'qualitative', materialType: 'Glass Slides', analytes: 5, challengesPerRound: 5, roundsPerYear: 3, participants: 250, jurisdictions: 13, inquiryRate: 3, correctiveActions: 15, peerGroups: 1, gradingMethod: 4, expertPanelNeeded: true, shipmentsPerYear: 0, coldChain: false, slidePrep: true, accreditationBodies: 2, reportComplexity: 3, remediationRate: 3, regulatoryChangeFreq: 1, committeeMeetings: 3, consensusRounds: 3, educationalComponent: true }),
        mk('v18', 'Molecular Microbiology STI', 'MOLE-STI', { surveyType: 'qualitative', materialType: 'Swab/Culture', analytes: 3, challengesPerRound: 3, roundsPerYear: 3, participants: 180, jurisdictions: 13, inquiryRate: 3, correctiveActions: 8, peerGroups: 2, gradingMethod: 3, expertPanelNeeded: true, shipmentsPerYear: 540, coldChain: true, slidePrep: false, accreditationBodies: 2, reportComplexity: 3, remediationRate: 2, regulatoryChangeFreq: 3, committeeMeetings: 2, consensusRounds: 2, educationalComponent: false }),
        mk('v19', 'Virology - HIV', 'VIRO-HIV', { surveyType: 'qualitative', materialType: 'Liquid', analytes: 2, challengesPerRound: 3, roundsPerYear: 3, participants: 220, jurisdictions: 13, inquiryRate: 3, correctiveActions: 12, peerGroups: 3, gradingMethod: 3, expertPanelNeeded: true, shipmentsPerYear: 660, coldChain: true, slidePrep: false, accreditationBodies: 2, reportComplexity: 3, remediationRate: 2, regulatoryChangeFreq: 2, committeeMeetings: 2, consensusRounds: 2, educationalComponent: false }),
        mk('v20', 'SARS-CoV-2', 'VIRO-COV', { surveyType: 'qualitative', materialType: 'Swab/Culture', analytes: 1, challengesPerRound: 3, roundsPerYear: 4, participants: 350, jurisdictions: 13, inquiryRate: 5, correctiveActions: 30, peerGroups: 4, gradingMethod: 3, expertPanelNeeded: true, shipmentsPerYear: 1400, coldChain: true, slidePrep: false, accreditationBodies: 3, reportComplexity: 3, remediationRate: 3, regulatoryChangeFreq: 5, committeeMeetings: 4, consensusRounds: 2, educationalComponent: false }),
        mk('v21', 'Leukocyte Immunophenotyping', 'FLOW-HD', { surveyType: 'quantitative', materialType: 'Whole Blood', analytes: 15, challengesPerRound: 2, roundsPerYear: 3, participants: 120, jurisdictions: 10, inquiryRate: 3, correctiveActions: 8, peerGroups: 4, gradingMethod: 4, expertPanelNeeded: true, shipmentsPerYear: 360, coldChain: true, slidePrep: false, accreditationBodies: 2, reportComplexity: 5, remediationRate: 2, regulatoryChangeFreq: 2, committeeMeetings: 2, consensusRounds: 1, educationalComponent: false }),
        mk('v22', 'Cytogenetics G-banding', 'GENE-CG', { surveyType: 'qualitative', materialType: 'Glass Slides', analytes: 5, challengesPerRound: 3, roundsPerYear: 3, participants: 60, jurisdictions: 8, inquiryRate: 2, correctiveActions: 5, peerGroups: 1, gradingMethod: 5, expertPanelNeeded: true, shipmentsPerYear: 0, coldChain: false, slidePrep: true, accreditationBodies: 2, reportComplexity: 5, remediationRate: 2, regulatoryChangeFreq: 2, committeeMeetings: 3, consensusRounds: 3, educationalComponent: true }),
        mk('v23', 'POCT Glucose', 'POCT-GLU', { surveyType: 'quantitative', materialType: 'Liquid', analytes: 1, challengesPerRound: 2, roundsPerYear: 4, participants: 400, jurisdictions: 13, inquiryRate: 3, correctiveActions: 25, peerGroups: 3, gradingMethod: 2, expertPanelNeeded: false, shipmentsPerYear: 1600, coldChain: false, slidePrep: false, accreditationBodies: 2, reportComplexity: 2, remediationRate: 3, regulatoryChangeFreq: 1, committeeMeetings: 1, consensusRounds: 0, educationalComponent: false }),
        mk('v24', 'POCT Coagulation INR', 'POCT-INR', { surveyType: 'quantitative', materialType: 'Liquid', analytes: 1, challengesPerRound: 2, roundsPerYear: 4, participants: 200, jurisdictions: 13, inquiryRate: 3, correctiveActions: 12, peerGroups: 3, gradingMethod: 2, expertPanelNeeded: false, shipmentsPerYear: 800, coldChain: false, slidePrep: false, accreditationBodies: 2, reportComplexity: 2, remediationRate: 2, regulatoryChangeFreq: 2, committeeMeetings: 0, consensusRounds: 0, educationalComponent: false }),
        mk('v25', 'Transfusion Medicine', 'TMED-AAU', { surveyType: 'mixed', materialType: 'Whole Blood', analytes: 6, challengesPerRound: 3, roundsPerYear: 4, participants: 180, jurisdictions: 13, inquiryRate: 4, correctiveActions: 15, peerGroups: 5, gradingMethod: 4, expertPanelNeeded: true, shipmentsPerYear: 720, coldChain: true, slidePrep: false, accreditationBodies: 3, reportComplexity: 4, remediationRate: 3, regulatoryChangeFreq: 3, committeeMeetings: 3, consensusRounds: 2, educationalComponent: false }),
        mk('v26', 'Cytology Non-Gynecological', 'CYTO-NG', { surveyType: 'qualitative', materialType: 'Glass Slides', analytes: 4, challengesPerRound: 5, roundsPerYear: 2, participants: 150, jurisdictions: 10, inquiryRate: 2, correctiveActions: 8, peerGroups: 1, gradingMethod: 5, expertPanelNeeded: true, shipmentsPerYear: 0, coldChain: false, slidePrep: true, accreditationBodies: 2, reportComplexity: 4, remediationRate: 3, regulatoryChangeFreq: 1, committeeMeetings: 4, consensusRounds: 4, educationalComponent: true }),
        mk('v27', 'Pathology Educational', 'PATH-E', { surveyType: 'qualitative', materialType: 'Digital Images', analytes: 6, challengesPerRound: 5, roundsPerYear: 2, participants: 100, jurisdictions: 8, inquiryRate: 2, correctiveActions: 4, peerGroups: 1, gradingMethod: 5, expertPanelNeeded: true, shipmentsPerYear: 0, coldChain: false, slidePrep: false, accreditationBodies: 2, reportComplexity: 3, remediationRate: 1, regulatoryChangeFreq: 1, committeeMeetings: 4, consensusRounds: 4, educationalComponent: true })
    ];
}
