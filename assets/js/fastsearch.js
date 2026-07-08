import * as params from '@params';

let fuse;
let dataSet = [];
let activeMode = 'title';
let first;
let last;
let currentElem = null;
let resultsAvailable = false;

const resList = document.getElementById('searchResults');
const sInput = document.getElementById('searchInput');
const statusEl = document.getElementById('searchStatus');
const modeButtons = document.querySelectorAll('[data-search-mode]');

const modeConfig = {
    title: {
        label: '标题',
        keys: ['title'],
        status: '标题'
    },
    content: {
        label: '正文',
        keys: ['content', 'summary'],
        status: '正文'
    },
    tags: {
        label: '标签',
        keys: ['tags'],
        status: '标签'
    }
};

function baseOptions(keys) {
    const defaults = {
        distance: 100,
        threshold: 0.36,
        ignoreLocation: true,
        includeMatches: true,
        minMatchCharLength: 1,
        keys: keys
    };

    if (!params.fuseOpts) return defaults;

    return {
        isCaseSensitive: params.fuseOpts.iscasesensitive ?? false,
        includeScore: params.fuseOpts.includescore ?? false,
        includeMatches: true,
        minMatchCharLength: params.fuseOpts.minmatchcharlength ?? 1,
        shouldSort: params.fuseOpts.shouldsort ?? true,
        findAllMatches: params.fuseOpts.findallmatches ?? false,
        keys: keys,
        location: params.fuseOpts.location ?? 0,
        threshold: params.fuseOpts.threshold ?? defaults.threshold,
        distance: params.fuseOpts.distance ?? defaults.distance,
        ignoreLocation: params.fuseOpts.ignorelocation ?? true
    };
}

function buildFuse() {
    const config = modeConfig[activeMode] || modeConfig.title;
    fuse = new Fuse(dataSet, baseOptions(config.keys));
}

function setStatus(message) {
    if (statusEl) statusEl.textContent = message;
}

function clearResults(message) {
    resultsAvailable = false;
    first = null;
    last = null;
    currentElem = null;
    resList.replaceChildren();
    setStatus(message);
}

function getLimit() {
    return params.fuseOpts && params.fuseOpts.limit ? params.fuseOpts.limit : 20;
}

function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function getMatchKey(match) {
    if (!match || !match.key) return '';
    return Array.isArray(match.key) ? match.key.join('.') : String(match.key);
}

function getBestMatch(result) {
    const matches = result.matches || [];
    if (!matches.length) return null;

    const config = modeConfig[activeMode] || modeConfig.title;
    const allowed = new Set(config.keys);
    return matches.find(function(match) {
        return allowed.has(getMatchKey(match));
    }) || matches[0];
}

function createSnippet(item, bestMatch, query) {
    const cleanSummary = normalizeText(item.summary);
    if (activeMode === 'title') return cleanSummary || '标题命中该关键词。';
    if (activeMode === 'tags') {
        const tags = Array.isArray(item.tags) ? item.tags : [];
        return tags.length ? '匹配标签：' + tags.join(' / ') : cleanSummary;
    }

    const source = normalizeText((bestMatch && bestMatch.value) || item.content || item.summary);
    if (!source) return cleanSummary;

    const lowerSource = source.toLowerCase();
    const lowerQuery = query.toLowerCase();
    let index = lowerSource.indexOf(lowerQuery);

    if (index < 0 && bestMatch && bestMatch.indices && bestMatch.indices.length) {
        index = bestMatch.indices[0][0];
    }
    if (index < 0) return source.slice(0, 120) + (source.length > 120 ? '...' : '');

    const start = Math.max(0, index - 48);
    const end = Math.min(source.length, index + query.length + 72);
    return (start > 0 ? '...' : '') + source.slice(start, end) + (end < source.length ? '...' : '');
}

function fieldLabel(bestMatch) {
    if (activeMode === 'title') return '标题';
    if (activeMode === 'tags') return '标签';
    if (!bestMatch) return '正文';

    const key = getMatchKey(bestMatch);
    if (key === 'summary') return '摘要';
    return '正文';
}

function renderTags(item, wrapper) {
    const tags = Array.isArray(item.tags) ? item.tags : [];
    if (!tags.length) return;

    const tagsEl = document.createElement('div');
    tagsEl.className = 'search-result__tags';

    tags.slice(0, 6).forEach(function(tag) {
        const chip = document.createElement('span');
        chip.className = 'search-result__tag';
        chip.textContent = tag;
        tagsEl.appendChild(chip);
    });

    wrapper.appendChild(tagsEl);
}

