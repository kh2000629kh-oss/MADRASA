/**
 * الوحدة البرمجية: js/grid-view.js
 * الوصف: بناء وتحديث شبكة بطاقات الرصد السريع وكبسولات التقييم
 */
    function toggleExpandedGridView() {
      expandedGridView = !expandedGridView;
      const topHeader = document.getElementById('mainTopHeader');
      const viewGridEl = document.getElementById('viewGrid');
      const subInfoRow = document.getElementById('gridSubInfoRow');
      const expandBtn = document.getElementById('expandGridViewBtn');
      const gm = document.getElementById('gridMoreMenu');
      if (gm) gm.classList.add('hidden');

      if (expandedGridView) {
        if (topHeader) topHeader.classList.add('hidden');
        if (subInfoRow) subInfoRow.classList.add('hidden');
        if (viewGridEl) {
          viewGridEl.classList.remove('max-w-7xl');
          viewGridEl.classList.add('max-w-full');
        }
        if (expandBtn) expandBtn.textContent = '✕ إنهاء توسعة الرصد';
        showToast('⛶ تم توسعة واجهة الرصد لملء الشاشة', 'info');
      } else {
        if (topHeader) topHeader.classList.remove('hidden');
        if (subInfoRow) subInfoRow.classList.remove('hidden');
        if (viewGridEl) {
          viewGridEl.classList.add('max-w-7xl');
          viewGridEl.classList.remove('max-w-full');
        }
        if (expandBtn) expandBtn.textContent = '⛶ توسعة واجهة الرصد';
      }
      renderStudentGrid();
    }

    function toggleSelectAllClass() {
      const sectionStudents = db.Students.filter(function(st) {
        return String(st.Section) === String(currentSection);
      });
      if (selectedStudentIds.length === sectionStudents.length && sectionStudents.length > 0) {
        selectedStudentIds = [];
        showToast('تم إلغاء تحديد الصف', 'info');
      } else {
        selectedStudentIds = sectionStudents.map(function(st) { return st.StudentID; });
        showToast('☑️ تم تحديد كل الصف (' + formatNum(selectedStudentIds.length) + ' طالب)', 'success');
      }
      triggerMobileFeedback('tap');
      updateBatchSelectionUI();
      renderStudentGrid();
    }

    function updateBatchSelectionUI() {
      const selBtn = document.getElementById('selectAllClassBtn');
      const applyBtn = document.getElementById('applyBatchClassBtn');
      const countLbl = document.getElementById('selectedClassCountLbl');
      if (countLbl) countLbl.textContent = formatNum(selectedStudentIds.length);

      if (selectedStudentIds.length > 0) {
        if (selBtn) selBtn.textContent = '✕ إلغاء تحديد (' + formatNum(selectedStudentIds.length) + ')';
        if (applyBtn) applyBtn.classList.remove('hidden');
      } else {
        if (selBtn) selBtn.textContent = '☑️ تحديد كل الصف';
        if (applyBtn) applyBtn.classList.add('hidden');
      }
    }

    function applyEvalToSelectedClass(optionalRule) {
      if (selectedStudentIds.length === 0) return;
      const rules = getEvalRules();
      const activeRule = optionalRule || rules.find(function(r) { return r.ItemID === selectedEvalRuleId; }) || rules[0];
      if (!activeRule) return;

      const delta = Number(activeRule.PointsValue) || 1;
      const cat = getRuleActionCategory(activeRule);
      const nowStr = getFormattedTimestamp();
      const todayPrefix = getFormattedDateOnly();
      const batchLogs = [];
      const targetIds = selectedStudentIds.slice();

      targetIds.forEach(function(sid, idx) {
        const student = db.Students.find(function(s) { return s.StudentID === sid; });
        if (!student) return;
        const logEntry = {
          LogID: 'LOG-' + Date.now() + '-' + idx + '-' + Math.floor(Math.random() * 100),
          Timestamp: nowStr,
          StudentID: student.StudentID,
          TeacherID: currentTeacher ? currentTeacher.TeacherID : 'TCH-01',
          Subject: currentSubject || 'عام',
          Grade: student.Grade,
          Section: student.Section,
          ActionCategory: cat,
          ActionLabel: activeRule.Label + ' (جماعي)',
          PointsDelta: delta
        };
        db.Points_Log.push(logEntry);
        indexSinglePointLogInCache(logEntry, todayPrefix);
        student.TotalPoints = studentTotalsCache[student.StudentID] || 0;
        batchLogs.push(logEntry);
        enqueueSyncOperation({ opType: 'addPointLog', ...logEntry });
      });

      lastBatchLogIds = batchLogs.map(function(l) { return l.LogID; });
      lastPointAction = batchLogs[batchLogs.length - 1] || null;
      selectedStudentIds = [];
      updateBatchSelectionUI();

      triggerMobileFeedback(delta >= 0 ? 'positive' : 'negative');
      saveStateToStorage();

      const undoBtn = document.getElementById('undoActionBtn');
      if (undoBtn) undoBtn.disabled = false;
      const ticker = document.getElementById('lastActionTicker');
      if (ticker) {
        ticker.textContent = 'رصد جماعي: ' + formatNum(targetIds.length) + ' طالب (' + formatNum(delta, true) + ' ' + activeRule.Label + ')';
      }

      renderStudentGrid();
      showToast('⚡ تم رصد (' + activeRule.Label + ') لـ ' + formatNum(targetIds.length) + ' طالباً', delta >= 0 ? 'success' : 'danger', undoLastPointAction);
    }

    // 12. شريط كبسولات التقييم وشبكة أزرار الطلاب عالية الأداء
    function getEvalRules() {
      return db.School_Setup.filter(function(item) {
        return item.Category === 'eval_rule';
      });
    }

    function getRuleActionCategory(rule) {
      if (rule.ActionCategory) return rule.ActionCategory;
      const lbl = String(rule.Label || '');
      if (lbl.includes('شفهي')) return 'oral';
      if (lbl.includes('واجب')) return 'homework';
      if (lbl.includes('مشاركة')) return 'participation';
      if (lbl.includes('تميز')) return 'bonus';
      return 'behavior';
    }

    function renderEvalRulesBar() {
      const bar = document.getElementById('evalRulesBar');
      const rules = getEvalRules();
      bar.innerHTML = '';

      rules.forEach(function(rule) {
        const isSelected = rule.ItemID === selectedEvalRuleId;
        const delta = Number(rule.PointsValue) || 0;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.onclick = function() {
          selectedEvalRuleId = rule.ItemID;
          renderEvalRulesBar();
          if (selectedStudentIds.length > 0) {
            applyEvalToSelectedClass(rule);
          }
        };

        let styleCls = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700';
        if (isSelected) {
          styleCls = delta >= 0
            ? 'bg-emerald-600 text-white border-emerald-700 shadow-md scale-[1.02]'
            : 'bg-rose-600 text-white border-rose-700 shadow-md scale-[1.02]';
        }

        btn.className = 'min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-extrabold whitespace-nowrap flex items-center gap-1.5 transition ' + styleCls;
        btn.innerHTML = '<span>' + escapeHtml(rule.Icon || '⭐') + '</span>' +
                        '<span>' + escapeHtml(rule.Label) + '</span>' +
                        '<span class="px-1.5 py-0.2 rounded-md text-[11px] bg-black/15 font-mono" dir="ltr">' + formatNum(delta, true) + '</span>';
        bar.appendChild(btn);
      });

      const activeRule = rules.find(function(r) { return r.ItemID === selectedEvalRuleId; }) || rules[0];
      if (activeRule) {
        const d = Number(activeRule.PointsValue) || 0;
        const ind = document.getElementById('activeRuleIndicator');
        ind.textContent = 'النشاط المحدد: ' + (activeRule.Icon || '') + ' ' + activeRule.Label + ' (' + formatNum(d, true) + ')';
      }
    }

    function shortenStudentName(fullName) {
      const raw = String(fullName || '').trim();
      const parts = raw.split(/\s+/);
      if (parts.length <= 2) return raw;

      const prefixes = ['عبد', 'أبو', 'ابو', 'ابن', 'بنت', 'آل'];
      const suffixes = ['الدين', 'الله', 'الإسلام', 'الاسلام', 'بالله', 'الحق'];

      let firstChunk = parts[0];
      let usedIdx = 1;

      if (prefixes.indexOf(parts[0]) !== -1 && parts.length >= 2) {
        firstChunk = parts[0] + ' ' + parts[1];
        usedIdx = 2;
      } else if (parts.length >= 2 && suffixes.indexOf(parts[1]) !== -1) {
        firstChunk = parts[0] + ' ' + parts[1];
        usedIdx = 2;
      } else if ((parts[0] === 'محمد' || parts[0] === 'أحمد' || parts[0] === 'احمد') && parts.length >= 3) {
        // تمييز الطلاب المشتركين باسم محمد أو أحمد عبر إظهار الاسم الثاني مع الكنية
        firstChunk = parts[0] + ' ' + parts[1];
        usedIdx = 2;
      }

      let lastChunk = parts[parts.length - 1];
      if (parts.length - 1 > usedIdx && (prefixes.indexOf(parts[parts.length - 2]) !== -1 || parts[parts.length - 2] === 'دالي' || parts[parts.length - 2] === 'الحاج' || parts[parts.length - 2] === 'شيخ')) {
        lastChunk = parts[parts.length - 2] + ' ' + parts[parts.length - 1];
      }

      if (usedIdx >= parts.length) return raw;
      return firstChunk + ' ' + lastChunk;
    }

    function toggleGridDensityMode() {
      if (gridDensityMode === 'standard') gridDensityMode = 'compact';
      else if (gridDensityMode === 'compact') gridDensityMode = 'comfortable';
      else gridDensityMode = 'standard';

      const btn = document.getElementById('toggleDensityBtn');
      const quickBtn = document.getElementById('quickColsBtn');
      if (gridDensityMode === 'compact') {
        if (btn) btn.textContent = '📱 عرض مكثف (5 أعمدة)';
        if (quickBtn) quickBtn.textContent = '⊞ 5 أعمدة';
      } else if (gridDensityMode === 'comfortable') {
        if (btn) btn.textContent = '🔲 عرض كبير (3 أعمدة)';
        if (quickBtn) quickBtn.textContent = '⊞ 3 أعمدة';
      } else {
        if (btn) btn.textContent = '📱 عرض متوازن (4 أعمدة)';
        if (quickBtn) quickBtn.textContent = '⊞ 4 أعمدة';
      }
      const gm = document.getElementById('gridMoreMenu');
      if (gm) gm.classList.add('hidden');
      renderStudentGrid();
    }

    function toggleUnrecordedTodayFilter() {
      filterUnrecordedToday = !filterUnrecordedToday;
      const btn = document.getElementById('filterUnrecordedBtn');
      if (btn) {
        btn.className = filterUnrecordedToday
          ? 'shrink-0 text-[11px] font-black px-2 py-1.5 rounded-xl bg-amber-500 text-slate-950 border border-amber-600 shadow'
          : 'shrink-0 text-[11px] font-bold px-2 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700';
      }
      renderStudentGrid();
    }

    function onGridSortChange() {
      gridSortMode = document.getElementById('gridSortSelect').value || 'roll';
      renderStudentGrid();
    }

    // بناء HTML بطاقة طالب واحدة (اسم واضح من سطرين ورقم تسلسلي بارز بالوسط)
    function buildStudentCardInnerHtml(student, isCompact) {
      const stStats = computeStudentStats(student.StudentID, currentSubject || 'TEACHER_ALL');
      const pts = stStats.netPoints;
      const isAbsent = student.AttendanceToday === 'غائب';
      const isSelected = selectedStudentIds.indexOf(student.StudentID) !== -1;
      const shortName = shortenStudentName(student.StudentName);

      let ptsBadgeClass = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300';
      if (pts > 0) ptsBadgeClass = 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700';
      if (pts < 0) ptsBadgeClass = 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700';

      return (isAbsent ? '<div class="absent-pattern-bar w-full h-1 rounded-t-lg mb-0.5" title="طالب غائب"></div>' : '') +
        '<div class="w-full flex items-center justify-between leading-none">' +
          '<span class="text-[10px] sm:text-[11px] font-black px-1.5 py-0.5 rounded-md font-mono ' + ptsBadgeClass + '" dir="ltr">' + formatNum(pts, true) + '</span>' +
          '<div class="flex items-center gap-0.5">' +
            (isSelected ? '<span class="text-xs font-black text-blue-600">✓</span>' : '') +
            (isAbsent
              ? '<span class="text-[9px] font-black bg-rose-600 text-white px-1 rounded" aria-label="غائب">غائب</span>'
              : '<span class="w-2 h-2 rounded-full bg-emerald-500" title="حاضر" aria-label="حاضر"></span>') +
          '</div>' +
        '</div>' +
        '<div class="' + (isCompact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl') + ' font-black text-slate-900 dark:text-white leading-none tracking-tight my-0.5 text-center">' + formatNum(student.RollNumber) + '</div>' +
        '<div class="student-card-name text-[10px] sm:text-xs font-extrabold text-slate-700 dark:text-slate-200 text-center w-full px-0.5">' + escapeHtml(shortName) + '</div>';
    }

    function getStudentCardClassName(student, isCompact) {
      const stStats = computeStudentStats(student.StudentID, currentSubject || 'TEACHER_ALL');
      const pts = stStats.netPoints;
      const isAbsent = student.AttendanceToday === 'غائب';
      const isSelected = selectedStudentIds.indexOf(student.StudentID) !== -1;

      let borderCls = 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900';
      if (isSelected) {
        borderCls = 'bg-blue-50 dark:bg-blue-950/50 border-blue-600 ring-2 ring-blue-500/50';
      } else if (isAbsent) {
        borderCls = 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-400 border-dashed opacity-80';
      } else if (pts > 0) {
        borderCls = 'bg-white dark:bg-slate-900 border-emerald-400 dark:border-emerald-600 border-2';
      } else if (pts < 0) {
        borderCls = 'bg-white dark:bg-slate-900 border-rose-400 dark:border-rose-600 border-2';
      }

      return 'student-card-btn relative border flex flex-col items-center justify-between cursor-pointer shadow-sm ' +
        (isCompact ? 'rounded-xl p-1 min-h-[72px] ' : 'rounded-2xl p-1.5 sm:p-2 min-h-[82px] ') + borderCls;
    }

    // تحديث بطاقة طالب واحدة فقط في DOM دون إعادة بناء الشبكة كلها
    function updateSingleStudentCardDOM(studentId) {
      const student = db.Students.find(function(s) { return s.StudentID === studentId; });
      if (!student) return;
      const cardEl = document.getElementById('stdCard_' + studentId);
      if (!cardEl) {
        renderStudentGrid();
        return;
      }
      const isCompact = gridDensityMode === 'compact';
      cardEl.className = getStudentCardClassName(student, isCompact);
      cardEl.innerHTML = buildStudentCardInnerHtml(student, isCompact);
      updateFooterStatus();
    }

    function renderStudentGrid() {
      updateCollapsedHeaderSummary();
      const grid = document.getElementById('studentsQuickGrid');
      const searchQ = (document.getElementById('quickGridSearch').value || '').trim().toLowerCase();

      const allowedSecs = getTeacherAllowedSections();
      if (allowedSecs.length > 0 && allowedSecs.indexOf(currentSection) === -1) {
        currentSection = allowedSecs[0];
      }

      const sectionStudents = db.Students
        .filter(function(st) {
          if (String(st.Section) !== String(currentSection)) return false;
          if (filterUnrecordedToday && recordedTodaySet.has(st.StudentID)) return false;
          if (!searchQ) return true;
          return String(st.StudentName).toLowerCase().includes(searchQ) ||
                 String(st.RollNumber).includes(searchQ) ||
                 String(st.StudentID).toLowerCase().includes(searchQ);
        })
        .sort(function(a, b) {
          if (gridSortMode === 'points_desc') {
            return computeStudentStats(b.StudentID, currentSubject || 'TEACHER_ALL').netPoints -
                   computeStudentStats(a.StudentID, currentSubject || 'TEACHER_ALL').netPoints;
          }
          if (gridSortMode === 'points_asc') {
            return computeStudentStats(a.StudentID, currentSubject || 'TEACHER_ALL').netPoints -
                   computeStudentStats(b.StudentID, currentSubject || 'TEACHER_ALL').netPoints;
          }
          if (gridSortMode === 'least_part') {
            return computeStudentStats(a.StudentID, currentSubject || 'TEACHER_ALL').participation -
                   computeStudentStats(b.StudentID, currentSubject || 'TEACHER_ALL').participation;
          }
          return (Number(a.RollNumber) || 0) - (Number(b.RollNumber) || 0);
        });

      document.getElementById('gridSectionTitle').textContent =
        '📍 ' + currentSection + ' (' + formatNum(sectionStudents.length) + ')';

      const isCompact = gridDensityMode === 'compact';
      if (gridDensityMode === 'compact') {
        grid.className = 'grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1 sm:gap-1.5 select-none';
      } else if (gridDensityMode === 'comfortable') {
        grid.className = 'grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 select-none';
      } else {
        grid.className = 'grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-9 gap-1.5 select-none';
      }

      const frag = document.createDocumentFragment();
      sectionStudents.forEach(function(student) {
        const card = document.createElement('div');
        card.id = 'stdCard_' + student.StudentID;
        card.setAttribute('data-student-id', student.StudentID);
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', 'الطالب ' + student.StudentName + ' رقم ' + student.RollNumber);
        card.className = getStudentCardClassName(student, isCompact);
        card.innerHTML = buildStudentCardInnerHtml(student, isCompact);
        frag.appendChild(card);
      });

      grid.innerHTML = '';
      grid.appendChild(frag);
      updateFooterStatus();
    }

