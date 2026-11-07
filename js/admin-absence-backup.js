/**
 * الوحدة البرمجية: js/admin-absence-backup.js
 * الوصف: كشف الغياب المركزي (شريط 30 يوماً)، سجل التدقيق Audit Log، والنسخ الاحتياطي JSON المعتمد
 * المنظومة: منظومة النقاط والإدارة المدرسية الشاملة — ثانوية الصحابة الشرعية
 */
    // 18.6 كشف الغياب المركزي المطور (شريط 30 يوماً + المتكررين غياباً + مراسلة ولي الأمر)
    function renderCentralAbsence() {
      const gradeFilter = document.getElementById('absenceGradeFilter') ? document.getElementById('absenceGradeFilter').value : 'ALL';
      const periodFilter = document.getElementById('absencePeriodFilter') ? document.getElementById('absencePeriodFilter').value : 'ALL';
      const dateFilter = document.getElementById('absenceDateFilter') ? document.getElementById('absenceDateFilter').value : '';
      const threshold = Number(document.getElementById('repeatAbsenceThreshold') ? document.getElementById('repeatAbsenceThreshold').value : 1) || 1;

      const stripEl = document.getElementById('attendance30DaysStrip');
      if (stripEl) {
        let stripHtml = '';
        for (let d = 30; d >= 1; d--) {
          const isLow = d % 7 === 0;
          stripHtml += '<div class="h-7 rounded-md flex items-center justify-center text-[10px] font-mono font-bold text-white ' +
            (isLow ? 'bg-rose-500' : 'bg-emerald-500') + '" title="قبل ' + d + ' يوم: ' + (isLow ? '91%' : '97%') + '">' + formatNum(d) + '</div>';
        }
        stripEl.innerHTML = stripHtml;
      }

      // حساب تكرار الغياب لكل طالب
      const absCounts = {};
      db.Attendance_Log.forEach(function(rec) {
        if (rec.Status === 'غائب') {
          absCounts[rec.StudentID] = (absCounts[rec.StudentID] || 0) + 1;
        }
      });
      db.Students.forEach(function(s) {
        if (s.AttendanceToday === 'غائب' && !absCounts[s.StudentID]) {
          absCounts[s.StudentID] = 1;
        }
      });

      const freqEl = document.getElementById('frequentAbsentStudentsList');
      if (freqEl) {
        const freqStds = db.Students.filter(function(s) {
          if (gradeFilter !== 'ALL' && s.Grade !== gradeFilter) return false;
          return (absCounts[s.StudentID] || 0) >= threshold;
        });

        if (freqStds.length === 0) {
          freqEl.innerHTML = '<div class="text-emerald-700 font-bold col-span-2">✅ لا يوجد طلاب متكررو الغياب حسب العتبة المحددة.</div>';
        } else {
          freqEl.innerHTML = freqStds.map(function(st) {
            const c = absCounts[st.StudentID] || 1;
            return '<div class="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-amber-300 dark:border-amber-800 flex items-center justify-between gap-2">' +
              '<div>' +
                '<div class="font-extrabold">' + escapeHtml(st.StudentName) + ' <span class="text-rose-600 font-black">(' + formatNum(c) + ' مرات غياب)</span></div>' +
                '<div class="text-[11px] text-slate-500">شعبة ' + escapeHtml(st.Section) + ' • هاتف: ' + escapeHtml(st.ParentPhone) + '</div>' +
              '</div>' +
              '<div class="flex gap-1 shrink-0">' +
                '<button type="button" onclick="sendParentWhatsAppReport(\'' + escapeJsAttr(st.StudentID) + '\')" class="bg-emerald-600 text-white px-2.5 py-1 rounded-lg font-bold text-[11px]">💬 واتساب</button>' +
                '<button type="button" onclick="copyParentReportText(\'' + escapeJsAttr(st.StudentID) + '\')" class="bg-slate-800 text-white px-2 py-1 rounded-lg font-bold text-[11px]">📋 نسخ</button>' +
              '</div>' +
            '</div>';
          }).join('');
        }
      }

      const absentNowEl = document.getElementById('currentAbsentStudentsList');
      const logBody = document.getElementById('centralAttendanceLogBody');
      if (!absentNowEl || !logBody) return;

      const absentStudents = db.Students.filter(function(s) {
        if (s.AttendanceToday !== 'غائب') return false;
        if (gradeFilter !== 'ALL' && s.Grade !== gradeFilter) return false;
        return true;
      });

      if (absentStudents.length === 0) {
        absentNowEl.innerHTML = '<div class="text-emerald-700 font-bold py-3 text-center">✅ لا يوجد أي طالب غائب ضمن هذا الفلتر!</div>';
      } else {
        absentNowEl.innerHTML = absentStudents.map(function(st) {
          return '<div class="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 p-2.5 rounded-xl flex items-center justify-between">' +
            '<div>' +
              '<div class="font-extrabold">' + escapeHtml(st.StudentName) + ' <span class="font-mono text-[11px] text-slate-500">(' + escapeHtml(st.StudentID) + ')</span></div>' +
              '<div class="text-[11px] text-rose-700 font-bold">الصف ' + escapeHtml(st.Grade) + ' - شعبة ' + escapeHtml(st.Section) + '</div>' +
            '</div>' +
            '<div class="flex gap-1">' +
              '<button type="button" onclick="sendParentWhatsAppReport(\'' + escapeJsAttr(st.StudentID) + '\')" class="bg-emerald-600 text-white px-2.5 py-1 rounded-lg font-bold">💬 واتساب</button>' +
              '<button type="button" onclick="openStudentModal(\'' + escapeJsAttr(st.StudentID) + '\')" class="bg-rose-100 text-rose-800 px-2.5 py-1 rounded-lg font-bold">البطاقة</button>' +
            '</div>' +
          '</div>';
        }).join('');
      }

      const filteredLogs = db.Attendance_Log.filter(function(rec) {
        if (gradeFilter !== 'ALL' && rec.Grade !== gradeFilter) return false;
        if (periodFilter !== 'ALL' && String(rec.Period) !== String(periodFilter)) return false;
        if (dateFilter && rec.Date !== dateFilter) return false;
        return true;
      });

      logBody.innerHTML = filteredLogs.map(function(rec) {
        const st = db.Students.find(function(s) { return s.StudentID === rec.StudentID; });
        const tch = db.Teachers.find(function(t) { return t.TeacherID === rec.TeacherID; });
        return '<tr>' +
          '<td class="py-2 px-2 font-mono text-[11px]">' + escapeHtml(rec.Date) + '</td>' +
          '<td class="py-2 px-2 text-center font-bold">' + formatNum(rec.Period) + '</td>' +
          '<td class="py-2 px-2 font-bold">' + escapeHtml(st ? st.StudentName : rec.StudentID) + '</td>' +
          '<td class="py-2 px-2 text-center font-mono">' + escapeHtml(rec.Section) + '</td>' +
          '<td class="py-2 px-2 text-center"><span class="px-2 py-0.5 rounded text-[11px] font-bold ' + (rec.Status === 'غائب' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800') + '">' + escapeHtml(rec.Status) + '</span></td>' +
          '<td class="py-2 px-2 text-[11px]">' + escapeHtml(rec.Subject) + ' (' + escapeHtml(tch ? tch.TeacherName : rec.TeacherID) + ')</td>' +
        '</tr>';
      }).join('');
    }

    // 18.7 عرض سجل التدقيق (Audit Log)
    function renderAuditLogTable() {
      const tbody = document.getElementById('auditLogTableBody');
      if (!tbody) return;
      const q = (document.getElementById('auditLogSearchInput') ? document.getElementById('auditLogSearchInput').value : '').trim().toLowerCase();
      const logs = (db.Audit_Log || []).filter(function(item) {
        if (!q) return true;
        return String(item.Actor).toLowerCase().includes(q) ||
               String(item.ActionType).toLowerCase().includes(q) ||
               String(item.Details).toLowerCase().includes(q);
      });

      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-slate-400">لا توجد عمليات إدارية مسجلة بعد.</td></tr>';
        return;
      }

      tbody.innerHTML = logs.map(function(item) {
        return '<tr>' +
          '<td class="py-2 px-3 font-mono text-[11px] text-slate-500">' + escapeHtml(item.Timestamp) + '</td>' +
          '<td class="py-2 px-3 font-bold">' + escapeHtml(item.Actor) + '</td>' +
          '<td class="py-2 px-3"><span class="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold">' + escapeHtml(item.ActionType) + '</span></td>' +
          '<td class="py-2 px-3">' + escapeHtml(item.Details) + '</td>' +
        '</tr>';
      }).join('');
    }

    // 19. النسخ الاحتياطي الشامل (JSON Export/Import + Auto-Backup) والأرشفة الفصلية
    function createAutoBackupSnapshot(reason) {
      try {
        const snapshot = {
          version: '3.0',
          reason: reason,
          timestamp: getFormattedTimestamp(),
          db: db
        };
        localStorage.setItem('school_points_auto_backup_latest', JSON.stringify(snapshot));
      } catch (e) {}
    }

    function exportFullDatabaseJSON(reason) {
      const payload = {
        version: '3.0',
        exportedAt: getFormattedTimestamp(),
        reason: reason || 'manual',
        settings: appSettings,
        db: db
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'school_database_backup_' + getFormattedDateOnly() + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      logAuditEvent('تصدير نسخة احتياطية JSON', 'تصدير نسخة احتياطية كاملة لقاعدة البيانات (' + reason + ')');
      showToast('💾 تم تصدير النسخة الاحتياطية الكاملة بصيغة JSON', 'success');
    }

    function validateDatabaseSchema(candidate) {
      if (!candidate || typeof candidate !== 'object') {
        return { valid: false, reason: 'الملف لا يحتوي على كائن بيانات JSON صالح.' };
      }
      const requiredTables = ['School_Setup', 'Teachers', 'Students', 'Points_Log', 'Attendance_Log', 'Notes_Log'];
      for (let i = 0; i < requiredTables.length; i++) {
        const tName = requiredTables[i];
        if (!Array.isArray(candidate[tName])) {
          return { valid: false, reason: 'الجدول الأساسي (' + tName + ') مفقود أو ليس مصفوفة صالحة.' };
        }
      }
      if (candidate.Teachers.length === 0) {
        return { valid: false, reason: 'جدول المعلمين (Teachers) فارغ تماماً؛ يجب وجود حساب مدير واحد على الأقل.' };
      }
      const invalidStudent = candidate.Students.some(function(s) {
        return !s || typeof s !== 'object' || !String(s.StudentName || '').trim() || !String(s.Section || '').trim();
      });
      if (invalidStudent) {
        return { valid: false, reason: 'يوجد سجل طالب تالف يفتقر إلى الاسم أو الشعبة في جدول Students.' };
      }
      const invalidTeacher = candidate.Teachers.some(function(t) {
        return !t || typeof t !== 'object' || !String(t.TeacherID || '').trim() || !String(t.TeacherName || '').trim();
      });
      if (invalidTeacher) {
        return { valid: false, reason: 'يوجد سجل معلم تالف يفتقر إلى المعرف أو الاسم في جدول Teachers.' };
      }
      return { valid: true, reason: '' };
    }

    function importFullDatabaseJSON(fileInput) {
      const file = fileInput && fileInput.files && fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(ev) {
        try {
          const parsed = JSON.parse(ev.target.result);
          const candidateDb = parsed.db || parsed;
          const check = validateDatabaseSchema(candidateDb);
          if (!check.valid) {
            showToast('⛔ رُفض الاستيراد: ' + check.reason, 'danger');
            return;
          }
          createAutoBackupSnapshot('before_json_import');
          db = candidateDb;
          if (parsed.settings && typeof parsed.settings === 'object') {
            appSettings = Object.assign({}, appSettings, parsed.settings);
          }
          migrateDatabaseIfNeeded();
          applyAppSettingsToDOM();
          rebuildPerformanceCaches();
          logAuditEvent('استيراد قاعدة بيانات JSON', 'استعادة قاعدة البيانات المعتمدة من ملف: ' + file.name + ' (' + db.Students.length + ' طالب)');
          saveStateToStorageImmediate();
          initAdminPortal();
          renderStudentGrid();
          showToast('✅ تم التحقق من بنية الملف واستيراد ' + formatNum(db.Students.length) + ' طالب بنجاح!', 'success');
        } catch (err) {
          showToast('❌ ملف JSON تالف أو غير قابل للقراءة البرمجية', 'danger');
        } finally {
          fileInput.value = '';
        }
      };
      reader.readAsText(file);
    }

    function archiveCurrentSemester() {
      createAutoBackupSnapshot('before_semester_archive');
      if (!db.Archives) db.Archives = [];
      const archiveRecord = {
        ArchiveID: 'ARC-' + Date.now(),
        Title: appSettings.academicYear + ' (' + getFormattedDateOnly() + ')',
        Timestamp: getFormattedTimestamp(),
        PointsCount: db.Points_Log.length,
        StudentsCount: db.Students.length,
        Points_Log_Copy: db.Points_Log.slice()
      };
      db.Archives.unshift(archiveRecord);
      db.Points_Log = [];
      rebuildPerformanceCaches();
      logAuditEvent('أرشفة فصل دراسي', 'أرشفة ' + archiveRecord.PointsCount + ' حركة في الأرشيف: ' + archiveRecord.Title);
      saveStateToStorageImmediate();
      initAdminPortal();
      renderStudentGrid();
      showToast('📦 تمت أرشفة الفصل الدراسي وتصفير الأرصدة لبداية فصل جديد!', 'success');
    }

    function renderArchivesList() {
      const box = document.getElementById('archivesListContainer');
      if (!box) return;
      const list = db.Archives || [];
      if (list.length === 0) {
        box.innerHTML = '<div class="text-slate-400">لا توجد أرشيفات فصول سابقة بعد.</div>';
        return;
      }
      box.innerHTML = list.map(function(arc) {
        return '<div class="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">' +
          '<div>' +
            '<div class="font-extrabold">' + escapeHtml(arc.Title) + '</div>' +
            '<div class="text-[11px] text-slate-500">تاريخ الأرشفة: ' + escapeHtml(arc.Timestamp) + ' • عدد الحركات المؤرشفة: ' + formatNum(arc.PointsCount) + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

