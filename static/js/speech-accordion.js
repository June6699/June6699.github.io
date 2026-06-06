(function () {
  var panels = Array.prototype.slice.call(document.querySelectorAll('[data-speech-panel]'));
  if (!panels.length) return;

  function setLanguage(panel, lang) {
    panel.setAttribute('data-speech-lang', lang);
    panel.querySelectorAll('[data-speech-content]').forEach(function (content) {
      var isActive = content.getAttribute('data-speech-content') === lang;
      content.hidden = !isActive;
      content.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });
    panel.querySelectorAll('[data-speech-lang-button]').forEach(function (button) {
      var isActive = button.getAttribute('data-speech-lang-button') === lang;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function setOpen(panel, open) {
    var toggle = panel.querySelector('[data-speech-toggle]');
    var body = toggle ? document.getElementById(toggle.getAttribute('aria-controls')) : null;
    if (!toggle || !body) return;
    panel.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    body.hidden = !open;
    var icon = panel.querySelector('.speech-excerpt__toggle-icon');
    if (icon) icon.textContent = open ? '收起' : '展开';
  }

  function openOnly(targetPanel) {
    panels.forEach(function (panel) {
      setOpen(panel, panel === targetPanel);
    });
  }

  panels.forEach(function (panel) {
    setLanguage(panel, panel.getAttribute('data-speech-lang') || 'zh');

    var toggle = panel.querySelector('[data-speech-toggle]');
    if (toggle) {
      toggle.addEventListener('click', function () {
        var isOpen = toggle.getAttribute('aria-expanded') === 'true';
        if (isOpen) {
          setOpen(panel, false);
        } else {
          openOnly(panel);
        }
      });
    }

    panel.querySelectorAll('[data-speech-lang-button]').forEach(function (button) {
      button.addEventListener('click', function () {
        setLanguage(panel, button.getAttribute('data-speech-lang-button') || 'zh');
      });
    });
  });
})();
