// Pretext runtime (按需启用)：只有当页面出现标记元素时才会加载 @chenglou/pretext
// 标记：
// - data-pretext-height="1"：A：计算文本高度并设置元素高度（避免排版抖动）
// - data-pretext-bubble="1"：B：在保持行数不变的前提下尽量收紧宽度（v1：二分搜索）
(function () {
  // #region agent log
  fetch('http://127.0.0.1:7806/ingest/8df93df5-a069-4faa-8b45-eb351672274f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'2c7a4c'},body:JSON.stringify({sessionId:'2c7a4c',runId:'run1',hypothesisId:'H1',location:'pretext-runtime.js:6',message:'runtime script executed',data:{path:location.pathname,readyState:document.readyState},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  function qsAll(sel) {
    return Array.from(document.querySelectorAll(sel));
  }

  function debounce(fn, wait) {
    let t = null;
    return function () {
      const args = arguments;
      if (t) clearTimeout(t);
      t = setTimeout(function () {
        t = null;
        fn.apply(null, args);
      }, wait);
    };
  }

  function getInnerWidth(el) {
    const cs = getComputedStyle(el);
    const padL = parseFloat(cs.paddingLeft || "0") || 0;
    const padR = parseFloat(cs.paddingRight || "0") || 0;
    const w = el.clientWidth || 0;
    return Math.max(1, w - padL - padR);
  }

  function getVerticalExtras(el) {
    const cs = getComputedStyle(el);
    const padT = parseFloat(cs.paddingTop || "0") || 0;
    const padB = parseFloat(cs.paddingBottom || "0") || 0;
    const bdT = parseFloat(cs.borderTopWidth || "0") || 0;
    const bdB = parseFloat(cs.borderBottomWidth || "0") || 0;
    return padT + padB + bdT + bdB;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function getLineHeightPx(el) {
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight || "");
    if (!Number.isFinite(lh) || lh <= 0) {
      const fs = parseFloat(cs.fontSize || "16") || 16;
      return fs * 1.4;
    }
    return lh;
  }

  function getCanvasFont(el) {
    const cs = getComputedStyle(el);
    const fontFamily = (cs.fontFamily || "sans-serif").replace(/"/g, "'");
    const fontStyle = cs.fontStyle || "normal";
    const fontWeight = cs.fontWeight || "400";
    const fontSize = cs.fontSize || "16px";
    // canvasFont shorthand
    return `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`;
  }

  function getText(el) {
    // 保持用户内容（pretext 内部会按 white-space: normal 语义归一化）
    return (el.textContent || "").trim();
  }

  function updateReflowMetrics(demoRoot, widthPx, lineCount, heightPx) {
    const wEl = demoRoot.querySelector("[data-pretext-width-value]");
    const lEl = demoRoot.querySelector("[data-pretext-line-count]");
    const hEl = demoRoot.querySelector("[data-pretext-height-value]");
    if (wEl) wEl.textContent = `${Math.round(widthPx)}px`;
    if (lEl) lEl.textContent = String(lineCount);
    if (hEl) hEl.textContent = `${Math.round(heightPx)}px`;
  }

  function measureLineCount(el) {
    const h = el.getBoundingClientRect().height || 0;
    const lh = getLineHeightPx(el);
    return Math.max(1, Math.round(h / Math.max(1, lh)));
  }

  async function loadPretext() {
    // 只加载一次
    if (window.__pretextLayoutEngine) return window.__pretextLayoutEngine;
    try {
      const engine = await import("https://cdn.jsdelivr.net/npm/@chenglou/pretext@0.0.4/dist/layout.js");
      // #region agent log
      fetch('http://127.0.0.1:7806/ingest/8df93df5-a069-4faa-8b45-eb351672274f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'2c7a4c'},body:JSON.stringify({sessionId:'2c7a4c',runId:'run1',hypothesisId:'H1',location:'pretext-runtime.js:72',message:'pretext import success',data:{hasPrepare:typeof engine.prepare==='function',hasLayout:typeof engine.layout==='function'},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      window.__pretextLayoutEngine = engine;
      return engine;
    } catch (e) {
      // #region agent log
      fetch('http://127.0.0.1:7806/ingest/8df93df5-a069-4faa-8b45-eb351672274f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'2c7a4c'},body:JSON.stringify({sessionId:'2c7a4c',runId:'run1',hypothesisId:'H1',location:'pretext-runtime.js:77',message:'pretext import failed',data:{error:String(e&&e.message||e)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      console.warn("[pretext-runtime] pretext import failed, fallback mode:", e);
      window.__pretextLayoutEngine = null;
      return null;
    }
  }

  async function applyHeight(pretext, el) {
    const innerWidth = getInnerWidth(el);
    if (innerWidth <= 0) return;

    const text = getText(el);
    if (!text) return;

    const font = getCanvasFont(el);
    const lineHeightPx = getLineHeightPx(el);

    let textHeight = 0;
    let lineCount = 0;
    if (pretext && typeof pretext.prepare === "function" && typeof pretext.layout === "function") {
      const prepared = pretext.prepare(text, font);
      const out = pretext.layout(prepared, innerWidth, lineHeightPx);
      textHeight = out.height;
      lineCount = out.lineCount;
    } else {
      // fallback：不用 pretext 时仍可工作（粗略）
      const oldH = el.style.height;
      el.style.height = "auto";
      const totalAuto = el.scrollHeight;
      const extraAuto = getVerticalExtras(el);
      textHeight = Math.max(0, totalAuto - extraAuto);
      lineCount = Math.max(1, Math.round(textHeight / lineHeightPx));
      el.style.height = oldH;
    }

    // 避免亚像素导致的微抖动 + 给一个“丝滑过渡”
    const h = Math.ceil(textHeight + getVerticalExtras(el));
    const startH = Math.ceil(el.getBoundingClientRect().height || h);
    if (el.getAttribute("data-pretext-scroll") === "1") {
      el.style.overflowY = "auto";
      el.style.overflowX = "hidden";
    } else {
      el.style.overflow = "hidden";
    }
    el.style.height = startH + "px";
    requestAnimationFrame(function () {
      el.style.height = h + "px";
    });
    el.dataset.pretextLines = String(lineCount);
    // #region agent log
    fetch('http://127.0.0.1:7806/ingest/8df93df5-a069-4faa-8b45-eb351672274f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'2c7a4c'},body:JSON.stringify({sessionId:'2c7a4c',runId:'run1',hypothesisId:'H4',location:'pretext-runtime.js:116',message:'applyHeight computed',data:{innerWidth:Math.round(innerWidth),lineHeightPx:Math.round(lineHeightPx),height:Math.round(h),lineCount:lineCount,pretextReady:!!pretext},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }

  async function applyBubble(pretext, el) {
    const innerWidth0 = getInnerWidth(el);
    if (innerWidth0 <= 0) return;

    const text = getText(el);
    if (!text) return;

    const font = getCanvasFont(el);
    const lineHeightPx = getLineHeightPx(el);
    const prepared = pretext.prepare(text, font);

    const target = pretext.layout(prepared, innerWidth0, lineHeightPx).lineCount;
    if (!target || target <= 0) return;

    const cs = getComputedStyle(el);
    const padL = parseFloat(cs.paddingLeft || "0") || 0;
    const padR = parseFloat(cs.paddingRight || "0") || 0;

    // 二分搜索：越往下宽度越可能增加行数
    let low = Math.max(80, innerWidth0 * 0.25);
    let high = innerWidth0;

    for (let i = 0; i < 18; i++) {
      const mid = (low + high) / 2;
      const { lineCount } = pretext.layout(prepared, mid, lineHeightPx);
      if (lineCount === target) {
        high = mid; // 还能更窄
      } else {
        low = mid; // 行数变多了，回退
      }
    }

    // 写回宽度（通过设置元素宽度限制 content box 的可用宽度）
    const contentW = Math.floor(high);
    const nextElWidth = contentW + padL + padR;
    // 为了让 width 变化也能过渡，先切到 inline-block（不改变最终逻辑）
    el.style.display = "inline-block";
    const startW = Math.ceil(el.getBoundingClientRect().width || nextElWidth);
    el.style.width = startW + "px";
    el.style.maxWidth = startW + "px";
    requestAnimationFrame(function () {
      el.style.width = nextElWidth + "px";
      el.style.maxWidth = nextElWidth + "px";
    });
    el.dataset.pretextBubbleWidth = String(contentW);

    // 再根据最终宽度设置高度（让两者联动，补齐 padding/border）
    const { height } = pretext.layout(prepared, contentW, lineHeightPx);
    const h = Math.ceil(height + getVerticalExtras(el));
    const startH = Math.ceil(el.getBoundingClientRect().height || h);
    el.style.overflow = "hidden";
    el.style.height = startH + "px";
    requestAnimationFrame(function () {
      el.style.height = h + "px";
    });
    el.style.overflow = "hidden";
  }

  async function init() {
    const heightEls = qsAll('[data-pretext-height="1"]');
    const bubbleEls = qsAll('[data-pretext-bubble="1"]');
    // #region agent log
    fetch('http://127.0.0.1:7806/ingest/8df93df5-a069-4faa-8b45-eb351672274f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'2c7a4c'},body:JSON.stringify({sessionId:'2c7a4c',runId:'run1',hypothesisId:'H2',location:'pretext-runtime.js:181',message:'init selector counts',data:{heightEls:heightEls.length,bubbleEls:bubbleEls.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (heightEls.length === 0 && bubbleEls.length === 0) return;

    // 避免重复渲染：同一元素只标记一次进行计算
    const allEls = Array.from(new Set([...heightEls, ...bubbleEls]));
    const heightOnlySet = new Set(heightEls);

    const pretext = await loadPretext();
    const reflowDemos = qsAll(".pretext-reflow-demo");

    const recalcAll = async function () {
      // 并发太多没必要，按顺序即可（demo 体量很小）
      for (const el of allEls) {
        if (!el.isConnected) continue;
        try {
          if (el.dataset.pretextBubble === "1" || el.getAttribute("data-pretext-bubble") === "1") {
            await applyBubble(pretext, el);
          } else if (el.getAttribute("data-pretext-height") === "1") {
            await applyHeight(pretext, el);
          }
        } catch (e) {
          // runtime 不允许影响页面：吞掉异常
          // eslint-disable-next-line no-console
          console.warn("[pretext-runtime] render failed:", e);
        }
      }
    };

    const recalcHeightOnly = async function () {
      for (const el of heightOnlySet) {
        if (!el.isConnected) continue;
        try {
          await applyHeight(pretext, el);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("[pretext-runtime] render failed:", e);
        }
      }
    };

    await recalcAll();

    // 仅在“有趣”这篇互动 demo 存在时启用：滑块驱动实时重排 + 指标回写
    async function initReflowDemos() {
      if (!reflowDemos.length) return;

      for (const demoRoot of reflowDemos) {
        const slider = demoRoot.querySelector('[data-pretext-slider="1"]');
        const target = demoRoot.querySelector('[data-pretext-target="1"]');
        const stage = demoRoot.querySelector('[data-pretext-stage="1"]');
        // #region agent log
        fetch('http://127.0.0.1:7806/ingest/8df93df5-a069-4faa-8b45-eb351672274f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'2c7a4c'},body:JSON.stringify({sessionId:'2c7a4c',runId:'run1',hypothesisId:'H2',location:'pretext-runtime.js:234',message:'reflow demo node binding',data:{hasSlider:!!slider,hasTarget:!!target,hasStage:!!stage},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (!slider || !target || !stage) continue;

        const run = async function () {
          const rawValue = Math.max(120, Number(slider.value || 520));
          const stageWidth = getInnerWidth(stage);
          const targetMin = Math.max(220, Number(slider.min || 220));
          const targetMaxByStage = Math.max(targetMin, Math.floor(stageWidth));
          const value = clamp(rawValue, targetMin, targetMaxByStage);

          slider.max = String(targetMaxByStage);
          if (value !== rawValue) slider.value = String(value);

          target.style.width = `${value}px`;
          target.style.maxWidth = "100%";
          await applyHeight(pretext, target);
          const lines = Number(target.dataset.pretextLines || 0);
          const height = target.getBoundingClientRect().height || 0;
          updateReflowMetrics(demoRoot, value, lines, height);
          // #region agent log
          fetch('http://127.0.0.1:7806/ingest/8df93df5-a069-4faa-8b45-eb351672274f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'2c7a4c'},body:JSON.stringify({sessionId:'2c7a4c',runId:'run1',hypothesisId:'H3',location:'pretext-runtime.js:247',message:'slider run applied',data:{sliderValue:value,lines:lines,height:Math.round(height),targetWidth:target.style.width},timestamp:Date.now()})}).catch(()=>{});
          // #endregion
        };

        slider.addEventListener("input", function () { run(); }, { passive: true });
        slider.addEventListener("change", function () { run(); }, { passive: true });

        // 当外层布局变化（例如窗口缩放）时，重新计算
        if (typeof ResizeObserver !== "undefined") {
          const ro = new ResizeObserver(debounce(function () { run(); }, 120));
          ro.observe(stage);
        }
        await run();
      }
    }
    await initReflowDemos();

    async function initJustificationDemos() {
      const demos = qsAll(".pretext-just-demo");
      if (!demos.length) return;
      for (const root of demos) {
        const slider = root.querySelector('[data-pretext-just-slider="1"]');
        const widthOut = root.querySelector("[data-pretext-just-width]");
        const cssOut = root.querySelector("[data-pretext-just-lines-css]");
        const preOut = root.querySelector("[data-pretext-just-lines-pretext]");
        const cols = Array.from(root.querySelectorAll('[data-pretext-just-col="1"]'));
        const cssBlock = root.querySelector('[data-pretext-just-css="1"]');
        const preBlocks = Array.from(root.querySelectorAll('[data-pretext-just-pretext="1"]'));
        if (!slider || cols.length === 0) continue;

        const run = async function () {
          const minW = Math.max(240, Number(slider.getAttribute("min") || 240));
          const hardMax = Math.min(520, Math.max(minW, Number(slider.getAttribute("max") || 520)));
          const raw = Number(slider.value || 364);
          const page = root.querySelector(".pretext-page");
          const perCol = page ? Math.floor(getInnerWidth(page) / 3) - 16 : hardMax;
          /* 保证 max >= min，避免 range 控件在 max<min 时彻底失灵 */
          const maxByPage = Math.max(minW, Math.min(hardMax, Math.max(minW, perCol)));
          const value = clamp(raw, minW, maxByPage);
          slider.max = String(maxByPage);
          if (raw !== value) slider.value = String(value);

          cols.forEach(function (c) { c.style.width = `${value}px`; });
          for (const el of preBlocks) {
            await applyHeight(pretext, el);
          }
          if (widthOut) widthOut.textContent = `${value}px`;
          if (cssOut && cssBlock) cssOut.textContent = String(measureLineCount(cssBlock));
          if (preOut) {
            const total = preBlocks.reduce(function (n, el) { return n + measureLineCount(el); }, 0);
            preOut.textContent = String(Math.max(1, Math.round(total / Math.max(1, preBlocks.length))));
          }
        };
        slider.addEventListener("input", function () { run(); }, { passive: true });
        slider.addEventListener("change", function () { run(); }, { passive: true });
        await run();
      }
    }
    await initJustificationDemos();

    async function initDragonDemos() {
      const demos = qsAll(".pretext-dragon-demo");
      if (!demos.length) return;
      demos.forEach(function (root) {
        const scene = root.querySelector('[data-pretext-dragon-scene="1"]');
        const flyer = root.querySelector('[data-pretext-dragon-flyer="1"]');
        const body = root.querySelector('[data-pretext-dragon-body="1"]');
        const text = root.querySelector('[data-pretext-dragon-text="1"]');
        const speedCtl = root.querySelector('[data-pretext-dragon-speed="1"]');
        if (!scene || !flyer || !body || !text) return;

        let rafId = 0;
        let t0 = performance.now();
        const tick = async function (ts) {
          const dt = (ts - t0) / 1000;
          const speed = speedCtl ? Number(speedCtl.value || 8) : 8;
          const width = Math.max(320, scene.clientWidth || 700);
          const x = ((dt * (40 + speed * 8)) % (width + 160)) - 90;
          const y = 10 + Math.sin(dt * 2.1) * 10;
          flyer.style.transform = `translate(${x}px, ${y}px) rotate(${Math.sin(dt * 1.8) * 10}deg)`;

          const phase = (x + 90) / Math.max(1, width + 160);
          const shift = Math.round((Math.sin(phase * Math.PI) * 46));
          body.style.setProperty("--dragon-shift", `${shift}px`);
          await applyHeight(pretext, text);
          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
        root.addEventListener("remove", function () { cancelAnimationFrame(rafId); });
      });
    }
    await initDragonDemos();

    // 让“交互”更明显：当元素宽度变化时（例如容器自适应/折叠），自动重算高度
    if (typeof ResizeObserver !== "undefined" && heightEls.length > 0) {
      const ro = new ResizeObserver(debounce(function () { recalcHeightOnly(); }, 150));
      heightEls.forEach(function (el) { ro.observe(el); });
    }

    window.addEventListener("resize", debounce(function () { recalcAll(); }, 150), { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

