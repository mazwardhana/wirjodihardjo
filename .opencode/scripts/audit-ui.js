// audit-ui.js — measurable UI quality audit. Paste into a browser page context
// (browser MCP evaluate_script, or DevTools console) and read the returned JSON.
//
// Returns per-finding selectors plus a summary.pass boolean. pass is true only when
// contrast, tap targets, input font size and image sizing are all clean and the page
// does not scroll horizontally.
//
// Set the viewport to 360x800 (mobile) before running, and re-apply device emulation
// AFTER navigating — emulation overrides are reset by navigation.
(() => {
  const MIN_TAP = 44;
  const MIN_INPUT_FONT = 16;
  const AA_NORMAL = 4.5;
  const AA_LARGE = 3.0;
  const MAX_PER_SECTION = 25; // keep the payload out of the context budget

  const parseColor = (s) => {
    const m = s && s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const chan = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const lum = ({ r, g, b }) => 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const ratio = (a, b) => {
    const la = lum(a), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };

  // Gradient backgrounds: take the first color stop. Without this, white text on a
  // hero gradient is misreported as white-on-white — the top false positive.
  const gradientColor = (s) => {
    const bi = s.backgroundImage;
    if (!bi || bi === 'none' || !bi.includes('gradient')) return null;
    const m = bi.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}\b/);
    if (!m) return null;
    if (m[0][0] === '#') {
      let h = m[0].slice(1);
      if (h.length === 3) h = h.split('').map((c) => c + c).join('');
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: 1,
      };
    }
    return parseColor(m[0]);
  };

  // Effective background: walk ancestors until an opaque color or a gradient.
  const effectiveBg = (el) => {
    let node = el;
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    const stack = [];
    while (node && node.nodeType === 1) {
      const s = getComputedStyle(node);
      const g = gradientColor(s);
      if (g) { stack.push(g); break; }
      const c = parseColor(s.backgroundColor);
      if (c && c.a > 0) {
        stack.push(c);
        if (c.a === 1) break;
      }
      node = node.parentElement;
    }
    for (let i = stack.length - 1; i >= 0; i--) bg = over(stack[i], bg);
    return bg;
  };

  const sel = (el) => {
    const id = el.id ? '#' + el.id : '';
    const cls = (el.className || '').toString().trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return el.tagName.toLowerCase() + id + (cls.length ? '.' + cls.join('.') : '');
  };
  const text = (el) => (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const ownTextNodes = (el) => [...el.childNodes].filter((n) => n.nodeType === 3);

  const report = {
    url: location.href,
    viewport: { w: innerWidth, h: innerHeight },
    scrollWidth: document.documentElement.scrollWidth,
    horizontalScroll: document.documentElement.scrollWidth > innerWidth + 1,
    contrast: [],
    tapTargets: [],
    inputFont: [],
    images: [],
    emojiIcons: [],
    hardcodedHex: [],
  };

  const all = [...document.querySelectorAll('body *')].filter(visible);

  for (const el of all) {
    const s = getComputedStyle(el);

    // --- text contrast ---
    const own = ownTextNodes(el).map((n) => n.textContent.trim()).join(' ').trim();
    if (own.length >= 2) {
      const fg = parseColor(s.color);
      if (fg) {
        const bg = effectiveBg(el);
        const fgOnBg = fg.a < 1 ? over(fg, bg) : fg;
        const cr = ratio(fgOnBg, bg);
        const px = parseFloat(s.fontSize);
        const bold = parseInt(s.fontWeight, 10) >= 700;
        const large = px >= 24 || (px >= 18.66 && bold);
        const need = large ? AA_LARGE : AA_NORMAL;
        if (cr < need) {
          report.contrast.push({
            selector: sel(el),
            text: text(el),
            ratio: Math.round(cr * 100) / 100,
            need,
            fg: s.color,
            bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
            fontSize: s.fontSize,
          });
        }
      }
    }

    // --- tap targets ---
    const interactive = el.matches(
      'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=link], [role=checkbox], [role=radio], [role=switch]'
    );
    if (interactive) {
      const r = el.getBoundingClientRect();
      // Inline links inside running text are not touch controls — exempt them.
      const inlineInText = el.tagName === 'A' && el.closest('p, li') && r.height < 30;
      if (!inlineInText && (r.width < MIN_TAP || r.height < MIN_TAP)) {
        report.tapTargets.push({
          selector: sel(el),
          text: text(el),
          size: `${Math.round(r.width)}\u00d7${Math.round(r.height)}`,
        });
      }
    }

    // --- input font (iOS auto-zoom below 16px) ---
    if (el.matches('input:not([type=hidden]), select, textarea')) {
      const px = parseFloat(s.fontSize);
      if (px < MIN_INPUT_FONT) {
        report.inputFont.push({ selector: sel(el), fontSize: s.fontSize, name: el.name || '' });
      }
    }

    // --- images without intrinsic size (CLS) ---
    if (el.tagName === 'IMG') {
      const hasAttr = el.hasAttribute('width') && el.hasAttribute('height');
      const hasRatio = s.aspectRatio && s.aspectRatio !== 'auto';
      if (!hasAttr && !hasRatio) {
        report.images.push({ selector: sel(el), src: (el.currentSrc || el.src || '').slice(-60) });
      }
    }

    // --- emoji used as an icon (only standalone/short nodes, never prose) ---
    const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
    const ownChars = ownTextNodes(el).map((n) => n.textContent).join('');
    const hits = ownChars.match(new RegExp(EMOJI, 'gu'));
    if (hits && hits.length && ownChars.trim().length <= 6) {
      report.emojiIcons.push({ selector: sel(el), chars: hits.join('') });
    }

    // --- hardcoded hex in inline styles (theme bypassed) ---
    const st = el.getAttribute('style') || '';
    const m = st.match(/#[0-9a-fA-F]{3,8}\b/g);
    if (m) report.hardcodedHex.push({ selector: sel(el), values: [...new Set(m)].join(' ') });
  }

  report.summary = {
    contrastViolations: report.contrast.length,
    tapTargetViolations: report.tapTargets.length,
    inputFontViolations: report.inputFont.length,
    imagesWithoutSize: report.images.length,
    emojiIcons: report.emojiIcons.length,
    hardcodedHex: report.hardcodedHex.length,
    pass:
      report.contrast.length === 0 &&
      report.tapTargets.length === 0 &&
      report.inputFont.length === 0 &&
      report.images.length === 0 &&
      !report.horizontalScroll,
  };

  for (const k of ['contrast', 'tapTargets', 'inputFont', 'images', 'emojiIcons', 'hardcodedHex']) {
    report[k] = report[k].slice(0, MAX_PER_SECTION);
  }
  return JSON.stringify(report, null, 1);
})();
