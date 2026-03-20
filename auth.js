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
};

// ===== Firestore-backed Allowlist =====
const AllowList = {
    _cache: null,
    _isAdmin: false,
    _currentRole: 'viewer',

    async load() {
        try {
            const snap = await db.collection('allowedUsers').get();
            this._cache = [];
            snap.forEach(doc => {
                this._cache.push({ id: doc.id, ...doc.data() });
            });
        } catch (err) {
            console.warn('Could not load allowlist from Firestore:', err);
            this._cache = [];
        }
        return this._cache;
    },

    isAllowed(email) {
        if (!email || !this._cache) return false;
        const lower = email.toLowerCase();
        return this._cache.some(u => u.email.toLowerCase() === lower);
    },

    getRole(email) {
        if (!email || !this._cache) return 'viewer';
        const lower = email.toLowerCase();
        const user = this._cache.find(u => u.email.toLowerCase() === lower);
        return user ? (user.role || 'viewer') : 'viewer';
    },

    isAdmin(email) { return this.getRole(email) === 'admin'; },

    async addUser(email, role = 'viewer') {
        const lower = email.toLowerCase().trim();
        if (!lower) throw new Error('Email is required');
        const existing = this._cache.find(u => u.email.toLowerCase() === lower);
        if (existing) throw new Error('User already exists');
        const docRef = await db.collection('allowedUsers').add({ email: lower, role, addedAt: new Date().toISOString() });
        this._cache.push({ id: docRef.id, email: lower, role, addedAt: new Date().toISOString() });
    },

    async updateUserRole(docId, newRole) {
        await db.collection('allowedUsers').doc(docId).update({ role: newRole });
        const user = this._cache.find(u => u.id === docId);
        if (user) user.role = newRole;
    },

    async removeUser(docId) {
        await db.collection('allowedUsers').doc(docId).delete();
        this._cache = this._cache.filter(u => u.id !== docId);
    },

    async seedAdmin(email) {
        if (this._cache && this._cache.length === 0) {
            await this.addUser(email, 'admin');
            console.log('Seeded admin:', email);
        }
    }
};

// ===== Auth UI Logic =====
const Auth = {
    currentUser: null,
    _isSignUpMode: false,

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

            if (!email || !password) {
                this._showError(loginError, 'Please enter email and password');
                return;
            }
            if (password.length < 6) {
                this._showError(loginError, 'Password must be at least 6 characters');
                return;
            }

            emailSigninBtn.disabled = true;
            emailSigninBtn.textContent = this._isSignUpMode ? 'Creating...' : 'Signing in...';

            try {
                if (this._isSignUpMode) {
                    await auth.createUserWithEmailAndPassword(email, password);
                } else {
                    await auth.signInWithEmailAndPassword(email, password);
                }
                // onAuthStateChanged will handle the rest
            } catch (err) {
                const msg = this._friendlyError(err.code);
                this._showError(loginError, msg);
                emailSigninBtn.disabled = false;
                emailSigninBtn.textContent = this._isSignUpMode ? 'Create Account' : 'Sign In';
            }
        });

        // Enter key submits the form
        passwordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') emailSigninBtn.click();
        });
        emailInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') passwordInput.focus();
        });

        // Forgot Password
        forgotBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = emailInput.value.trim();
            if (!email) {
                this._showError(loginError, 'Enter your email above first');
                return;
            }
            try {
                await auth.sendPasswordResetEmail(email);
                loginError.style.display = '';
                loginError.style.background = 'rgba(46, 204, 113, 0.1)';
                loginError.style.borderColor = 'rgba(46, 204, 113, 0.3)';
                loginError.style.color = '#2ecc71';
                loginError.textContent = '✓ Password reset email sent!';
            } catch (err) {
                this._showError(loginError, this._friendlyError(err.code));
            }
        });

        // Google Sign-In
        signinBtn.addEventListener('click', async () => {
            signinBtn.disabled = true;
            signinBtn.textContent = 'Signing in...';
            try {
                const provider = new firebase.auth.GoogleAuthProvider();
                await auth.signInWithPopup(provider);
            } catch (err) {
                console.error('Sign-in error:', err);
                signinBtn.disabled = false;
                signinBtn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Sign in with Google`;
            }
        });

        // Sign out from denied screen
        signoutDenied.addEventListener('click', async () => {
            await auth.signOut();
            deniedDiv.style.display = 'none';
            document.getElementById('email-auth-form').style.display = '';
            document.querySelector('.auth-divider').style.display = '';
            signinBtn.style.display = '';
        });

        // Sign out from sidebar
        signoutBtn.addEventListener('click', async () => {
            await auth.signOut();
            location.reload();
        });

        // Auth state observer
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                await AllowList.load();

                if (AllowList._cache.length === 0) {
                    await AllowList.seedAdmin(user.email);
                }

                if (AllowList.isAllowed(user.email)) {
                    this.currentUser = user;
                    AllowList._currentRole = AllowList.getRole(user.email);
                    AllowList._isAdmin = AllowList._currentRole === 'admin';
                    loginGate.classList.add('hidden');
                    this.showUserInfo(user);

                    if (!window._appInitialized) {
                        window._appInitialized = true;
                        Store.load();
                        Modal.init();
                        initNavigation();
                        initWhatIf();
                        initSettings();
                        applyRoleRestrictions();
                        document.getElementById('btn-add-staff').onclick = () => openStaffModal(null);
                        document.getElementById('btn-add-survey').onclick = () => openSurveyModal(null);
                        renderDashboard();
                    }
                } else {
                    // Not on allowlist
                    document.getElementById('email-auth-form').style.display = 'none';
                    document.querySelector('.auth-divider').style.display = 'none';
                    signinBtn.style.display = 'none';
                    deniedDiv.style.display = '';
                    loginGate.classList.remove('hidden');
                }
            } else {
                this.currentUser = null;
                loginGate.classList.remove('hidden');
                document.getElementById('email-auth-form').style.display = '';
                document.querySelector('.auth-divider').style.display = '';
                signinBtn.style.display = '';
                signinBtn.disabled = false;
                deniedDiv.style.display = 'none';
                document.getElementById('sidebar-user').style.display = 'none';
            }
        });
    },

    showUserInfo(user) {
        document.getElementById('sidebar-user').style.display = '';
        document.getElementById('user-avatar').src = user.photoURL || '';
        const roleBadge = `<span class="role-badge role-${AllowList._currentRole}">${Roles.LABELS[AllowList._currentRole]}</span>`;
        const authMethod = user.providerData[0]?.providerId === 'password' ? '📧' : '';
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
    }
};
