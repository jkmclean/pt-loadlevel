// ===== Firebase Configuration =====
const firebaseConfig = {
    apiKey: "AIzaSyAxE0bCj6Jm0lvi4vbJdeVerfrQO72BP9Y",
    authDomain: "pt-loadlevel.firebaseapp.com",
    projectId: "pt-loadlevel",
    storageBucket: "pt-loadlevel.firebasestorage.app",
    messagingSenderId: "96502262038",
    appId: "1:96502262038:web:22018e0ef269fbf6e38837"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ===== Role Definitions =====
const Roles = {
    ADMIN: 'admin',
    EDITOR: 'editor',
    VIEWER: 'viewer',

    LABELS: { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' },
    DESCRIPTIONS: {
        admin: 'Full access including user management',
        editor: 'Create & edit surveys, staff, assignments',
        viewer: 'View dashboards, data entry on existing surveys'
    },

    canManageUsers(role) { return role === 'admin'; },
    canCreateStaff(role) { return role === 'admin' || role === 'editor'; },
    canDeleteStaff(role) { return role === 'admin' || role === 'editor'; },
    canCreateSurvey(role) { return role === 'admin' || role === 'editor'; },
    canDeleteSurvey(role) { return role === 'admin' || role === 'editor'; },
    canEditSurvey(role) { return role === 'admin' || role === 'editor' || role === 'viewer'; },
    canChangeAssignments(role) { return role === 'admin' || role === 'editor'; },
    canEditSettings(role) { return role === 'admin' || role === 'editor'; },
    canExportImportData(role) { return role === 'admin' || role === 'editor'; },
    canClearData(role) { return role === 'admin'; },
    canManageOrgs() { return UserManager._isSuperAdmin; },
};

// ===== Session Timeout =====
const SessionTimer = {
    TIMEOUT_MS: 30 * 60 * 1000,    // 30 minutes
    WARNING_MS: 25 * 60 * 1000,    // warning at 25 min
    _idleTimer: null,
    _warningTimer: null,
    _countdownInterval: null,
    _active: false,

    start() {
        if (this._active) return;
        this._active = true;
        const events = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
        this._resetHandler = () => this.reset();
        events.forEach(e => document.addEventListener(e, this._resetHandler, { passive: true }));
        this._scheduleTimers();
        Logger.info('auth', 'Session timer started', { timeoutMin: 30 });
    },

    stop() {
        this._active = false;
        clearTimeout(this._idleTimer);
        clearTimeout(this._warningTimer);
        clearInterval(this._countdownInterval);
        const events = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
        if (this._resetHandler) events.forEach(e => document.removeEventListener(e, this._resetHandler));
        document.getElementById('session-timeout-overlay').style.display = 'none';
    },

    reset() {
        if (!this._active) return;
        clearTimeout(this._idleTimer);
        clearTimeout(this._warningTimer);
        clearInterval(this._countdownInterval);
        document.getElementById('session-timeout-overlay').style.display = 'none';
        this._scheduleTimers();
    },

    _scheduleTimers() {
        this._warningTimer = setTimeout(() => this._showWarning(), this.WARNING_MS);
        this._idleTimer = setTimeout(() => this._expire(), this.TIMEOUT_MS);
    },

    _showWarning() {
        Logger.warn('auth', 'Session timeout warning shown');
        const overlay = document.getElementById('session-timeout-overlay');
        overlay.style.display = '';
        let remaining = Math.round((this.TIMEOUT_MS - this.WARNING_MS) / 1000);
        const countdown = document.getElementById('timeout-countdown');
        countdown.textContent = this._formatTime(remaining);
        this._countdownInterval = setInterval(() => {
            remaining--;
            countdown.textContent = this._formatTime(remaining);
            if (remaining <= 0) clearInterval(this._countdownInterval);
        }, 1000);
    },

    _expire() {
        Logger.warn('auth', 'Session expired due to inactivity');
        this.stop();
        auth.signOut();
        location.reload();
    },

    _formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
};

// ===== Auth UI Logic =====
const Auth = {
    currentUser: null,
    _isSignUpMode: false,
    _currentOrgId: null,
    _currentRole: 'viewer',

    init() {
        const loginGate = document.getElementById('login-gate');
        const signinBtn = document.getElementById('btn-google-signin');
        const emailSigninBtn = document.getElementById('btn-email-signin');
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const loginError = document.getElementById('login-error');
        const signupToggle = document.getElementById('btn-toggle-signup');
        const forgotBtn = document.getElementById('btn-forgot-password');
        const deniedDiv = document.getElementById('login-denied');
        const signoutDenied = document.getElementById('btn-signout-denied');
        const signoutBtn = document.getElementById('btn-signout');

        // Toggle sign-in / sign-up mode
        signupToggle.addEventListener('click', (e) => {
            e.preventDefault();
            this._isSignUpMode = !this._isSignUpMode;
            emailSigninBtn.textContent = this._isSignUpMode ? 'Create Account' : 'Sign In';
            signupToggle.textContent = this._isSignUpMode ? 'Back to Sign In' : 'Create account';
            loginError.style.display = 'none';
        });

        // Email/Password Sign-In or Sign-Up
        emailSigninBtn.addEventListener('click', async () => {
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            loginError.style.display = 'none';

            if (!email || !password) { this._showError(loginError, 'Please enter email and password'); return; }
            if (password.length < 6) { this._showError(loginError, 'Password must be at least 6 characters'); return; }

            emailSigninBtn.disabled = true;
            emailSigninBtn.textContent = this._isSignUpMode ? 'Creating...' : 'Signing in...';

            try {
                if (this._isSignUpMode) {
                    await auth.createUserWithEmailAndPassword(email, password);
                } else {
                    await auth.signInWithEmailAndPassword(email, password);
                }
            } catch (err) {
                Logger.error('auth', this._isSignUpMode ? 'Account creation failed' : 'Email sign-in failed', { email, code: err.code }, err);
                this._showError(loginError, this._friendlyError(err.code));
                emailSigninBtn.disabled = false;
                emailSigninBtn.textContent = this._isSignUpMode ? 'Create Account' : 'Sign In';
            }
        });

        passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') emailSigninBtn.click(); });
        emailInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') passwordInput.focus(); });

        // Forgot Password
        forgotBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = emailInput.value.trim();
            if (!email) { this._showError(loginError, 'Enter your email above first'); return; }
            try {
                await auth.sendPasswordResetEmail(email);
                Logger.info('auth', 'Password reset email sent', { email });
                loginError.style.display = '';
                loginError.style.background = 'rgba(46, 204, 113, 0.1)';
                loginError.style.borderColor = 'rgba(46, 204, 113, 0.3)';
                loginError.style.color = '#2ecc71';
                loginError.textContent = '✓ Password reset email sent!';
            } catch (err) {
                Logger.error('auth', 'Password reset failed', { email, code: err.code }, err);
                this._showError(loginError, this._friendlyError(err.code));
            }
        });

        // Google Sign-In (redirect flow — avoids COOP popup blocking)
        signinBtn.addEventListener('click', () => {
            signinBtn.disabled = true;
            signinBtn.textContent = 'Redirecting...';
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithRedirect(provider);
        });

        signoutDenied.addEventListener('click', async () => {
            await auth.signOut();
            deniedDiv.style.display = 'none';
            document.getElementById('email-auth-form').style.display = '';
            document.querySelector('.auth-divider').style.display = '';
            signinBtn.style.display = '';
        });

        signoutBtn.addEventListener('click', async () => {
            Logger.info('auth', 'User signed out');
            SessionTimer.stop();
            await auth.signOut();
            location.reload();
        });

        // Session timeout buttons
        const sessionExtendBtn = document.getElementById('btn-session-extend');
        const sessionSignoutBtn = document.getElementById('btn-session-signout');
        if (sessionExtendBtn) sessionExtendBtn.addEventListener('click', () => SessionTimer.reset());
        if (sessionSignoutBtn) sessionSignoutBtn.addEventListener('click', async () => {
            SessionTimer.stop();
            await auth.signOut();
            location.reload();
        });

        // Self-service onboarding
        const onboardBtn = document.getElementById('btn-onboard-create');
        const onboardInput = document.getElementById('onboard-org-name');
        if (onboardBtn) onboardBtn.addEventListener('click', () => this._selfServiceOnboard());
        if (onboardInput) onboardInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._selfServiceOnboard();
        });

        // Auth state observer
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                await this._handleSignIn(user, loginGate, signinBtn, deniedDiv);
            } else {
                this.currentUser = null;
                this._currentOrgId = null;
                loginGate.classList.remove('hidden');
                document.getElementById('email-auth-form').style.display = '';
                document.querySelector('.auth-divider').style.display = '';
                signinBtn.style.display = '';
                signinBtn.disabled = false;
                document.getElementById('login-denied').style.display = 'none';
                document.getElementById('sidebar-user').style.display = 'none';
            }
        });
    },

    async _handleSignIn(user, loginGate, signinBtn, deniedDiv) {
        try {
            const email = user.email.toLowerCase();
            Logger.setUser(email);
            Logger.info('auth', 'Sign-in detected', { email, provider: user.providerData?.[0]?.providerId });

            // Seed super admin if first user ever (non-fatal if fails)
            try {
                await UserManager.seedSuperAdmin(email);
                console.log('[auth] seedSuperAdmin OK');
            } catch (e) { console.warn('[auth] seedSuperAdmin failed:', e.message); }

            // Load user profile
            try {
                await UserManager.loadUser(email);
                console.log('[auth] loadUser OK, isSuperAdmin:', UserManager._isSuperAdmin);
            } catch (e) { console.warn('[auth] loadUser failed:', e.message); }

            try {
                await UserManager.ensureUserDoc(email);
                console.log('[auth] ensureUserDoc OK');
            } catch (e) { console.warn('[auth] ensureUserDoc failed:', e.message); }

            // Super admins always get in
            if (UserManager._isSuperAdmin) {
                Logger.info('auth', 'Super Admin access granted', { email });
                this.currentUser = user;
                loginGate.classList.add('hidden');
                this.showUserInfo(user);
                await this._initApp();
                return;
            }

            // Regular users need to belong to at least one org
            const userOrgs = UserManager.getUserOrgs();
            if (userOrgs.length > 0) {
                Logger.info('auth', 'User access granted', { email, orgCount: userOrgs.length });
                this.currentUser = user;
                loginGate.classList.add('hidden');
                this.showUserInfo(user);
                await this._initApp();
            } else {
                // Not assigned to any org — show onboarding
                Logger.warn('auth', 'Access denied — user has no org assignments', { email });
                this.currentUser = user;
                document.getElementById('email-auth-form').style.display = 'none';
                document.querySelector('.auth-divider').style.display = 'none';
                signinBtn.style.display = 'none';
                deniedDiv.style.display = '';
                loginGate.classList.remove('hidden');
            }
        } catch (err) {
            Logger.error('auth', 'Sign-in handling failed', null, err);
            console.error('Sign-in handling failed:', err);
            // Reset button states so user can try again
            signinBtn.disabled = false;
            signinBtn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Sign in with Google`;
            document.getElementById('login-error').style.display = '';
            document.getElementById('login-error').textContent = 'Sign-in failed. Please try again.';
        }
    },

    async _initApp() {
        if (window._appInitialized) return;
        window._appInitialized = true;

        // Determine which org to load
        const userOrgs = UserManager.getUserOrgs();
        const allOrgs = await FirestoreStore.listOrgs();

        // Super admin can see all orgs
        const availableOrgs = UserManager._isSuperAdmin
            ? allOrgs
            : allOrgs.filter(o => userOrgs.some(uo => uo.orgId === o.id));

        if (availableOrgs.length === 0 && UserManager._isSuperAdmin) {
            // First time — create default org
            const orgId = await FirestoreStore.createOrg('IQMH', this.currentUser.email);
            await UserManager.setRoleForOrg(this.currentUser.email, orgId, 'admin');
            await UserManager.loadUser(this.currentUser.email); // refresh
            this._currentOrgId = orgId;
        } else if (availableOrgs.length > 0) {
            // Use last-used org or first available
            const lastOrg = localStorage.getItem('pt-lastOrg');
            const match = availableOrgs.find(o => o.id === lastOrg);
            this._currentOrgId = match ? match.id : availableOrgs[0].id;
        }

        // Set role for current org
        this._currentRole = UserManager.getRoleForOrg(this._currentOrgId);
        Logger.setOrg(this._currentOrgId);
        Logger.info('auth', 'App initialized', { orgId: this._currentOrgId, role: this._currentRole });

        // Load org data with real-time updates
        await FirestoreStore.loadOrg(this._currentOrgId, (changeType) => {
            // Real-time callback — re-render affected panels
            if (typeof refreshCurrentPanel === 'function') {
                refreshCurrentPanel();
            }
        });

        // Save last-used org
        localStorage.setItem('pt-lastOrg', this._currentOrgId);

        // Init UI
        Modal.init();
        initNavigation();
        initWhatIf();
        initSettings();
        applyRoleRestrictions();
        renderOrgPicker();
        document.getElementById('btn-add-staff').onclick = () => openStaffModal(null);
        document.getElementById('btn-add-survey').onclick = () => openSurveyModal(null);
        renderDashboard();
        SessionTimer.start();
    },

    async switchOrg(orgId) {
        Logger.info('auth', 'Switching org', { from: this._currentOrgId, to: orgId });
        this._currentOrgId = orgId;
        this._currentRole = UserManager.getRoleForOrg(orgId);
        Logger.setOrg(orgId);
        localStorage.setItem('pt-lastOrg', orgId);

        await FirestoreStore.loadOrg(orgId, (changeType) => {
            if (typeof refreshCurrentPanel === 'function') {
                refreshCurrentPanel();
            }
        });

        applyRoleRestrictions();
        renderOrgPicker();
        this.showUserInfo(this.currentUser);
        renderDashboard();
        showToast(`Switched to ${(await FirestoreStore.listOrgs()).find(o => o.id === orgId)?.name || orgId}`, 'info');
    },

    showUserInfo(user) {
        document.getElementById('sidebar-user').style.display = '';
        document.getElementById('user-avatar').src = user.photoURL || '';
        const roleLabel = UserManager._isSuperAdmin ? 'Super Admin' : Roles.LABELS[this._currentRole] || 'Viewer';
        const roleClass = UserManager._isSuperAdmin ? 'role-superadmin' : `role-${this._currentRole}`;
        const roleBadge = `<span class="role-badge ${roleClass}">${roleLabel}</span>`;
        document.getElementById('user-name').innerHTML = (user.displayName || user.email) + ' ' + roleBadge;
    },

    _showError(el, msg) {
        el.style.display = '';
        el.style.background = '';
        el.style.borderColor = '';
        el.style.color = '';
        el.textContent = msg;
    },

    _friendlyError(code) {
        const messages = {
            'auth/user-not-found': 'No account found with this email',
            'auth/wrong-password': 'Incorrect password',
            'auth/invalid-credential': 'Invalid email or password',
            'auth/email-already-in-use': 'An account with this email already exists',
            'auth/weak-password': 'Password must be at least 6 characters',
            'auth/invalid-email': 'Invalid email address',
            'auth/too-many-requests': 'Too many attempts. Try again later.',
            'auth/network-request-failed': 'Network error. Check your connection.',
        };
        return messages[code] || 'Authentication error. Please try again.';
    },

    async _selfServiceOnboard() {
        const nameInput = document.getElementById('onboard-org-name');
        const name = nameInput.value.trim();
        if (!name) {
            nameInput.style.borderColor = 'var(--color-danger)';
            nameInput.focus();
            return;
        }
        const btn = document.getElementById('btn-onboard-create');
        btn.disabled = true;
        btn.textContent = 'Creating...';
        try {
            const email = this.currentUser.email.toLowerCase();
            const orgId = await FirestoreStore.createOrg(name, email);
            await UserManager.setRoleForOrg(email, orgId, 'admin');
            await UserManager.loadUser(email);
            Logger.info('auth', 'Self-service org created', { orgId, name, email });
            document.getElementById('login-denied').style.display = 'none';
            document.getElementById('login-gate').classList.add('hidden');
            this.showUserInfo(this.currentUser);
            this._currentOrgId = orgId;
            this._currentRole = 'admin';
            await this._initApp();
        } catch (err) {
            Logger.error('auth', 'Self-service onboarding failed', null, err);
            btn.disabled = false;
            btn.textContent = '🏢 Create';
            alert('Failed to create organization: ' + err.message);
        }
    }
};
