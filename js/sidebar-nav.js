/**
 * 左侧标签导航、右侧标题导航：一键折叠/展开；文章页右侧 TOC 从正文 h2/h3 生成
 */
(function () {
  function slugify(text) {
    return text.replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '').toLowerCase() || 'heading';
  }

  function buildSideToc() {
    var inner = document.getElementById('side-toc-inner');
    var container = document.querySelector('.post-container');
    if (!inner || !container) return;
    var headings = container.querySelectorAll('h2, h3');
    if (headings.length === 0) return;
    var fragment = document.createDocumentFragment();
    var usedIds = {};
    headings.forEach(function (h) {
      var id = h.id;
      if (!id) {
        id = slugify(h.textContent);
        if (usedIds[id]) {
          var n = 1;
          while (usedIds[id + '-' + n]) n++;
          id = id + '-' + n;
        }
        usedIds[id] = true;
        h.id = id;
      }
      var a = document.createElement('a');
      a.href = '#' + id;
      a.textContent = h.textContent.trim();
      a.className = 'tag-catalog-link toc-' + h.tagName.toLowerCase();
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      fragment.appendChild(a);
    });
    inner.appendChild(fragment);
  }

  function initTagTreeToggle() {
    var tree = document.getElementById('tag-tree');
    if (!tree) return;
    var card = tree.closest('.tag-tree-card');
    tree.querySelectorAll('.nav-toggle-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = this.getAttribute('data-action');
        var nodes = tree.querySelectorAll('.tag-tree-node');
        if (action === 'collapse') {
          nodes.forEach(function (n) { n.classList.remove('open'); });
          if (card) card.classList.add('sidebar-collapsed');
        } else {
          nodes.forEach(function (n) { n.classList.add('open'); });
          if (card) card.classList.remove('sidebar-collapsed');
        }
      });
    });
  }

  function initTocCardToggle() {
    document.querySelectorAll('.tag-catalog-card').forEach(function (card) {
      var collapseBtn = card.querySelector('.nav-toggle-btn[data-action="collapse"], .nav-toggle-btn.toc-collapse');
      var expandBtn = card.querySelector('.nav-toggle-btn[data-action="expand"], .nav-toggle-btn.toc-expand');
      if (collapseBtn) {
        collapseBtn.addEventListener('click', function () { card.classList.add('sidebar-collapsed'); });
      }
      if (expandBtn) {
        expandBtn.addEventListener('click', function () { card.classList.remove('sidebar-collapsed'); });
      }
    });
  }

  function initTagTreeTagClick() {
    var tree = document.getElementById('tag-tree');
    if (!tree) return;
    tree.querySelectorAll('.tag-tree-node').forEach(function (el) {
      var tagLink = el.querySelector('.tag-tree-tag');
      var posts = el.querySelector('.tag-tree-posts');
      if (!tagLink || !posts || !posts.children.length) return;
      tagLink.addEventListener('click', function (e) {
        var href = tagLink.getAttribute('href') || '';
        if (href.indexOf('/tags/') >= 0) return;
        if (href.indexOf('#') === -1) return;
        e.preventDefault();
        el.classList.toggle('open');
        var id = el.getAttribute('data-target');
        if (id) {
          var section = document.getElementById(id);
          if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  function run() {
    initTagTreeToggle();
    initTocCardToggle();
    initTagTreeTagClick();
    buildSideToc();
  }
})();
