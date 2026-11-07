/**
 * الوحدة البرمجية: js/admin-teachers.js
 * الوصف: إدارة المعلمين، مصفوفة الصلاحيات التفاعلية، وإعادة تعيين الرمز السري لمرة واحدة
 * المنظومة: منظومة النقاط والإدارة المدرسية الشاملة — ثانوية الصحابة الشرعية
 */
    // 18.4 إدارة المعلمين والصلاحيات (بدون عرض PIN، مع إعادة تعيين الرمز لمرة واحدة وإيقاف مؤقت)
    function renderAdminTeacherPermissionPickers() {
      const subPicker = document.getElementById('adminQuickSubjectPicker');
      const secPicker = document.getElementById('adminQuickSectionPicker');
      if (!subPicker || !secPicker) return;

      const currentSubs = String(document.getElementById('tchSubjectsInput').value || '')
        .split(',').map(function(s) { return s.trim(); }).filter(Boolean);
      const currentSecs = String(document.getElementById('tchSectionsInput').value || '')
        .split(',').map(function(s) { return s.trim(); }).filter(Boolean);

      const allSubs = getAllUniqueSubjects();
      subPicker.innerHTML = '';
      allSubs.forEach(function(sub) {
        const active = currentSubs.indexOf(sub) !== -1;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'min-h-[38px] px-3 py-1 rounded-xl text-xs font-bold border transition ' +
          (active ? 'bg-teal-600 text-white border-teal-700 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700');
        btn.textContent = (active ? '✓ ' : '+ ') + sub;
        btn.onclick = function() { adminToggleSubjectForTeacher(sub); };
        subPicker.appendChild(btn);
      });

      const allSecs = getAllUniqueSections();
      secPicker.innerHTML = '';
      allSecs.forEach(function(sec) {
        const active = currentSecs.indexOf(sec) !== -1;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'min-h-[38px] px-3 py-1 rounded-xl text-xs font-bold border font-mono transition ' +
          (active ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700');
        btn.textContent = (active ? '✓ ' : '+ ') + sec + ' (' + getGradeFromSection(sec) + ')';
        btn.onclick = function() { adminToggleSectionForTeacher(sec); };
        secPicker.appendChild(btn);
      });
    }

    function adminToggleSubjectForTeacher(subName) {
      const known = getAllUniqueSubjects();
      if (known.indexOf(subName) === -1) return;
      const inp = document.getElementById('tchSubjectsInput');
      let list = String(inp.value || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
      const idx = list.indexOf(subName);
      if (idx === -1) list.push(subName);
      else list.splice(idx, 1);
      inp.value = list.join(', ');
      renderAdminTeacherPermissionPickers();
    }

    function adminToggleSectionForTeacher(secCode) {
      const known = getAllUniqueSections();
      if (known.indexOf(secCode) === -1) return;
      const inp = document.getElementById('tchSectionsInput');
      let list = String(inp.value || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
      const idx = list.indexOf(secCode);
      if (idx === -1) list.push(secCode);
      else list.splice(idx, 1);
      inp.value = list.join(', ');
      renderAdminTeacherPermissionPickers();
    }

    function adminToggleGradeSectionsForTeacher(gradePrefix) {
      const inp = document.getElementById('tchSectionsInput');
      let list = String(inp.value || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean);
      const matching = getAllUniqueSections().filter(function(sec) { return String(sec).startsWith(gradePrefix + '_'); });
      const allPresent = matching.every(function(m) { return list.indexOf(m) !== -1; });
      if (allPresent) {
        list = list.filter(function(item) { return matching.indexOf(item) === -1; });
      } else {
        matching.forEach(function(m) {
          if (list.indexOf(m) === -1) list.push(m);
        });
      }
      inp.value = list.join(', ');
      renderAdminTeacherPermissionPickers();
    }

    async function adminSaveTeacher() {
      const editId = document.getElementById('editTeacherId').value.trim();
      const name = document.getElementById('tchNameInput').value.trim();
      const pin = document.getElementById('tchPinInput').value.trim();
      const role = document.getElementById('tchRoleInput').value;

      const validSubs = getAllUniqueSubjects();
      const validSecs = getAllUniqueSections();
      const subjectsList = String(document.getElementById('tchSubjectsInput').value || '')
        .split(',').map(function(s) { return s.trim(); }).filter(function(s) { return validSubs.indexOf(s) !== -1; });
      const sectionsList = String(document.getElementById('tchSectionsInput').value || '')
        .split(',').map(function(s) { return s.trim(); }).filter(function(s) { return validSecs.indexOf(s) !== -1; });

      if (!name) {
        showToast('يرجى إدخال اسم المعلم الكامل', 'warning');
        return;
      }
      if (subjectsList.length === 0 || sectionsList.length === 0) {
        showToast('يرجى اختيار مادة واحدة وشعبة واحدة على الأقل من الأزرار التفاعلية', 'warning');
        return;
      }

      if (editId) {
        const target = db.Teachers.find(function(t) { return t.TeacherID === editId; });
        if (target) {
          // منع إزالة صلاحية آخر مدير في النظام
          if (target.Role === 'admin' && role !== 'admin') {
            const adminCount = db.Teachers.filter(function(t) { return t.Role === 'admin' && t.Status !== 'suspended'; }).length;
            if (adminCount <= 1) {
              showToast('⛔ لا يمكن تخفيض صلاحية آخر مدير نشط في النظام!', 'danger');
              return;
            }
          }
          target.TeacherName = name;
          target.Role = role;
          target.Subjects = subjectsList.join(', ');
          target.AssignedSections = sectionsList.join(', ');
          if (pin && pin.length === 4) {
            target.PINHash = await computePinHash(pin);
          }
          logAuditEvent('تعديل صلاحيات معلم', 'تحديث بيانات وصلاحيات المعلم ' + name + ' (' + target.TeacherID + ')');
        }
        showToast('✅ تم تحديث بياناتوصلاحيات المعلم ' + name, 'success');
      } else {
        if (!pin || pin.length !== 4) {
          showToast('يرجى إدخال رمز PIN مبدئي من 4 أرقام للمعلم الجديد', 'warning');
          return;
        }
        const newId = 'TCH-' + String(db.Teachers.length + 1).padStart(2, '0');
        const pinHash = await computePinHash(pin);
        db.Teachers.push({
          TeacherID: newId,
          TeacherName: name,
          PINHash: pinHash,
          Role: role,
          Status: 'active',
          Subjects: subjectsList.join(', '),
          AssignedSections: sectionsList.join(', ')
        });
        logAuditEvent('إضافة معلم جديد', 'إضافة المعلم ' + name + ' (' + newId + ') بدور ' + role);
        showToast('✅ تمت إضافة المعلم الجديد ' + name + ' (الرمز مخزن بتجزئة SHA-256)', 'success');
      }

      if (currentTeacher) {
        const refreshed = db.Teachers.find(function(t) { return t.TeacherID === currentTeacher.TeacherID; });
        if (refreshed) {
          currentTeacher = refreshed;
          populateHeaderSectionsForTeacher();
        }
      }
      saveStateToStorage();
      adminResetTeacherForm();
      renderAdminTeachersCrudTable();
    }

    function adminEditTeacher(teacherId) {
      const t = db.Teachers.find(function(x) { return x.TeacherID === teacherId; });
      if (!t) return;
      document.getElementById('editTeacherId').value = t.TeacherID;
      document.getElementById('tchNameInput').value = t.TeacherName;
      document.getElementById('tchPinInput').value = '';
      document.getElementById('tchRoleInput').value = t.Role;
      document.getElementById('tchSubjectsInput').value = t.Subjects;
      document.getElementById('tchSectionsInput').value = t.AssignedSections;
      renderAdminTeacherPermissionPickers();
    }

    async function adminResetTeacherPinOneTime(teacherId) {
      const t = db.Teachers.find(function(x) { return x.TeacherID === teacherId; });
      if (!t) return;
      const randomPin = String(Math.floor(1000 + Math.random() * 9000));
      t.PINHash = await computePinHash(randomPin);
      delete t.PIN;
      logAuditEvent('إعادة تعيين رمز PIN', 'توليد رمز دخول عشوائي جديد للمعلم ' + t.TeacherName);
      saveStateToStorage();

      document.getElementById('oneTimePinTeacherLbl').textContent = 'المعلم: ' + t.TeacherName + ' (' + t.TeacherID + ')';
      document.getElementById('oneTimePinValueBox').textContent = randomPin;
      openModalDialog('oneTimePinModal');
    }

    function copyOneTimePin() {
      const code = document.getElementById('oneTimePinValueBox').textContent;
      copyTextSafe(code);
      showToast('📋 تم نسخ الرمز الجديد إلى الحافظة', 'success');
    }

    function closeOneTimePinModal() {
      document.getElementById('oneTimePinValueBox').textContent = '----';
      const m = document.getElementById('oneTimePinModal');
      m.classList.add('hidden');
      m.classList.remove('flex');
    }

    function adminToggleTeacherStatus(teacherId) {
      const t = db.Teachers.find(function(x) { return x.TeacherID === teacherId; });
      if (!t) return;
      if (t.Role === 'admin' && t.Status !== 'suspended') {
        const activeAdmins = db.Teachers.filter(function(x) { return x.Role === 'admin' && x.Status !== 'suspended'; }).length;
        if (activeAdmins <= 1) {
          showToast('⛔ لا يمكن إيقاف آخر مدير نشط في النظام!', 'danger');
          return;
        }
      }
      t.Status = t.Status === 'suspended' ? 'active' : 'suspended';
      logAuditEvent('تغيير حالة معلم', (t.Status === 'suspended' ? 'إيقاف مؤقت لحساب ' : 'إعادة تفعيل حساب ') + t.TeacherName);
      saveStateToStorage();
      renderAdminTeachersCrudTable();
      showToast(t.Status === 'suspended' ? '⏸️ تم إيقاف حساب المعلم مؤقتاً' : '▶️ تم تفعيل حساب المعلم', 'info');
    }

    function adminDeleteTeacher(teacherId) {
      const t = db.Teachers.find(function(x) { return x.TeacherID === teacherId; });
      if (!t) return;
      if (t.Role === 'admin') {
        const adminCount = db.Teachers.filter(function(x) { return x.Role === 'admin'; }).length;
        if (adminCount <= 1) {
          showToast('⛔ لا يمكن حذف آخر مدير في النظام!', 'danger');
          return;
        }
      }
      const hasLogs = db.Points_Log.some(function(l) { return l.TeacherID === teacherId; });
      db.Teachers = db.Teachers.filter(function(x) { return x.TeacherID !== teacherId; });
      logAuditEvent('حذف معلم', 'حذف المعلم ' + t.TeacherName + (hasLogs ? ' (مع بقاء سجلاته التاريخية)' : ''));
      triggerSoftDelete('teacher', [t], 'تم حذف المعلم ' + t.TeacherName + (hasLogs ? ' (له سجلات سابقة)' : ''));
      saveStateToStorage();
      renderAdminTeachersCrudTable();
    }

    function adminResetTeacherForm() {
      document.getElementById('editTeacherId').value = '';
      document.getElementById('tchNameInput').value = '';
      document.getElementById('tchPinInput').value = '';
      document.getElementById('tchRoleInput').value = 'teacher';
      document.getElementById('tchSubjectsInput').value = '';
      document.getElementById('tchSectionsInput').value = '';
      renderAdminTeacherPermissionPickers();
    }

    function renderAdminTeachersCrudTable() {
      renderAdminTeacherPermissionPickers();
      const tbody = document.getElementById('adminTeachersCrudBody');
      if (!tbody) return;
      tbody.innerHTML = db.Teachers.map(function(t) {
        const isSusp = t.Status === 'suspended';
        return '<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 ' + (isSusp ? 'opacity-60' : '') + '">' +
          '<td class="py-2.5 px-3 font-mono text-slate-500">' + escapeHtml(t.TeacherID) + '</td>' +
          '<td class="py-2.5 px-3 font-extrabold">' + escapeHtml(t.TeacherName) + '</td>' +
          '<td class="py-2.5 px-3 text-center"><span class="px-2 py-0.5 rounded-full text-[11px] font-bold ' + (isSusp ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800') + '">' + (isSusp ? 'موقوف مؤقتاً' : 'نشط') + '</span></td>' +
          '<td class="py-2.5 px-3 text-center"><span class="px-2 py-0.5 rounded text-[11px] font-bold ' + (t.Role === 'admin' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 dark:bg-slate-800') + '">' + escapeHtml(t.Role) + '</span></td>' +
          '<td class="py-2.5 px-3 font-semibold max-w-[180px] truncate" title="' + escapeHtml(t.Subjects) + '">' + (String(t.Subjects || '').split(',').length > 6 ? 'جميع المواد (' + formatNum(String(t.Subjects).split(',').length) + ' مادة)' : escapeHtml(t.Subjects)) + '</td>' +
          '<td class="py-2.5 px-3 font-mono text-[11px]" dir="ltr">' + escapeHtml(t.AssignedSections) + '</td>' +
          '<td class="py-2.5 px-3 text-center space-x-1 space-x-reverse whitespace-nowrap">' +
            '<button type="button" onclick="adminResetTeacherPinOneTime(\'' + escapeJsAttr(t.TeacherID) + '\')" class="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-2 py-1 rounded-lg font-bold">🔑 إعادة تعيين الرمز</button>' +
            '<button type="button" onclick="adminEditTeacher(\'' + escapeJsAttr(t.TeacherID) + '\')" class="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg font-bold">تعديل ✏️</button>' +
            '<button type="button" onclick="adminToggleTeacherStatus(\'' + escapeJsAttr(t.TeacherID) + '\')" class="text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-lg font-bold">' + (isSusp ? 'تفعيل ▶️' : 'إيقاف ⏸️') + '</button>' +
            '<button type="button" onclick="adminDeleteTeacher(\'' + escapeJsAttr(t.TeacherID) + '\')" class="text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg font-bold">حذف 🗑️</button>' +
          '</td>' +
        '</tr>';
      }).join('');
    }

