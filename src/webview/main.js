(function () {
  const vscode = acquireVsCodeApi();

  let allLogs = [];
  let filteredLogs = [];
  let activeLevels = new Set(['info', 'warn', 'error']);
  let searchQuery = '';
  let searchRegex = null;
  let timestampMode = 'absolute'; // 'absolute' | 'relative' | 'hidden'
  let launchTimestamp = null; // timestamp of the first log entry
  let autoHideTimestampsWidth = 200;
  let shouldAutoScroll = true;
  let contextMenuTargetIndex = -1;
  let compactMessages = false;
  let highlightTags = true; // true = highlight [TAGS], false = plain text
  /** 'search' = levels filter the list, text only for find-in-view; 'and' / 'or' = text participates in filtering. */
  let filterMode = 'and';
  let localPackageNames = new Set(); // package names that are in the user's workspace (for link styling)
  let filterDebounceTimer = null;
  const FILTER_DEBOUNCE_MS = 150;
  /** Indices into filteredLogs whose message matches the search text (OR mode can include level-only rows). */
  let searchLineIndices = [];
  /** Ordinal among searchLineIndices for prev/next; -1 until user navigates with arrows or Enter. */
  let searchMatchIndex = -1;

  // Virtual scroll state - variable height
  const DEFAULT_ITEM_HEIGHT = 20;
  const BUFFER_SIZE = 10;
  let itemHeights = new Map(); // logId -> measured height
  let itemPositions = []; // cumulative positions
  let totalHeight = 0;
  let containerHeight = 0;
  let containerWidth = 0;
  let scrollTop = 0;
  let visibleStartIndex = 0;
  let visibleEndIndex = 0;
  let pendingRender = false;

  // File path regex (supports package: and dart: URI scheme prefixes)
  const FILE_PATH_REGEX = /(package:|dart:)?([a-zA-Z0-9_+\-./\\]+\.(?:dart|kt|java|ts|js|tsx|jsx|py|rb|go|rs|cpp|c|h|hpp|swift|m|mm|json|xml|yaml|yml|gradle|properties|txt|md|html|css|scss|less)):(\d+)(?::(\d+))?/g;

  // URL regex for clickable HTTP/HTTPS links
  const URL_REGEX = /https?:\/\/[^\s"'<>)\]},]+/g;

  // Matches verbose prefixes to strip:
  // Old logger: [tag] | timestamp ms | message
  // New logger: HH:mm:ss.SSS LEVEL message
  // Android logcat: D/sqflite:  (single letter level / tag name : )
  const COMPACT_PREFIX_REGEX = /^(?:\[[\w]+\]\s*\|\s*\d{1,2}:\d{2}:\d{2}\s+\d+ms\s*\|\s*|\d{2}:\d{2}:\d{2}\.\d{3}\s+(?:DEBUG|INFO|WARNING|ERROR|WARN)\s+|[DIWEV]\/[\w.]+:\s*)/;
  // Bracketed timestamps like [2026-02-07 18:06:00.904] (can appear anywhere in the line)
  const BRACKET_TIMESTAMP_REGEX = /\[\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?\]\s*/g;
  // Box-drawing characters used by logger packages (e.g. │├└┌┐┘─║╔╗╚╝ etc.)
  const BOX_DRAWING_REGEX = /[│├└┌┐┘┴┬┼─║╔╗╚╝╠╣╦╩╬]+\s*/g;
  const TAG_REGEX = /\[([A-Za-z][\w. =-]*)\]/g;

  const SEARCH_TOGGLE_SVG =
    '<svg class="logic-toggle-search-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  // DOM elements
  const logsContainer = document.getElementById('logsContainer');
  const levelButtons = document.querySelectorAll('#levelFilters .level-btn');
  const filterInput = document.getElementById('filterInput');
  const logicToggle = document.getElementById('logicToggle');
  const searchNav = document.getElementById('searchNav');
  const searchNavCount = document.getElementById('searchNavCount');
  const searchPrev = document.getElementById('searchPrev');
  const searchNext = document.getElementById('searchNext');

  let scrollContent = null;
  let visibleContent = null;
  let measureContainer = null;

  function init() {
    setupVirtualScroll();

    levelButtons.forEach((btn) => {
      btn.addEventListener('click', () => toggleLevel(btn.dataset.level));
    });

    if (filterInput) {
      filterInput.addEventListener('input', handleFilterInput);
      filterInput.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          clearTimeout(filterDebounceTimer);
          searchQuery = filterInput.value;
          updateSearchRegex();
          syncFilterModeUi();
          applyFilters();
          recomputeSearchLineIndices();
          if (searchQuery.trim().length > 0 && searchLineIndices.length > 0) {
            e.preventDefault();
            navigateSearchMatch(e.shiftKey ? -1 : 1);
          }
          return;
        }
        // Handle clipboard shortcuts explicitly — VSCode intercepts them otherwise
        const isMod = e.metaKey || e.ctrlKey;
        if (isMod && e.key === 'c') {
          document.execCommand('copy');
          e.preventDefault();
        } else if (isMod && e.key === 'v') {
          document.execCommand('paste');
          e.preventDefault();
        } else if (isMod && e.key === 'x') {
          document.execCommand('cut');
          e.preventDefault();
        } else if (isMod && e.key === 'a') {
          filterInput.select();
          e.preventDefault();
        }
      });
    }

    if (searchPrev) {
      searchPrev.addEventListener('click', () => navigateSearchMatch(-1));
    }
    if (searchNext) {
      searchNext.addEventListener('click', () => navigateSearchMatch(1));
    }

    if (logicToggle) {
      logicToggle.addEventListener('click', cycleFilterMode);
      logicToggle.addEventListener('contextmenu', showFilterModeContextMenu);
    }

    logsContainer.addEventListener('scroll', handleScroll);

    const resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      const widthChanged = Math.abs(containerWidth - rect.width) > 5;
      containerWidth = rect.width;
      containerHeight = rect.height;

      if (rect.width < autoHideTimestampsWidth) {
        document.body.classList.add('hide-timestamps-responsive');
      } else {
        document.body.classList.remove('hide-timestamps-responsive');
      }

      // Width change invalidates all heights (word wrap changes)
      if (widthChanged) {
        itemHeights.clear();
        recalculatePositions();
      }

      scheduleRender();
    });
    resizeObserver.observe(logsContainer);

    document.addEventListener('click', hideContextMenu);

    document.addEventListener(
      'keydown',
      (e) => {
        const mod = e.metaKey || e.ctrlKey;
        if (!mod) return;
        const isFindKey = e.key === 'f' || e.key === 'F' || e.code === 'KeyF';
        if (!isFindKey) return;
        e.preventDefault();
        e.stopPropagation();
        focusFilterField();
      },
      true
    );

    // Initialize toggle button state
    syncFilterModeUi();
    refreshSearchNav();

    vscode.postMessage({ type: 'ready' });
  }

  function focusFilterField() {
    if (!filterInput) return;
    filterInput.focus();
    filterInput.select();
  }

  function setupVirtualScroll() {
    logsContainer.innerHTML = '';

    scrollContent = document.createElement('div');
    scrollContent.className = 'virtual-scroll-content';
    scrollContent.style.position = 'relative';
    scrollContent.style.width = '100%';

    visibleContent = document.createElement('div');
    visibleContent.className = 'virtual-visible-content';
    visibleContent.style.position = 'absolute';
    visibleContent.style.left = '0';
    visibleContent.style.right = '0';

    // Hidden container for measuring heights
    measureContainer = document.createElement('div');
    measureContainer.className = 'measure-container';
    measureContainer.style.position = 'absolute';
    measureContainer.style.visibility = 'hidden';
    measureContainer.style.left = '0';
    measureContainer.style.right = '0';
    measureContainer.style.top = '-9999px';

    scrollContent.appendChild(visibleContent);
    scrollContent.appendChild(measureContainer);
    logsContainer.appendChild(scrollContent);
  }

  function getItemHeight(index) {
    const log = filteredLogs[index];
    if (!log) return DEFAULT_ITEM_HEIGHT;

    if (itemHeights.has(log.id)) {
      return itemHeights.get(log.id);
    }
    return DEFAULT_ITEM_HEIGHT;
  }

  function measureItem(index) {
    const log = filteredLogs[index];
    if (!log || itemHeights.has(log.id)) return;

    const entry = createLogEntry(log, index);
    measureContainer.innerHTML = '';
    measureContainer.appendChild(entry);

    const height = Math.max(DEFAULT_ITEM_HEIGHT, entry.offsetHeight);
    itemHeights.set(log.id, height);
  }

  function recalculatePositions() {
    itemPositions = [];
    let cumulative = 0;

    for (let i = 0; i < filteredLogs.length; i++) {
      itemPositions.push(cumulative);
      cumulative += getItemHeight(i);
    }

    totalHeight = cumulative;
    if (scrollContent) {
      scrollContent.style.height = `${totalHeight}px`;
    }
  }

  function findStartIndex(scrollTop) {
    // Binary search for start index
    let low = 0;
    let high = filteredLogs.length - 1;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const pos = itemPositions[mid] || 0;
      const height = getItemHeight(mid);

      if (pos + height < scrollTop) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return Math.max(0, low - BUFFER_SIZE);
  }

  function findEndIndex(startIndex, viewportBottom) {
    let index = startIndex;

    while (index < filteredLogs.length) {
      const pos = itemPositions[index] || 0;
      if (pos > viewportBottom) break;
      index++;
    }

    return Math.min(filteredLogs.length, index + BUFFER_SIZE);
  }

  function handleScroll() {
    scrollTop = logsContainer.scrollTop;
    shouldAutoScroll = logsContainer.scrollHeight - scrollTop <= containerHeight + 50;
    scheduleRender();
  }

  function scheduleRender(force = false) {
    if (pendingRender) return;
    pendingRender = true;
    requestAnimationFrame(() => {
      pendingRender = false;
      const prevStart = visibleStartIndex;
      const prevEnd = visibleEndIndex;
      updateVisibleRange();

      // Skip re-render if user has text selected and visible range hasn't changed
      if (!force && hasTextSelection() && prevStart === visibleStartIndex && prevEnd === visibleEndIndex) {
        return;
      }

      renderVisibleLogs();
    });
  }

  function updateVisibleRange() {
    if (filteredLogs.length === 0) {
      visibleStartIndex = 0;
      visibleEndIndex = 0;
      return;
    }

    visibleStartIndex = findStartIndex(scrollTop);
    visibleEndIndex = findEndIndex(visibleStartIndex, scrollTop + containerHeight);
  }

  function hasTextSelection() {
    const selection = window.getSelection();
    return selection && selection.toString().length > 0;
  }

  window.addEventListener('message', (event) => {
    const message = event.data;

    switch (message.type) {
      case 'logs':
        allLogs = message.logs || [];
        launchTimestamp = allLogs.length > 0 ? allLogs[0].timestamp : null;
        applyFilters();
        break;
      case 'newLog':
        if (message.log) {
          if (allLogs.length === 0 && launchTimestamp === null) {
            launchTimestamp = message.log.timestamp;
          }
          allLogs.push(message.log);
          applyFiltersIncremental(allLogs.length - 1);
        }
        break;
      case 'clear':
        allLogs = [];
        filteredLogs = [];
        launchTimestamp = null;
        itemHeights.clear();
        recalculatePositions();
        scheduleRender();
        refreshSearchNav();
        break;
      case 'config':
        if (message.config) {
          timestampMode = message.config.timestampMode || 'absolute';
          autoHideTimestampsWidth = message.config.autoHideTimestampsWidth || 200;
          if (message.config.defaultLevels) {
            activeLevels = new Set(message.config.defaultLevels);
            updateLevelButtons();
          }
          updateTimestampVisibility();
          itemHeights.clear();
          applyFilters();
        }
        break;
      case 'setFilter':
        searchQuery = message.filter || '';
        searchMatchIndex = -1;
        if (filterInput) filterInput.value = searchQuery;
        updateSearchRegex();
        syncFilterModeUi();
        applyFilters();
        break;
      case 'copyAll':
        handleCopyAll();
        break;
      case 'toggleCompact':
        toggleCompact();
        break;
      case 'toggleTags':
        toggleTagHighlighting();
        break;
      case 'packageInfo':
        localPackageNames = new Set(message.localPackageNames || []);
        applyFilters();
        break;
      case 'focusFilter':
        focusFilterField();
        break;
    }
  });

  function toggleLevel(level) {
    if (activeLevels.has(level)) {
      activeLevels.delete(level);
    } else {
      activeLevels.add(level);
    }
    updateLevelButtons();
    applyFilters();
  }

  function updateLevelButtons() {
    levelButtons.forEach((btn) => {
      btn.classList.toggle('active', activeLevels.has(btn.dataset.level));
    });
  }

  function handleFilterInput() {
    searchQuery = filterInput.value;
    searchMatchIndex = -1;
    updateSearchRegex();
    syncFilterModeUi();
    clearTimeout(filterDebounceTimer);
    filterDebounceTimer = setTimeout(() => applyFilters(), FILTER_DEBOUNCE_MS);
  }

  function syncFilterModeUi() {
    if (logicToggle) {
      logicToggle.classList.add('active');
      logicToggle.removeAttribute('disabled');
      if (filterMode === 'search') {
        logicToggle.innerHTML = SEARCH_TOGGLE_SVG;
        logicToggle.title =
          'Search in view: D/I/W/E filter the list; text only highlights and find-next (click to cycle, right-click for menu)';
      } else if (filterMode === 'and') {
        logicToggle.textContent = '&&';
        logicToggle.title = 'Filter (AND): level and text must both match (click to cycle, right-click for menu)';
      } else {
        logicToggle.textContent = '||';
        logicToggle.title = 'Filter (OR): level or text can match (click to cycle, right-click for menu)';
      }
    }
    if (filterInput) {
      filterInput.placeholder = filterMode === 'search' ? 'Search' : 'Filter';
    }
  }

  function setFilterMode(mode) {
    if (mode !== 'search' && mode !== 'and' && mode !== 'or') return;
    filterMode = mode;
    syncFilterModeUi();
    applyFilters();
  }

  function cycleFilterMode() {
    if (filterMode === 'and') filterMode = 'or';
    else if (filterMode === 'or') filterMode = 'search';
    else filterMode = 'and';
    syncFilterModeUi();
    applyFilters();
  }

  function showFilterModeContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();
    hideContextMenu();

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.id = 'filterModeMenu';

    const modes = [
      { mode: 'search', label: 'Search in view', hint: 'levels filter list; text finds matches' },
      { mode: 'and', label: 'Filter (AND)', hint: '&&' },
      { mode: 'or', label: 'Filter (OR)', hint: '||' },
    ];

    modes.forEach(({ mode, label, hint }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'context-menu-item' + (filterMode === mode ? ' context-menu-item--current' : '');
      btn.textContent = label;
      btn.title = hint;
      btn.onclick = () => {
        hideContextMenu();
        setFilterMode(mode);
      };
      menu.appendChild(btn);
    });

    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    document.body.appendChild(menu);

    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = `${window.innerWidth - rect.width - 5}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - rect.height - 5}px`;
  }

  function toggleCompact() {
    compactMessages = !compactMessages;
    itemHeights.clear();
    recalculatePositions();
    scheduleRender(true); // Force render on toggle
  }

  function toggleTagHighlighting() {
    highlightTags = !highlightTags;
    scheduleRender(true); // Force render on toggle
  }

  function compactMessage(message) {
    if (!compactMessages) return message;
    return message.replace(COMPACT_PREFIX_REGEX, '').replace(BRACKET_TIMESTAMP_REGEX, '').replace(BOX_DRAWING_REGEX, '');
  }

  function updateSearchRegex() {
    if (searchQuery) {
      try { searchRegex = new RegExp(searchQuery, 'gi'); }
      catch (e) { searchRegex = null; }
    } else {
      searchRegex = null;
    }
  }

  function recomputeSearchLineIndices() {
    searchLineIndices = [];
    if (!searchQuery.trim()) return;
    for (let i = 0; i < filteredLogs.length; i++) {
      if (matchesSearchQuery(filteredLogs[i])) {
        searchLineIndices.push(i);
      }
    }
  }

  function clampSearchMatchIndex() {
    if (searchLineIndices.length === 0) {
      searchMatchIndex = -1;
    } else if (searchMatchIndex >= searchLineIndices.length) {
      searchMatchIndex = searchLineIndices.length - 1;
    }
  }

  function refreshSearchNav() {
    if (!searchNav) return;
    const hasSearch = searchQuery.trim().length > 0;
    searchNav.hidden = !hasSearch;
    if (!hasSearch) return;

    recomputeSearchLineIndices();
    clampSearchMatchIndex();
    const total = searchLineIndices.length;
    if (searchNavCount) {
      if (total === 0) {
        searchNavCount.textContent = '0';
      } else if (searchMatchIndex < 0) {
        searchNavCount.textContent = `1 / ${total}`;
      } else {
        searchNavCount.textContent = `${searchMatchIndex + 1} / ${total}`;
      }
    }
    if (searchPrev && searchNext) {
      const disabled = total === 0;
      searchPrev.disabled = disabled;
      searchNext.disabled = disabled;
    }
  }

  function navigateSearchMatch(delta) {
    recomputeSearchLineIndices();
    if (!searchQuery.trim() || searchLineIndices.length === 0) return;
    const n = searchLineIndices.length;
    if (searchMatchIndex < 0) {
      searchMatchIndex = delta > 0 ? 0 : n - 1;
    } else {
      searchMatchIndex = (searchMatchIndex + delta + n) % n;
    }
    scrollToSearchMatch();
    refreshSearchNav();
  }

  function scrollToSearchMatch() {
    if (searchMatchIndex < 0 || searchMatchIndex >= searchLineIndices.length) return;
    const i = searchLineIndices[searchMatchIndex];
    if (i < 0 || i >= filteredLogs.length) return;

    measureItem(i);
    recalculatePositions();

    const pos = itemPositions[i] || 0;
    const h = getItemHeight(i);
    const targetScroll = Math.max(0, pos - containerHeight / 2 + h / 2);
    logsContainer.scrollTop = targetScroll;
    scrollTop = targetScroll;
    shouldAutoScroll = false;
    scheduleRender(true);

    requestAnimationFrame(() => {
      const entry = visibleContent?.querySelector(`[data-log-index="${i}"]`);
      if (entry) {
        entry.classList.add('highlight');
        setTimeout(() => entry.classList.remove('highlight'), 600);
      }
    });
  }

  function updateTimestampVisibility() {
    document.body.classList.toggle('hide-timestamps', timestampMode === 'hidden');
  }

  function formatRelativeTimestamp(timestamp) {
    if (launchTimestamp === null) return '+00:00.000';
    const diffMs = timestamp - launchTimestamp;
    if (diffMs < 0) return '+00:00.000';

    const totalSeconds = diffMs / 1000;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const secStr = seconds.toFixed(3);

    if (hours > 0) {
      return `+${hours}:${String(minutes).padStart(2, '0')}:${secStr.padStart(6, '0')}`;
    }
    return `+${String(minutes).padStart(2, '0')}:${secStr.padStart(6, '0')}`;
  }

  function getTimestampText(log) {
    if (timestampMode === 'absolute') {
      return log.formattedTimestamp || '';
    }
    if (timestampMode === 'relative') {
      return formatRelativeTimestamp(log.timestamp);
    }
    return '';
  }

  function formatLogForCopy(log) {
    if (timestampMode === 'hidden') return log.message;
    const ts = timestampMode === 'relative'
      ? formatRelativeTimestamp(log.timestamp)
      : log.formattedTimestamp;
    return `${ts} ${log.level.toUpperCase()} ${log.message}`;
  }

  function handleCopyAll() {
    navigator.clipboard.writeText(filteredLogs.map(formatLogForCopy).join('\n'));
  }

  function copyLogsRange(startIndex, endIndex) {
    const text = filteredLogs.slice(startIndex, endIndex + 1).map(formatLogForCopy).join('\n');
    navigator.clipboard.writeText(text);
  }

  function matchesSearchQuery(log) {
    if (!searchQuery) return true;

    if (searchRegex) {
      searchRegex.lastIndex = 0;
      return searchRegex.test(log.message);
    } else {
      const query = searchQuery.toLowerCase();
      return log.message.toLowerCase().includes(query);
    }
  }

  function matchesLevel(log) {
    return activeLevels.has(log.level);
  }

  function passLevelAndSearchFilter(log) {
    const hasText = searchQuery && searchQuery.trim().length > 0;
    const levelMatch = matchesLevel(log);
    if (filterMode === 'search') {
      return levelMatch;
    }
    if (!hasText) {
      return levelMatch;
    }
    const searchMatch = matchesSearchQuery(log);
    if (filterMode === 'and') {
      return levelMatch && searchMatch;
    }
    return levelMatch || searchMatch;
  }

  function applyFilters() {
    const filtered = allLogs.filter(passLevelAndSearchFilter);

    // Decide from current scroll state (avoids race when new logs arrive)
    const wasAtBottom = logsContainer.scrollHeight - logsContainer.scrollTop <= containerHeight + 50;
    shouldAutoScroll = wasAtBottom;

    // Save scroll position before recalculating (if not at bottom)
    let savedScrollTop = 0;
    if (!wasAtBottom) {
      savedScrollTop = logsContainer.scrollTop;
    }

    filteredLogs = filtered;
    recalculatePositions();

    // Restore scroll position if we saved it
    if (!wasAtBottom) {
      logsContainer.scrollTop = savedScrollTop;
      scrollTop = savedScrollTop;
    }

    scheduleRender(true); // Force render on filter change

    refreshSearchNav();

    if (wasAtBottom) scrollToBottom();
  }

  function applyFiltersIncremental(fromIndex) {
    // Decide from current scroll state (avoids race: user scrolled up but scroll event not fired yet)
    const wasAtBottom = logsContainer.scrollHeight - logsContainer.scrollTop <= containerHeight + 50;
    shouldAutoScroll = wasAtBottom;

    const newLogs = allLogs.slice(fromIndex);
    const newFiltered = newLogs.filter(passLevelAndSearchFilter);

    if (newFiltered.length === 0) return; // No new filtered logs, skip update

    // Save scroll position before recalculating (if not at bottom)
    let savedScrollTop = 0;
    if (!wasAtBottom) {
      savedScrollTop = logsContainer.scrollTop;
    }

    filteredLogs = filteredLogs.concat(newFiltered);
    recalculatePositions();

    // Restore scroll position if we saved it
    if (!wasAtBottom) {
      logsContainer.scrollTop = savedScrollTop;
      scrollTop = savedScrollTop;
    }

    // Only re-render if was at bottom or if new items are in visible range
    const needsRender = wasAtBottom || (newFiltered.length > 0 && filteredLogs.length - newFiltered.length < visibleEndIndex);
    if (needsRender) {
      scheduleRender();
    }

    if (wasAtBottom) scrollToBottom();
    refreshSearchNav();
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      logsContainer.scrollTop = totalHeight;
    });
  }

  const escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (c) => escapeMap[c]);
  }

  function highlightSearchMatches(text) {
    if (!searchQuery) return escapeHtml(text);

    let escaped = escapeHtml(text);

    if (searchRegex) {
      const regex = new RegExp(searchQuery, 'gi');
      return escaped.replace(regex, (m) => `<span class="search-highlight">${m}</span>`);
    }

    const query = searchQuery.toLowerCase();
    const lowerText = escaped.toLowerCase();
    let result = '', lastIndex = 0, index;

    while ((index = lowerText.indexOf(query, lastIndex)) !== -1) {
      result += escaped.slice(lastIndex, index);
      result += `<span class="search-highlight">${escaped.slice(index, index + query.length)}</span>`;
      lastIndex = index + query.length;
    }
    return result + escaped.slice(lastIndex);
  }

  function applyTagHighlighting(html) {
    if (!highlightTags) return html;
    return html.replace(TAG_REGEX, (match, tag) => {
      const lower = tag.toLowerCase();
      if (['debug', 'info', 'warn', 'warning', 'error', 'trace', 'exception'].includes(lower)) {
        return match;
      }
      return `<span class="log-tag">[${tag}]</span>`;
    });
  }

  // Find end of balanced JSON object/array starting at `start` in raw text.
  function findBalancedJsonEnd(text, start) {
    const open = text[start];
    const close = open === '{' ? '}' : ']';
    let depth = 1;
    let i = start + 1;
    let inString = false;
    let escaped = false;
    while (i < text.length) {
      const c = text[i];
      if (escaped) { escaped = false; i++; continue; }
      if (inString) {
        if (c === '\\') { escaped = true; i++; continue; }
        if (c === '"') { inString = false; }
        i++; continue;
      }
      if (c === '"') { inString = true; i++; continue; }
      if (c === open) { depth++; }
      else if (c === close) { depth--; if (depth === 0) return i; }
      i++;
    }
    return -1;
  }

  // Recursively render a parsed JSON value into syntax-highlighted HTML.
  const DEPTH_COUNT = 6;

  function renderJsonValue(value, depth) {
    if (value === null) {
      return '<span class="json-null">null</span>';
    }
    switch (typeof value) {
      case 'string':
        return `<span class="json-string">"${escapeHtml(value)}"</span>`;
      case 'number':
        return `<span class="json-number">${value}</span>`;
      case 'boolean':
        return `<span class="json-bool">${value}</span>`;
      default:
        break;
    }
    if (Array.isArray(value)) {
      return renderJsonArray(value, depth);
    }
    if (typeof value === 'object') {
      return renderJsonObject(value, depth);
    }
    return escapeHtml(String(value));
  }

  function renderJsonObject(obj, depth) {
    const dc = depth % DEPTH_COUNT;
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      return `<span class="json-bracket json-depth-${dc}">{}</span>`;
    }
    let out = `<span class="json-bracket json-depth-${dc}">{</span>`;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      out += `<span class="json-key">"${escapeHtml(key)}"</span>`;
      out += `<span class="json-punctuation">:</span>`;
      out += renderJsonValue(obj[key], depth + 1);
      if (i < keys.length - 1) {
        out += `<span class="json-punctuation">,</span>`;
      }
    }
    out += `<span class="json-bracket json-depth-${dc}">}</span>`;
    return out;
  }

  function renderJsonArray(arr, depth) {
    const dc = depth % DEPTH_COUNT;
    if (arr.length === 0) {
      return `<span class="json-bracket json-depth-${dc}">[]</span>`;
    }
    let out = `<span class="json-bracket json-depth-${dc}">[</span>`;
    for (let i = 0; i < arr.length; i++) {
      out += renderJsonValue(arr[i], depth + 1);
      if (i < arr.length - 1) {
        out += `<span class="json-punctuation">,</span>`;
      }
    }
    out += `<span class="json-bracket json-depth-${dc}">]</span>`;
    return out;
  }

  // Extract JSON segments from raw text before HTML escaping.
  // Returns an array of { type: 'text' | 'json', content: string, parsed?: any }.
  function splitJsonSegments(raw) {
    const segments = [];
    let i = 0;
    while (i < raw.length) {
      if (raw[i] === '{' || raw[i] === '[') {
        const end = findBalancedJsonEnd(raw, i);
        if (end !== -1 && end > i + 1) {
          const candidate = raw.slice(i, end + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (typeof parsed === 'object' && parsed !== null) {
              segments.push({ type: 'json', content: candidate, parsed });
              i = end + 1;
              continue;
            }
          } catch (_) { /* not valid JSON, treat as text */ }
        }
      }
      const textStart = i;
      i++;
      while (i < raw.length && raw[i] !== '{' && raw[i] !== '[') i++;
      segments.push({ type: 'text', content: raw.slice(textStart, i) });
    }
    return segments;
  }

  function processTextSegment(text) {
    let html = highlightSearchMatches(text);
    html = applyTagHighlighting(html);
    return html;
  }

  function processMessageForDisplay(text) {
    const compacted = compactMessage(text);

    // Split into JSON and non-JSON segments on raw text, then render each appropriately
    const segments = highlightTags ? splitJsonSegments(compacted) : [{ type: 'text', content: compacted }];
    let html = '';
    for (const seg of segments) {
      if (seg.type === 'json') {
        html += renderJsonValue(seg.parsed, 0);
      } else {
        html += processTextSegment(seg.content);
      }
    }

    // URL links: make http/https URLs clickable (run before file-link regex to avoid conflicts)
    html = html.replace(URL_REGEX, (match) => {
      const realUrl = match.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      return `<span class="url-link" data-url="${escapeHtml(realUrl)}">${match}</span>`;
    });
    // File links
    return html.replace(FILE_PATH_REGEX, (match, prefix, path, line, col) => {
      const scheme = prefix ? prefix.replace(':', '') : '';
      const isExternal = scheme === 'dart' || (scheme === 'package' && path.includes('/') && !localPackageNames.has(path.split('/')[0]));
      const externalAttr = isExternal ? ' data-external="true"' : '';
      return `<span class="file-link${isExternal ? ' file-link--external' : ''}" data-path="${escapeHtml(path)}" data-line="${line}" data-col="${col || '1'}" data-scheme="${escapeHtml(scheme)}"${externalAttr}>${match}</span>`;
    });
  }

  function createLogEntry(log, index) {
    const entry = document.createElement('div');
    entry.className = `log-entry ${log.level}`;
    entry.dataset.logIndex = index;

    if (timestampMode !== 'hidden') {
      const ts = document.createElement('span');
      ts.className = 'log-timestamp';
      ts.textContent = getTimestampText(log);
      entry.appendChild(ts);

      const lv = document.createElement('span');
      lv.className = 'log-level';
      lv.textContent = log.level.toUpperCase();
      entry.appendChild(lv);
    }

    const msg = document.createElement('span');
    msg.className = 'log-message';
    msg.innerHTML = processMessageForDisplay(log.message);
    entry.appendChild(msg);

    return entry;
  }

  function renderVisibleLogs() {
    if (!scrollContent || !visibleContent) return;

    // Save scroll anchor before measuring/recalculating (if not auto-scrolling)
    let anchorIndex = -1;
    let anchorPosition = 0;
    let savedScrollTop = 0;
    if (!shouldAutoScroll && visibleStartIndex >= 0 && visibleStartIndex < filteredLogs.length) {
      anchorIndex = visibleStartIndex;
      anchorPosition = itemPositions[anchorIndex] || 0;
      savedScrollTop = logsContainer.scrollTop;
    }

    // Measure unmeasured items in visible range
    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      measureItem(i);
    }

    // Recalculate after measuring
    recalculatePositions();

    scrollContent.style.height = `${totalHeight}px`;

    // Restore scroll position if we saved an anchor
    if (anchorIndex >= 0 && !shouldAutoScroll) {
      const newAnchorPosition = itemPositions[anchorIndex] || 0;
      const positionDrift = newAnchorPosition - anchorPosition;
      // Restore scroll position, compensating for any drift
      logsContainer.scrollTop = savedScrollTop + positionDrift;
      // Update scrollTop variable to match
      scrollTop = logsContainer.scrollTop;
    }

    const topOffset = itemPositions[visibleStartIndex] || 0;
    visibleContent.style.top = `${topOffset}px`;

    const fragment = document.createDocumentFragment();

    for (let i = visibleStartIndex; i < visibleEndIndex; i++) {
      const log = filteredLogs[i];
      if (!log) continue;
      fragment.appendChild(createLogEntry(log, i));
    }

    visibleContent.innerHTML = '';
    visibleContent.appendChild(fragment);

    visibleContent.onclick = handleClick;
    visibleContent.oncontextmenu = handleContextMenu;
  }

  function handleClick(e) {
    const fileLink = e.target.closest('.file-link');
    if (fileLink) {
      e.preventDefault();
      e.stopPropagation();
      // Extension expects: filePath (path only), line/column numbers, scheme '' or 'package'/'dart'
      vscode.postMessage({
        type: 'openFile',
        filePath: fileLink.dataset.path,
        line: parseInt(fileLink.dataset.line, 10),
        column: parseInt(fileLink.dataset.col, 10),
        scheme: fileLink.dataset.scheme || ''
      });
      return;
    }

    const urlLink = e.target.closest('.url-link');
    if (urlLink) {
      e.preventDefault();
      e.stopPropagation();
      vscode.postMessage({
        type: 'openUrl',
        url: urlLink.dataset.url
      });
    }
  }

  function handleContextMenu(e) {
    const entry = e.target.closest('.log-entry');
    if (entry) {
      const index = parseInt(entry.dataset.logIndex, 10);
      const log = filteredLogs[index];
      if (log) showContextMenu(e, index, log);
    }
  }

  function highlightLogRange(startIndex, endIndex) {
    clearLogHighlights();
    for (let i = startIndex; i <= endIndex; i++) {
      const entry = visibleContent?.querySelector(`[data-log-index="${i}"]`);
      if (entry) {
        entry.classList.add('hover-highlight');
      }
    }
  }

  function clearLogHighlights() {
    if (visibleContent) {
      const highlighted = visibleContent.querySelectorAll('.log-entry.hover-highlight');
      highlighted.forEach(el => el.classList.remove('hover-highlight'));
    }
  }

  function showContextMenu(e, index, log) {
    e.preventDefault();
    hideContextMenu();

    contextMenuTargetIndex = index;

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.id = 'contextMenu';

    const copyUp = document.createElement('button');
    copyUp.className = 'context-menu-item';
    copyUp.textContent = 'Copy up to here';
    copyUp.onmouseenter = () => highlightLogRange(0, index);
    copyUp.onmouseleave = clearLogHighlights;
    copyUp.onclick = () => { copyLogsRange(0, index); hideContextMenu(); };
    menu.appendChild(copyUp);

    const copyDown = document.createElement('button');
    copyDown.className = 'context-menu-item';
    copyDown.textContent = 'Copy from here';
    copyDown.onmouseenter = () => highlightLogRange(index, filteredLogs.length - 1);
    copyDown.onmouseleave = clearLogHighlights;
    copyDown.onclick = () => { copyLogsRange(index, filteredLogs.length - 1); hideContextMenu(); };
    menu.appendChild(copyDown);

    if (searchQuery || activeLevels.size < 4) {
      const sep = document.createElement('div');
      sep.className = 'context-menu-separator';
      menu.appendChild(sep);

      const showAll = document.createElement('button');
      showAll.className = 'context-menu-item';
      showAll.textContent = 'Show without filters';
      showAll.onclick = () => {
        searchQuery = '';
        searchRegex = null;
        if (filterInput) filterInput.value = '';
        activeLevels = new Set(['debug', 'info', 'warn', 'error']);
        updateLevelButtons();
        applyFilters();

        requestAnimationFrame(() => {
          const logIndex = allLogs.findIndex(l => l.id === log.id);
          if (logIndex >= 0 && itemPositions[logIndex] !== undefined) {
            logsContainer.scrollTop = Math.max(0, itemPositions[logIndex] - containerHeight / 2);
            setTimeout(() => {
              const entry = visibleContent.querySelector(`[data-log-index="${logIndex}"]`);
              if (entry) {
                entry.classList.add('highlight');
                setTimeout(() => entry.classList.remove('highlight'), 800);
              }
            }, 100);
          }
        });
        hideContextMenu();
      };
      menu.appendChild(showAll);
    }

    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    document.body.appendChild(menu);

    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = `${window.innerWidth - rect.width - 5}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${window.innerHeight - rect.height - 5}px`;
  }

  function hideContextMenu() {
    document.getElementById('contextMenu')?.remove();
    document.getElementById('filterModeMenu')?.remove();
    contextMenuTargetIndex = -1;
    clearLogHighlights();
  }

  init();
})();

