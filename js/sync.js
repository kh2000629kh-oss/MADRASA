/**
 * الوحدة البرمجية: js/sync.js
 * الوصف: تصدير CSV والمزامنة السحابية الثنائية المحمية بـ API Token مع إعادة المحاولة التصاعدية
 * المنظومة: منظومة النقاط والإدارة المدرسية الشاملة — ثانوية الصحابة الشرعية
 */
    // 20. التصدير إلى CSV والمزامنة السحابية الصادقة (بدون تفريغ وهمي للطابور)
    function exportTableToCSV(tableName) {
      if (tableName === 'Teachers_Efficiency') {
        const headers = ['TeacherID', 'اسم المعلم', 'المواد', 'الشعب', 'عدد المشاركات', 'عدد الوظائف (الواجبات)', 'مرات التسميع الشفهي', 'الملاحظات المسجلة', 'إجمالي الحركات'];
        const rows = db.Teachers.map(function(t) {
          const tLogs = db.Points_Log.filter(function(l) { return l.TeacherID === t.TeacherID; });
          const tNotes = db.Notes_Log.filter(function(n) { return n.TeacherID === t.TeacherID; });
          const part = tLogs.filter(function(l) { return l.ActionCategory === 'participation'; }).length;
          const oral = tLogs.filter(function(l) { return l.ActionCategory === 'oral'; }).length;
          const hw = tLogs.filter(function(l) { return l.ActionCategory === 'homework'; }).length;
          return [t.TeacherID, t.TeacherName, t.Subjects, t.AssignedSections, part, hw, oral, tNotes.length, tLogs.length];
        });
        downloadCSVFile('Teachers_Efficiency_Report.csv', headers, rows);
        return;
      }

      const tableData = db[tableName];
      if (!tableData || tableData.length === 0) {
        showToast('الجدول ' + tableName + ' فارغ حالياً', 'warning');
        return;
      }
      const headers = Object.keys(tableData[0]).filter(function(k) { return k !== 'PINHash' && k !== 'PIN'; });
      const rows = tableData.map(function(obj) {
        return headers.map(function(h) { return obj[h]; });
      });
      downloadCSVFile(tableName + '.csv', headers, rows);
    }

    function downloadCSVFile(filename, headers, rows) {
      const escapeCSV = function(val) {
        const s = String(val === null || val === undefined ? '' : val).replace(/"/g, '""');
        return '"' + s + '"';
      };
      const csvContent = '\uFEFF' + [
        headers.map(escapeCSV).join(','),
        ...rows.map(function(r) { return r.map(escapeCSV).join(','); })
      ].join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('📥 تم تصدير ملف ' + filename + ' بترميز CSV UTF-8 BOM', 'success');
    }

    function copyTeacherCloudInviteLink() {
      if (!gasWebAppUrl) {
        showToast('⚠️ الصق رابط Web App URL أولاً ليتم دمجه في رابط دعوة المعلمين', 'warning');
        return;
      }
      const baseUrl = window.location.origin + window.location.pathname;
      const inviteUrl = baseUrl + '?cloud=' + encodeURIComponent(gasWebAppUrl) +
        (gasApiToken ? '&token=' + encodeURIComponent(gasApiToken) : '');
      copyTextSafe(inviteUrl);
      showToast('📲 تم نسخ رابط المعلمين المحمي بالرمز السري! أي معلم يفتحه سيرتبط بالشيت تلقائياً', 'success');
    }

    function saveGasWebAppUrl() {
      const el = document.getElementById('gasWebAppUrlInput');
      if (!el) return;
      gasWebAppUrl = el.value.trim();
      try { localStorage.setItem('school_points_gas_url_v1', gasWebAppUrl); } catch (e) {}
      updateFooterStatus();
    }

    function saveGasApiToken() {
      const el = document.getElementById('gasApiTokenInput');
      if (!el) return;
      gasApiToken = el.value.trim() || DEFAULT_GAS_API_TOKEN;
      try { localStorage.setItem('school_points_gas_token_v1', gasApiToken); } catch (e) {}
    }

    // دمج الحركات المحلية المعلقة في الطابور فوق البيانات المسحوبة من السحابة لمنع ضياع التعديلات (Conflict Resolution)
    function reapplyPendingOfflineQueueToLocalDb() {
      if (!offlineQueue || offlineQueue.length === 0) return;
      const existingLogIds = {};
      (db.Points_Log || []).forEach(function(l) { if (l.LogID) existingLogIds[l.LogID] = true; });
      const existingAttIds = {};
      (db.Attendance_Log || []).forEach(function(a) { if (a.RecordID) existingAttIds[a.RecordID] = true; });
      const existingNoteIds = {};
      (db.Notes_Log || []).forEach(function(n) { if (n.NoteID) existingNoteIds[n.NoteID] = true; });

      offlineQueue.forEach(function(op) {
        const opType = op.opType || op.action;
        if (opType === 'addPointLog' && op.LogID && !existingLogIds[op.LogID]) {
          db.Points_Log.push({
            LogID: op.LogID,
            Timestamp: op.Timestamp,
            StudentID: op.StudentID,
            TeacherID: op.TeacherID,
            Subject: op.Subject,
            Grade: op.Grade,
            Section: op.Section,
            ActionCategory: op.ActionCategory,
            ActionLabel: op.ActionLabel,
            PointsDelta: Number(op.PointsDelta) || 0
          });
          existingLogIds[op.LogID] = true;
        } else if (opType === 'undoPointLog' && op.LogID) {
          db.Points_Log = (db.Points_Log || []).filter(function(l) { return l.LogID !== op.LogID; });
        } else if (opType === 'logAttendance' && op.RecordID && !existingAttIds[op.RecordID]) {
          db.Attendance_Log.push({
            RecordID: op.RecordID,
            Date: op.Date,
            Period: op.Period,
            Grade: op.Grade,
            Section: op.Section,
            StudentID: op.StudentID,
            Status: op.Status,
            TeacherID: op.TeacherID,
            Subject: op.Subject
          });
          existingAttIds[op.RecordID] = true;
          const st = (db.Students || []).find(function(s) { return s.StudentID === op.StudentID; });
          if (st) st.AttendanceToday = op.Status;
        } else if (opType === 'addNote' && op.NoteID && !existingNoteIds[op.NoteID]) {
          db.Notes_Log.push({
            NoteID: op.NoteID,
            Timestamp: op.Timestamp,
            StudentID: op.StudentID,
            TeacherID: op.TeacherID,
            Subject: op.Subject,
            Grade: op.Grade,
            Section: op.Section,
            NoteType: op.NoteType,
            NoteText: op.NoteText
          });
          existingNoteIds[op.NoteID] = true;
        }
      });
    }

    let isSyncInProgress = false;
    let syncRetryAttempt = 0;
    let syncRetryTimer = null;

    function scheduleSyncRetryWithBackoff() {
      if (syncRetryTimer) clearTimeout(syncRetryTimer);
      if (offlineQueue.length === 0 || !gasWebAppUrl) return;
      const delaySec = Math.min(30, Math.pow(2, Math.min(syncRetryAttempt + 1, 5)));
      syncRetryAttempt++;
      syncRetryTimer = setTimeout(function() {
        syncRetryTimer = null;
        if (navigator.onLine && offlineQueue.length > 0) {
          syncOfflineQueueNow(true);
        }
      }, delaySec * 1000);
    }

    function enqueueSyncOperation(op) {
      // منع إضافة نفس الحركة مرتين في الطابور المحلي (Client-Side Deduplication)
      const uniqueKey = op.LogID || op.RecordID || op.NoteID;
      if (uniqueKey && (op.opType === 'addPointLog' || op.opType === 'logAttendance' || op.opType === 'addNote')) {
        const alreadyQueued = offlineQueue.some(function(item) {
          return (item.LogID || item.RecordID || item.NoteID) === uniqueKey && item.opType === op.opType;
        });
        if (alreadyQueued) return;
      }
      offlineQueue.push(op);
      saveStateToStorage();
      updateFooterStatus();

      if (navigator.onLine && gasWebAppUrl) {
        syncOfflineQueueNow(true);
      }
    }

    function updateFooterStatus() {
      const secStudents = db.Students.filter(function(s) { return s.Section === currentSection; });
      const absentCnt = secStudents.filter(function(s) { return s.AttendanceToday === 'غائب'; }).length;
      const presentCnt = secStudents.length - absentCnt;
      const recTodayCnt = secStudents.filter(function(s) { return recordedTodaySet.has(s.StudentID); }).length;

      const presEl = document.getElementById('footerPresentCount');
      const absEl = document.getElementById('footerAbsentCount');
      const livePres = document.getElementById('livePresentCount');
      const liveAbs = document.getElementById('liveAbsentCount');
      const liveRec = document.getElementById('liveRecordedTodayCount');

      if (presEl) presEl.textContent = formatNum(presentCnt);
      if (absEl) absEl.textContent = formatNum(absentCnt);
      if (livePres) livePres.textContent = formatNum(presentCnt);
      if (liveAbs) liveAbs.textContent = formatNum(absentCnt);
      if (liveRec) liveRec.textContent = formatNum(recTodayCnt);

      const qBadge = document.getElementById('offlineQueueBadge');
      const cloudQ = document.getElementById('cloudQueueCount');
      const cloudQBtn = document.getElementById('cloudQueueCountBtn');
      if (qBadge) qBadge.textContent = formatNum(offlineQueue.length);
      if (cloudQ) cloudQ.textContent = formatNum(offlineQueue.length);
      if (cloudQBtn) cloudQBtn.textContent = formatNum(offlineQueue.length);

      const connStateEl = document.getElementById('syncConnStateText');
      const lastSyncEl = document.getElementById('lastSyncTimeText');
      const errCountEl = document.getElementById('syncErrorCountText');
      if (connStateEl) {
        connStateEl.textContent = gasWebAppUrl
          ? (lastSuccessfulSyncTime ? 'متزامن فعلياً مع السحابة (محمي بـ Token)' : 'مربوط برابط السحابة (بانتظار أول مزامنة)')
          : 'غير مربوط (تخزين محلي فقط)';
        connStateEl.className = gasWebAppUrl ? 'text-sm text-emerald-300' : 'text-sm text-amber-300';
      }
      if (lastSyncEl) lastSyncEl.textContent = lastSuccessfulSyncTime || 'لم تتم بعد';
      if (errCountEl) errCountEl.textContent = formatNum(syncErrorsLog.length);

      const isOnline = navigator.onLine;
      const netBadge = document.getElementById('networkStatusBadge');
      const netDot = document.getElementById('networkDot');
      const netText = document.getElementById('networkStatusText');

      if (netBadge && netDot && netText) {
        if (!isOnline) {
          netBadge.className = 'min-h-[36px] px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer';
          netDot.className = 'w-2 h-2 rounded-full bg-amber-400';
          netText.textContent = '📴 دون اتصال';
        } else if (isSyncInProgress) {
          netBadge.className = 'min-h-[36px] px-2.5 py-1 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer';
          netDot.className = 'w-2 h-2 rounded-full bg-cyan-400 animate-pulse';
          netText.textContent = '⏳ جاري المزامنة...';
        } else if (offlineQueue.length > 0 && syncRetryAttempt > 0) {
          netBadge.className = 'min-h-[36px] px-2.5 py-1 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer';
          netDot.className = 'w-2 h-2 rounded-full bg-rose-400 animate-pulse';
          netText.textContent = '⚠️ إعادة محاولة تلقائية';
        } else if (offlineQueue.length > 0) {
          netBadge.className = 'min-h-[36px] px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer';
          netDot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-pulse';
          netText.textContent = '⏳ بانتظار المزامنة';
        } else if (gasWebAppUrl && lastSuccessfulSyncTime) {
          netBadge.className = 'min-h-[36px] px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer';
          netDot.className = 'w-2 h-2 rounded-full bg-emerald-400';
          netText.textContent = '✅ متزامن';
        } else {
          netBadge.className = 'min-h-[36px] px-2.5 py-1 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer';
          netDot.className = 'w-2 h-2 rounded-full bg-cyan-400';
          netText.textContent = 'جاهز للاتصال';
        }
      }
    }

    async function triggerOneClickCloudSetup() {
      const statusEl = document.getElementById('cloudSyncStatusText');
      if (!gasWebAppUrl) {
        if (statusEl) {
          statusEl.textContent = '⚠️ لم يتم إدخال رابط خادم Google Apps Script (Web App URL) بعد. يرجى لصق الرابط أولاً لتهيئة الشيت السحابي.';
        }
        showToast('⚠️ يرجى إدخال رابط Web App URL أولاً؛ لم يتم الاتصال بأي خادم خارجي', 'warning');
        return;
      }

      if (statusEl) statusEl.textContent = '⏳ جاري إرسال أمر بناء وتنسيق الأوراق الـ 6 إلى Google Sheets...';
      try {
        const res = await fetch(gasWebAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'initDatabase', token: gasApiToken })
        });
        const data = await res.json();
        if (data && data.status === 'error') {
          throw new Error(data.message || 'رفض الخادم الطلب');
        }
        lastSuccessfulSyncTime = getFormattedTimestamp();
        syncRetryAttempt = 0;
        if (statusEl) statusEl.textContent = '✅ ' + (data.message || 'تم بناء وتنسيق الأوراق الـ 6 في Google Sheets بنجاح!');
        updateFooterStatus();
        showToast('🏗️ اكتملت التهيئة التلقائية الشاملة لقاعدة البيانات السحابية!', 'success');
      } catch (err) {
        syncErrorsLog.push({ time: getFormattedTimestamp(), error: String(err) });
        if (statusEl) statusEl.textContent = '❌ تعذر الاتصال أو التحقق من الرمز السري: ' + String(err.message || err);
        updateFooterStatus();
        showToast('❌ تعذر إتمام العملية: تحقق من رابط Web App ورمز المصادقة السري', 'danger');
      }
    }

    // مزامنة محمية بـ Token مع دعم معالجة الفشل الجزئي ومنع التكرار (Idempotency)
    async function syncOfflineQueueNow(isSilentAuto) {
      const statusEl = document.getElementById('cloudSyncStatusText');
      if (isSyncInProgress) return;
      if (offlineQueue.length === 0) {
        if (!isSilentAuto) {
          if (gasWebAppUrl && navigator.onLine) {
            await pullAllFromCloud();
          } else {
            showToast('ℹ️ لا توجد حركات معلقة في طابور المزامنة حالياً', 'info');
          }
        }
        return;
      }
      if (!gasWebAppUrl) {
        if (statusEl) {
          statusEl.textContent = '⚠️ لا يوجد رابط خادم (Web App URL) مضبوط. الحركات الـ (' + formatNum(offlineQueue.length) + ') محفوظة محلياً في الطابور ولن تُفرّغ حتى يتم الربط الفعلي.';
        }
        if (!isSilentAuto) {
          showToast('⚠️ لم تتم المزامنة لعدم وجود رابط خادم؛ بقيت ' + formatNum(offlineQueue.length) + ' حركة في الطابور', 'warning');
        }
        return;
      }

      isSyncInProgress = true;
      updateFooterStatus();

      try {
        const batch = offlineQueue.slice();
        const res = await fetch(gasWebAppUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'syncBatch', token: gasApiToken, operations: batch })
        });
        const data = await res.json();
        if (data && (data.status === 'success' || data.status === 'partial_success')) {
          const serverData = data.data || {};
          const processedIds = Array.isArray(serverData.processedIds) ? serverData.processedIds : null;

          if (processedIds) {
            // إزالة الحركات التي أكد الخادم معالجتها فقط (معالجة الفشل الجزئي)
            const doneSet = {};
            processedIds.forEach(function(id) { doneSet[String(id)] = true; });
            offlineQueue = offlineQueue.filter(function(op) {
              const opKey = String(op.LogID || op.RecordID || op.NoteID || '');
              return opKey && !doneSet[opKey];
            });
          } else {
            offlineQueue.splice(0, batch.length);
          }

          lastSuccessfulSyncTime = getFormattedTimestamp();
          syncRetryAttempt = 0;
          if (syncRetryTimer) {
            clearTimeout(syncRetryTimer);
            syncRetryTimer = null;
          }
          isSyncInProgress = false;
          saveStateToStorageImmediate();
          updateFooterStatus();
          if (statusEl) statusEl.textContent = '✅ ' + (data.message || ('تمت مزامنة ' + formatNum(batch.length) + ' حركة مع Google Sheets بنجاح'));
          if (offlineQueue.length > 0) {
            scheduleSyncRetryWithBackoff();
          } else if (!isSilentAuto) {
            showToast('☁️ تمت مزامنة كافة الحركات المعلقة مع Google Sheets!', 'success');
          }
        } else {
          throw new Error((data && data.message) || 'استجابة غير متوقعة من الخادم');
        }
      } catch (e) {
        isSyncInProgress = false;
        syncErrorsLog.push({ time: getFormattedTimestamp(), error: String(e) });
        scheduleSyncRetryWithBackoff();
        updateFooterStatus();
        if (statusEl) statusEl.textContent = '❌ تعذرت المزامنة مؤقتاً (' + String(e.message || e) + ')، ستتم إعادة المحاولة تلقائياً.';
        if (!isSilentAuto) {
          showToast('⚠️ تعذرت المزامنة حالياً؛ بقيت الحركات محفوظة بأمان في الطابور لإعادة المحاولة', 'warning');
        }
      }
    }

    async function pullAllFromCloud() {
      if (!gasWebAppUrl) {
        showToast('⚠️ يرجى إدخال رابط Web App URL أولاً لسحب البيانات من السحابة', 'warning');
        return;
      }
      try {
        const sep = gasWebAppUrl.includes('?') ? '&' : '?';
        const res = await fetch(gasWebAppUrl + sep + 'action=getAll&token=' + encodeURIComponent(gasApiToken));
        const payload = await res.json();
        if (payload && payload.status === 'error') {
          throw new Error(payload.message || 'رفض الخادم طلب القراءة');
        }
        if (payload && payload.status === 'success' && payload.data) {
          createAutoBackupSnapshot('before_cloud_pull');
          db = Object.assign({}, db, payload.data);
          // إعادة تطبيق أي حركات محلية معلقة في الطابور فوق البيانات المسحوبة لمنع التعارض
          reapplyPendingOfflineQueueToLocalDb();
          migrateDatabaseIfNeeded();
          rebuildPerformanceCaches();
          lastSuccessfulSyncTime = getFormattedTimestamp();
          saveStateToStorageImmediate();
          renderStudentGrid();
          initAdminPortal();
          showToast('⬇️ تم سحب وتحديث كافة الجداول الـ 6 من Google Sheets بأمان!', 'success');
        }
      } catch (e) {
        syncErrorsLog.push({ time: getFormattedTimestamp(), error: String(e) });
        updateFooterStatus();
        showToast('❌ تعذر سحب البيانات: ' + String(e.message || 'تأكد من صحة الرمز السري وصلاحية النشر'), 'danger');
      }
    }

    async function pushAllTablesToCloud() {
      if (!gasWebAppUrl) {
        showToast('⚠️ يرجى إدخال رابط Web App URL أولاً لدفع الجداول إلى السحابة', 'warning');
        return;
      }
      const sheetsToPush = ['School_Setup', 'Teachers', 'Students'];
      try {
        for (let i = 0; i < sheetsToPush.length; i++) {
          const sName = sheetsToPush[i];
          const res = await fetch(gasWebAppUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'saveTable', token: gasApiToken, sheetName: sName, rows: db[sName] })
          });
          const respData = await res.json();
          if (respData && respData.status === 'error') {
            throw new Error(respData.message || ('فشل حفظ جدول ' + sName));
          }
        }
        lastSuccessfulSyncTime = getFormattedTimestamp();
        updateFooterStatus();
        showToast('⬆️ تم دفع الجداول المحدثة إلى Google Sheets بنجاح!', 'success');
      } catch (e) {
        syncErrorsLog.push({ time: getFormattedTimestamp(), error: String(e) });
        updateFooterStatus();
        showToast('❌ تعذر دفع الجداول إلى السحابة: ' + String(e.message || e), 'danger');
      }
    }

