/**
 * الوحدة البرمجية: js/reports-hall.js
 * الوصف: تقارير المعلم التفصيلية (جدول + بطاقات جوال) ولوحة الشرف وفرسان الصفوف
 * المنظومة: منظومة النقاط والإدارة المدرسية الشاملة — ثانوية الصحابة الشرعية
 */
    // 16. تقارير المعلم التفصيلية
    function populateReportFilters() {
      const secFilter = document.getElementById('reportSectionFilter');
      const subFilter = document.getElementById('reportSubjectFilter');
      const bannerEl = document.getElementById('teacherReportScopeBanner');

      const teacherSections = getTeacherAllowedSections();
      const teacherSubjects = getTeacherAllowedSubjects();

      if (bannerEl) {
        bannerEl.textContent = '🔒 نطاق صلاحياتك المحدد من الإدارة: الشُعب (' + teacherSections.join('، ') + ') | المواد (' + teacherSubjects.join('، ') + ')';
      }

      secFilter.innerHTML = '';
      if (teacherSections.length > 1) {
        const optAll = document.createElement('option');
        optAll.value = 'TEACHER_SECTIONS';
        optAll.textContent = 'كل شُعبي المسندة (' + formatNum(teacherSections.length) + ' شُعب)';
        secFilter.appendChild(optAll);
      }
      teacherSections.forEach(function(sec) {
        const opt = document.createElement('option');
        opt.value = sec;
        opt.textContent = formatSectionArabicLabel(sec);
        secFilter.appendChild(opt);
      });
      if (teacherSections.indexOf(currentSection) !== -1) {
        secFilter.value = currentSection;
      }

      subFilter.innerHTML = '';
      if (teacherSubjects.length === 1) {
        const optSingle = document.createElement('option');
        optSingle.value = teacherSubjects[0];
        optSingle.textContent = '📘 ' + teacherSubjects[0];
        subFilter.appendChild(optSingle);
        subFilter.value = teacherSubjects[0];
      } else {
        const optAllSub = document.createElement('option');
        optAllSub.value = 'TEACHER_ALL';
        optAllSub.textContent = 'كل موادي المسندة (' + teacherSubjects.join(' + ') + ')';
        subFilter.appendChild(optAllSub);
        teacherSubjects.forEach(function(sub) {
          const opt = document.createElement('option');
          opt.value = sub;
          opt.textContent = sub;
          subFilter.appendChild(opt);
        });
        subFilter.value = currentSubject && teacherSubjects.indexOf(currentSubject) !== -1 ? currentSubject : 'TEACHER_ALL';
      }
    }

    function renderTeacherReports() {
      const teacherSections = getTeacherAllowedSections();
      const secVal = document.getElementById('reportSectionFilter').value || 'TEACHER_SECTIONS';
      const subVal = document.getElementById('reportSubjectFilter').value || 'TEACHER_ALL';
      const q = (document.getElementById('reportStudentSearch').value || '').trim().toLowerCase();

      const filteredStudents = db.Students.filter(function(st) {
        if (teacherSections.indexOf(st.Section) === -1) return false;
        if (secVal !== 'TEACHER_SECTIONS' && secVal !== 'ALL' && st.Section !== secVal) return false;
        if (q && !String(st.StudentName).toLowerCase().includes(q) && !String(st.StudentID).toLowerCase().includes(q)) return false;
        return true;
      });

      let totalOral = 0, totalHw = 0, totalPart = 0, totalNotes = 0;
      const tbody = document.getElementById('teacherReportsTableBody');
      tbody.innerHTML = '';

      filteredStudents.forEach(function(st) {
        const stats = computeStudentStats(st.StudentID, subVal);
        totalOral += stats.oral;
        totalHw += stats.homework;
        totalPart += stats.participation;
        totalNotes += stats.notes.length;

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-blue-50/40 dark:hover:bg-slate-800/60 transition';
        const pts = stats.netPoints;

        let commitColor = 'bg-emerald-100 text-emerald-800';
        if (stats.commitmentPct < 50) commitColor = 'bg-rose-100 text-rose-800';
        else if (stats.commitmentPct < 80) commitColor = 'bg-amber-100 text-amber-800';

        tr.innerHTML =
          '<td class="py-2.5 px-2 text-center font-bold text-slate-500">' + formatNum(st.RollNumber) + '</td>' +
          '<td class="py-2.5 px-3 font-extrabold sticky right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm shadow-sm z-10 whitespace-nowrap">' + escapeHtml(st.StudentName) + '</td>' +
          '<td class="py-2.5 px-3 font-mono text-[11px] text-slate-500">' + escapeHtml(st.StudentID) + '</td>' +
          '<td class="py-2.5 px-3 text-center"><span class="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">' + escapeHtml(st.Section) + '</span></td>' +
          '<td class="py-2.5 px-3 text-center font-black ' + (pts >= 0 ? 'text-emerald-700' : 'text-rose-600') + '" dir="ltr">' + formatNum(pts, true) + '</td>' +
          '<td class="py-2.5 px-3 text-center font-bold text-emerald-700">' + formatNum(stats.oral) + '</td>' +
          '<td class="py-2.5 px-3 text-center font-bold text-blue-700">' + formatNum(stats.homework) + '</td>' +
          '<td class="py-2.5 px-3 text-center font-bold text-indigo-700">' + formatNum(stats.participation) + '</td>' +
          '<td class="py-2.5 px-3 text-center font-bold text-rose-600">' + formatNum(stats.negative) + '</td>' +
          '<td class="py-2.5 px-3 text-center">' +
            '<button type="button" onclick="openStudentModal(\'' + escapeJsAttr(st.StudentID) + '\')" class="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800">' +
              '📝 ' + formatNum(stats.notes.length) + ' (عرض)' +
            '</button>' +
          '</td>' +
          '<td class="py-2.5 px-3 text-center">' +
            '<span class="px-2.5 py-1 rounded-full font-black text-[11px] ' + commitColor + '">' + formatNum(stats.commitmentPct) + '%</span>' +
          '</td>';
        tbody.appendChild(tr);
      });

      const mobileCardsEl = document.getElementById('teacherReportsMobileCards');
      if (mobileCardsEl) {
        mobileCardsEl.innerHTML = filteredStudents.map(function(st) {
          const stats = computeStudentStats(st.StudentID, subVal);
          const pts = stats.netPoints;
          return '<div onclick="openStudentModal(\'' + escapeJsAttr(st.StudentID) + '\')" class="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-2 cursor-pointer active:scale-[0.99] transition">' +
            '<div class="flex items-center justify-between">' +
              '<div class="flex items-center gap-2">' +
                '<span class="w-7 h-7 rounded-xl bg-slate-900 text-white font-black text-xs flex items-center justify-center">' + formatNum(st.RollNumber) + '</span>' +
                '<div>' +
                  '<div class="font-extrabold text-xs">' + escapeHtml(st.StudentName) + '</div>' +
                  '<div class="text-[10px] text-slate-500">الشعبة ' + escapeHtml(st.Section) + ' • التزام ' + formatNum(stats.commitmentPct) + '%</div>' +
                '</div>' +
              '</div>' +
              '<span class="px-2.5 py-1 rounded-xl font-mono font-black text-xs ' + (pts >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800') + '" dir="ltr">' + formatNum(pts, true) + '</span>' +
            '</div>' +
            '<div class="grid grid-cols-4 gap-1 text-center text-[11px] bg-slate-50 dark:bg-slate-800/70 p-1.5 rounded-xl">' +
              '<div><span class="text-slate-500 block text-[10px]">✋ مشاركة</span><b class="text-indigo-600">' + formatNum(stats.participation) + '</b></div>' +
              '<div><span class="text-slate-500 block text-[10px]">🎙️ تسميع</span><b class="text-emerald-600">' + formatNum(stats.oral) + '</b></div>' +
              '<div><span class="text-slate-500 block text-[10px]">📘 واجب</span><b class="text-blue-600">' + formatNum(stats.homework) + '</b></div>' +
              '<div><span class="text-slate-500 block text-[10px]">⚠️ تنبيه</span><b class="text-rose-600">' + formatNum(stats.negative) + '</b></div>' +
            '</div>' +
          '</div>';
        }).join('');
      }

      const cardsEl = document.getElementById('reportSummaryCards');
      cardsEl.innerHTML =
        '<div class="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">' +
          '<div class="text-xs text-slate-500 font-bold">إجمالي التسميع الشفهي</div>' +
          '<div class="text-2xl font-black text-emerald-600 mt-1">🎙️ ' + formatNum(totalOral) + '</div>' +
        '</div>' +
        '<div class="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">' +
          '<div class="text-xs text-slate-500 font-bold">إجمالي الواجبات المنجزة</div>' +
          '<div class="text-2xl font-black text-blue-600 mt-1">📘 ' + formatNum(totalHw) + '</div>' +
        '</div>' +
        '<div class="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">' +
          '<div class="text-xs text-slate-500 font-bold">إجمالي المشاركات الصفية</div>' +
          '<div class="text-2xl font-black text-indigo-600 mt-1">✋ ' + formatNum(totalPart) + '</div>' +
        '</div>' +
        '<div class="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">' +
          '<div class="text-xs text-slate-500 font-bold">الملاحظات التربوية المسجلة</div>' +
          '<div class="text-2xl font-black text-purple-600 mt-1">📝 ' + formatNum(totalNotes) + '</div>' +
        '</div>';
    }

    function exportTeacherReportCSV() {
      const teacherSections = getTeacherAllowedSections();
      const secVal = document.getElementById('reportSectionFilter').value || 'TEACHER_SECTIONS';
      const subVal = document.getElementById('reportSubjectFilter').value || 'TEACHER_ALL';
      const headers = ['StudentID', 'الرقم التسلسلي', 'اسم الطالب', 'الصف', 'الشعبة', 'نقاط مادة المعلم', 'مرات التسميع الشفهي', 'الواجبات المنجزة', 'المشاركات الصفية', 'مرات التقصير/التنبيهات', 'عدد الملاحظات', 'نسبة الالتزام %'];
      const rows = db.Students
        .filter(function(st) {
          if (teacherSections.indexOf(st.Section) === -1) return false;
          return secVal === 'TEACHER_SECTIONS' || secVal === 'ALL' || st.Section === secVal;
        })
        .map(function(st) {
          const stats = computeStudentStats(st.StudentID, subVal);
          return [
            st.StudentID, st.RollNumber, st.StudentName, st.Grade, st.Section,
            stats.netPoints, stats.oral, stats.homework, stats.participation,
            stats.negative, stats.notes.length, stats.commitmentPct + '%'
          ];
        });
      downloadCSVFile('Teacher_Analytical_Report_' + secVal + '.csv', headers, rows);
    }

    // 17. لوحة الشرف والأوائل (مع اختيار المادة)
    function populateHallSubjectFilter() {
      const sel = document.getElementById('hallSubjectFilter');
      if (!sel) return;
      const isAdmin = currentTeacher && (currentTeacher.Role === 'admin' || currentTeacher.Role === 'supervisor');
      const subjects = isAdmin ? getAllUniqueSubjects() : getTeacherAllowedSubjects();

      sel.innerHTML = '';
      if (isAdmin) {
        const optSchool = document.createElement('option');
        optSchool.value = 'SCHOOL_ALL';
        optSchool.textContent = '🌟 المجموع العام (كل مواد المدرسة)';
        sel.appendChild(optSchool);
      }
      if (subjects.length > 1) {
        const optTch = document.createElement('option');
        optTch.value = 'TEACHER_ALL';
        optTch.textContent = '📚 مجموع موادي المسندة (' + subjects.join(' + ') + ')';
        sel.appendChild(optTch);
      }
      subjects.forEach(function(sub) {
        const opt = document.createElement('option');
        opt.value = sub;
        opt.textContent = '📘 مادة: ' + sub;
        sel.appendChild(opt);
      });

      if (subjects.length === 1) hallSelectedSubject = subjects[0];
      else if (isAdmin && hallSelectedSubject === 'ALL_ALLOWED') hallSelectedSubject = 'SCHOOL_ALL';
      else if (hallSelectedSubject === 'ALL_ALLOWED') hallSelectedSubject = 'TEACHER_ALL';

      if ([...sel.options].some(function(o) { return o.value === hallSelectedSubject; })) {
        sel.value = hallSelectedSubject;
      } else if (sel.options.length > 0) {
        hallSelectedSubject = sel.options[0].value;
        sel.value = hallSelectedSubject;
      }
    }

    function onHallSubjectChange() {
      const sel = document.getElementById('hallSubjectFilter');
      if (sel) hallSelectedSubject = sel.value;
      renderHallOfFame();
    }

    function getStudentHallPointsAndStats(studentId) {
      return computeStudentStats(studentId, hallSelectedSubject || 'TEACHER_ALL');
    }

    function renderHallOfFame() {
      const isAdmin = currentTeacher && (currentTeacher.Role === 'admin' || currentTeacher.Role === 'supervisor');
      const grades = isAdmin ? getAllGrades().map(function(g) { return g.name; }) : getTeacherAllowedGrades();
      const allowedSecs = isAdmin ? getAllUniqueSections() : getTeacherAllowedSections();

      const lblEl = document.getElementById('hallActiveSubjectLabel');
      if (lblEl) {
        if (hallSelectedSubject === 'SCHOOL_ALL') lblEl.textContent = 'المجموع العام لكل المواد';
        else if (hallSelectedSubject === 'TEACHER_ALL') lblEl.textContent = 'مجموع مواد المعلم';
        else lblEl.textContent = 'مادة ' + hallSelectedSubject;
      }

      const champContainer = document.getElementById('gradeChampionsContainer');
      champContainer.innerHTML = '';

      grades.forEach(function(gradeName) {
        const gradeStudents = db.Students
          .filter(function(s) { return s.Grade === gradeName && allowedSecs.indexOf(s.Section) !== -1; })
          .map(function(s) {
            const stStats = getStudentHallPointsAndStats(s.StudentID);
            return { student: s, stats: stStats, hallPoints: stStats.netPoints };
          })
          .sort(function(a, b) { return b.hallPoints - a.hallPoints; });

        const topEntry = gradeStudents[0];
        const card = document.createElement('div');
        card.className = 'bg-white/10 backdrop-blur-md border border-amber-400/30 rounded-2xl p-4 flex flex-col justify-between shadow-lg';
        if (topEntry) {
          const topStudent = topEntry.student;
          const stStats = topEntry.stats;
          const pts = topEntry.hallPoints;
          card.innerHTML =
            '<div class="flex items-center justify-between mb-2">' +
              '<span class="text-xs font-extrabold px-2.5 py-1 rounded-full bg-amber-400 text-slate-950">🏆 الأول على الصف ' + escapeHtml(gradeName) + '</span>' +
              '<span class="font-mono text-xs text-amber-200">رقم ' + formatNum(topStudent.RollNumber) + ' | ' + escapeHtml(topStudent.Section) + '</span>' +
            '</div>' +
            '<div class="my-2">' +
              '<div class="text-lg font-black text-white">' + escapeHtml(topStudent.StudentName) + '</div>' +
              '<div class="text-xs text-cyan-300 font-bold mt-0.5">التزام: ' + formatNum(stStats.commitmentPct) + '% | مشاركات: ' + formatNum(stStats.participation) + ' | وظائف: ' + formatNum(stStats.homework) + '</div>' +
            '</div>' +
            '<div class="mt-2 pt-2 border-t border-white/15 flex items-center justify-between">' +
              '<span class="text-xs text-slate-300">الرصيد في الاختيار الحالي:</span>' +
              '<span class="text-2xl font-black text-amber-300" dir="ltr">' + formatNum(pts, true) + ' نقطة</span>' +
            '</div>';
        } else {
          card.innerHTML = '<div class="text-sm text-slate-300">لا يوجد طلاب في الصف ' + escapeHtml(gradeName) + '</div>';
        }
        champContainer.appendChild(card);
      });

      const allSections = allowedSecs;
      const tabsEl = document.getElementById('hallSectionTabs');
      tabsEl.innerHTML = '';

      const allBtn = document.createElement('button');
      allBtn.type = 'button';
      allBtn.className = 'px-3 py-1.5 rounded-xl text-xs font-bold ' + (hallFilterSection === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300');
      allBtn.textContent = 'كل الشُعب (' + formatNum(allSections.length) + ')';
      allBtn.onclick = function() { hallFilterSection = 'ALL'; renderHallOfFame(); };
      tabsEl.appendChild(allBtn);

      allSections.forEach(function(sec) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'px-3 py-1.5 rounded-xl text-xs font-bold ' + (hallFilterSection === sec ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300');
        b.textContent = 'شعبة ' + sec;
        b.onclick = function() { hallFilterSection = sec; renderHallOfFame(); };
        tabsEl.appendChild(b);
      });

      const top5Container = document.getElementById('sectionTop5Container');
      top5Container.innerHTML = '';
      const targetSections = hallFilterSection === 'ALL' ? allSections : [hallFilterSection];

      targetSections.forEach(function(sec) {
        const top5 = db.Students
          .filter(function(s) { return s.Section === sec; })
          .map(function(s) {
            const stStats = getStudentHallPointsAndStats(s.StudentID);
            return { student: s, stats: stStats, hallPoints: stStats.netPoints };
          })
          .sort(function(a, b) { return b.hallPoints - a.hallPoints; })
          .slice(0, 5);

        const box = document.createElement('div');
        box.className = 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3.5';
        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

        const rowsHtml = top5.map(function(entry, i) {
          const st = entry.student;
          const pts = entry.hallPoints;
          return '<div class="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200/80 dark:border-slate-700">' +
            '<div class="flex items-center gap-2">' +
              '<span class="text-base">' + (medals[i] || '⭐') + '</span>' +
              '<div>' +
                '<div class="text-xs font-extrabold"><span class="text-blue-700 dark:text-cyan-400 font-black ml-1">#' + formatNum(st.RollNumber) + '</span>' + escapeHtml(st.StudentName) + '</div>' +
                '<div class="text-[11px] text-slate-400">مشاركات: ' + formatNum(entry.stats.participation) + ' | وظائف: ' + formatNum(entry.stats.homework) + '</div>' +
              '</div>' +
            '</div>' +
            '<span class="px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs" dir="ltr">' + formatNum(pts, true) + '</span>' +
          '</div>';
        }).join('');

        box.innerHTML =
          '<div class="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-200 dark:border-slate-700">' +
            '<span class="text-xs font-black">🎖️ ' + escapeHtml(formatSectionArabicLabel(sec)) + '</span>' +
            '<span class="text-[11px] font-bold text-blue-600 dark:text-cyan-400">الـ 5 الأوائل</span>' +
          '</div>' +
          '<div class="space-y-1.5">' + rowsHtml + '</div>';
        top5Container.appendChild(box);
      });
    }

