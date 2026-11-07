/**
 * الوحدة البرمجية: js/admin-students.js
 * الوصف: جدول الطلاب الإداري، الفرز، الترقيم، والإجراءات الجماعية
 */
    function deleteStudentById(studentId) {
      const target = db.Students.find(function(s) { return s.StudentID === studentId; });
      if (!target) return;
      db.Students = db.Students.filter(function(s) { return s.StudentID !== studentId; });
      logAuditEvent('حذف طالب', 'حذف الطالب ' + target.StudentName + ' (' + target.StudentID + ')');
      triggerSoftDelete('students', [target], 'تم حذف الطالب ' + target.StudentName);
      rebuildPerformanceCaches();
      saveStateToStorage();
      renderAdminStudentsTable();
      renderStudentGrid();
    }

    function setAdminStudentSort(field) {
      if (adminStdSortField === field) adminStdSortAsc = !adminStdSortAsc;
      else {
        adminStdSortField = field;
        adminStdSortAsc = true;
      }
      renderAdminStudentsTable();
    }

    function changeAdminStdPage(delta) {
      adminStdCurrentPage = Math.max(1, adminStdCurrentPage + delta);
      renderAdminStudentsTable();
    }

    function toggleAdminStudentSelect(studentId, checked) {
      const idx = adminSelectedStudentIds.indexOf(studentId);
      if (checked && idx === -1) adminSelectedStudentIds.push(studentId);
      if (!checked && idx !== -1) adminSelectedStudentIds.splice(idx, 1);
      updateAdminStudentBatchBar();
    }

    function toggleAdminSelectAllStudents(checked) {
      const filtered = getFilteredAdminStudents();
      if (checked) {
        adminSelectedStudentIds = filtered.map(function(s) { return s.StudentID; });
      } else {
        adminSelectedStudentIds = [];
      }
      updateAdminStudentBatchBar();
      renderAdminStudentsTable();
    }

    function updateAdminStudentBatchBar() {
      const bar = document.getElementById('adminStudentBatchBar');
      const cnt = document.getElementById('adminSelectedStdCount');
      if (cnt) cnt.textContent = formatNum(adminSelectedStudentIds.length);
      if (bar) {
        if (adminSelectedStudentIds.length > 0) {
          bar.classList.remove('hidden');
          bar.classList.add('flex');
        } else {
          bar.classList.add('hidden');
          bar.classList.remove('flex');
        }
      }
    }

    function adminBatchTransferStudents() {
      const targetSec = document.getElementById('adminBatchTargetSec').value;
      if (!targetSec || adminSelectedStudentIds.length === 0) return;
      db.Students.forEach(function(st) {
        if (adminSelectedStudentIds.indexOf(st.StudentID) !== -1 && st.Section !== targetSec) {
          st.Section = targetSec;
          st.Grade = getGradeFromSection(targetSec);
          st.RollNumber = getNextRollNumberForSection(targetSec);
        }
      });
      logAuditEvent('نقل جماعي للطلاب', 'نقل ' + adminSelectedStudentIds.length + ' طلاب إلى الشعبة ' + targetSec);
      adminSelectedStudentIds = [];
      updateAdminStudentBatchBar();
      saveStateToStorage();
      renderAdminStudentsTable();
      renderStudentGrid();
      showToast('✅ تم نقل الطلاب المحددين إلى الشعبة ' + targetSec, 'success');
    }

    function adminBatchMarkStudentsAbsent() {
      if (adminSelectedStudentIds.length === 0) return;
      db.Students.forEach(function(st) {
        if (adminSelectedStudentIds.indexOf(st.StudentID) !== -1) {
          st.AttendanceToday = 'غائب';
        }
      });
      logAuditEvent('تعيين غياب جماعي', 'تعيين ' + adminSelectedStudentIds.length + ' طلاب غائبين');
      adminSelectedStudentIds = [];
      updateAdminStudentBatchBar();
      saveStateToStorage();
      renderAdminStudentsTable();
      renderStudentGrid();
      showToast('🚫 تم تعيين الطلاب المحددين كغائبين اليوم', 'warning');
    }

    function adminBatchDeleteStudents() {
      if (adminSelectedStudentIds.length === 0) return;
      createAutoBackupSnapshot('before_batch_student_delete');
      const removed = db.Students.filter(function(s) { return adminSelectedStudentIds.indexOf(s.StudentID) !== -1; });
      db.Students = db.Students.filter(function(s) { return adminSelectedStudentIds.indexOf(s.StudentID) === -1; });
      logAuditEvent('حذف جماعي للطلاب', 'حذف ' + removed.length + ' طلاب دفعة واحدة');
      triggerSoftDelete('students', removed, 'تم حذف ' + formatNum(removed.length) + ' طلاب');
      adminSelectedStudentIds = [];
      updateAdminStudentBatchBar();
      rebuildPerformanceCaches();
      saveStateToStorage();
      renderAdminStudentsTable();
      renderStudentGrid();
    }

    function getFilteredAdminStudents() {
      const filterGrade = document.getElementById('adminStdFilterGrade') ? document.getElementById('adminStdFilterGrade').value : 'ALL';
      const filterSec = document.getElementById('adminStdFilterSection') ? document.getElementById('adminStdFilterSection').value : 'ALL';
      const filterAtt = document.getElementById('adminStdFilterAtt') ? document.getElementById('adminStdFilterAtt').value : 'ALL';
      const q = (document.getElementById('adminStdSearchInput') ? document.getElementById('adminStdSearchInput').value : '').trim().toLowerCase();

      return db.Students.filter(function(s) {
        if (filterGrade && filterGrade !== 'ALL' && s.Grade !== filterGrade) return false;
        if (filterSec && filterSec !== 'ALL' && s.Section !== filterSec) return false;
        if (filterAtt && filterAtt !== 'ALL' && s.AttendanceToday !== filterAtt) return false;
        if (q && !String(s.StudentName).toLowerCase().includes(q) && !String(s.StudentID).toLowerCase().includes(q)) return false;
        return true;
      }).sort(function(a, b) {
        let va = a[adminStdSortField], vb = b[adminStdSortField];
        if (adminStdSortField === 'RollNumber' || adminStdSortField === 'TotalPoints') {
          va = Number(va) || 0;
          vb = Number(vb) || 0;
          return adminStdSortAsc ? va - vb : vb - va;
        }
        return adminStdSortAsc
          ? String(va).localeCompare(String(vb), 'ar')
          : String(vb).localeCompare(String(va), 'ar');
      });
    }

    function renderAdminStudentsTable() {
      const tbody = document.getElementById('adminStudentsCrudBody');
      const mobileCards = document.getElementById('adminStudentsMobileCards');
      const countEl = document.getElementById('adminTotalStudentsCount');
      const pageInfo = document.getElementById('adminStdPaginationInfo');
      if (countEl) countEl.textContent = formatNum(db.Students.length);
      if (!tbody) return;

      const filtered = getFilteredAdminStudents();
      const totalPages = Math.max(1, Math.ceil(filtered.length / ADMIN_STD_PAGE_SIZE));
      if (adminStdCurrentPage > totalPages) adminStdCurrentPage = totalPages;
      const startIdx = (adminStdCurrentPage - 1) * ADMIN_STD_PAGE_SIZE;
      const pageItems = filtered.slice(startIdx, startIdx + ADMIN_STD_PAGE_SIZE);

      if (pageInfo) {
        pageInfo.textContent = 'صفحة ' + formatNum(adminStdCurrentPage) + ' من ' + formatNum(totalPages) + ' (إجمالي النتائج: ' + formatNum(filtered.length) + ')';
      }

      tbody.innerHTML = pageItems.map(function(st) {
        const checked = adminSelectedStudentIds.indexOf(st.StudentID) !== -1 ? 'checked' : '';
        return '<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">' +
          '<td class="py-2 px-2 text-center"><input type="checkbox" ' + checked + ' onchange="toggleAdminStudentSelect(\'' + escapeJsAttr(st.StudentID) + '\', this.checked)" /></td>' +
          '<td class="py-2 px-2.5 font-mono text-[11px] font-bold text-blue-700 dark:text-cyan-400">' + escapeHtml(st.StudentID) + '</td>' +
          '<td class="py-2 px-2 text-center font-bold">' + formatNum(st.RollNumber) + '</td>' +
          '<td class="py-2 px-2.5 font-extrabold">' + escapeHtml(st.StudentName) + '</td>' +
          '<td class="py-2 px-2 text-center">' + escapeHtml(st.Grade) + '</td>' +
          '<td class="py-2 px-2 text-center font-mono">' + escapeHtml(st.Section) + '</td>' +
          '<td class="py-2 px-2 text-center font-black" dir="ltr">' + formatNum(st.TotalPoints, true) + '</td>' +
          '<td class="py-2 px-2 text-center">' + escapeHtml(st.AttendanceToday) + '</td>' +
          '<td class="py-2 px-2 text-center font-mono text-[11px]" dir="ltr">' + escapeHtml(st.ParentPhone) + '</td>' +
          '<td class="py-2 px-2 text-center space-x-1 space-x-reverse">' +
            '<button type="button" onclick="openStudentEditDrawer(\'' + escapeJsAttr(st.StudentID) + '\')" class="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded font-bold">تعديل/نقل ✏️</button>' +
            '<button type="button" onclick="deleteStudentById(\'' + escapeJsAttr(st.StudentID) + '\')" class="text-rose-600 hover:bg-rose-50 px-2 py-1 rounded font-bold">حذف 🗑️</button>' +
          '</td>' +
        '</tr>';
      }).join('');

      if (mobileCards) {
        mobileCards.innerHTML = pageItems.map(function(st) {
          return '<div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">' +
            '<div>' +
              '<div class="font-black text-sm">#' + formatNum(st.RollNumber) + ' ' + escapeHtml(st.StudentName) + '</div>' +
              '<div class="text-[11px] text-slate-500 font-mono">' + escapeHtml(st.StudentID) + ' • شعبة ' + escapeHtml(st.Section) + ' • نقاط: ' + formatNum(st.TotalPoints, true) + '</div>' +
            '</div>' +
            '<div class="flex gap-1">' +
              '<button type="button" onclick="openStudentEditDrawer(\'' + escapeJsAttr(st.StudentID) + '\')" class="bg-blue-100 text-blue-800 px-2.5 py-1.5 rounded-xl font-bold">✏️</button>' +
              '<button type="button" onclick="deleteStudentById(\'' + escapeJsAttr(st.StudentID) + '\')" class="bg-rose-100 text-rose-800 px-2.5 py-1.5 rounded-xl font-bold">🗑️</button>' +
            '</div>' +
          '</div>';
        }).join('');
      }
    }

