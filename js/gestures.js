/**
 * الوحدة البرمجية: js/gestures.js
 * الوصف: محرك الإيماءات الموحد (Pointer Events + setPointerCapture) وتطبيق النقاط والتراجع الفوري
 * المنظومة: منظومة النقاط والإدارة المدرسية الشاملة — ثانوية الصحابة الشرعية
 */
    // 13. محرك الإيماءات الموحد بـ Pointer Events (pointerdown/move/up/cancel + setPointerCapture)
    function initGridEventDelegation() {
      const grid = document.getElementById('studentsQuickGrid');
      if (!grid) return;

      const EDGE_GUARD_PX = 22; // حماية حواف الشاشة من التعارض مع إيماءة الرجوع في iOS/Android
      const activePointers = new Set();
      let activeCard = null;
      let activeStudentId = null;
      let trackedPointerId = null;
      let startX = 0;
      let startY = 0;
      let gestureMode = 'none'; // 'none' | 'tap' | 'swipe_x' | 'scroll_y' | 'longpress'
      let pressTimer = null;
      let previewBadge = null;

      function clearSwipePreview() {
        if (previewBadge && previewBadge.parentNode) {
          previewBadge.parentNode.removeChild(previewBadge);
        }
        previewBadge = null;
        if (activeCard) {
          activeCard.style.transform = '';
        }
      }

      function cancelPressTimer() {
        if (pressTimer) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
      }

      function abortActiveGesture() {
        cancelPressTimer();
        clearSwipePreview();
        if (activeCard && trackedPointerId !== null) {
          try {
            if (activeCard.hasPointerCapture(trackedPointerId)) {
              activeCard.releasePointerCapture(trackedPointerId);
            }
          } catch (e) {}
        }
        activeCard = null;
        activeStudentId = null;
        trackedPointerId = null;
        gestureMode = 'none';
      }

      function handleTapAction(studentId) {
        if (selectedStudentIds.length > 0) {
          const idx = selectedStudentIds.indexOf(studentId);
          if (idx === -1) selectedStudentIds.push(studentId);
          else selectedStudentIds.splice(idx, 1);
          triggerMobileFeedback('tap');
          updateBatchSelectionUI();
          updateSingleStudentCardDOM(studentId);
          return;
        }
        const rules = getEvalRules();
        const activeRule = rules.find(function(r) { return r.ItemID === selectedEvalRuleId; }) || rules[0];
        if (activeRule) {
          applyPointsToStudent(studentId, {
            Label: activeRule.Label,
            PointsValue: Number(activeRule.PointsValue) || 1,
            ActionCategory: getRuleActionCategory(activeRule)
          });
        }
      }

      // منع قائمة السياق/النسخ الافتراضية على بطاقات الطلاب
      grid.addEventListener('contextmenu', function(ev) {
        if (ev.target.closest('[data-student-id]')) {
          ev.preventDefault();
        }
      });

      // إلغاء أي إيماءة جارية عند تدوير الشاشة أو تغير أبعاد النافذة
      window.addEventListener('orientationchange', abortActiveGesture);
      window.addEventListener('blur', abortActiveGesture);

      grid.addEventListener('pointerdown', function(ev) {
        if (ev.pointerType === 'mouse' && ev.button !== 0) return;
        activePointers.add(ev.pointerId);

        // إذا لمس المستخدم الشاشة بإصبعين (تكبير/تصغير) نلغي الإيماءة فوراً لمنع الرصد الخاطئ
        if (activePointers.size > 1) {
          abortActiveGesture();
          return;
        }

        const card = ev.target.closest('[data-student-id]');
        if (!card) return;

        activeCard = card;
        activeStudentId = card.getAttribute('data-student-id');
        trackedPointerId = ev.pointerId;
        startX = ev.clientX;
        startY = ev.clientY;
        gestureMode = 'tap';

        cancelPressTimer();
        pressTimer = setTimeout(function() {
          if (gestureMode === 'tap' && activeStudentId) {
            gestureMode = 'longpress';
            clearSwipePreview();
            triggerMobileFeedback('longpress');
            openStudentModal(activeStudentId);
          }
        }, 430);
      });

      grid.addEventListener('pointermove', function(ev) {
        if (!activeCard || ev.pointerId !== trackedPointerId) return;
        if (activePointers.size > 1) {
          abortActiveGesture();
          return;
        }

        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        if (absX > 10 || absY > 10) {
          cancelPressTimer();
        }

        if (gestureMode === 'longpress' || gestureMode === 'scroll_y') return;

        if (gestureMode === 'tap') {
          // قفل مبكر للتمرير العمودي لمنع أي تسجيل خاطئ أثناء التمرير السريع
          if (absY > 10 && absY >= absX) {
            gestureMode = 'scroll_y';
            clearSwipePreview();
            return;
          }
          // قفل السحب الأفقي مع احترام هامش الحافة (Edge Guard) لعدم التعارض مع رجوع المتصفح
          const isNearScreenEdge = startX < EDGE_GUARD_PX || startX > (window.innerWidth - EDGE_GUARD_PX);
          if (appSettings.swipeEnabled && !isNearScreenEdge && absX > 12 && absX > absY * 1.2) {
            gestureMode = 'swipe_x';
            try {
              activeCard.setPointerCapture(ev.pointerId);
            } catch (e) {}
          }
        }

        if (gestureMode === 'swipe_x') {
          const clampedX = Math.max(-30, Math.min(30, dx * 0.55));
          activeCard.style.transform = 'translateX(' + clampedX + 'px)';

          if (!previewBadge) {
            previewBadge = document.createElement('span');
            activeCard.appendChild(previewBadge);
          }
          if (dx >= SWIPE_THRESHOLD_PX) {
            previewBadge.className = 'absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-600 text-white shadow-lg pointer-events-none z-20 whitespace-nowrap';
            previewBadge.textContent = '+1 مشاركة';
          } else if (dx <= -SWIPE_THRESHOLD_PX) {
            previewBadge.className = 'absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[11px] font-black bg-rose-600 text-white shadow-lg pointer-events-none z-20 whitespace-nowrap';
            previewBadge.textContent = '-1 تنبيه';
          } else {
            previewBadge.className = 'hidden';
          }
        }
      });

      grid.addEventListener('pointerup', function(ev) {
        activePointers.delete(ev.pointerId);
        if (!activeCard || ev.pointerId !== trackedPointerId) return;

        const studentId = activeStudentId;
        const mode = gestureMode;
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;

        abortActiveGesture();

        if (mode === 'longpress' || mode === 'scroll_y') return;

        if (mode === 'swipe_x' && appSettings.swipeEnabled) {
          if (dx >= SWIPE_THRESHOLD_PX) {
            applyPointsToStudent(studentId, {
              Label: 'مشاركة (سحب لليمين)',
              PointsValue: 1,
              ActionCategory: 'participation'
            });
          } else if (dx <= -SWIPE_THRESHOLD_PX) {
            applyPointsToStudent(studentId, {
              Label: 'تنبيه سلوكي (سحب لليسار)',
              PointsValue: -1,
              ActionCategory: 'behavior'
            });
          }
        } else if (mode === 'tap' && Math.abs(dx) < 12 && Math.abs(dy) < 12) {
          handleTapAction(studentId);
        }
      });

      grid.addEventListener('pointercancel', function(ev) {
        activePointers.delete(ev.pointerId);
        if (ev.pointerId === trackedPointerId) {
          abortActiveGesture();
        }
      });
    }

    // 14. تطبيق حركة النقاط مع تحديث البطاقة المتأثرة فقط (Targeted DOM Update) وسجل آخر 10 حركات
    function applyPointsToStudent(studentId, ruleObj) {
      const student = db.Students.find(function(s) { return s.StudentID === studentId; });
      if (!student) return;

      const delta = Number(ruleObj.PointsValue) || 0;
      const nowStr = getFormattedTimestamp();
      const todayPrefix = getFormattedDateOnly();
      const logEntry = {
        LogID: 'LOG-' + Date.now() + '-' + Math.floor(Math.random() * 100),
        Timestamp: nowStr,
        StudentID: student.StudentID,
        TeacherID: currentTeacher ? currentTeacher.TeacherID : 'TCH-01',
        Subject: currentSubject || 'عام',
        Grade: student.Grade,
        Section: student.Section,
        ActionCategory: ruleObj.ActionCategory || 'participation',
        ActionLabel: ruleObj.Label,
        PointsDelta: delta
      };

      db.Points_Log.push(logEntry);
      indexSinglePointLogInCache(logEntry, todayPrefix);
      student.TotalPoints = studentTotalsCache[student.StudentID] || 0;

      lastPointAction = logEntry;
      lastBatchLogIds = [];
      recentActionsStack.unshift({
        LogID: logEntry.LogID,
        StudentID: student.StudentID,
        StudentName: student.StudentName,
        ActionLabel: ruleObj.Label,
        PointsDelta: delta,
        Timestamp: nowStr
      });
      if (recentActionsStack.length > 10) recentActionsStack.length = 10;

      triggerMobileFeedback(delta >= 0 ? 'positive' : 'negative');
      saveStateToStorage();

      enqueueSyncOperation({ opType: 'addPointLog', ...logEntry });

      const undoBtn = document.getElementById('undoActionBtn');
      if (undoBtn) undoBtn.disabled = false;
      const ticker = document.getElementById('lastActionTicker');
      if (ticker) {
        ticker.textContent = 'آخر رصد: ' + shortenStudentName(student.StudentName) + ' (' + formatNum(delta, true) + ' ' + ruleObj.Label + ')';
      }

      // تحديث البطاقة المتأثرة فقط أو إعادة الفرز إن كان الفرز بالنقاط مفعلاً
      if (gridSortMode !== 'roll' || filterUnrecordedToday) {
        renderStudentGrid();
      } else {
        updateSingleStudentCardDOM(student.StudentID);
      }

      const cardEl = document.getElementById('stdCard_' + student.StudentID);
      if (cardEl) {
        cardEl.classList.remove('flash-positive', 'flash-negative');
        void cardEl.offsetWidth;
        cardEl.classList.add(delta >= 0 ? 'flash-positive' : 'flash-negative');

        const badge = document.createElement('span');
        badge.className = 'floating-delta absolute top-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-xs font-black shadow ' +
          (delta >= 0 ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white');
        badge.textContent = formatNum(delta, true);
        cardEl.appendChild(badge);
        setTimeout(function() {
          if (badge.parentNode) badge.parentNode.removeChild(badge);
        }, 700);
      }

      showToast(
        shortenStudentName(student.StudentName) + ': ' + ruleObj.Label + ' (' + formatNum(delta, true) + ')',
        delta >= 0 ? 'success' : 'danger',
        function() { undoSpecificLogId(logEntry.LogID); }
      );
    }

    function undoSpecificLogId(targetLogId) {
      const foundLog = db.Points_Log.find(function(l) { return l.LogID === targetLogId; });
      if (!foundLog) return;
      db.Points_Log = db.Points_Log.filter(function(l) { return l.LogID !== targetLogId; });
      recentActionsStack = recentActionsStack.filter(function(r) { return r.LogID !== targetLogId; });
      if (lastPointAction && lastPointAction.LogID === targetLogId) {
        lastPointAction = recentActionsStack[0] || null;
      }
      rebuildPerformanceCaches();
      saveStateToStorage();
      enqueueSyncOperation({ opType: 'undoPointLog', LogID: targetLogId, StudentID: foundLog.StudentID });
      document.getElementById('undoActionBtn').disabled = (!lastPointAction && lastBatchLogIds.length === 0);
      renderStudentGrid();
      renderRecent10ActionsList();
      showToast('↩️ تم التراجع عن الحركة بنجاح', 'warning');
    }

    function undoLastPointAction() {
      if (!lastPointAction && lastBatchLogIds.length === 0) return;

      if (lastBatchLogIds.length > 0) {
        const count = lastBatchLogIds.length;
        db.Points_Log = db.Points_Log.filter(function(l) {
          return lastBatchLogIds.indexOf(l.LogID) === -1;
        });
        lastBatchLogIds = [];
        lastPointAction = null;
        rebuildPerformanceCaches();
        saveStateToStorage();
        document.getElementById('undoActionBtn').disabled = true;
        document.getElementById('lastActionTicker').textContent = 'تم التراجع عن الرصد الجماعي (' + formatNum(count) + ' طالب)';
        renderStudentGrid();
        showToast('↩️ تم التراجع عن الرصد الجماعي (' + formatNum(count) + ' طالب)', 'warning');
        return;
      }

      undoSpecificLogId(lastPointAction.LogID);
    }

    function openRecentActionsModal() {
      const gm = document.getElementById('gridMoreMenu');
      if (gm) gm.classList.add('hidden');
      renderRecent10ActionsList();
      openModalDialog('recentActionsModal');
    }

    function closeRecentActionsModal() {
      closeModalDialog('recentActionsModal');
    }

    function renderRecent10ActionsList() {
      const listEl = document.getElementById('recent10ActionsList');
      if (!listEl) return;
      if (recentActionsStack.length === 0) {
        listEl.innerHTML = '<div class="text-slate-400 text-center py-4">لا توجد حركات حديثة في هذه الجلسة.</div>';
        return;
      }
      listEl.innerHTML = recentActionsStack.map(function(item) {
        const d = Number(item.PointsDelta) || 0;
        return '<div class="flex items-center justify-between bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl">' +
          '<div>' +
            '<div class="font-extrabold">' + escapeHtml(item.StudentName) + ' <span class="font-mono text-xs ' + (d >= 0 ? 'text-emerald-600' : 'text-rose-600') + '">(' + formatNum(d, true) + ')</span></div>' +
            '<div class="text-[11px] text-slate-500">' + escapeHtml(item.ActionLabel) + ' • ' + escapeHtml(item.Timestamp) + '</div>' +
          '</div>' +
          '<button type="button" onclick="undoSpecificLogId(\'' + escapeJsAttr(item.LogID) + '\')" class="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-3 py-1 rounded-lg">↩️ تراجع</button>' +
        '</div>';
      }).join('');
    }