function renderResults(results, query) {
    resList.replaceChildren();

    if (!query) {
        clearResults('输入关键词开始搜索文章。');
        return;
    }

    if (!results.length) {
        clearResults('没有找到匹配文章。');
        return;
    }

    const fragment = document.createDocumentFragment();

    results.forEach(function(result) {
        const item = result.item;
        const bestMatch = getBestMatch(result);

        const li = document.createElement('li');
        li.className = 'post-entry search-result';

        const meta = document.createElement('div');
        meta.className = 'search-result__meta';

        const badge = document.createElement('span');
        badge.className = 'search-result__badge';
        badge.textContent = fieldLabel(bestMatch);
        meta.appendChild(badge);

        const title = document.createElement('header');
        title.className = 'entry-header search-result__title';
        title.textContent = item.title + ' »';

        const snippet = document.createElement('p');
        snippet.className = 'search-result__snippet';
        snippet.textContent = createSnippet(item, bestMatch, query);

        const link = document.createElement('a');
        link.href = item.permalink;
        link.setAttribute('aria-label', item.title);

        li.appendChild(meta);
        li.appendChild(title);
        li.appendChild(snippet);
        renderTags(item, li);
        li.appendChild(link);
        fragment.appendChild(li);
    });

    resList.appendChild(fragment);
    resultsAvailable = true;
    first = resList.firstElementChild;
    last = resList.lastElementChild;
    setStatus('找到 ' + results.length + ' 篇相关文章。');
}

function runSearch() {
    const query = sInput.value.trim();
    if (!fuse || !query) {
        clearResults('输入关键词开始搜索文章。');
        return;
    }

    const results = fuse.search(query, { limit: getLimit() });
    renderResults(results, query);
}

function activeToggle(ae) {
    document.querySelectorAll('#searchResults .focus').forEach(function(element) {
        element.classList.remove('focus');
    });

    if (!ae) return;

    ae.focus();
    currentElem = ae;
    if (ae.parentElement) ae.parentElement.classList.add('focus');
}

function reset() {
    sInput.value = '';
    clearResults('输入关键词开始搜索文章。');
    sInput.focus();
}

function setMode(mode) {
    if (!modeConfig[mode] || activeMode === mode) return;

    activeMode = mode;
    modeButtons.forEach(function(button) {
        const isActive = button.dataset.searchMode === mode;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });

    buildFuse();
    runSearch();
}

window.addEventListener('load', function() {
    fetch('../index.json')
        .then(function(response) {
            if (!response.ok) throw new Error('Search index request failed: ' + response.status);
            return response.json();
        })
        .then(function(data) {
            dataSet = Array.isArray(data) ? data : [];
            buildFuse();
            setStatus('输入关键词开始搜索文章。');
        })
        .catch(function(error) {
            console.log(error);
            clearResults('搜索索引加载失败。');
        });
});

modeButtons.forEach(function(button) {
    button.addEventListener('click', function() {
        setMode(button.dataset.searchMode);
    });
});

sInput.addEventListener('input', runSearch);

sInput.addEventListener('search', function() {
    if (!this.value) reset();
});

document.addEventListener('keydown', function(e) {
    const key = e.key;
    let ae = document.activeElement;
    const inbox = document.getElementById('searchbox').contains(ae);

    if (ae === sInput) {
        document.querySelectorAll('#searchResults .focus').forEach(function(element) {
            element.classList.remove('focus');
        });
    } else if (currentElem) {
        ae = currentElem;
    }

    if (key === 'Escape') {
        reset();
    } else if (!resultsAvailable || !inbox) {
        return;
    } else if (key === 'ArrowDown') {
        e.preventDefault();
        if (ae === sInput && first) {
            activeToggle(first.querySelector('a'));
        } else if (ae.parentElement !== last) {
            activeToggle(ae.parentElement.nextElementSibling.querySelector('a'));
        }
    } else if (key === 'ArrowUp') {
        e.preventDefault();
        if (ae.parentElement === first) {
            activeToggle(sInput);
        } else if (ae !== sInput) {
            activeToggle(ae.parentElement.previousElementSibling.querySelector('a'));
        }
    } else if (key === 'ArrowRight' || key === 'Enter') {
        if (ae !== sInput) ae.click();
    }
});
