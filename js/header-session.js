/**
 * الوحدة البرمجية: js/grid-view.js
 * الوصف: تهيئة جلسة المعلم، مبدّل الشعبة والمادة، وبناء شبكة بطاقات الرصد السريع
 * المنظومة: منظومة النقاط والإدارة المدرسية الشاملة — ثانوية الصحابة الشرعية
 */
    // 9. تهيئة جلسة المعلم والترويسة الذكية
    function initializeTeacherSession() {
      document.getElementById('activeTeacherName').textContent = currentTeacher.TeacherName;
      const isAdmin = currentTeacher.Role === 'admin';
      const isSupervisor = currentTeacher.Role === 'supervisor';
      const roleBadge = document.getElementById('activeRoleBadge');
      const navAdminBtn = document.getElementById('navBtnAdmin');

      if (isAdmin) {
        roleBadge.textContent = 'مدير النظام';
        roleBadge.className = 'text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 font-bold shrink-0';
        navAdminBtn.classList.remove('hidden');
      } else if (isSupervisor) {
        roleBadge.textContent = 'مشرف تربوي';
        roleBadge.className = 'text-[11px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30 font-bold shrink-0';
        navAdminBtn.classList.add('hidden');
      } else {
        roleBadge.textContent = 'معلم المادة';
        roleBadge.className = 'text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 font-bold shrink-0';
        navAdminBtn.classList.add('hidden');
      }

      const allowedGrades = getTeacherAllowedGrades();
      const gradeSelect = document.getElementById('headerGradeSelect');
      gradeSelect.innerHTML = '';
      if (allowedGrades.length > 1) {
        const allGOpt = document.createElement('option');
        allGOpt.value = 'ALL';
        allGOpt.className = 'bg-slate-900 text-white';
        allGOpt.textContent = 'كل صفوفي (' + formatNum(allowedGrades.length) + ')';
        gradeSelect.appendChild(allGOpt);
      }
      allowedGrades.forEach(function(gName) {
        const opt = document.createElement('option');
        opt.value = gName;
        opt.className = 'bg-slate-900 text-white';
        opt.textContent = 'الصف ' + gName;
        gradeSelect.appendChild(opt);
      });
      currentGradeFilter = allowedGrades.length === 1 ? allowedGrades[0] : 'ALL';
      gradeSelect.value = currentGradeFilter;

      populateHeaderSectionsForTeacher();

      const subjects = getTeacherAllowedSubjects();
      const multiWrapper = document.getElementById('multiSubjectWrapper');
      const singleBadge = document.getElementById('singleSubjectBadge');
      const subSelect = document.getElementById('headerSubjectSelect');

      if (subjects.length === 1) {
        currentSubject = subjects[0];
        multiWrapper.classList.add('hidden');
        singleBadge.classList.remove('hidden');
        singleBadge.textContent = '📘 ' + currentSubject;
      } else {
        multiWrapper.classList.remove('hidden');
        singleBadge.classList.add('hidden');
        subSelect.innerHTML = '';
        subjects.forEach(function(sub) {
          const opt = document.createElement('option');
          opt.value = sub;
          opt.className = 'bg-slate-900 text-white';
          opt.textContent = sub;
          subSelect.appendChild(opt);
        });
        currentSubject = subjects[0] || 'عام';
        subSelect.value = currentSubject;
      }

      checkOnboardingFirstTime();
      renderEvalRulesBar();
      switchMainView('grid');
      updateFooterStatus();
    }

    function checkOnboardingFirstTime() {
      try {
        const seen = localStorage.getItem('school_points_onboarding_seen_v3');
        const banner = document.getElementById('onboardingBanner');
        if (!seen && banner) {
          banner.classList.remove('hidden');
        }
      } catch (e) {}
    }

    function openOnboardingGuide(forceShow) {
      const banner = document.getElementById('onboardingBanner');
      if (banner && forceShow) banner.classList.remove('hidden');
      const hm = document.getElementById('headerOverflowMenu');
      if (hm) hm.classList.add('hidden');
      const gm = document.getElementById('gridMoreMenu');
      if (gm) gm.classList.add('hidden');
    }

    function dismissOnboardingBanner() {
      const banner = document.getElementById('onboardingBanner');
      if (banner) banner.classList.add('hidden');
      try { localStorage.setItem('school_points_onboarding_seen_v3', '1'); } catch (e) {}
    }

    const DEFAULT_ARABIC_GRADES_MAP = {
      '1': 'الأول', '2': 'الثاني', '3': 'الثالث', '4': 'الرابع',
      '5': 'الخامس', '6': 'السادس', '7': 'السابع', '8': 'الثامن',
      '9': 'التاسع', '10': 'العاشر', '11': 'الحادي عشر', '12': 'البكالوريا'
    };

    function getAllGrades() {
      const map = {};
      // 1. من جدول الإعدادات School_Setup
      (db.School_Setup || []).forEach(function(item) {
        if (item.Category === 'grade' && item.Label) {
          const code = String(item.Type || item.PointsValue || item.Label).trim();
          map[code] = { code: code, name: String(item.Label).trim(), itemId: item.ItemID };
        }
      });
      // 2. التأكد من وجود السابع والثامن والتاسع افتراضياً إن لم يكن هناك أي صف
      if (Object.keys(map).length === 0) {
        map['7'] = { code: '7', name: 'السابع', itemId: 'GRD-07' };
        map['8'] = { code: '8', name: 'الثامن', itemId: 'GRD-08' };
        map['9'] = { code: '9', name: 'التاسع', itemId: 'GRD-09' };
      }
      // 3. استنتاج أي صف إضافي من الشعب الحالية
      (db.Students || []).forEach(function(st) {
        if (st.Section) {
          const p = String(st.Section).split('_')[0];
          if (p && !map[p]) {
            map[p] = { code: p, name: st.Grade || DEFAULT_ARABIC_GRADES_MAP[p] || p, itemId: 'GRD-' + p };
          }
        }
      });
      return Object.keys(map).sort(function(a, b) {
        return ( parseInt(a, 10) || 99 ) - ( parseInt(b, 10) || 99 );
      }).map(function(k) { return map[k]; });
    }

    function getGradeFromSection(secCode) {
      const prefix = String(secCode || '').split('_')[0];
      const found = (db.School_Setup || []).find(function(item) {
        return item.Category === 'grade' && (String(item.Type) === prefix || String(item.PointsValue) === prefix);
      });
      if (found && found.Label) return found.Label;
      if (DEFAULT_ARABIC_GRADES_MAP[prefix]) return DEFAULT_ARABIC_GRADES_MAP[prefix];
      return prefix || 'العام';
    }

    function formatSectionArabicLabel(secCode) {
      const parts = String(secCode).split('_');
      const gName = getGradeFromSection(secCode);
      return 'الصف ' + gName + ' / شعبة ' + (parts[1] || '1') + ' (' + secCode + ')';
    }

    function populateHeaderSectionsForTeacher() {
      const assignedSecs = getTeacherAllowedSections().filter(function(sec) {
        if (currentGradeFilter === 'ALL') return true;
        return getGradeFromSection(sec) === currentGradeFilter;
      });
      const secSelect = document.getElementById('headerSectionSelect');
      secSelect.innerHTML = '';
      assignedSecs.forEach(function(sec) {
        const opt = document.createElement('option');
        opt.value = sec;
        opt.className = 'bg-slate-900 text-white';
        opt.textContent = formatSectionArabicLabel(sec);
        secSelect.appendChild(opt);
      });
      if (assignedSecs.indexOf(currentSection) === -1 && assignedSecs.length > 0) {
        currentSection = assignedSecs[0];
      }
      secSelect.value = currentSection;
      updateCollapsedHeaderSummary();
    }

    function onHeaderGradeChange() {
      currentGradeFilter = document.getElementById('headerGradeSelect').value || 'ALL';
      populateHeaderSectionsForTeacher();
      renderStudentGrid();
      updateFooterStatus();
    }

    function onHeaderSectionChange() {
      currentSection = document.getElementById('headerSectionSelect').value;
      selectedStudentIds = [];
      updateBatchSelectionUI();
      renderStudentGrid();
      updateFooterStatus();
    }

    function onHeaderSubjectChange() {
      currentSubject = document.getElementById('headerSubjectSelect').value;
      updateCollapsedHeaderSummary();
      renderStudentGrid();
      showToast('تم تحديد المادة: ' + currentSubject, 'info');
    }

    function updateCollapsedHeaderSummary() {
      const txt = document.getElementById('collapsedHeaderText');
      if (txt) {
        txt.textContent = '📍 ' + currentSection + ' (' + getGradeFromSection(currentSection) + ')' + (currentSubject ? ' • ' + currentSubject : '');
      }
    }

    function toggleMobileFocusMode() {
      mobileFocusMode = !mobileFocusMode;
      const controlsGrid = document.getElementById('headerControlsGrid');
      const focusBtn = document.getElementById('focusModeToggleBtn');
      if (controlsGrid) {
        if (mobileFocusMode) {
          controlsGrid.classList.remove('hidden');
          controlsGrid.classList.add('grid');
          if (focusBtn) focusBtn.textContent = '▴ إخفاء محددات الترويسة';
        } else {
          controlsGrid.classList.add('hidden');
          controlsGrid.classList.remove('grid');
          if (focusBtn) focusBtn.textContent = '↕️ طي الترويسة';
        }
      }
      const hm = document.getElementById('headerOverflowMenu');
      if (hm) hm.classList.add('hidden');
    }

    // Bottom Sheet لتغيير الشعبة والمادة بيد واحدة
    function openContextSwitcherSheet() {
      const sheet = document.getElementById('contextSwitcherSheet');
      const secContainer = document.getElementById('sheetSectionButtons');
      const subWrapper = document.getElementById('sheetSubjectWrapper');
      const subContainer = document.getElementById('sheetSubjectButtons');

      const allowedSecs = getTeacherAllowedSections();
      secContainer.innerHTML = allowedSecs.map(function(sec) {
        const active = sec === currentSection;
        return '<button type="button" onclick="selectSectionFromSheet(\'' + escapeJsAttr(sec) + '\')" class="min-h-[44px] px-3 py-2 rounded-xl font-extrabold border transition ' +
          (active ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700') + '">' +
          escapeHtml(formatSectionArabicLabel(sec)) + '</button>';
      }).join('');

      const subjects = getTeacherAllowedSubjects();
      if (subjects.length <= 1) {
        subWrapper.classList.add('hidden');
      } else {
        subWrapper.classList.remove('hidden');
        subContainer.innerHTML = subjects.map(function(sub) {
          const active = sub === currentSubject;
          return '<button type="button" onclick="selectSubjectFromSheet(\'' + escapeJsAttr(sub) + '\')" class="min-h-[44px] px-3 py-2 rounded-xl font-extrabold border transition ' +
            (active ? 'bg-teal-600 text-white border-teal-600 shadow' : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700') + '">' +
            escapeHtml(sub) + '</button>';
        }).join('');
      }

      openModalDialog('contextSwitcherSheet');
    }

    function closeContextSwitcherSheet() {
      closeModalDialog('contextSwitcherSheet');
    }

    function selectSectionFromSheet(sec) {
      currentSection = sec;
      const sel = document.getElementById('headerSectionSelect');
      if (sel) sel.value = sec;
      selectedStudentIds = [];
      updateBatchSelectionUI();
      updateCollapsedHeaderSummary();
      renderStudentGrid();
      openContextSwitcherSheet();
    }

    function selectSubjectFromSheet(sub) {
      currentSubject = sub;
      const sel = document.getElementById('headerSubjectSelect');
      if (sel) sel.value = sub;
      updateCollapsedHeaderSummary();
      renderStudentGrid();
      openContextSwitcherSheet();
    }

    // 10. التنقل بين الشاشات الرئيسية
    function switchMainView(viewName) {
      const views = ['grid', 'reports', 'hall', 'admin'];
      views.forEach(function(v) {
        const el = document.getElementById('view' + v.charAt(0).toUpperCase() + v.slice(1));
        if (el) el.classList.add('hidden');
      });

      const isAdmin = currentTeacher && currentTeacher.Role === 'admin';
      const navBtns = {
        grid: document.getElementById('navBtnGrid'),
        reports: document.getElementById('navBtnReports'),
        hall: document.getElementById('navBtnHall'),
        admin: document.getElementById('navBtnAdmin')
      };
      Object.keys(navBtns).forEach(function(k) {
        if (!navBtns[k]) return;
        if (k === viewName) {
          navBtns[k].className = 'nav-tab-btn flex-1 py-1.5 px-2 rounded-xl text-[11px] sm:text-xs font-extrabold whitespace-nowrap bg-blue-600 text-white shadow text-center';
        } else {
          navBtns[k].className = 'nav-tab-btn flex-1 py-1.5 px-2 rounded-xl text-[11px] sm:text-xs font-bold whitespace-nowrap text-slate-300 hover:bg-slate-800 text-center' + (k === 'admin' && !isAdmin ? ' hidden' : '');
        }
      });

      if (viewName === 'grid') {
        document.getElementById('viewGrid').classList.remove('hidden');
        renderStudentGrid();
      } else if (viewName === 'reports') {
        document.getElementById('viewReports').classList.remove('hidden');
        populateReportFilters();
        renderTeacherReports();
      } else if (viewName === 'hall') {
        document.getElementById('viewHall').classList.remove('hidden');
        populateHallSubjectFilter();
        renderHallOfFame();
      } else if (viewName === 'admin') {
        if (!isAdmin) return;
        document.getElementById('viewAdmin').classList.remove('hidden');
        initAdminPortal();
      }
    }

    // 11. توسعة واجهة الرصد وتحديد كل الصف
