(function () {
  async function sha256Hex(input) {
    const bytes = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map(function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
  }

  function setStatus(target, message, kind) {
    if (!target) return;
    target.textContent = message || "";
    target.dataset.state = kind || "";
  }

  function unlock(root, feed, gate, sessionKey, remember) {
    root.classList.add("is-unlocked");
    if (gate) gate.hidden = true;
    if (feed) feed.hidden = false;
    if (remember) localStorage.setItem(sessionKey, "1");
    else sessionStorage.setItem(sessionKey, "1");
  }

  function buildMailto(targetEmail, requesterEmail) {
    const subject = "动态区密码找回";
    const body = [
      "你好，我想申请找回动态区访问口令。",
      "",
      "联系邮箱：" + requesterEmail,
      "页面：" + location.href,
      "时间：" + new Date().toLocaleString(),
      "",
      "请协助确认。"
    ].join("\n");
    return "mailto:" + encodeURIComponent(targetEmail) + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }

  document.querySelectorAll("[data-moments-gate-root]").forEach(function (root) {
    const sessionKey = root.dataset.sessionKey || "moments-access";
    // 未勾选「记住设备」时口令存在 sessionStorage；同标签内刷新默认不会清空 sessionStorage。
    // 在检测到整页刷新时先清掉该 key，这样刷新后需要重新输入，与「不记住设备」的预期一致。
    try {
      var navEntry = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
      if (navEntry && navEntry.type === "reload") {
        sessionStorage.removeItem(sessionKey);
      }
    } catch (err) {
      console.warn("[moments-gate] navigation timing check failed:", err);
    }

    const expectedHash = (root.dataset.passwordHash || "").trim().toLowerCase();
    const recoveryEmail = (root.dataset.recoveryEmail || "").trim();
    const feed = root.querySelector("[data-moments-feed]");
    const gate = root.querySelector("[data-moments-gate-panel]");
    const form = root.querySelector("[data-moments-gate-form]");
    const passwordInput = form ? form.querySelector('input[type="password"]') : null;
    const rememberInput = root.querySelector("[data-moments-remember]");
    const status = root.querySelector("[data-moments-status]");
    const forgotButton = root.querySelector("[data-moments-forgot]");
    const recoveryForm = root.querySelector("[data-moments-recovery-form]");

    if (localStorage.getItem(sessionKey) === "1" || sessionStorage.getItem(sessionKey) === "1") {
      unlock(root, feed, gate, sessionKey, localStorage.getItem(sessionKey) === "1");
      return;
    }

    if (!expectedHash) {
      setStatus(status, "当前未配置动态区口令哈希，请先设置环境变量 HUGO_MOMENTS_PASSWORD_HASH。", "error");
      return;
    }

    if (form && passwordInput) {
      form.addEventListener("submit", async function (event) {
        event.preventDefault();
        const value = passwordInput.value || "";
        if (!value) {
          setStatus(status, "请输入访问口令。", "error");
          return;
        }

        setStatus(status, "正在校验口令...", "pending");

        try {
          const actual = await sha256Hex(value);
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
        const emailInput = recoveryForm.querySelector('input[type="email"]');
        const requesterEmail = emailInput ? (emailInput.value || "").trim() : "";
        if (!requesterEmail) {
          setStatus(status, "请输入邮箱地址。", "error");
          return;
        }
        if (!recoveryEmail) {
          setStatus(status, "当前未配置找回邮箱。", "error");
          return;
        }
        setStatus(status, "正在调用邮件客户端。", "success");
        window.location.href = buildMailto(recoveryEmail, requesterEmail);
      });
    }
  });
})();
