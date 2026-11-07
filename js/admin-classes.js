/**
 * الوحدة البرمجية: js/admin-classes.js
 * الوصف: إدارة الصفوف الدراسية، الشُعب، جدول المواد الـ 21 المعتمدة، وبنود التقييم
 * المنظومة: منظومة النقاط والإدارة المدرسية الشاملة — ثانوية الصحابة الشرعية
 */
    // 18.5 الصفوف والشُعب والمواد وبنود التقييم (إدارة شاملة للصفوف والشعب وجدول المواد الـ 21)
    function getAllUniqueSections() {
      const set = {};
      (db.School_Setup || []).forEach(function(item) {
        if (item.Category === 'section' && item.Label) set[String(item.Label).trim()] = true;
      });
      if (Object.keys(set).length === 0) {
        ['7_1', '7_2', '7_3', '8_1', '8_2', '9_1', '9_2'].forEach(function(s) { set[s] = true; });
      }
      db.Students.forEach(function(st) { if (st.Section) set[st.Section] = true; });
      db.Teachers.forEach(function(t) {
        String(t.AssignedSections || '').split(',').forEach(function(s) {
          if (s.trim()) set[s.trim()] = true;
        });
      });
      return Object.keys(set).sort(function(a, b) {
        const pa = a.split('_');
        const pb = b.split('_');
        const ga = parseInt(pa[0], 10) || 0;
        const gb = parseInt(pb[0], 10) || 0;
        if (ga !== gb) return ga - gb;
        return (parseInt(pa[1], 10) || 0) - (parseInt(pb[1], 10) || 0);
      });
    }

    function getAllUniqueSubjects() {
      const set = {};
      (db.School_Setup || []).forEach(function(item) {
        if (item.Category === 'subject' && item.Label) {
          set[String(item.Label).trim()] = true;
        }
      });
      db.Teachers.forEach(function(t) {
        String(t.Subjects || '').split(',').forEach(function(s) {
          if (s.trim()) set[s.trim()] = true;
        });
      });
      return Object.keys(set);
    }

    function onNewSecGradeSelectChange() {
      const gCode = document.getElementById('newSecGradeSelect').value;
      const inp = document.getElementById('newSecCodeInput');
      if (!inp || !gCode) return;
      const existingInGrade = getAllUniqueSections().filter(function(s) {
        return String(s).split('_')[0] === String(gCode);
      });
      const nextNum = existingInGrade.length + 1;
      inp.value = gCode + '_' + nextNum;
    }

    function adminAddGrade() {
      const nameInp = document.getElementById('newGradeNameInput');
      const codeInp = document.getElementById('newGradeCodeInput');
      const gName = (nameInp ? nameInp.value : '').trim().replace(/^الصف\s+/, '');
      const gCode = (codeInp ? codeInp.value : '').trim();

      if (!gName || !gCode || !/^[0-9]+$/.test(gCode)) {
        showToast('⚠️ يرجى إدخال اسم الصف (مثال: العاشر) ورقمه (مثال: 10)', 'warning');
        return;
      }

      const existing = getAllGrades();
      if (existing.some(function(g) { return g.code === gCode || g.name === gName; })) {
        showToast('⚠️ هذا الصف مسجل بالفعل في المنظومة', 'warning');
        return;
      }

      db.School_Setup.push({
        ItemID: 'GRD-' + gCode.padStart(2, '0'),
        Category: 'grade',
        Label: gName,
        PointsValue: Number(gCode),
        Type: gCode,
        Icon: '📚',
        Color: '#3B82F6'
      });

      // إنشاء الشعبة الأولى للصف الجديد تلقائياً (مثلاً 10_1)
      const firstSec = gCode + '_1';
      db.School_Setup.push({
        ItemID: 'SEC-' + firstSec,
        Category: 'section',
        Label: firstSec,
        PointsValue: Number(gCode),
        Type: gName,
        Icon: '🏫',
        Color: '#2563EB'
      });

      if (db.Teachers[0] && !String(db.Teachers[0].AssignedSections).includes(firstSec)) {
        db.Teachers[0].AssignedSections = (db.Teachers[0].AssignedSections ? db.Teachers[0].AssignedSections + ', ' : '') + firstSec;
      }

      if (nameInp) nameInp.value = '';
      if (codeInp) codeInp.value = '';

      logAuditEvent('إضافة صف دراسي جديد', 'إضافة الصف ' + gName + ' (' + gCode + ') مع شعبته الأولى ' + firstSec);
      saveStateToStorage();
      populateAdminSectionDropdowns();
      renderAdminTeacherPermissionPickers();
      renderAdminClassesAndSubjects();
      if (currentTeacher) initializeTeacherSession();
      showToast('🎓 تمت إضافة الصف ' + gName + ' والشعبة ' + firstSec + ' بنجاح!', 'success');
    }

    function adminDeleteGrade(gradeCode) {
      const hasStudents = db.Students.some(function(s) {
        return String(s.Section).split('_')[0] === String(gradeCode);
      });
      if (hasStudents) {
        showToast('⛔ لا يمكن حذف صف يحتوي على طلاب مسجلين. انقل الطلاب أو احذفهم أولاً.', 'warning');
        return;
      }
      db.School_Setup = db.School_Setup.filter(function(item) {
        if (item.Category === 'grade' && (String(item.Type) === String(gradeCode) || String(item.PointsValue) === String(gradeCode))) return false;
        if (item.Category === 'section' && String(item.Label).split('_')[0] === String(gradeCode)) return false;
        return true;
      });
      db.Teachers.forEach(function(t) {
        t.AssignedSections = String(t.AssignedSections || '')
          .split(',')
          .map(function(s) { return s.trim(); })
          .filter(function(s) { return s && String(s).split('_')[0] !== String(gradeCode); })
          .join(', ');
      });
      logAuditEvent('حذف صف دراسي', 'حذف الصف رقم ' + gradeCode);
      saveStateToStorage();
      populateAdminSectionDropdowns();
      renderAdminTeacherPermissionPickers();
      renderAdminClassesAndSubjects();
      showToast('🗑️ تم حذف الصف الدراسي الفارغ بنجاح', 'info');
    }

    function adminAddSection() {
      const gradeCode = document.getElementById('newSecGradeSelect').value;
      let secCode = document.getElementById('newSecCodeInput').value.trim();
      if (!secCode && gradeCode) {
        const existingInGrade = getAllUniqueSections().filter(function(s) { return String(s).split('_')[0] === String(gradeCode); });
        secCode = gradeCode + '_' + (existingInGrade.length + 1);
      }
      if (!secCode || !/^[0-9]+_[0-9]+$/.test(secCode)) {
        showToast('أدخل رمز شعبة صحيح بصيغة رقم_الصف_رقم_الشعبة مثل 7_4 أو 10_1', 'warning');
        return;
      }
      if (getAllUniqueSections().indexOf(secCode) !== -1) {
        showToast('⚠️ هذه الشعبة مضافة مسبقاً', 'warning');
        return;
      }
      const gradeName = getGradeFromSection(secCode);
      db.School_Setup.push({
        ItemID: 'SEC-' + secCode,
        Category: 'section',
        Label: secCode,
        PointsValue: Number(secCode.split('_')[0]) || 0,
        Type: gradeName,
        Icon: '🏫',
        Color: '#2563EB'
      });
      if (db.Teachers[0] && !String(db.Teachers[0].AssignedSections).includes(secCode)) {
        db.Teachers[0].AssignedSections += ', ' + secCode;
      }
      document.getElementById('newSecCodeInput').value = '';
      logAuditEvent('إضافة شعبة دراسية', 'إضافة الشعبة ' + secCode + ' (الصف ' + gradeName + ')');
      saveStateToStorage();
      populateAdminSectionDropdowns();
      renderAdminTeacherPermissionPickers();
      renderAdminClassesAndSubjects();
      showToast('🏫 تمت إضافة الشعبة ' + secCode + ' بنجاح', 'success');
    }

    function adminDeleteSection(secCode) {
      const cnt = db.Students.filter(function(s) { return s.Section === secCode; }).length;
      if (cnt > 0) {
        showToast('⛔ لا يمكن حذف شعبة تضم ' + formatNum(cnt) + ' طالباً. انقل الطلاب أولاً.', 'warning');
        return;
      }
      db.School_Setup = db.School_Setup.filter(function(item) {
        return !(item.Category === 'section' && String(item.Label).trim() === secCode);
      });
      db.Teachers.forEach(function(t) {
        t.AssignedSections = String(t.AssignedSections || '')
          .split(',')
          .map(function(s) { return s.trim(); })
          .filter(function(s) { return s && s !== secCode; })
          .join(', ');
      });
      logAuditEvent('حذف شعبة دراسية', 'حذف الشعبة الفارغة ' + secCode);
      saveStateToStorage();
      populateAdminSectionDropdowns();
      renderAdminTeacherPermissionPickers();
      renderAdminClassesAndSubjects();
      showToast('🗑️ تم حذف الشعبة ' + secCode, 'info');
    }

    function adminAddSubject() {
      const subName = document.getElementById('newSubjectInput').value.trim();
      if (!subName) return;
      if (getAllUniqueSubjects().indexOf(subName) !== -1) {
        showToast('هذه المادة مضافة مسبقاً في جدول المواد', 'warning');
        return;
      }
      db.School_Setup.push({
        ItemID: 'SUB-' + Date.now(),
        Category: 'subject',
        Label: subName,
        PointsValue: 0,
        Type: 'neutral',
        Icon: '📖',
        Color: '#0D9488'
      });
      if (db.Teachers[0]) {
        db.Teachers[0].Subjects = (db.Teachers[0].Subjects ? db.Teachers[0].Subjects + ', ' : '') + subName;
      }
      document.getElementById('newSubjectInput').value = '';
      logAuditEvent('إضافة مادة دراسية', 'إضافة المادة الدراسية: ' + subName);
      saveStateToStorage();
      renderAdminTeacherPermissionPickers();
      renderAdminClassesAndSubjects();
      showToast('📚 تمت إضافة المادة الدراسية: ' + subName, 'success');
    }

    function adminDeleteSubject(subName) {
      if (getAllUniqueSubjects().length <= 1) {
        showToast('لا يمكن حذف جميع المواد الدراسية', 'warning');
        return;
      }
      db.School_Setup = db.School_Setup.filter(function(item) {
        return !(item.Category === 'subject' && String(item.Label).trim() === subName);
      });
      db.Teachers.forEach(function(t) {
        t.Subjects = String(t.Subjects || '')
          .split(',')
          .map(function(s) { return s.trim(); })
          .filter(function(s) { return s && s !== subName; })
          .join(', ');
      });
      logAuditEvent('حذف مادة دراسية', 'حذف المادة الدراسية: ' + subName);
      saveStateToStorage();
      renderAdminTeacherPermissionPickers();
      renderAdminClassesAndSubjects();
      showToast('🗑️ تم حذف المادة: ' + subName, 'info');
    }

    function updateLiveEvalRulePreview() {
      const lbl = (document.getElementById('newRuleLabelInput').value || 'بند جديد').trim();
      const pts = Number(document.getElementById('newRulePointsInput').value) || 0;
      const icn = (document.getElementById('newRuleIconInput').value || '⭐').trim();
      const pill = document.getElementById('liveRulePreviewPill');
      const errEl = document.getElementById('evalRuleValidationError');
      if (errEl) errEl.classList.add('hidden');
      if (!pill) return;
      pill.textContent = icn + ' ' + lbl + ' (' + formatNum(pts, true) + ')';
      pill.className = 'px-2.5 py-1 rounded-xl text-white font-extrabold text-[11px] ' + (pts >= 0 ? 'bg-emerald-600' : 'bg-rose-600');
    }

    function adminAddEvalRule() {
      const lbl = (document.getElementById('newRuleLabelInput').value || '').trim();
      const pts = Number(document.getElementById('newRulePointsInput').value);
      const icn = (document.getElementById('newRuleIconInput').value || '⭐').trim();
      const errEl = document.getElementById('evalRuleValidationError');

      if (!lbl) {
        errEl.textContent = '⚠️ يرجى إدخال اسم بند التقييم.';
        errEl.classList.remove('hidden');
        return;
      }
      if (isNaN(pts) || pts === 0 || pts < -10 || pts > 10) {
        errEl.textContent = '⚠️ يجب أن تكون قيمة النقاط بين -10 و +10 (وغير مساوية للصفر).';
        errEl.classList.remove('hidden');
        return;
      }
      const dup = getEvalRules().some(function(r) { return String(r.Label).trim() === lbl; });
      if (dup) {
        errEl.textContent = '⚠️ يوجد بند تقييم بنفس الاسم بالفعل.';
        errEl.classList.remove('hidden');
        return;
      }

      errEl.classList.add('hidden');
      const newRule = {
        ItemID: 'EV-' + Date.now(),
        Category: 'eval_rule',
        Label: lbl,
        PointsValue: pts,
        Type: pts > 0 ? 'positive' : 'negative',
        Icon: icn,
        Color: pts > 0 ? '#10B981' : '#EF4444',
        ActionCategory: pts > 0 ? 'participation' : 'behavior'
      };
      db.School_Setup.push(newRule);
      logAuditEvent('إضافة بند تقييم', 'إضافة بند التقييم: ' + lbl + ' (' + pts + ')');
      document.getElementById('newRuleLabelInput').value = '';
      saveStateToStorage();
      renderEvalRulesBar();
      renderAdminClassesAndSubjects();
      showToast('✅ تمت إضافة بند التقييم الجديد بنجاح', 'success');
    }

    function moveEvalRuleOrder(itemId, direction) {
      const idx = db.School_Setup.findIndex(function(x) { return x.ItemID === itemId; });
      if (idx === -1) return;
      const targetIdx = idx + direction;
      if (targetIdx < 0 || targetIdx >= db.School_Setup.length) return;
      if (db.School_Setup[targetIdx].Category !== 'eval_rule') return;
      const temp = db.School_Setup[idx];
      db.School_Setup[idx] = db.School_Setup[targetIdx];
      db.School_Setup[targetIdx] = temp;
      saveStateToStorage();
      renderEvalRulesBar();
      renderAdminClassesAndSubjects();
    }

    function deleteEvalRule(itemId) {
      if (getEvalRules().length <= 1) {
        showToast('لا يمكن حذف جميع بنود التقييم', 'warning');
        return;
      }
      db.School_Setup = db.School_Setup.filter(function(x) { return x.ItemID !== itemId; });
      saveStateToStorage();
      renderEvalRulesBar();
      renderAdminClassesAndSubjects();
    }

    function importPresetEvalRules() {
      const presets = [
        { Label: 'تعاون جماعي', PointsValue: 2, Icon: '🤝', ActionCategory: 'participation' },
        { Label: 'ترتيب الدفتر', PointsValue: 1, Icon: '📒', ActionCategory: 'homework' },
        { Label: 'تأخر عن الحصة', PointsValue: -1, Icon: '⏰', ActionCategory: 'behavior' }
      ];
      let added = 0;
      presets.forEach(function(p) {
        if (!getEvalRules().some(function(r) { return r.Label === p.Label; })) {
          db.School_Setup.push({
            ItemID: 'EV-PRE-' + Date.now() + '-' + added,
            Category: 'eval_rule',
            Label: p.Label,
            PointsValue: p.PointsValue,
            Type: p.PointsValue > 0 ? 'positive' : 'negative',
            Icon: p.Icon,
            Color: p.PointsValue > 0 ? '#10B981' : '#EF4444',
            ActionCategory: p.ActionCategory
          });
          added++;
        }
      });
      saveStateToStorage();
      renderEvalRulesBar();
      renderAdminClassesAndSubjects();
      showToast('✨ تم استيراد ' + formatNum(added) + ' قوالب تقييم جاهزة', 'success');
    }

    function renderAdminClassesAndSubjects() {
      const gradesListEl = document.getElementById('adminGradesList');
      const secList = document.getElementById('adminSectionsList');
      const subList = document.getElementById('adminSubjectsList');
      const subCountBadge = document.getElementById('adminSubjectsCountBadge');
      const rulesList = document.getElementById('adminEvalRulesList');
      if (!secList || !subList || !rulesList) return;

      const grades = getAllGrades();
      const secs = getAllUniqueSections();

      if (gradesListEl) {
        gradesListEl.innerHTML = grades.map(function(g) {
          const gSecs = secs.filter(function(s) { return String(s).split('_')[0] === String(g.code); });
          const gStds = db.Students.filter(function(s) { return String(s.Section).split('_')[0] === String(g.code); }).length;
          return '<div class="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-xl">' +
            '<span class="font-extrabold text-indigo-900 dark:text-indigo-200">🎓 الصف ' + escapeHtml(g.name) + ' (' + escapeHtml(g.code) + ')</span>' +
            '<span class="text-[11px] bg-white dark:bg-slate-800 px-2 py-0.5 rounded-lg font-bold text-slate-600 dark:text-slate-300">' + formatNum(gSecs.length) + ' شُعب • ' + formatNum(gStds) + ' طالب</span>' +
            (gStds === 0 ? '<button type="button" onclick="adminDeleteGrade(\'' + escapeJsAttr(g.code) + '\')" title="حذف الصف" class="text-rose-600 hover:text-rose-800 font-bold px-1">✕</button>' : '') +
          '</div>';
        }).join('');
      }

      secList.innerHTML = secs.map(function(sc) {
        const cnt = db.Students.filter(function(s) { return s.Section === sc; }).length;
        return '<div class="flex items-center justify-between bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl">' +
          '<span class="font-extrabold">' + escapeHtml(formatSectionArabicLabel(sc)) + '</span>' +
          '<div class="flex items-center gap-1.5">' +
            '<span class="bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full font-bold">' + formatNum(cnt) + ' طالب</span>' +
            (cnt === 0 ? '<button type="button" onclick="adminDeleteSection(\'' + escapeJsAttr(sc) + '\')" title="حذف الشعبة الفارغة" class="text-rose-600 hover:bg-rose-100 px-1.5 py-0.5 rounded font-bold">🗑️</button>' : '') +
          '</div>' +
        '</div>';
      }).join('');

      const subs = getAllUniqueSubjects();
      if (subCountBadge) subCountBadge.textContent = formatNum(subs.length);
      subList.innerHTML = subs.map(function(sb) {
        return '<div class="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 border border-teal-200 dark:border-teal-800 font-bold text-xs">' +
          '<span class="truncate">📖 ' + escapeHtml(sb) + '</span>' +
          '<button type="button" onclick="adminDeleteSubject(\'' + escapeJsAttr(sb) + '\')" title="حذف المادة" class="text-rose-500 hover:text-rose-700 font-black px-1 shrink-0">✕</button>' +
        '</div>';
      }).join('');

      const rules = getEvalRules();
      rulesList.innerHTML = rules.map(function(r) {
        const d = Number(r.PointsValue) || 0;
        return '<div class="flex items-center justify-between bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl">' +
          '<span>' + escapeHtml(r.Icon) + ' <b>' + escapeHtml(r.Label) + '</b></span>' +
          '<div class="flex items-center gap-1.5">' +
            '<span class="font-mono font-black px-2 py-0.5 rounded ' + (d >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800') + '" dir="ltr">' + formatNum(d, true) + '</span>' +
            '<button type="button" onclick="moveEvalRuleOrder(\'' + escapeJsAttr(r.ItemID) + '\', -1)" aria-label="تحريك لأعلى" class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700">⬆️</button>' +
            '<button type="button" onclick="moveEvalRuleOrder(\'' + escapeJsAttr(r.ItemID) + '\', 1)" aria-label="تحريك لأسفل" class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700">⬇️</button>' +
            '<button type="button" onclick="deleteEvalRule(\'' + escapeJsAttr(r.ItemID) + '\')" aria-label="حذف البند" class="px-1.5 py-0.5 rounded text-rose-600">🗑️</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }

