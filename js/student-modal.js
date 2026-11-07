/**
 * الوحدة البرمجية: js/student-modal.js
 * الوصف: نافذة بطاقة الطالب التفصيلية، تحضير الحصة، الملاحظات السريعة، وتقرير واتساب ولي الأمر
 * المنظومة: منظومة النقاط والإدارة المدرسية الشاملة — ثانوية الصحابة الشرعية
 */
    // 15. حساب إحصائيات الطالب السريع من الـ Cache وبطاقة الطالب التفصيلية
    function computeStudentStats(studentId, optionalSubject) {
      const teacherSubjects = getTeacherAllowedSubjects();
      const filterMode = optionalSubject || 'TEACHER_ALL';
      const subBuckets = studentSubjectStatsCache[studentId] || {};

      let oral = 0, homework = 0, participation = 0, negative = 0, positiveActions = 0, totalActions = 0, netPoints = 0;

      Object.keys(subBuckets).forEach(function(subKey) {
        if (filterMode === 'SCHOOL_ALL') {
          // يشمل كل المواد
        } else if (filterMode === 'TEACHER_ALL' || filterMode === 'ALL') {
          if (teacherSubjects.length > 0 && teacherSubjects.indexOf(subKey) === -1) return;
        } else if (subKey !== filterMode) {
          return;
        }
        const b = subBuckets[subKey];
        oral += b.oral;
        homework += b.homework;
        participation += b.participation;
        negative += b.negative;
        positiveActions += b.positiveActions;
        totalActions += b.totalActions;
        netPoints += b.netPoints;
      });

      const notes = db.Notes_Log.filter(function(n) {
        if (n.StudentID !== studentId) return false;
        if (filterMode === 'SCHOOL_ALL') return true;
        if (filterMode === 'TEACHER_ALL' || filterMode === 'ALL') {
          return teacherSubjects.length === 0 || teacherSubjects.indexOf(n.Subject) !== -1;
        }
        return n.Subject === filterMode;
      });

      const commitmentPct = totalActions > 0 ? Math.round((positiveActions / totalActions) * 100) : 100;
      return {
        oral: oral,
        homework: homework,
        participation: participation,
        negative: negative,
        positiveActions: positiveActions,
        totalActions: totalActions,
        commitmentPct: commitmentPct,
        netPoints: netPoints,
        notes: notes
      };
    }

    function openStudentModal(studentId) {
      const student = db.Students.find(function(s) { return s.StudentID === studentId; });
      if (!student) return;
      activeModalStudentId = studentId;
      triggerMobileFeedback('longpress');

      const stats = computeStudentStats(studentId, 'TEACHER_ALL');
      document.getElementById('modalStdRoll').textContent = formatNum(student.RollNumber);
      document.getElementById('modalStdName').textContent = student.StudentName;
      document.getElementById('modalStdId').textContent = student.StudentID;
      document.getElementById('modalStdGradeSec').textContent = 'الصف ' + student.Grade + ' - شعبة ' + student.Section + ' (' + getTeacherAllowedSubjects().join('، ') + ')';
      document.getElementById('modalCurrentPeriodLbl').textContent = formatNum(currentPeriod);

      const pts = Number(stats.netPoints) || 0;
      const ptsEl = document.getElementById('modalStdPoints');
      ptsEl.textContent = formatNum(pts, true);
      ptsEl.className = 'text-2xl font-black ' + (pts >= 0 ? 'text-emerald-600' : 'text-rose-600');

      const attBtn = document.getElementById('modalAttendanceBtn');
      if (student.AttendanceToday === 'غائب') {
        attBtn.textContent = '🚫 غائب (انقر للتحويل إلى حاضر)';
        attBtn.className = 'w-full py-2 px-3 rounded-xl font-black text-xs bg-rose-600 text-white shadow transition';
      } else {
        attBtn.textContent = '🟢 حاضر (انقر لتسجيل غياب)';
        attBtn.className = 'w-full py-2 px-3 rounded-xl font-black text-xs bg-emerald-600 text-white shadow transition';
      }

      document.getElementById('modalStatOral').textContent = formatNum(stats.oral);
      document.getElementById('modalStatHw').textContent = formatNum(stats.homework);
      document.getElementById('modalStatPart').textContent = formatNum(stats.participation);
      document.getElementById('modalStatNeg').textContent = formatNum(stats.negative);

      const modalEvalBar = document.getElementById('modalQuickEvalBtns');
      if (modalEvalBar) {
        modalEvalBar.innerHTML = '';
        getEvalRules().forEach(function(rule) {
          const d = Number(rule.PointsValue) || 0;
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'min-h-[42px] py-1.5 px-2 rounded-xl font-extrabold text-[11px] border flex items-center justify-between transition ' +
            (d >= 0
              ? 'bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-600 hover:text-white text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
              : 'bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-600 hover:text-white text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-700');
          b.innerHTML = '<span>' + escapeHtml(rule.Icon) + ' ' + escapeHtml(rule.Label) + '</span><span class="font-mono font-black" dir="ltr">' + formatNum(d, true) + '</span>';
          b.onclick = function() {
            applyPointsToStudent(student.StudentID, {
              Label: rule.Label,
              PointsValue: d,
              ActionCategory: getRuleActionCategory(rule)
            });
            openStudentModal(student.StudentID);
          };
          modalEvalBar.appendChild(b);
        });
      }

      const chipsContainer = document.getElementById('modalQuickNoteChips');
      chipsContainer.innerHTML = '';
      const quickNotes = db.School_Setup.filter(function(item) { return item.Category === 'quick_note'; });
      quickNotes.forEach(function(qn) {
        const isPos = qn.Type === 'positive';
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'min-h-[38px] px-2.5 py-1 rounded-xl text-[11px] font-bold border transition flex items-center gap-1 ' +
          (isPos
            ? 'bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-600 hover:text-white text-emerald-800 dark:text-emerald-200 border-emerald-300'
            : 'bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-600 hover:text-white text-rose-800 dark:text-rose-200 border-rose-300');
        chip.innerHTML = '<span>' + escapeHtml(qn.Icon || '📝') + '</span><span>' + escapeHtml(qn.Label) + '</span>';
        chip.onclick = function() {
          recordStudentNote(student.StudentID, isPos ? 'إيجابية' : 'تنبيه', qn.Label);
        };
        chipsContainer.appendChild(chip);
      });

      renderModalStudentNotesList(student.StudentID);

      openModalDialog('studentModal');
    }

    function closeStudentModal() {
      closeModalDialog('studentModal');
      activeModalStudentId = null;
    }

    function toggleModalStudentAttendance() {
      if (!activeModalStudentId) return;
      const student = db.Students.find(function(s) { return s.StudentID === activeModalStudentId; });
      if (!student) return;

      student.AttendanceToday = student.AttendanceToday === 'غائب' ? 'حاضر' : 'غائب';
      const attRecord = {
        RecordID: 'ATT-' + Date.now(),
        Date: getFormattedDateOnly(),
        Period: currentPeriod,
        Grade: student.Grade,
        Section: student.Section,
        StudentID: student.StudentID,
        Status: student.AttendanceToday,
        TeacherID: currentTeacher ? currentTeacher.TeacherID : 'TCH-01',
        Subject: currentSubject || 'عام'
      };
      db.Attendance_Log.push(attRecord);
      saveStateToStorage();
      enqueueSyncOperation({ opType: 'logAttendance', ...attRecord });

      openStudentModal(activeModalStudentId);
      updateSingleStudentCardDOM(student.StudentID);
      showToast('تم تحديث حضور الطالب ' + student.StudentName + ' إلى: ' + student.AttendanceToday, 'info');
    }

    function recordStudentNote(studentId, noteType, noteText) {
      const student = db.Students.find(function(s) { return s.StudentID === studentId; });
      if (!student || !noteText.trim()) return;

      const noteObj = {
        NoteID: 'NTE-' + Date.now(),
        Timestamp: getFormattedTimestamp(),
        StudentID: student.StudentID,
        TeacherID: currentTeacher ? currentTeacher.TeacherID : 'TCH-01',
        Subject: currentSubject || 'عام',
        Grade: student.Grade,
        Section: student.Section,
        NoteType: noteType,
        NoteText: noteText.trim()
      };

      db.Notes_Log.unshift(noteObj);
      saveStateToStorage();
      enqueueSyncOperation({ opType: 'addNote', ...noteObj });
      renderModalStudentNotesList(studentId);
      showToast('📝 تم تسجيل الملاحظة: ' + noteText, 'success');
    }

    function saveCustomStudentNote() {
      if (!activeModalStudentId) return;
      const input = document.getElementById('modalCustomNoteInput');
      const noteType = document.getElementById('modalCustomNoteType').value;
      if (!input.value.trim()) {
        showToast('يرجى كتابة نص الملاحظة أولاً', 'warning');
        return;
      }
      recordStudentNote(activeModalStudentId, noteType, input.value.trim());
      input.value = '';
    }

    function renderModalStudentNotesList(studentId) {
      const listEl = document.getElementById('modalStudentNotesList');
      const allowedSubs = getTeacherAllowedSubjects();
      const notes = db.Notes_Log.filter(function(n) {
        if (n.StudentID !== studentId) return false;
        return allowedSubs.length === 0 || allowedSubs.indexOf(n.Subject) !== -1;
      });
      if (notes.length === 0) {
        listEl.innerHTML = '<div class="text-slate-400 text-center py-2">لا توجد ملاحظات مسجلة لهذا الطالب حتى الآن.</div>';
        return;
      }
      listEl.innerHTML = notes.map(function(n) {
        const badgeCls = n.NoteType === 'إيجابية'
          ? 'bg-emerald-100 text-emerald-800'
          : 'bg-rose-100 text-rose-800';
        return '<div class="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-2">' +
          '<div>' +
            '<span class="px-1.5 py-0.5 rounded text-[11px] font-bold ml-1.5 ' + badgeCls + '">' + escapeHtml(n.NoteType) + '</span>' +
            '<span class="font-bold">' + escapeHtml(n.NoteText) + '</span>' +
            '<div class="text-[11px] text-slate-400 mt-0.5">المادة: ' + escapeHtml(n.Subject) + ' | ' + escapeHtml(n.Timestamp) + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    function buildParentReportMessage(studentId) {
      const student = db.Students.find(function(s) { return s.StudentID === studentId; });
      if (!student) return '';
      const stats = computeStudentStats(studentId, 'TEACHER_ALL');
      const schoolName = appSettings.schoolName || (db.School_Setup[0] && db.School_Setup[0].Label) || 'المدرسة';
      const latestNotes = stats.notes.slice(0, 3).map(function(n) {
        return '• (' + n.NoteType + ' - ' + n.Subject + '): ' + n.NoteText;
      }).join('\n') || '• لا توجد ملاحظات مسجلة.';

      return '🏫 *' + schoolName + '*\n' +
             '📄 *تقرير المتابعة التربوية والأكاديمية للطالب*\n' +
             '━━━━━━━━━━━━━━━\n' +
             '👤 *الطالب:* ' + student.StudentName + '\n' +
             '🆔 *المعرف:* ' + student.StudentID + '\n' +
             '🏛️ *الصف والشعبة:* ' + student.Grade + ' (' + student.Section + ')\n' +
             '📅 *الحضور اليوم:* ' + student.AttendanceToday + '\n' +
             '━━━━━━━━━━━━━━━\n' +
             '⭐ *الرصيد في المواد:* ' + formatNum(stats.netPoints, true) + ' نقطة\n' +
             '🎙️ *مرات التسميع الشفهي:* ' + formatNum(stats.oral) + '\n' +
             '📘 *الواجبات المنجزة:* ' + formatNum(stats.homework) + '\n' +
             '✋ *المشاركات الصفية:* ' + formatNum(stats.participation) + '\n' +
             '📊 *نسبة الالتزام العام:* ' + formatNum(stats.commitmentPct) + '%\n' +
             '━━━━━━━━━━━━━━━\n' +
             '📝 *أحدث الملاحظات المسجلة:*\n' + latestNotes + '\n' +
             '━━━━━━━━━━━━━━━\n' +
             'مع تحيات إدارة المدرسة والمعلم: ' + (currentTeacher ? currentTeacher.TeacherName : '');
    }

    function sendParentWhatsAppReport(customStudentId) {
      const sid = customStudentId || activeModalStudentId;
      if (!sid) return;
      const student = db.Students.find(function(s) { return s.StudentID === sid; });
      if (!student) return;
      const msg = buildParentReportMessage(sid);
      const cleanPhone = String(student.ParentPhone || '').replace(/[^0-9]/g, '');
      const waUrl = 'https://wa.me/' + cleanPhone + '?text=' + encodeURIComponent(msg);
      window.open(waUrl, '_blank', 'noopener,noreferrer');
      showToast('💬 تم فتح رسالة واتساب لولي أمر الطالب ' + student.StudentName, 'success');
    }

    function copyParentReportText(customStudentId) {
      const sid = customStudentId || activeModalStudentId;
      if (!sid) return;
      const msg = buildParentReportMessage(sid);
      copyTextSafe(msg);
      showToast('📋 تم نسخ تقرير ولي الأمر إلى الحافظة بنجاح', 'success');
    }

    function copyTextSafe(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function() { fallbackCopyText(text); });
      } else {
        fallbackCopyText(text);
      }
    }

    function fallbackCopyText(text) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
    }

