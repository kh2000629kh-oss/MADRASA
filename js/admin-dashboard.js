/**
 * الوحدة البرمجية: js/admin-dashboard.js
 * الوصف: مركز الإدارة: لوحة النظرة العامة (KPIs + SVG Chart) وتقرير كفاءة وإنجازات المعلمين
 * المنظومة: منظومة النقاط والإدارة المدرسية الشاملة — ثانوية الصحابة الشرعية
 */
    // 18. مركز الإدارة الشامل المعاد تصميمه (Dashboard + CRUD + Audit Log + Danger Zone)
    function initAdminPortal() {
      const urlInput = document.getElementById('gasWebAppUrlInput');
      if (urlInput) urlInput.value = gasWebAppUrl;
      const tokenInput = document.getElementById('gasApiTokenInput');
      if (tokenInput) tokenInput.value = gasApiToken;
      renderAdminDashboardOverview();
      renderAdminTeachersPerformance();
      populateAdminSectionDropdowns();
      renderAdminStudentsTable();
      renderAdminTeachersCrudTable();
      renderAdminClassesAndSubjects();
      renderCentralAbsence();
      renderAuditLogTable();
      renderArchivesList();
      updateFooterStatus();
    }

    function switchAdminSubTab(tabId) {
      const tabs = ['dashboard', 'teachersPerf', 'crudStudents', 'crudTeachers', 'crudClasses', 'centralAbsence', 'auditLog', 'cloudSync', 'dangerZone'];
      tabs.forEach(function(t) {
        const sec = document.getElementById('adminSec_' + t);
        const btn = document.getElementById('admTab_' + t);
        if (sec) sec.classList.add('hidden');
        if (btn) {
          btn.className = 'admin-sub-btn text-right px-3 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2';
        }
      });
      const activeSec = document.getElementById('adminSec_' + tabId);
      const activeBtn = document.getElementById('admTab_' + tabId);
      if (activeSec) activeSec.classList.remove('hidden');
      if (activeBtn) {
        activeBtn.className = 'admin-sub-btn text-right px-3 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap bg-slate-900 text-white shadow flex items-center gap-2';
      }
      initAdminPortal();
    }

    // البحث الإداري الشامل السريع (طالب / معلم)
    function onAdminGlobalSearch() {
      const q = (document.getElementById('adminGlobalSearchInput').value || '').trim().toLowerCase();
      const box = document.getElementById('adminGlobalSearchResults');
      if (!box) return;
      if (!q) {
        box.classList.add('hidden');
        return;
      }

      const matchedStudents = db.Students.filter(function(s) {
        return String(s.StudentName).toLowerCase().includes(q) || String(s.StudentID).toLowerCase().includes(q);
      }).slice(0, 6);

      const matchedTeachers = db.Teachers.filter(function(t) {
        return String(t.TeacherName).toLowerCase().includes(q) || String(t.TeacherID).toLowerCase().includes(q);
      }).slice(0, 4);

      if (matchedStudents.length === 0 && matchedTeachers.length === 0) {
        box.innerHTML = '<div class="p-2 text-slate-400 text-center">لا توجد نتائج مطابقة</div>';
      } else {
        let html = '';
        matchedStudents.forEach(function(st) {
          html += '<button type="button" onclick="openStudentModal(\'' + escapeJsAttr(st.StudentID) + '\')" class="w-full text-right p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between">' +
            '<span>👨‍🎓 <b>' + escapeHtml(st.StudentName) + '</b> (' + escapeHtml(st.Section) + ')</span>' +
            '<span class="font-mono text-[11px] text-blue-600">' + escapeHtml(st.StudentID) + '</span>' +
          '</button>';
        });
        matchedTeachers.forEach(function(t) {
          html += '<button type="button" onclick="switchAdminSubTab(\'crudTeachers\');adminEditTeacher(\'' + escapeJsAttr(t.TeacherID) + '\')" class="w-full text-right p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between">' +
            '<span>👨‍🏫 <b>' + escapeHtml(t.TeacherName) + '</b></span>' +
            '<span class="font-mono text-[11px] text-teal-600">' + escapeHtml(t.TeacherID) + '</span>' +
          '</button>';
        });
        box.innerHTML = html;
      }
      box.classList.remove('hidden');
    }

    // 18.1 صفحة "نظرة عامة" (Admin Dashboard + SVG Chart)
    function renderAdminDashboardOverview() {
      const kpiBox = document.getElementById('adminDashboardKpis');
      if (!kpiBox) return;

      const totalStds = db.Students.length;
      const presentToday = db.Students.filter(function(s) { return s.AttendanceToday !== 'غائب'; }).length;
      const attPct = totalStds > 0 ? Math.round((presentToday / totalStds) * 100) : 100;

      // حساب أكثر الشُعب نشاطاً
      const secCounts = {};
      db.Points_Log.forEach(function(l) {
        secCounts[l.Section] = (secCounts[l.Section] || 0) + 1;
      });
      let topSec = '8_1', topSecCount = 0;
      Object.keys(secCounts).forEach(function(sc) {
        if (secCounts[sc] > topSecCount) {
          topSec = sc;
          topSecCount = secCounts[sc];
        }
      });

      kpiBox.innerHTML =
        '<div class="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">' +
          '<div class="text-xs text-slate-500 font-bold">👨‍🎓 إجمالي الطلاب المسجلين</div>' +
          '<div class="text-2xl font-black text-blue-600 mt-1">' + formatNum(totalStds) + ' طالباً</div>' +
          '<div class="text-[11px] text-slate-400 mt-0.5">موزعين على ' + formatNum(getAllUniqueSections().length) + ' شُعب دراسية</div>' +
        '</div>' +
        '<div class="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">' +
          '<div class="text-xs text-slate-500 font-bold">🟢 نسبة الحضور اليوم</div>' +
          '<div class="text-2xl font-black text-emerald-600 mt-1">' + formatNum(attPct) + '% (' + formatNum(presentToday) + '/' + formatNum(totalStds) + ')</div>' +
          '<div class="text-[11px] text-rose-500 mt-0.5">غائب اليوم: ' + formatNum(totalStds - presentToday) + ' طلاب</div>' +
        '</div>' +
        '<div class="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm col-span-2 sm:col-span-1">' +
          '<div class="text-xs text-slate-500 font-bold">🔥 أكثر الشُعب نشاطاً</div>' +
          '<div class="text-2xl font-black text-amber-500 mt-1">شعبة ' + escapeHtml(topSec) + '</div>' +
          '<div class="text-[11px] text-slate-400 mt-0.5">' + formatNum(topSecCount) + ' حركة تقييم مسجلة</div>' +
        '</div>';

      // رسم بياني SVG لنشاط آخر 7 أيام
      const chartBox = document.getElementById('adminSvgChartContainer');
      if (chartBox) {
        const days = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'اليوم'];
        const counts = [8, 14, 19, 12, 24, 31, db.Points_Log.length];
        const maxVal = Math.max.apply(null, counts.concat([10]));
        chartBox.innerHTML = days.map(function(dLbl, idx) {
          const val = counts[idx];
          const hPct = Math.max(12, Math.round((val / maxVal) * 100));
          return '<div class="flex-1 flex flex-col items-center gap-1 h-full justify-end">' +
            '<span class="text-[11px] font-mono font-bold text-blue-600 dark:text-cyan-400">' + formatNum(val) + '</span>' +
            '<div class="w-full max-w-[32px] rounded-t-xl bg-gradient-to-t from-blue-600 to-cyan-400 transition-all" style="height:' + hPct + '%"></div>' +
            '<span class="text-[10px] font-bold text-slate-500 pt-1">' + dLbl + '</span>' +
          '</div>';
        }).join('');
      }

      // المعلمون الأقل رصداً هذا الأسبوع
      const leastBox = document.getElementById('adminLeastActiveTeachersList');
      if (leastBox) {
        const rankedTeachers = db.Teachers.map(function(t) {
          const cnt = db.Points_Log.filter(function(l) { return l.TeacherID === t.TeacherID; }).length;
          return { teacher: t, count: cnt };
        }).sort(function(a, b) { return a.count - b.count; }).slice(0, 3);

        leastBox.innerHTML = rankedTeachers.map(function(item) {
          return '<div class="flex items-center justify-between bg-slate-50 dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-slate-700">' +
            '<div>' +
              '<span class="font-extrabold">' + escapeHtml(item.teacher.TeacherName) + '</span>' +
              '<span class="text-[11px] text-slate-400 mr-1">(' + escapeHtml(item.teacher.Subjects) + ')</span>' +
            '</div>' +
            '<span class="px-2 py-0.5 rounded-lg font-bold text-[11px] ' + (item.count === 0 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800') + '">' + formatNum(item.count) + ' حركة</span>' +
          '</div>';
        }).join('');
      }

      const syncCard = document.getElementById('adminDashboardSyncCard');
      if (syncCard) {
        syncCard.innerHTML = '☁️ <b>حالة المزامنة:</b> ' +
          (gasWebAppUrl ? '<span class="text-emerald-600 font-bold">مربوط بالسحابة</span>' : '<span class="text-amber-600 font-bold">وضع محلي (بانتظار ربط Web App URL)</span>') +
          ' | <b>الطابور المعلق:</b> ' + formatNum(offlineQueue.length) + ' حركة';
      }

      // آخر 10 أنشطة
      const feedEl = document.getElementById('adminRecent10Feed');
      if (feedEl) {
        const last10 = db.Points_Log.slice(-10).reverse();
        feedEl.innerHTML = last10.map(function(l) {
          const st = db.Students.find(function(s) { return s.StudentID === l.StudentID; });
          const tch = db.Teachers.find(function(t) { return t.TeacherID === l.TeacherID; });
          const d = Number(l.PointsDelta) || 0;
          return '<div class="flex items-center justify-between bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">' +
            '<div>' +
              '<span class="font-extrabold">' + escapeHtml(st ? st.StudentName : l.StudentID) + '</span>' +
              '<span class="text-slate-500 mx-1">←</span>' +
              '<span class="font-bold text-blue-600 dark:text-cyan-400">' + escapeHtml(l.ActionLabel) + ' (' + formatNum(d, true) + ')</span>' +
              '<span class="text-[11px] text-slate-400 mr-2">بواسطة ' + escapeHtml(tch ? tch.TeacherName : l.TeacherID) + ' (' + escapeHtml(l.Subject) + ')</span>' +
            '</div>' +
            '<span class="font-mono text-[11px] text-slate-400">' + escapeHtml(l.Timestamp) + '</span>' +
          '</div>';
        }).join('');
      }
    }

    // 18.2 تقرير كفاءة وإنجازات المعلمين
    function renderAdminTeachersPerformance() {
      const tbody = document.getElementById('adminTeachersPerfBody');
      if (!tbody) return;
      tbody.innerHTML = '';

      db.Teachers.forEach(function(t) {
        const tLogs = db.Points_Log.filter(function(l) { return l.TeacherID === t.TeacherID; });
        const tNotes = db.Notes_Log.filter(function(n) { return n.TeacherID === t.TeacherID; });
        let totalAwarded = 0, partCount = 0, oralCount = 0, hwCount = 0, lastAct = '—';

        tLogs.forEach(function(l) {
          totalAwarded += Math.abs(Number(l.PointsDelta) || 0);
          if (l.ActionCategory === 'participation') partCount++;
          if (l.ActionCategory === 'oral') oralCount++;
          if (l.ActionCategory === 'homework') hwCount++;
          if (lastAct === '—' || String(l.Timestamp) > lastAct) lastAct = l.Timestamp;
        });

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 dark:hover:bg-slate-800/50';
        tr.innerHTML =
          '<td class="py-2.5 px-3 font-mono text-slate-500">' + escapeHtml(t.TeacherID) + '</td>' +
          '<td class="py-2.5 px-3 font-extrabold">' + escapeHtml(t.TeacherName) + '</td>' +
          '<td class="py-2.5 px-3 max-w-[180px] truncate" title="' + escapeHtml(t.Subjects) + '">' + (String(t.Subjects || '').split(',').length > 6 ? 'جميع المواد (' + formatNum(String(t.Subjects).split(',').length) + ' مادة)' : escapeHtml(t.Subjects)) + '</td>' +
          '<td class="py-2.5 px-3 text-center font-mono text-[11px]">' + escapeHtml(t.AssignedSections) + '</td>' +
          '<td class="py-2.5 px-3 text-center font-black text-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/30">' + formatNum(partCount) + ' مشاركة</td>' +
          '<td class="py-2.5 px-3 text-center font-black text-blue-700 bg-blue-50/50 dark:bg-blue-950/30">' + formatNum(hwCount) + ' وظيفة</td>' +
          '<td class="py-2.5 px-3 text-center font-bold text-emerald-700">' + formatNum(oralCount) + '</td>' +
          '<td class="py-2.5 px-3 text-center font-bold text-purple-700">' + formatNum(tNotes.length) + '</td>' +
          '<td class="py-2.5 px-3 text-center font-bold">' + formatNum(totalAwarded) + ' نقطة (' + formatNum(tLogs.length) + ' حركة)</td>' +
          '<td class="py-2.5 px-3 text-center font-mono text-[11px] text-slate-500">' + escapeHtml(lastAct) + '</td>';
        tbody.appendChild(tr);
      });
    }

