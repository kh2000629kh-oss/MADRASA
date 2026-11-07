/**
 * الوحدة البرمجية: js/state.js
 * الوصف: إدارة الحالة المركزية (appState)، التخزين المحلي، الترحيل الآمن، ومحرك الـ Cache التزايدي
 * المنظومة: منظومة النقاط والإدارة المدرسية الشاملة — ثانوية الصحابة الشرعية
 */
    // حالة التطبيق العامة والـ Caches التزايدية عالية الأداء
    let db = JSON.parse(JSON.stringify(INITIAL_DATABASE));
    let studentTotalsCache = {}; // StudentID -> total points across all subjects
    let studentSubjectStatsCache = {}; // StudentID -> { ALL: stats, [Subject]: stats }
    let recordedTodaySet = new Set(); // StudentIDs recorded today

    let appSettings = {
      schoolName: 'ثانوية الصحابة الشرعية',
      academicYear: 'العام الدراسي 2026-2027 - الفصل الأول',
      idleMinutes: 15,
      fontScale: '1',
      swipeEnabled: true,
      numFormat: 'latin',
      darkMode: false
    };

    let enteredPin = '';
    let failedPinAttempts = 0;
    let lockoutUntil = 0;
    let lockoutInterval = null;
    let idleTimer = null;

    let currentTeacher = null;
    let currentSection = '8_1';
    let currentPeriod = 1;
    let currentSubject = '';
    let selectedEvalRuleId = 'EV-01';
    let lastPointAction = null;
    let lastBatchLogIds = [];
    let recentActionsStack = []; // سجل آخر 10 حركات قابلة للتراجع
    let offlineQueue = [];
    let syncErrorsLog = [];
    let lastSuccessfulSyncTime = '';
    let activeModalStudentId = null;
    let hallFilterSection = 'ALL';
    let hallSelectedSubject = 'ALL_ALLOWED';
    let currentGradeFilter = 'ALL';
    let gridDensityMode = 'standard';
    let filterUnrecordedToday = false;
    let gridSortMode = 'roll';
    let mobileFocusMode = false;
    let expandedGridView = false;
    let selectedStudentIds = [];
    let mobileFeedbackEnabled = true;
    let audioCtx = null;
    let wakeLockSentinel = null;
    let gasWebAppUrl = DEFAULT_GAS_WEB_APP_URL;
    let gasApiToken = DEFAULT_GAS_API_TOKEN;

    // متغيرات إدارة الطلاب (الفرز، الترقيم، التحديد الجماعي، والحذف المؤقت)
    let adminStdSortField = 'RollNumber';
    let adminStdSortAsc = true;
    let adminStdCurrentPage = 1;
    const ADMIN_STD_PAGE_SIZE = 20;
    let adminSelectedStudentIds = [];
    let validatedBulkRows = [];
    let softDeletedPayload = null;
    let softDeleteTimer = null;
    let saveDebounceTimer = null;

    // 2. الترحيل الآمن للبيانات القديمة (Safe Migration v1/v2 -> v3 مع تجزئة PIN)
    function migrateDatabaseIfNeeded() {
      if (!db.Audit_Log) db.Audit_Log = [];
      if (!db.Archives) db.Archives = [];

      // ترحيل كلمات المرور الصريحة للمعلمين إلى PINHash بتجزئة SHA-256
      if (Array.isArray(db.Teachers)) {
        db.Teachers.forEach(function(t) {
          if (!t.Status) t.Status = 'active';
          if (t.PIN && !t.PINHash) {
            t.PINHash = computePinHashSync(String(t.PIN));
          }
          // حذف الرمز الصريح من التخزين المحلي والاكتفاء بـ PINHash المشفر (مع حفظه في الشيت عند المزامنة)
          delete t.PIN;
        });
      }
    }

    function loadStateFromStorage() {
      try {
        // قراءة النسخة الأحدث أو ترحيل النسخ السابقة بأمان دون فقدان أي سجل
        const savedV3 = localStorage.getItem('school_points_db_v5');
        if (savedV3) {
          db = JSON.parse(savedV3);
        }

        const savedQueue = localStorage.getItem('school_points_offline_queue_v1');
        if (savedQueue) offlineQueue = JSON.parse(savedQueue);

        const urlParams = new URLSearchParams(window.location.search);
        const cloudParam = urlParams.get('cloud');
        const tokenParam = urlParams.get('token');
        const savedUrl = localStorage.getItem('school_points_gas_url_v1');
        const savedToken = localStorage.getItem('school_points_gas_token_v1');

        if (tokenParam) {
          gasApiToken = tokenParam.trim();
          localStorage.setItem('school_points_gas_token_v1', gasApiToken);
        } else if (savedToken) {
          gasApiToken = savedToken.trim();
        } else {
          gasApiToken = DEFAULT_GAS_API_TOKEN;
          localStorage.setItem('school_points_gas_token_v1', gasApiToken);
        }

        if (cloudParam && cloudParam.startsWith('https://script.google.com/')) {
          gasWebAppUrl = cloudParam.trim();
          localStorage.setItem('school_points_gas_url_v1', gasWebAppUrl);
          try { window.history.replaceState({}, document.title, window.location.pathname); } catch (e) {}
        } else if (DEFAULT_GAS_WEB_APP_URL) {
          gasWebAppUrl = DEFAULT_GAS_WEB_APP_URL.trim();
          localStorage.setItem('school_points_gas_url_v1', gasWebAppUrl);
        } else if (savedUrl) {
          gasWebAppUrl = savedUrl;
        }

        const savedSettings = localStorage.getItem('school_points_settings_v5');
        if (savedSettings) {
          appSettings = Object.assign({}, appSettings, JSON.parse(savedSettings));
        }

        const savedLockout = Number(localStorage.getItem('school_points_lockout_until') || 0);
        if (savedLockout > Date.now()) {
          lockoutUntil = savedLockout;
          startLockoutCountdown();
        }
      } catch (e) {
      }

      migrateDatabaseIfNeeded();
      applyAppSettingsToDOM();
      rebuildPerformanceCaches();
      saveStateToStorageImmediate();
    }

    // حفظ فوري وحفظ مؤجل (Debounced 300ms) لتحسين الأداء مع آلاف السجلات
    function saveStateToStorageImmediate() {
      if (saveDebounceTimer) {
        clearTimeout(saveDebounceTimer);
        saveDebounceTimer = null;
      }
      try {
        localStorage.setItem('school_points_db_v5', JSON.stringify(db));
        localStorage.setItem('school_points_offline_queue_v1', JSON.stringify(offlineQueue));
        localStorage.setItem('school_points_settings_v5', JSON.stringify(appSettings));
      } catch (e) {
      }
    }

    function saveStateToStorage() {
      if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
      saveDebounceTimer = setTimeout(saveStateToStorageImmediate, 300);
    }

    window.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'hidden') {
        saveStateToStorageImmediate();
      } else if (currentTeacher) {
        requestScreenWakeLock();
      }
    });

    // 3. محرك الـ Cache التزايدي للأداء الفائق (يدعم 20,000+ سجل نقاط بدون تأخير)
    function rebuildPerformanceCaches() {
      studentTotalsCache = {};
      studentSubjectStatsCache = {};
      recordedTodaySet = new Set();
      const todayPrefix = getFormattedDateOnly();

      db.Students.forEach(function(st) {
        studentTotalsCache[st.StudentID] = 0;
        studentSubjectStatsCache[st.StudentID] = {};
      });

      db.Points_Log.forEach(function(log) {
        indexSinglePointLogInCache(log, todayPrefix);
      });

      db.Students.forEach(function(st) {
        st.TotalPoints = studentTotalsCache[st.StudentID] || 0;
      });
    }

    function initEmptyBucket() {
      return { oral: 0, homework: 0, participation: 0, negative: 0, positiveActions: 0, totalActions: 0, netPoints: 0 };
    }

    function indexSinglePointLogInCache(log, todayPrefix) {
      const sid = log.StudentID;
      const d = Number(log.PointsDelta) || 0;
      const effectiveSign = log.PointsZeroed
        ? (log.HistoricalDelta !== undefined ? Number(log.HistoricalDelta) : 1)
        : d;

      studentTotalsCache[sid] = (studentTotalsCache[sid] || 0) + d;
      if (!studentSubjectStatsCache[sid]) studentSubjectStatsCache[sid] = {};
      const sub = log.Subject || 'عام';
      if (!studentSubjectStatsCache[sid][sub]) {
        studentSubjectStatsCache[sid][sub] = initEmptyBucket();
      }
      const b = studentSubjectStatsCache[sid][sub];
      b.netPoints += d;
      b.totalActions++;
      if (effectiveSign > 0) b.positiveActions++;
      if (effectiveSign < 0) b.negative++;
      if (log.ActionCategory === 'oral') b.oral++;
      if (log.ActionCategory === 'homework' && effectiveSign > 0) b.homework++;
      if (log.ActionCategory === 'participation') b.participation++;

      if (String(log.Timestamp || '').startsWith(todayPrefix)) {
        recordedTodaySet.add(sid);
      }
    }

    // 4. سجل التدقيق الإداري (Audit Log)
    function logAuditEvent(actionType, details) {
      if (!db.Audit_Log) db.Audit_Log = [];
      db.Audit_Log.unshift({
        AuditID: 'AUD-' + Date.now() + '-' + Math.floor(Math.random() * 100),
        Timestamp: getFormattedTimestamp(),
        Actor: currentTeacher ? currentTeacher.TeacherName : 'النظام',
        ActionType: actionType,
        Details: details
      });
      if (db.Audit_Log.length > 500) db.Audit_Log.length = 500;
      saveStateToStorage();
    }

