// ===== Centralized Logging & Observability =====
// Loaded FIRST — before all other scripts — so global error handlers are active immediately.

const Logger = (() => {
    // ===== Configuration =====
    const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    const LEVEL_NAMES = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    const LEVEL_ICONS = ['🔍', 'ℹ️', '⚠️', '🔴'];
    const LEVEL_COLORS = ['#8b92a8', '#3498db', '#f39c12', '#e74c3c'];

    let _minLevel = LEVELS.INFO;
    const BUFFER_SIZE = 200;
    const _buffer = [];

    // Context — set by auth/app once user is known
    let _userEmail = null;
    let _orgId = null;

    // Performance timers
    const _timers = {};

    // ===== Core Logging =====

    function _log(level, category, message, data, error) {
        const entry = {
            timestamp: new Date().toISOString(),
            level: LEVEL_NAMES[level],
            category,
            message,
            data: data || null,
            error: error ? { message: error.message, stack: error.stack, code: error.code } : null,
            user: _userEmail,
            orgId: _orgId
        };

        // Ring buffer — drop oldest when full
        _buffer.push(entry);
        if (_buffer.length > BUFFER_SIZE) _buffer.shift();

        // Console output (if above minimum level)
        if (level >= _minLevel) {
            const icon = LEVEL_ICONS[level];
            const color = LEVEL_COLORS[level];
            const prefix = `${icon} [${LEVEL_NAMES[level]}][${category}]`;

            if (level >= LEVELS.ERROR) {
                console.error(`%c${prefix}`, `color:${color};font-weight:bold`, message, data || '', error || '');
            } else if (level >= LEVELS.WARN) {
                console.warn(`%c${prefix}`, `color:${color};font-weight:bold`, message, data || '');
            } else {
                console.log(`%c${prefix}`, `color:${color}`, message, data || '');
            }
        }

        return entry;
    }

    // ===== Public API =====

    return {
        // Log at specific levels
        debug(category, message, data) { return _log(LEVELS.DEBUG, category, message, data); },
        info(category, message, data) { return _log(LEVELS.INFO, category, message, data); },
        warn(category, message, data) { return _log(LEVELS.WARN, category, message, data); },
        error(category, message, data, error) {
            // Allow (category, message, error) shorthand when no data
            if (data instanceof Error && !error) {
                error = data;
                data = null;
            }
            return _log(LEVELS.ERROR, category, message, data, error);
        },

        // Set context (called by auth layer after sign-in)
        setUser(email) { _userEmail = email; },
        setOrg(orgId) { _orgId = orgId; },

        // Set minimum log level
        setLevel(levelName) {
            const l = LEVELS[levelName.toUpperCase()];
            if (l !== undefined) _minLevel = l;
        },

        // Performance timing
        time(label) { _timers[label] = performance.now(); },
        timeEnd(label) {
            if (_timers[label]) {
                const duration = Math.round(performance.now() - _timers[label]);
                _log(LEVELS.INFO, 'perf', `${label} completed`, { durationMs: duration });
                delete _timers[label];
                return duration;
            }
        },

        // Retrieve recent logs (for dev console inspection)
        getRecentLogs(count) { return _buffer.slice(-(count || BUFFER_SIZE)); },

        // Export all buffered logs as JSON (for pasting into a bug report)
        exportLogs() { return JSON.stringify(_buffer, null, 2); },
    };
})();

// ===== Global Error Handlers =====
// Catches uncaught synchronous errors
window.onerror = function (message, source, lineno, colno, error) {
    Logger.error('global', 'Uncaught error', { source, lineno, colno }, error || new Error(message));
};

// Catches unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    Logger.error('global', 'Unhandled promise rejection', null, error);
});

Logger.info('init', 'Logger initialized');
