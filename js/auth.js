/**
 * الوحدة البرمجية: js/auth.js
 * الوصف: إدارة الصلاحيات، شاشة الدخول بـ PIN، القفل المؤقت، ومدير النوافذ المنبثقة والإشعارات
 * المنظومة: منظومة النقاط والإدارة المدرسية الشاملة — ثانوية الصحابة الشرعية
 */
    // 5. الصلاحيات المحددة للمعلم
    function getTeacherAllowedSections(teacherObj) {
      const t = teacherObj || currentTeacher;
      if (!t) return [];
      if (t.Role === 'admin' || t.Role === 'supervisor') {
        const assigned = String(t.AssignedSections || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
        return assigned.length > 0 ? assigned : getAllUniqueSections();
      }
      return String(t.AssignedSections || '')
        .split(',')
        .map(function(s) { return s.trim(); })
        .filter(Boolean);
    }

    function getTeacherAllowedGrades(teacherObj) {
      const secs = getTeacherAllowedSections(teacherObj);
      const grades = [];
      secs.forEach(function(sec) {
        const g = getGradeFromSection(sec);
        if (grades.indexOf(g) === -1) grades.push(g);
      });
      return grades;
    }

    function getTeacherAllowedSubjects(teacherObj) {
      const t = teacherObj || currentTeacher;
      if (!t) return [];
      return String(t.Subjects || '')
        .split(',')
        .map(function(s) { return s.trim(); })
        .filter(Boolean);
    }

    // 6. المؤثرات اللمسية والصوتية وWake Lock
    function triggerMobileFeedback(kind) {
      if (!mobileFeedbackEnabled) return;
      try {
        if (navigator.vibrate) {
          if (kind === 'positive') navigator.vibrate(22);
          else if (kind === 'negative') navigator.vibrate([35, 25, 35]);
          else if (kind === 'longpress') navigator.vibrate(45);
          else navigator.vibrate(15);
        }
      } catch (e) {}

      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        if (!audioCtx) audioCtx = new AudioContextClass();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;
        if (kind === 'positive') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.09);
          gain.gain.setValueAtTime(0.07, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
          osc.start(now);
          osc.stop(now + 0.11);
        } else if (kind === 'negative') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(310, now);
          osc.frequency.exponentialRampToValueAtTime(190, now + 0.14);
          gain.gain.setValueAtTime(0.09, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
          osc.start(now);
          osc.stop(now + 0.15);
        } else {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, now);
          gain.gain.setValueAtTime(0.04, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
          osc.start(now);
          osc.stop(now + 0.06);
        }
      } catch (e) {}
    }

    async function requestScreenWakeLock() {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          wakeLockSentinel = await navigator.wakeLock.request('screen');
        }
      } catch (e) {}
    }

    function toggleMobileFeedback() {
      mobileFeedbackEnabled = !mobileFeedbackEnabled;
      const btn = document.getElementById('feedbackToggleBtn');
      if (btn) {
        btn.textContent = mobileFeedbackEnabled ? '🔊 اهتزاز وصوت' : '🔇 صامت';
      }
      if (mobileFeedbackEnabled) triggerMobileFeedback('tap');
      showToast(mobileFeedbackEnabled ? '🔊 تم تفعيل الاهتزاز والصوت التفاعلي' : '🔇 تم كتم الصوت والاهتزاز', 'info');
    }

    function toggleHeaderOverflowMenu() {
      const m = document.getElementById('headerOverflowMenu');
      if (m) m.classList.toggle('hidden');
    }

    function toggleGridMoreMenu() {
      const m = document.getElementById('gridMoreMenu');
      if (m) m.classList.toggle('hidden');
    }

    // 6.5 مدير النوافذ المنبثقة المركزي (Body Scroll Lock + History API Back Button + Focus Trap + Escape)
    let openModalStack = [];
    let isHandlingPopState = false;

    function syncBodyScrollLock() {
      if (openModalStack.length > 0) {
        document.body.classList.add('modal-scroll-locked');
      } else {
        document.body.classList.remove('modal-scroll-locked');
      }
    }

    function openModalDialog(modalId) {
      const m = document.getElementById(modalId);
      if (!m) return;
      m.classList.remove('hidden');
      m.classList.add('flex');
      if (openModalStack.indexOf(modalId) === -1) {
        openModalStack.push(modalId);
        try {
          window.history.pushState({ sahabaModal: modalId }, '');
        } catch (e) {}
      }
      syncBodyScrollLock();
    }

    function closeModalDialog(modalId) {
      const m = document.getElementById(modalId);
      if (m) {
        m.classList.add('hidden');
        m.classList.remove('flex');
      }
      const idx = openModalStack.indexOf(modalId);
      if (idx !== -1) {
        openModalStack.splice(idx, 1);
        if (!isHandlingPopState) {
          try {
            if (window.history.state && window.history.state.sahabaModal) {
              window.history.back();
            }
          } catch (e) {}
        }
      }
      syncBodyScrollLock();
    }

    window.addEventListener('popstate', function() {
      if (openModalStack.length > 0) {
        isHandlingPopState = true;
        const topModalId = openModalStack[openModalStack.length - 1];
        if (topModalId === 'studentModal') closeStudentModal();
        else if (topModalId === 'contextSwitcherSheet') closeContextSwitcherSheet();
        else if (topModalId === 'recentActionsModal') closeRecentActionsModal();
        else if (topModalId === 'unifiedSettingsModal') closeUnifiedSettingsModal();
        else if (topModalId === 'oneTimePinModal') closeOneTimePinModal();
        else if (topModalId === 'resetConfirmModal') closeResetPointsModal();
        else if (topModalId === 'iosInstallModal') closeIosInstallModal();
        else closeModalDialog(topModalId);
        isHandlingPopState = false;
      }
    });

    // إغلاق القوائم والنوافذ المنبثقة عند ضغط Escape وحصر التركيز (Focus Trap) داخل النافذة المفتوحة
    document.addEventListener('keydown', function(ev) {
      if (ev.key === 'Escape') {
        closeStudentModal();
        closeContextSwitcherSheet();
        closeRecentActionsModal();
        closeUnifiedSettingsModal();
        closeOneTimePinModal();
        closeResetPointsModal();
        closeIosInstallModal();
        const hm = document.getElementById('headerOverflowMenu');
        if (hm) hm.classList.add('hidden');
        const gm = document.getElementById('gridMoreMenu');
        if (gm) gm.classList.add('hidden');
        return;
      }
      if (ev.key === 'Tab' && openModalStack.length > 0) {
        const activeModal = document.getElementById(openModalStack[openModalStack.length - 1]);
        if (!activeModal) return;
        const focusables = activeModal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;
        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];
        if (ev.shiftKey && document.activeElement === firstEl) {
          ev.preventDefault();
          lastEl.focus();
        } else if (!ev.shiftKey && document.activeElement === lastEl) {
          ev.preventDefault();
          firstEl.focus();
        }
      }
    });

    // 7. نظام التنبيهات الفورية (Toast مع دعم زر "تراجع" لمدة 5 ثوانٍ)
    function showToast(message, type, withUndoCallback) {
      const container = document.getElementById('toastContainer');
      if (!container) return;
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      const toast = document.createElement('div');
      let colors = 'bg-slate-900 text-white border-slate-700';
      if (type === 'success') colors = 'bg-emerald-700 text-white border-emerald-400';
      if (type === 'danger') colors = 'bg-rose-700 text-white border-rose-400';
      if (type === 'warning') colors = 'bg-amber-500 text-slate-950 border-amber-300';

      toast.className = colors + ' border px-4 py-2.5 rounded-2xl shadow-xl text-xs font-extrabold flex items-center justify-between gap-3 transition-all duration-300 pointer-events-auto';
      const msgSpan = document.createElement('span');
      msgSpan.textContent = message;
      toast.appendChild(msgSpan);

      if (typeof withUndoCallback === 'function') {
        const undoBtn = document.createElement('button');
        undoBtn.type = 'button';
        undoBtn.className = 'bg-black/25 hover:bg-black/40 text-white font-black px-2.5 py-1 rounded-xl shrink-0';
        undoBtn.textContent = '↩️ تراجع';
        undoBtn.onclick = function() {
          withUndoCallback();
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        };
        toast.appendChild(undoBtn);
      }

      container.appendChild(toast);
      const duration = withUndoCallback ? 4000 : 1800;
      setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(function() {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 260);
      }, duration);
    }

    // 8. شاشة الدخول الآمنة بـ PIN (مع قفل مؤقت بعد 5 محاولات وخروج تلقائي عند الخمول)
    function pressPinDigit(digit) {
      if (lockoutUntil > Date.now()) return;
      if (enteredPin.length >= 4) return;
      enteredPin += digit;
      updatePinDotsUI();
      if (enteredPin.length === 4) {
        verifyPinAndLogin(enteredPin);
      }
    }

    function backspacePinDigit() {
      enteredPin = enteredPin.slice(0, -1);
      document.getElementById('pinErrorMsg').textContent = '';
      updatePinDotsUI();
    }

    function clearPinDigits() {
      enteredPin = '';
      document.getElementById('pinErrorMsg').textContent = '';
      updatePinDotsUI();
    }

    function updatePinDotsUI() {
      const dots = document.querySelectorAll('#pinDotsContainer span');
      dots.forEach(function(dot, idx) {
        if (idx < enteredPin.length) {
          dot.classList.add('bg-cyan-400', 'scale-110');
        } else {
          dot.classList.remove('bg-cyan-400', 'scale-110');
        }
      });
    }

    function startLockoutCountdown() {
      if (lockoutInterval) clearInterval(lockoutInterval);
      const errEl = document.getElementById('pinErrorMsg');
      lockoutInterval = setInterval(function() {
        const rem = Math.ceil((lockoutUntil - Date.now()) / 1000);
        if (rem <= 0) {
          clearInterval(lockoutInterval);
          lockoutInterval = null;
          lockoutUntil = 0;
          failedPinAttempts = 0;
          try { localStorage.removeItem('school_points_lockout_until'); } catch (e) {}
          if (errEl) errEl.textContent = '';
        } else if (errEl) {
          errEl.textContent = '🔒 تم قفل الدخول مؤقتاً بسبب محاولات خاطئة. انتظر ' + formatNum(rem) + ' ثانية.';
        }
      }, 500);
    }

    async function verifyPinAndLogin(pinCode) {
      if (lockoutUntil > Date.now()) {
        startLockoutCountdown();
        return;
      }

      const candidateHash = await computePinHash(pinCode);
      const syncHash = computePinHashSync(pinCode);

      const found = db.Teachers.find(function(t) {
        return t.PINHash === candidateHash || t.PINHash === syncHash;
      });

      if (!found) {
        failedPinAttempts++;
        const remaining = MAX_LOGIN_ATTEMPTS - failedPinAttempts;
        if (failedPinAttempts >= MAX_LOGIN_ATTEMPTS) {
          lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
          try { localStorage.setItem('school_points_lockout_until', String(lockoutUntil)); } catch (e) {}
          startLockoutCountdown();
        } else {
          document.getElementById('pinErrorMsg').textContent = '❌ رمز الدخول غير صحيح (متبقي ' + formatNum(remaining) + ' محاولات)';
        }
        triggerMobileFeedback('negative');
        setTimeout(clearPinDigits, 550);
        return;
      }

      if (found.Status === 'suspended') {
        document.getElementById('pinErrorMsg').textContent = '⛔ هذا الحساب موقوف مؤقتاً من قِبل الإدارة';
        setTimeout(clearPinDigits, 900);
        return;
      }

      failedPinAttempts = 0;
      currentTeacher = found;
      enteredPin = '';
      updatePinDotsUI();
      document.getElementById('pinErrorMsg').textContent = '';

      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('appWorkspace').classList.remove('hidden');

      resetIdleLogoutTimer();
      initializeTeacherSession();
      requestScreenWakeLock();
      showToast('مرحباً بك ' + currentTeacher.TeacherName, 'success');
    }

    function logoutTeacher(isAutoIdle) {
      if (idleTimer) clearTimeout(idleTimer);
      currentTeacher = null;
      document.getElementById('appWorkspace').classList.add('hidden');
      document.getElementById('loginScreen').classList.remove('hidden');
      const hm = document.getElementById('headerOverflowMenu');
      if (hm) hm.classList.add('hidden');
      clearPinDigits();
      if (isAutoIdle) {
        showToast('🔒 تم تسجيل الخروج تلقائياً لعدم النشاط حفاظاً على أمان المنظومة', 'warning');
      }
    }

    function resetIdleLogoutTimer() {
      if (idleTimer) clearTimeout(idleTimer);
      if (!currentTeacher) return;
      const mins = Number(appSettings.idleMinutes) || 15;
      idleTimer = setTimeout(function() {
        logoutTeacher(true);
      }, mins * 60 * 1000);
    }

    ['pointerdown', 'keydown', 'touchstart'].forEach(function(evtName) {
      window.addEventListener(evtName, function() {
        if (currentTeacher) resetIdleLogoutTimer();
      }, { passive: true });
    });

