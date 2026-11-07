/**
 * الوحدة البرمجية: js/utils.js
 * الوصف: أدوات التطهير الأمني، تنسيق الأرقام العربية/اللاتينية، والتجزئة التشفيرية SHA-256
 * المنظومة: منظومة النقاط والإدارة المدرسية الشاملة — ثانوية الصحابة الشرعية
 */
    // 0. الأعلام والثوابت الأمنية والهندسية
    // ضع رابط Web App URL هنا بين العلامتين إذا أردت تثبيته نهائياً في الكود على GitHub لكل المعلمين:
    const DEFAULT_GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxszYL_HZ04vtRQLlLXIlCqCfstpqIiFEIEeC1_FVRy4QdvrtqmqLU5fhJpfQraPSK-/exec';
    const DEFAULT_GAS_API_TOKEN = 'SAHABA-SEC-2026-TOKEN';
    const PIN_SALT = 'school_pwa_sha256_salt_2026_v3';
    const SWIPE_THRESHOLD_PX = 30; // عتبة السحب المرفوعة لمنع السحب العرضي على الجوال
    const MAX_LOGIN_ATTEMPTS = 5;
    const LOCKOUT_DURATION_MS = 60000; // قفل مؤقت لمدة 60 ثانية بعد 5 محاولات خاطئة

    // دالة تهريب النصوص لمنع ثغرات XSS في جميع مواضع الواجهة
    function escapeHtml(value) {
      if (value === null || value === undefined) return '';
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    // دالة تطهير النصوص الممررة داخل سمات ومعالجات أحداث JS المضمنة لمنع كسر علامات التنصيص أو XSS
    function escapeJsAttr(value) {
      if (value === null || value === undefined) return '';
      return String(value)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '&quot;')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\r/g, '')
        .replace(/\n/g, ' ');
    }

    // دالة تنسيق الأرقام (لاتينية 123 أو هندية ١٢٣) مع ضبط الإشارات داخل RTL
    function formatNum(val, forcePlusSign) {
      const n = Number(val) || 0;
      const sign = forcePlusSign && n > 0 ? '+' : (n < 0 ? '-' : '');
      const absStr = String(Math.abs(n));
      const formattedDigits = appSettings.numFormat === 'arabic'
        ? absStr.replace(/[0-9]/g, function(d) { return '٠١٢٣٤٥٦٧٨٩'[d]; })
        : absStr;
      return sign + formattedDigits;
    }

    // دالة التجزئة التشفيرية للرمز السري (SHA-256 via Web Crypto API مع بديل متوافق)
    function fallbackSha256Hex(ascii) {
      function rightRotate(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
      const mathPow = Math.pow, maxWord = mathPow(2, 32);
      let result = '';
      const words = [], asciiBitLength = ascii.length * 8;
      let hash = [], k = [];
      let primeCounter = 0;
      const isComposite = {};
      for (let candidate = 2; primeCounter < 64; candidate++) {
        if (!isComposite[candidate]) {
          for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
          hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
          k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
        }
      }
      ascii += '\x80';
      while ((ascii.length % 64) - 56) ascii += '\x00';
      for (let i = 0; i < ascii.length; i++) {
        const j = ascii.charCodeAt(i);
        words[i >> 2] |= j << ((3 - (i % 4)) * 8);
      }
      words[words.length] = (asciiBitLength / maxWord) | 0;
      words[words.length] = asciiBitLength;
      for (let j = 0; j < words.length;) {
        const w = words.slice(j, (j += 16));
        const oldHash = hash.slice(0);
        for (let i = 0; i < 64; i++) {
          const w15 = w[i - 15], w2 = w[i - 2];
          const a = hash[0], e = hash[4];
          const temp1 = hash[7] + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) + ((e & hash[5]) ^ (~e & hash[6])) + k[i] +
            (w[i] = i < 16 ? w[i] : (w[i - 16] + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0);
          const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
          hash = [(temp1 + temp2) | 0].concat(hash);
          hash[4] = (hash[4] + temp1) | 0;
          hash.pop();
        }
        for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
      }
      for (let i = 0; i < 8; i++) {
        for (let j = 3; j + 1; j--) {
          const b = (hash[i] >> (j * 8)) & 255;
          result += (b < 16 ? 0 : '') + b.toString(16);
        }
      }
      return result;
    }

    async function computePinHash(pinPlain) {
      const salted = PIN_SALT + ':' + String(pinPlain).trim();
      try {
        if (window.crypto && window.crypto.subtle) {
          const msgBuffer = new TextEncoder().encode(salted);
          const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          return hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
        }
      } catch (e) {}
      return fallbackSha256Hex(unescape(encodeURIComponent(salted)));
    }

    function computePinHashSync(pinPlain) {
      const salted = PIN_SALT + ':' + String(pinPlain).trim();
      return fallbackSha256Hex(unescape(encodeURIComponent(salted)));
    }

