/**
 * الوحدة البرمجية: js/admin-students.js
 * الوصف: إدارة الطلاب، الترقيم والفرز، اللصق الجماعي المعاين من Excel، والحذف المؤقت مع الاسترجاع
 * المنظومة: منظومة النقاط والإدارة المدرسية الشاملة — ثانوية الصحابة الشرعية
 */
    // 18.3 إدارة الطلاب المطورة (تعديل، نقل شعبة، معاينة لصق Excel، وإجراءات جماعية)
    function generateUniqueStudentIDForSection(sectionCode) {
      const cleanDigits = String(sectionCode).replace('_', '0');
      const prefix = 'STD-' + cleanDigits + '-';
      let maxNum = 0;
      db.Students.forEach(function(s) {
        if (String(s.StudentID).startsWith(prefix)) {
          const n = parseInt(String(s.StudentID).split('-')[2], 10);
          if (!isNaN(n) && n > maxNum) maxNum = n;
        }
      });
      return prefix + String(maxNum + 1).padStart(3, '0');
    }

    function getNextRollNumberForSection(sectionCode) {
      let maxRoll = 0;
      db.Students.forEach(function(s) {
        if (s.Section === sectionCode) {
          const r = Number(s.RollNumber) || 0;
          if (r > maxRoll) maxRoll = r;
        }
      });
      return maxRoll + 1;
    }

    function populateAdminSectionDropdowns() {
      const grades = getAllGrades();
      const gradeFilterIds = ['adminStdFilterGrade', 'absenceGradeFilter'];
      gradeFilterIds.forEach(function(gid) {
        const gSel = document.getElementById(gid);
        if (!gSel) return;
        const prevG = gSel.value;
        gSel.innerHTML = '<option value="ALL">كل الصفوف</option>';
        grades.forEach(function(g) {
          const opt = document.createElement('option');
          opt.value = g.name;
          opt.textContent = 'الصف ' + g.name;
          gSel.appendChild(opt);
        });
        if (prevG && (prevG === 'ALL' || grades.some(function(x) { return x.name === prevG; }))) {
          gSel.value = prevG;
        }
      });

      const newSecGradeSel = document.getElementById('newSecGradeSelect');
      if (newSecGradeSel) {
        const prevCode = newSecGradeSel.value;
        newSecGradeSel.innerHTML = '';
        grades.forEach(function(g) {
          const opt = document.createElement('option');
          opt.value = g.code;
          opt.textContent = 'الصف ' + g.name + ' (' + g.code + ')';
          newSecGradeSel.appendChild(opt);
        });
        if (prevCode && grades.some(function(x) { return x.code === prevCode; })) {
          newSecGradeSel.value = prevCode;
        }
      }

      const quickGradePickers = document.getElementById('adminGradeQuickPickers');
      if (quickGradePickers) {
        quickGradePickers.innerHTML = grades.map(function(g) {
          return '<button type="button" onclick="adminToggleGradeSectionsForTeacher(\'' + escapeJsAttr(g.code) + '\')" class="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold">كل ' + escapeHtml(g.name) + '</button>';
        }).join('');
      }

      const secs = getAllUniqueSections();
      const ids = ['newStdSection', 'bulkStdSection', 'adminStdFilterSection', 'adminBatchTargetSec'];
      ids.forEach(function(id) {
        const sel = document.getElementById(id);
        if (!sel) return;
        const prev = sel.value;
        sel.innerHTML = id === 'adminStdFilterSection' ? '<option value="ALL">كل الشُعب</option>' : '';
        secs.forEach(function(sec) {
          const opt = document.createElement('option');
          opt.value = sec;
          opt.textContent = formatSectionArabicLabel(sec);
          sel.appendChild(opt);
        });
        if (prev && (prev === 'ALL' || secs.indexOf(prev) !== -1)) sel.value = prev;
      });
    }

    function openStudentEditDrawer(studentId) {
      const drawer = document.getElementById('studentFormDrawer');
      const title = document.getElementById('studentDrawerTitle');
      const editIdInp = document.getElementById('editStdIdInput');
      const nameInp = document.getElementById('newStdName');
      const secSel = document.getElementById('newStdSection');
      const phoneInp = document.getElementById('newStdPhone');

      populateAdminSectionDropdowns();
      if (studentId) {
        const st = db.Students.find(function(s) { return s.StudentID === studentId; });
        if (!st) return;
        title.textContent = '✏️ تعديل بيانات الطالب أو نقله لشعبة أخرى (' + st.StudentID + ')';
        editIdInp.value = st.StudentID;
        nameInp.value = st.StudentName;
        secSel.value = st.Section;
        phoneInp.value = st.ParentPhone;
      } else {
        title.textContent = '➕ إضافة طالب جديد (يتولد StudentID تلقائياً بدون PIN)';
        editIdInp.value = '';
        nameInp.value = '';
        phoneInp.value = '';
      }
      drawer.classList.remove('hidden');
    }

    function closeStudentEditDrawer() {
      document.getElementById('studentFormDrawer').classList.add('hidden');
    }

    function adminAddSingleStudent() {
      const editId = document.getElementById('editStdIdInput').value.trim();
      const nameInput = document.getElementById('newStdName');
      const secSelect = document.getElementById('newStdSection');
      const phoneInput = document.getElementById('newStdPhone');
      const name = nameInput.value.trim();
      const sec = secSelect.value || '8_1';

      if (!name) {
        showToast('يرجى إدخال الاسم الكامل للطالب', 'warning');
        return;
      }

      if (editId) {
        const st = db.Students.find(function(s) { return s.StudentID === editId; });
        if (st) {
          const oldSec = st.Section;
          st.StudentName = name;
          st.ParentPhone = phoneInput.value.trim() || '963944000000';
          if (oldSec !== sec) {
            st.Section = sec;
            st.Grade = getGradeFromSection(sec);
            st.RollNumber = getNextRollNumberForSection(sec);
            logAuditEvent('نقل طالب بين الشُعب', 'نقل الطالب ' + st.StudentName + ' (' + st.StudentID + ') من ' + oldSec + ' إلى ' + sec + ' مع الحفاظ على سجله');
          } else {
            logAuditEvent('تعديل بيانات طالب', 'تعديل بيانات الطالب ' + st.StudentName + ' (' + st.StudentID + ')');
          }
          saveStateToStorage();
          closeStudentEditDrawer();
          renderAdminStudentsTable();
          renderStudentGrid();
          showToast('✅ تم حفظ تعديلات الطالب ' + st.StudentName, 'success');
          return;
        }
      }

      // التحقق من عدم تكرار الاسم في نفس الشعبة
      const duplicate = db.Students.find(function(s) {
        return s.Section === sec && String(s.StudentName).trim() === name;
      });
      if (duplicate) {
        showToast('⚠️ يوجد طالب بنفس الاسم في الشعبة ' + sec + ' بالفعل!', 'warning');
        return;
      }

      const newStd = {
        StudentID: generateUniqueStudentIDForSection(sec),
        RollNumber: getNextRollNumberForSection(sec),
        StudentName: name,
        Grade: getGradeFromSection(sec),
        Section: sec,
        TotalPoints: 0,
        AttendanceToday: 'حاضر',
        ParentPhone: phoneInput.value.trim() || '963944000000'
      };
      db.Students.push(newStd);
      rebuildPerformanceCaches();
      logAuditEvent('إضافة طالب جديد', 'إضافة الطالب ' + newStd.StudentName + ' بمعرف ' + newStd.StudentID + ' في الشعبة ' + sec);
      saveStateToStorage();
      nameInput.value = '';
      phoneInput.value = '';
      closeStudentEditDrawer();
      renderAdminStudentsTable();
      renderStudentGrid();
      showToast('✅ تمت إضافة الطالب ' + newStd.StudentName + ' بمعرف ' + newStd.StudentID, 'success');
    }

    function toggleBulkPastePanel() {
      const p = document.getElementById('adminBulkPastePanel');
      if (p) p.classList.toggle('hidden');
    }

    // خطوة المعاينة الذكية قبل استيراد الطلاب من Excel
    function previewBulkPasteStudents() {
      const raw = document.getElementById('bulkStdTextarea').value.trim();
      const defaultSec = document.getElementById('bulkStdSection').value || '8_1';
      if (!raw) {
        showToast('يرجى لصق قائمة الطلاب أولاً للمعاينة', 'warning');
        return;
      }

      const knownSections = getAllUniqueSections();
      const lines = raw.split(/\r?\n/).map(function(l) { return l.trim(); }).filter(Boolean);
      validatedBulkRows = [];
      let validCount = 0, warnCount = 0;

      lines.forEach(function(line, idx) {
        const parts = line.split(/[\t,،]+/);
        const name = (parts[0] || '').trim();
        const phone = (parts[1] || '963944000000').trim();
        const sec = (parts[2] || defaultSec).trim();

        const issues = [];
        if (name.split(/\s+/).length < 2) issues.push('اسم غير ثنائي');
        if (knownSections.indexOf(sec) === -1) issues.push('شعبة غير معرّفة (' + sec + ')');
        const dupInDb = db.Students.some(function(s) { return s.Section === sec && String(s.StudentName).trim() === name; });
        if (dupInDb) issues.push('مكرر في نفس الشعبة');

        const isOk = issues.length === 0;
        if (isOk) validCount++;
        else warnCount++;

        validatedBulkRows.push({
          idx: idx,
          include: isOk,
          name: name,
          phone: phone,
          section: knownSections.indexOf(sec) !== -1 ? sec : defaultSec,
          issues: issues
        });
      });

      const container = document.getElementById('bulkPreviewContainer');
      const summary = document.getElementById('bulkPreviewSummary');
      const tbody = document.getElementById('bulkPreviewTableBody');

      summary.innerHTML = '📊 نتيجة الفحص: <span class="text-emerald-600">' + formatNum(validCount) + ' صفوف سليمة</span> | <span class="text-amber-600">' + formatNum(warnCount) + ' صفوف تحتاج مراجعة</span>';
      tbody.innerHTML = validatedBulkRows.map(function(row, i) {
        const statusBadge = row.issues.length === 0
          ? '<span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">✅ سليم</span>'
          : '<span class="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">⚠️ ' + escapeHtml(row.issues.join('، ')) + '</span>';
        return '<tr class="' + (row.issues.length ? 'bg-amber-50/40 dark:bg-amber-950/20' : '') + '">' +
          '<td class="py-1.5 px-2 text-center"><input type="checkbox" ' + (row.include ? 'checked' : '') + ' onchange="validatedBulkRows[' + i + '].include=this.checked" /></td>' +
          '<td class="py-1.5 px-2 font-bold">' + escapeHtml(row.name) + '</td>' +
          '<td class="py-1.5 px-2 font-mono">' + escapeHtml(row.section) + '</td>' +
          '<td class="py-1.5 px-2 font-mono">' + escapeHtml(row.phone) + '</td>' +
          '<td class="py-1.5 px-2">' + statusBadge + '</td>' +
        '</tr>';
      }).join('');

      container.classList.remove('hidden');
    }

    function confirmValidatedBulkImport() {
      const toImport = validatedBulkRows.filter(function(r) { return r.include && r.name; });
      if (toImport.length === 0) {
        showToast('لا توجد صفوف محددة للاستيراد', 'warning');
        return;
      }
      toImport.forEach(function(r) {
        db.Students.push({
          StudentID: generateUniqueStudentIDForSection(r.section),
          RollNumber: getNextRollNumberForSection(r.section),
          StudentName: r.name,
          Grade: getGradeFromSection(r.section),
          Section: r.section,
          TotalPoints: 0,
          AttendanceToday: 'حاضر',
          ParentPhone: r.phone
        });
      });
      rebuildPerformanceCaches();
      logAuditEvent('استيراد جماعي للطلاب', 'استيراد ' + toImport.length + ' طالباً بعد المعاينة والتدقيق');
      saveStateToStorage();
      document.getElementById('bulkStdTextarea').value = '';
      document.getElementById('bulkPreviewContainer').classList.add('hidden');
      renderAdminStudentsTable();
      renderStudentGrid();
      showToast('✅ تم استيراد ' + formatNum(toImport.length) + ' طالباً وتوليد معرفاتهم بنجاح!', 'success');
    }

    function adminBulkPasteStudents() {
      previewBulkPasteStudents();
      confirmValidatedBulkImport();
    }

    function regenerateAllMissingStudentIDs() {
      let fixed = 0;
      db.Students.forEach(function(st) {
        if (!st.StudentID || !String(st.StudentID).startsWith('STD-')) {
          st.StudentID = generateUniqueStudentIDForSection(st.Section || '8_1');
          fixed++;
        }
      });
      saveStateToStorage();
      renderAdminStudentsTable();
      showToast('🆔 تم فحص الطلاب وتوليد المعرفات الناقصة (' + formatNum(fixed) + ' معرف محدث).', 'success');
    }

    // الحذف المؤقت (Soft Delete لمدة 30 ثانية مع إمكانية الاسترجاع)
    function triggerSoftDelete(itemsType, itemsArray, descriptionText) {
      softDeletedPayload = { type: itemsType, items: itemsArray };
      const banner = document.getElementById('softDeleteUndoBanner');
      const txt = document.getElementById('softDeleteBannerText');
      const timerLbl = document.getElementById('softDeleteTimerLbl');
      if (txt) txt.textContent = descriptionText;
      if (banner) banner.classList.remove('hidden');

      let rem = 30;
      if (timerLbl) timerLbl.textContent = formatNum(rem);
      if (softDeleteTimer) clearInterval(softDeleteTimer);
      softDeleteTimer = setInterval(function() {
        rem--;
        if (timerLbl) timerLbl.textContent = formatNum(rem);
        if (rem <= 0) {
          clearInterval(softDeleteTimer);
          softDeletedPayload = null;
          if (banner) banner.classList.add('hidden');
        }
      }, 1000);
    }

    function restoreSoftDeletedItem() {
      if (!softDeletedPayload) return;
      if (softDeletedPayload.type === 'students') {
        softDeletedPayload.items.forEach(function(st) { db.Students.push(st); });
        logAuditEvent('استرجاع طلاب محذوفين', 'استرجاع ' + softDeletedPayload.items.length + ' طالب من الحذف المؤقت');
      } else if (softDeletedPayload.type === 'teacher') {
        softDeletedPayload.items.forEach(function(t) { db.Teachers.push(t); });
        logAuditEvent('استرجاع معلم محذوف', 'استرجاع المعلم ' + softDeletedPayload.items[0].TeacherName);
      }
      softDeletedPayload = null;
      if (softDeleteTimer) clearInterval(softDeleteTimer);
      document.getElementById('softDeleteUndoBanner').classList.add('hidden');
      rebuildPerformanceCaches();
      saveStateToStorage();
      initAdminPortal();
      renderStudentGrid();
      showToast('↩️ تم استرجاع البيانات المحذوفة بنجاح!', 'success');
    }

