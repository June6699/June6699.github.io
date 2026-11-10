/* 代码块工具栏交互：复制 / 自动换行 / 折叠。
   结构由 layouts/_default/_markup/render-codeblock.html 生成，本脚本只做事件委托，
   动态插入或 PJAX 刷新后的代码块也能生效。换行与折叠偏好写入 localStorage。 */
(function () {
    'use strict';

    var WRAP_KEY = 'code-block-wrap';
    var COLLAPSE_KEY = 'code-block-collapse';

    function readPref(key) {
        try { return localStorage.getItem(key) === '1'; } catch (e) { return false; }
    }

    function writePref(key, value) {
        try { localStorage.setItem(key, value ? '1' : '0'); } catch (e) {}
    }

    function codeText(block) {
        var code = block.querySelector('code');
        return code ? code.innerText : block.querySelector('pre').innerText;
    }

    function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
        return ok;
    }

    function doCopy(btn, block) {
        var text = codeText(block);
        var done = function () { flashCopied(btn); };
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(done, function () {
                if (fallbackCopy(text)) done();
            });
        } else if (fallbackCopy(text)) {
            done();
        }
    }

    function flashCopied(btn) {
        var label = btn.querySelector('.code-block__btn-text');
        var original = label ? label.textContent : '';
        btn.classList.add('is-copied');
        if (label) label.textContent = '已复制';
        setTimeout(function () {
            btn.classList.remove('is-copied');
            if (label) label.textContent = original;
        }, 1500);
    }

    function setWrap(block, btn, on) {
        block.classList.toggle('is-wrap', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    function setCollapsed(block, btn, on) {
        block.classList.toggle('is-collapsed', on);
        btn.setAttribute('aria-expanded', on ? 'false' : 'true');
        var label = btn.querySelector('.code-block__btn-text');
        if (label) label.textContent = on ? '展开' : '折叠';
    }

    function init() {
        var blocks = document.querySelectorAll('.code-block');
        var preferWrap = readPref(WRAP_KEY);
        var preferCollapse = readPref(COLLAPSE_KEY);

        blocks.forEach(function (block) {
            if (block.dataset.codeReady === '1') return;
            block.dataset.codeReady = '1';

            var wrapBtn = block.querySelector('[data-code-action="wrap"]');
            var collapseBtn = block.querySelector('[data-code-action="collapse"]');
            var copyBtn = block.querySelector('[data-code-action="copy"]');

            if (wrapBtn) setWrap(block, wrapBtn, preferWrap);
            if (collapseBtn) setCollapsed(block, collapseBtn, preferCollapse);

            if (wrapBtn) wrapBtn.addEventListener('click', function () {
                var on = !block.classList.contains('is-wrap');
                setWrap(block, wrapBtn, on);
                writePref(WRAP_KEY, on);
            });

            if (collapseBtn) collapseBtn.addEventListener('click', function () {
                var on = !block.classList.contains('is-collapsed');
                setCollapsed(block, collapseBtn, on);
                writePref(COLLAPSE_KEY, on);
            });

            if (copyBtn) copyBtn.addEventListener('click', function () {
                doCopy(copyBtn, block);
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
