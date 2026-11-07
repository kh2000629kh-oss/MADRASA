/**
 * الوحدة البرمجية: js/settings-reset.js
 * الوصف: التصفير المحمي للنقاط، الإعدادات الموحدة، والسمة الليلية
 */
    // 21. التصفير المحمي بكتابة كلمة "تصفير" مع النسخ الاحتياطي التلقائي
    function openResetPointsModal() {
      document.getElementById('resetAffectedLogsCount').textContent = formatNum(db.Points_Log.length);
      document.getElementById('resetTypeConfirmInput').value = '';
      openModalDialog('resetConfirmModal');
    }

    function closeResetPointsModal() {
      closeModalDialog('resetConfirmModal');
    }

    function verifyResetConfirmationWord() {
      const val = (document.getElementById('resetTypeConfirmInput').value || '').trim();
      if (val !== 'تصفير') {
        showToast('⚠️ يرجى كتابة كلمة "تصفير" في حقل التأكيد أولاً لحماية البيانات', 'warning');
        return false;
      }
      return true;
    }

    function confirmResetPointsKeepCounts() {
      if (!verifyResetConfirmationWord()) return;
      createAutoBackupSnapshot('before_reset_keep_counts');
      exportFullDatabaseJSON('auto_before_reset_keep_counts');

      db.Points_Log.forEach(function(l) {
        if (l.HistoricalDelta === undefined) {
          l.HistoricalDelta = Number(l.PointsDelta) || 0;
        }
        l.PointsDelta = 0;
        l.PointsZeroed = true;
      });
      rebuildPerformanceCaches();
      logAuditEvent('تصفير نقاط مع حفظ إحصائيات المعلمين', 'تصفير نقاط كافة الطلاب مع الإبقاء على عدادات المشاركات والوظائف والتسميع');
      saveStateToStorageImmediate();
      enqueueSyncOperation({ opType: 'resetPointsKeepCounts', Timestamp: getFormattedTimestamp() });
      closeResetPointsModal();
      renderStudentGrid();
      initAdminPortal();
      showToast('✅ تم تصفير أرصدة نقاط الطلاب مع الاحتفاظ الكامل بعدد المشاركات والوظائف للمعلمين!', 'success');
    }

    function confirmResetPeriodPoints() {
      if (!verifyResetConfirmationWord()) return;
      createAutoBackupSnapshot('before_full_reset');
      exportFullDatabaseJSON('auto_before_full_reset');

      const count = db.Points_Log.length;
      db.Points_Log = [];
      rebuildPerformanceCaches();
      logAuditEvent('تصفير شامل للنقاط والعدادات', 'مسح شامل لـ ' + count + ' حركة نقاط');
      saveStateToStorageImmediate();
      closeResetPointsModal();
      renderStudentGrid();
      initAdminPortal();
      showToast('🗑️ تم التصفير الشامل للنقاط والعدادات بعد حفظ نسخة احتياطية', 'success');
    }

    // 22. الإعدادات الموحدة والوضع الليلي
    function applyAppSettingsToDOM() {
      document.documentElement.style.setProperty('--app-font-scale', appSettings.fontScale || '1');
      if (appSettings.darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      const dmBtn = document.getElementById('darkModeHeaderBtn');
      if (dmBtn) dmBtn.textContent = appSettings.darkMode ? '☀️' : '🌙';

      const loginTitle = document.getElementById('loginSchoolName');
      const loginYear = document.getElementById('loginAcademicYear');
      if (loginTitle && appSettings.schoolName) loginTitle.textContent = appSettings.schoolName;
      if (loginYear && appSettings.academicYear) loginYear.textContent = appSettings.academicYear;


    }

    function toggleDarkMode() {
      appSettings.darkMode = !appSettings.darkMode;
      applyAppSettingsToDOM();
      saveStateToStorage();
    }

    function openUnifiedSettingsModal() {
      const hm = document.getElementById('headerOverflowMenu');
      if (hm) hm.classList.add('hidden');
      document.getElementById('settingSchoolNameInput').value = appSettings.schoolName || '';
      document.getElementById('settingAcademicYearInput').value = appSettings.academicYear || '';
      document.getElementById('settingIdleMinutesSelect').value = String(appSettings.idleMinutes || 15);
      document.getElementById('settingFontScaleSelect').value = String(appSettings.fontScale || '1');
      document.getElementById('settingSwipeEnabledSelect').value = String(appSettings.swipeEnabled !== false);
      document.getElementById('settingNumFormatSelect').value = appSettings.numFormat || 'latin';

      openModalDialog('unifiedSettingsModal');
    }

    function closeUnifiedSettingsModal() {
      closeModalDialog('unifiedSettingsModal');
    }

    function saveUnifiedSettings() {
      appSettings.schoolName = document.getElementById('settingSchoolNameInput').value.trim() || 'ثانوية الصحابة الشرعية';
      appSettings.academicYear = document.getElementById('settingAcademicYearInput').value.trim() || 'العام الدراسي 2026-2027';
      appSettings.idleMinutes = Number(document.getElementById('settingIdleMinutesSelect').value) || 15;
      appSettings.fontScale = document.getElementById('settingFontScaleSelect').value || '1';
      appSettings.swipeEnabled = document.getElementById('settingSwipeEnabledSelect').value === 'true';
      appSettings.numFormat = document.getElementById('settingNumFormatSelect').value || 'latin';

      if (db.School_Setup[0]) db.School_Setup[0].Label = appSettings.schoolName;
      if (db.School_Setup[1]) db.School_Setup[1].Label = appSettings.academicYear;

      applyAppSettingsToDOM();
      resetIdleLogoutTimer();
      logAuditEvent('تحديث الإعدادات الموحدة', 'تحديث إعدادات المدرسة وتفضيلات العرض والخمول');
      saveStateToStorageImmediate();
      closeUnifiedSettingsModal();
      renderStudentGrid();
      showToast('✅ تم حفظ وتطبيق الإعدادات الموحدة بنجاح', 'success');
    }

    // دوال التاريخ والوقت
    function getFormattedTimestamp() {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return yyyy + '-' + mm + '-' + dd + ' ' + hh + ':' + min;
    }

    function getFormattedDateOnly() {
      return getFormattedTimestamp().split(' ')[0];
    }

