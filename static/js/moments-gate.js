(function () {
  var REMEMBER_TTL_MS = 30 * 60 * 1000;

  async function sha256Hex(input) {
    var bytes = new TextEncoder().encode(input);
    var digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map(function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
  }

  function setStatus(target, message, kind) {
    if (!target) return;
    target.textContent = message || "";
    target.dataset.state = kind || "";
  }

  function lock(root, feed, gate) {
    root.classList.remove("is-unlocked");
    if (gate) gate.hidden = false;
    if (feed) feed.hidden = true;
  }

  function readSessionGrant(sessionKey) {
    try {
      var raw = sessionStorage.getItem(sessionKey);
      if (!raw) return false;
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.granted !== true || typeof parsed.exp !== "number") return false;
      if (Date.now() > parsed.exp) return false;
      return true;
    } catch (_err) {
      return false;
    }
  }

  function writeSessionGrant(sessionKey) {
    sessionStorage.setItem(sessionKey, JSON.stringify({
      granted: true,
      exp: Date.now() + REMEMBER_TTL_MS
    }));
  }

  function buildMailto(targetEmail, requesterEmail) {
    var subject = "动态区密码找回";
    var body = [
      "你好，我想申请找回动态区访问口令。",
      "",
      "联系邮箱：" + requesterEmail,
      "页面：" + window.location.href,
      "时间：" + new Date().toLocaleString(),
      "",
      "请协助确认。"
    ].join("\n");
    return "mailto:" + encodeURIComponent(targetEmail) + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }

  function getHeaderOffset() {
    var css = getComputedStyle(document.documentElement).getPropertyValue("--header-height");
    var h = parseFloat(String(css).replace("px", ""));
    return (Number.isFinite(h) ? h : 60) + 18;
  }

  function toModeGroups(items, mode) {
    if (!items.length) return [];
    var latestYear = items[items.length - 1].year;
    var rows = [];
    var map = {};

    items.forEach(function (item) {
      var key = "";
      var label = "";
      var tip = "";
      if (mode === "year") {
        key = item.year;
        label = item.year + "年";
        tip = item.year + "年";
      } else if (mode === "month") {
        if (item.year !== latestYear) return;
        key = item.month;
        label = item.month.slice(5) + "月";
        tip = item.month;
      } else {
        if (item.year !== latestYear) return;
        key = item.day;
        label = item.day.slice(5);
        tip = item.day;
      }

      if (!map[key]) {
        map[key] = { key: key, label: label, tip: tip, target: item.id, count: 0, firstTs: item.ts };
        rows.push(map[key]);
      }
      map[key].count += 1;
    });

    return rows;
  }

  function initVerticalTimeline(root) {
    if (!root || root.dataset.vTimelineReady === "1") return;
    var shell = root.querySelector("[data-moments-vtimeline]");
    var list = root.querySelector("[data-v-list]");
    var modeBtns = Array.prototype.slice.call(root.querySelectorAll("[data-v-mode]"));
    var posts = Array.prototype.slice.call(root.querySelectorAll(".moments-feed__item[data-moment-id]"));
    if (!shell || !list || !posts.length) return;

    var items = posts.map(function (node) {
      var ts = Number(node.dataset.momentTs || 0) * 1000;
      var d = new Date(ts);
      return {
        id: node.dataset.momentId || "",
        title: node.dataset.momentTitle || "",
        ts: ts,
        date: d,
        year: node.dataset.momentYear || "",
        month: node.dataset.momentMonth || "",
        day: node.dataset.momentDay || "",
        node: node
      };
    }).filter(function (x) { return x.id; });
    if (!items.length) return;

    var activeMode = "month";
    var activeId = items[items.length - 1].id;

    function setActiveDotById(targetId) {
      Array.prototype.slice.call(list.querySelectorAll(".moments-vtimeline__item")).forEach(function (li) {
        li.classList.toggle("is-active", li.dataset.target === targetId);
      });
    }

    function render() {
      shell.dataset.mode = activeMode;
      modeBtns.forEach(function (btn) {
        var on = btn.dataset.vMode === activeMode;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });

      list.innerHTML = "";
      var groups = toModeGroups(items, activeMode);
      groups.forEach(function (g) {
        var li = document.createElement("li");
        li.className = "moments-vtimeline__item";
        li.dataset.target = g.target;

        var anchor = document.createElement("a");
        anchor.className = "moments-vtimeline__link";
        anchor.href = "#" + g.target;
        anchor.dataset.target = g.target;

        var dot = document.createElement("span");
        dot.className = "moments-vtimeline__dot";
        dot.setAttribute("aria-hidden", "true");
        dot.setAttribute("data-tip", g.tip);

        var label = document.createElement("span");
        label.className = "moments-vtimeline__label";
        label.textContent = g.label;

        anchor.appendChild(dot);
        anchor.appendChild(label);

        var count = document.createElement("small");
        count.className = "moments-vtimeline__count";
        count.textContent = g.count + "篇";
        anchor.appendChild(count);

        anchor.addEventListener("click", function (e) {
          e.preventDefault();
          var target = document.getElementById(g.target);
          if (!target) return;
          var top = target.getBoundingClientRect().top + window.pageYOffset - getHeaderOffset();
          window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
          history.replaceState(null, "", "#" + g.target);
          activeId = g.target;
          setActiveDotById(g.target);
        });

        li.appendChild(anchor);
        list.appendChild(li);
      });
      setActiveDotById(activeId);
    }

    function refreshByScroll() {
      var threshold = getHeaderOffset() + 40;
      var current = items[0].id;
      items.forEach(function (item) {
        var rect = item.node.getBoundingClientRect();
        if (rect.top <= threshold) current = item.id;
      });
      activeId = current;
      setActiveDotById(current);
    }

    modeBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        activeMode = btn.dataset.vMode || "month";
        render();
      });
    });

    window.addEventListener("scroll", refreshByScroll, { passive: true });
    window.addEventListener("resize", refreshByScroll, { passive: true });
    render();
    refreshByScroll();
    root.dataset.vTimelineReady = "1";
  }

  function unlock(root, feed, gate, sessionKey, remember) {
    root.classList.add("is-unlocked");
    if (gate) gate.hidden = true;
    if (feed) feed.hidden = false;
    if (remember) writeSessionGrant(sessionKey);
    else sessionStorage.removeItem(sessionKey);
    try {
      initVerticalTimeline(root);
    } catch (error) {
      console.warn("[moments-gate] timeline init failed:", error);
    }
  }

  document.querySelectorAll("[data-moments-gate-root]").forEach(function (root) {
    var sessionKey = root.dataset.sessionKey || "moments-access";
    try {
      localStorage.removeItem(sessionKey);
      localStorage.removeItem("moments-access");
    } catch (_err) {}

    var expectedHash = (root.dataset.passwordHash || "").trim().toLowerCase();
    var recoveryEmail = (root.dataset.recoveryEmail || "").trim();
    var feed = root.querySelector("[data-moments-feed]");
    var gate = root.querySelector("[data-moments-gate-panel]");
    var form = root.querySelector("[data-moments-gate-form]");
    var passwordInput = form ? form.querySelector('input[type="password"]') : null;
    var rememberInput = root.querySelector("[data-moments-remember]");
    var status = root.querySelector("[data-moments-status]");
    var forgotButton = root.querySelector("[data-moments-forgot]");
    var recoveryForm = root.querySelector("[data-moments-recovery-form]");

    lock(root, feed, gate);
    if (readSessionGrant(sessionKey)) {
      unlock(root, feed, gate, sessionKey, true);
      return;
    }
    if (!expectedHash) {
      setStatus(status, "当前未配置动态区口令哈希，请先设置环境变量 HUGO_MOMENTS_PASSWORD_HASH。", "error");
      return;
    }

    if (form && passwordInput) {
      form.addEventListener("submit", async function (event) {
        event.preventDefault();
        var value = passwordInput.value || "";
        if (!value) return setStatus(status, "请输入访问口令。", "error");
        setStatus(status, "正在校验口令...", "pending");
        try {
          var actual = await sha256Hex(value);
          if (actual === expectedHash) {
            setStatus(status, "校验通过，正在打开动态流。", "success");
            unlock(root, feed, gate, sessionKey, !!(rememberInput && rememberInput.checked));
            passwordInput.value = "";
          } else {
            setStatus(status, "口令不正确，请重试。", "error");
          }
        } catch (error) {
          setStatus(status, "浏览器未能完成加密校验。", "error");
          console.warn("[moments-gate] hash failed:", error);
        }
      });
    }

    if (forgotButton && recoveryForm) {
      forgotButton.addEventListener("click", function () {
        recoveryForm.hidden = !recoveryForm.hidden;
        if (!recoveryForm.hidden) setStatus(status, "填写邮箱后会调用默认邮件客户端发起找回。", "pending");
      });
    }

    if (recoveryForm) {
      recoveryForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var emailInput = recoveryForm.querySelector('input[type="email"]');
        var requesterEmail = emailInput ? (emailInput.value || "").trim() : "";
        if (!requesterEmail) return setStatus(status, "请输入邮箱地址。", "error");
        if (!recoveryEmail) return setStatus(status, "当前未配置找回邮箱。", "error");
        setStatus(status, "正在调用邮件客户端。", "success");
        window.location.href = buildMailto(recoveryEmail, requesterEmail);
      });
    }
  });
})();
