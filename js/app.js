/**
 * الوحدة البرمجية: js/app.js
 * الوصف: نقطة الدخول الرئيسية، تثبيت PWA، القياس الديناميكي للشريط السفلي، وتفويض الأحداث العام
 * المنظومة: منظومة النقاط والإدارة المدرسية الشاملة — ثانوية الصحابة الشرعية
 */
    // 23. إدارة تثبيت PWA، تحديثات Service Worker، القياس الديناميكي للشريط السفلي، وحماية لوحة المفاتيح
    let waitingServiceWorker = null;
    let deferredInstallPrompt = null;

    window.addEventListener('beforeinstallprompt', function(ev) {
      ev.preventDefault();
      deferredInstallPrompt = ev;
      const loginBtn = document.getElementById('loginInstallPwaBtn');
      if (loginBtn) loginBtn.classList.remove('hidden');
    });

    window.addEventListener('appinstalled', function() {
      deferredInstallPrompt = null;
      showToast('🎉 تم تثبيت تطبيق ثانوية الصحابة الشرعية على جهازك بنجاح!', 'success');
    });

    async function triggerPwaInstallFlow() {
      const hm = document.getElementById('headerOverflowMenu');
      if (hm) hm.classList.add('hidden');

      if (deferredInstallPrompt) {
        try {
          deferredInstallPrompt.prompt();
          await deferredInstallPrompt.userChoice;
          deferredInstallPrompt = null;
          return;
        } catch (e) {}
      }
      openModalDialog('iosInstallModal');
    }

    function closeIosInstallModal() {
      closeModalDialog('iosInstallModal');
    }

    function initDynamicFooterAndKeyboardGuard() {
      const footerEl = document.getElementById('mainBottomFooter');
      if (!footerEl) return;

      // 1) قياس الارتفاع الفعلي للشريط السفلي ديناميكياً وتحديث --footer-h
      if ('ResizeObserver' in window) {
        const ro = new ResizeObserver(function(entries) {
          for (let i = 0; i < entries.length; i++) {
            const h = Math.ceil(entries[i].target.getBoundingClientRect().height);
            if (h > 20) {
              document.documentElement.style.setProperty('--footer-h', h + 'px');
            }
          }
        });
        ro.observe(footerEl);
      }

      // 2) إخفاء الشريط السفلي تلقائياً عند ظهور لوحة المفاتيح على الجوال لمنع تغطية الحقول
      function setKeyboardFooterHidden(isHidden) {
        if (isHidden) {
          footerEl.classList.add('keyboard-open-hide-footer');
        } else {
          footerEl.classList.remove('keyboard-open-hide-footer');
        }
      }

      if (window.visualViewport) {
        let baselineHeight = window.visualViewport.height;
        window.visualViewport.addEventListener('resize', function() {
          const currentH = window.visualViewport.height;
          if (currentH > baselineHeight) baselineHeight = currentH;
          const keyboardLikelyOpen = (baselineHeight - currentH) > 130;
          setKeyboardFooterHidden(keyboardLikelyOpen);
        });
      }

      document.addEventListener('focusin', function(ev) {
        if (window.innerWidth > 768) return;
        const tag = ev.target && ev.target.tagName ? ev.target.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea') {
          const type = (ev.target.getAttribute('type') || 'text').toLowerCase();
          if (type !== 'checkbox' && type !== 'radio' && type !== 'file') {
            setKeyboardFooterHidden(true);
          }
        }
      });

      document.addEventListener('focusout', function() {
        setTimeout(function() {
          const activeTag = document.activeElement && document.activeElement.tagName
            ? document.activeElement.tagName.toLowerCase()
            : '';
          if (activeTag !== 'input' && activeTag !== 'textarea') {
            setKeyboardFooterHidden(false);
          }
        }, 120);
      });
    }

    function registerPWAFeatures() {
      try {
        if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
          navigator.serviceWorker.register('./sw.js').then(function(reg) {
            if (reg.waiting) {
              waitingServiceWorker = reg.waiting;
              const banner = document.getElementById('pwaUpdateBanner');
              if (banner) banner.classList.remove('hidden');
            }
            reg.addEventListener('updatefound', function() {
              const newWorker = reg.installing;
              if (!newWorker) return;
              newWorker.addEventListener('statechange', function() {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  waitingServiceWorker = newWorker;
                  const banner = document.getElementById('pwaUpdateBanner');
                  if (banner) banner.classList.remove('hidden');
                }
              });
            });
          }).catch(function() {});

          let refreshing = false;
          navigator.serviceWorker.addEventListener('controllerchange', function() {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
          });
        }
      } catch (e) {}
    }

    function applyPwaUpdate() {
      if (waitingServiceWorker) {
        waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
      } else {
        window.location.reload();
      }
    }

    window.addEventListener('online', function() {
      updateFooterStatus();
      if (offlineQueue.length > 0 && gasWebAppUrl) {
        syncOfflineQueueNow(true);
      }
    });
    window.addEventListener('offline', updateFooterStatus);


    /**
     * معجم النصوص العربية الموحد للواجهة ورسائل الأخطاء والحالات الفارغة (UI_STRINGS)
     */
    const UI_STRINGS = {
      appTitle: 'منظومة النقاط والإدارة المدرسية | ثانوية الصحابة الشرعية',
      emptyStudentsGrid: 'لا يوجد طلاب مطابقون لمعايير البحث أو الفلترة في هذه الشعبة حالياً.',
      emptyReportsList: 'لا توجد سجلات طلاب مطابقة لهذا الفلتر في تقارير المعلم.',
      emptyNotesList: 'لا توجد ملاحظات تربوية أو أكاديمية مسجلة لهذا الطالب بعد.',
      emptyAuditLog: 'لا توجد عمليات إدارية مطابقة في سجل التدقيق.',
      syncSuccess: '☁️ تمت مزامنة كافة الحركات المعلقة مع Google Sheets بنجاح!',
      syncOfflineSaved: '📴 أنت دون اتصال؛ حُفظت الحركة بأمان في الطابور المحلي وستُزامن تلقائياً فور عودة الشبكة.',
      unauthorizedError: '⛔ رفض الخادم العملية: تحقق من صحة رمز المصادقة السحابي (API Token).'
    };

    /**
     * كائن الحالة المركزي الموحد (Unified Application State Proxy)
     * يوفّر واجهة موحدة لقراءة وتعديل حالة التطبيق دون تشتيت المتغيرات العامة
     */
    const appState = {
      get db() { return db; },
      set db(val) { db = val; },
      get settings() { return appSettings; },
      set settings(val) { appSettings = val; },
      get teacher() { return currentTeacher; },
      set teacher(val) { currentTeacher = val; },
      get section() { return currentSection; },
      set section(val) { currentSection = val; },
      get subject() { return currentSubject; },
      set subject(val) { currentSubject = val; },
      get evalRuleId() { return selectedEvalRuleId; },
      set evalRuleId(val) { selectedEvalRuleId = val; },
      get queue() { return offlineQueue; },
      set queue(val) { offlineQueue = val; }
    };

    /**
     * تفويض الأحداث المركزي (Global Event Delegation عبر data-action)
     * يتيح تشغيل جميع الأزرار والمدخلات عبر سمات data-action دون الحاجة لمعالجات onclick المضمنة،
     * مما يسهّل الصيانة ويمكّن من تطبيق سياسة أمان المحتوى (CSP).
     */
    function initGlobalActionDelegation() {
      document.addEventListener('click', function(ev) {
        const actionEl = ev.target.closest('[data-action]');
        if (!actionEl || actionEl.disabled) return;
        const actionName = actionEl.getAttribute('data-action');
        const arg1 = actionEl.getAttribute('data-arg1');
        const arg2 = actionEl.getAttribute('data-arg2');
        if (actionName && typeof window[actionName] === 'function') {
          ev.preventDefault();
          window[actionName](arg1 !== null ? arg1 : undefined, arg2 !== null ? (isNaN(Number(arg2)) ? arg2 : Number(arg2)) : undefined);
        }
      });
    }

    window.addEventListener('DOMContentLoaded', function() {
      initGlobalActionDelegation();
      loadStateFromStorage();
      initGridEventDelegation();
      initDynamicFooterAndKeyboardGuard();
      registerPWAFeatures();
      updatePinDotsUI();
      if (gasWebAppUrl && navigator.onLine) {
        pullAllFromCloud();
      }
    });
