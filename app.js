// ╔═══════════════════════════════════════════════════════════╗
// ║  REMOTE SOUND LIBRARY — add public folder URLs here  ║
// ╚═══════════════════════════════════════════════════════════╝
const LIBRARY_BASE_URLS = [
    "https://raw.githubusercontent.com/duckie-jr/HotKey-Chaos/refs/heads/main/sounds/",
];

// ── State ──────────────────────────────────────────────────────────────────
let boards          = [];          // [{ id, name, sounds: [] }]
let currentBoardId  = 'all';       // 'all' | board.id
let boardIdCounter  = 0;
let soundIdCounter  = 0;
let masterVolume    = 1;
let audioCtx        = null;
let activeSources   = {};          // key: `${soundId}-${timestamp}` → { source, gain }
let playbackMode    = 'overlap';   // 'overlap' | 'interrupt' | 'loop'
let currentEditSound = null;
let listeningForKey  = false;

// ── DOM refs ────────────────────────────────────────────────────────────────
const soundGrid          = document.getElementById('sound-grid');
const addNewTileBtn      = document.getElementById('add-new-tile');
const masterVolumeSlider = document.getElementById('master-volume');
const stopAllBtn         = document.getElementById('stop-all');
const openLibraryBtn     = document.getElementById('open-library-btn');
const libraryModal       = document.getElementById('library-modal');
const closeLibraryBtn    = document.getElementById('close-library');
const editSidebar        = document.getElementById('edit-sidebar');
const closeSidebarBtn    = document.getElementById('close-sidebar-btn');
const saveSidebarBtn     = document.getElementById('save-sidebar-btn');
const deleteTileBtn      = document.getElementById('delete-tile-btn');
const duplicateTileBtn   = document.querySelector('[title="Duplicate"]');
const volSlider          = document.getElementById('tile-volume');
const volDisplay         = document.getElementById('volume-val-display');
const bassSlider         = document.getElementById('tile-bass');
const bassDisplay        = document.getElementById('bass-val-display');
const colorSwatches      = document.querySelectorAll('.color-swatch');
const headerColorDot     = document.getElementById('header-color-dot');
const setHotkeyBtn       = document.getElementById('set-hotkey-btn');
const hotkeyDisplay      = document.getElementById('hotkey-display');
const sidebarTitle       = document.getElementById('sidebar-title');
const exportBtn          = document.getElementById('export-btn');
const importFileInput    = document.getElementById('import-file');
const modeButtons        = document.querySelectorAll('.mode-toggles button');
const sourceTabs         = document.querySelectorAll('.source-tabs button');
const uploadArea         = document.querySelector('.upload-area');
const tileFileInput      = document.getElementById('tile-file-input');
const urlSection         = document.getElementById('url-source-section');
const urlInput           = document.getElementById('tile-url-input');
const boardTabsEl        = document.getElementById('board-tabs');
const renameModal        = document.getElementById('rename-modal');
const renameInput        = document.getElementById('rename-input');
const renameConfirmBtn   = document.getElementById('rename-confirm');
const renameCancelBtn    = document.getElementById('rename-cancel');

// ── Board helpers ───────────────────────────────────────────────────────────
function getCurrentBoard() {
    if (currentBoardId === 'all') return null;
    return boards.find(b => b.id === currentBoardId) || null;
}

function getActiveSounds() {
    if (currentBoardId === 'all') return boards.flatMap(b => b.sounds);
    const board = getCurrentBoard();
    return board ? board.sounds : [];
}

function getBoardForSound(soundId) {
    return boards.find(b => b.sounds.some(s => s.id === soundId));
}

function getDefaultBoard() {
    return boards[0] || null;
}

// ── Board CRUD ──────────────────────────────────────────────────────────────
function createBoard(name = 'New Board') {
    const board = { id: ++boardIdCounter, name, sounds: [] };
    boards.push(board);
    saveState();
    renderBoardTabs();
    return board;
}

function deleteBoard(id) {
    if (boards.length <= 1) return; // keep at least one
    boards = boards.filter(b => b.id !== id);
    if (currentBoardId === id) currentBoardId = 'all';
    saveState();
    renderBoardTabs();
    renderMainBoard();
}

function renameBoard(id, name) {
    const board = boards.find(b => b.id === id);
    if (board && name.trim()) {
        board.name = name.trim();
        saveState();
        renderBoardTabs();
    }
}

// ── Rename modal ────────────────────────────────────────────────────────────
let renameTarget = null; // board id or null (create mode)

function openRenameModal(boardId, currentName = '') {
    renameTarget = boardId;
    renameInput.value = currentName;
    renameModal.classList.remove('hidden');
    requestAnimationFrame(() => { renameInput.focus(); renameInput.select(); });
}

function closeRenameModal() {
    renameModal.classList.add('hidden');
    renameTarget = null;
    renameInput.value = '';
}

renameConfirmBtn.addEventListener('click', () => {
    const name = renameInput.value.trim();
    if (!name) return;
    if (renameTarget === null) {
        // Create new board
        const board = createBoard(name);
        currentBoardId = board.id;
        renderBoardTabs();
        renderMainBoard();
    } else {
        renameBoard(renameTarget, name);
    }
    closeRenameModal();
});

renameCancelBtn.addEventListener('click', closeRenameModal);

renameModal.addEventListener('click', e => { if (e.target === renameModal) closeRenameModal(); });

renameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') renameConfirmBtn.click();
    if (e.key === 'Escape') closeRenameModal();
});

// ── Render board tabs ───────────────────────────────────────────────────────
function renderBoardTabs() {
    boardTabsEl.innerHTML = '';

    // "All Sounds" tab
    const allBtn = document.createElement('button');
    allBtn.className = 'board-tab-all' + (currentBoardId === 'all' ? ' active' : '');
    allBtn.textContent = 'All Sounds';
    allBtn.addEventListener('click', () => {
        currentBoardId = 'all';
        renderBoardTabs();
        renderMainBoard();
    });
    boardTabsEl.appendChild(allBtn);

    // Individual board tabs
    boards.forEach(board => {
        const tab = document.createElement('button');
        tab.className = 'board-tab' + (currentBoardId === board.id ? ' active' : '');
        tab.dataset.id = board.id;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'board-tab-name';
        nameSpan.textContent = board.name;

        const closeSpan = document.createElement('span');
        closeSpan.className = 'board-tab-close';
        closeSpan.title = 'Delete board';
        closeSpan.innerHTML = '&times;';

        tab.appendChild(nameSpan);
        tab.appendChild(closeSpan);

        // Click → switch board
        tab.addEventListener('click', e => {
            if (e.target === closeSpan) return;
            currentBoardId = board.id;
            renderBoardTabs();
            renderMainBoard();
        });

        // Double-click → rename
        tab.addEventListener('dblclick', e => {
            if (e.target === closeSpan) return;
            openRenameModal(board.id, board.name);
        });

        // Close button → delete
        closeSpan.addEventListener('click', e => {
            e.stopPropagation();
            if (board.sounds.length > 0) {
                if (!confirm(`Delete "${board.name}" and its ${board.sounds.length} sound(s)?`)) return;
            }
            deleteBoard(board.id);
        });

        boardTabsEl.appendChild(tab);
    });

    // "+" new board button
    const addBtn = document.createElement('button');
    addBtn.className = 'board-tab-add';
    addBtn.title = 'New board';
    addBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    addBtn.addEventListener('click', () => openRenameModal(null, ''));
    boardTabsEl.appendChild(addBtn);
}

// ── AudioContext ─────────────────────────────────────────────────────────────
function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

// ── Decode audio buffer from URL or Blob ─────────────────────────────────────
async function loadBuffer(sound) {
    if (sound.audioBuffer) return sound.audioBuffer;
    if (!sound.url) return null;
    const ctx = getAudioCtx();
    try {
        const res = await fetch(sound.url);
        const ab  = await res.arrayBuffer();
        sound.audioBuffer = await ctx.decodeAudioData(ab);
        return sound.audioBuffer;
    } catch (e) {
        console.error('Failed to load audio:', e);
        return null;
    }
}

// ── Play a sound ─────────────────────────────────────────────────────────────
async function playSound(sound) {
    const buffer = await loadBuffer(sound);
    if (!buffer) return;

    const ctx = getAudioCtx();

    if (playbackMode === 'interrupt') stopSoundById(sound.id);

    const source  = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop   = playbackMode === 'loop';

    const gain = ctx.createGain();
    gain.gain.value = (sound.volume / 100) * masterVolume;

    const bass = ctx.createBiquadFilter();
    bass.type            = 'lowshelf';
    bass.frequency.value = 200;
    bass.gain.value      = sound.bass || 0;

    source.connect(bass);
    bass.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    const key = `${sound.id}-${Date.now()}`;
    activeSources[key] = { source, gain };
    setTilePlaying(sound.id, true);

    source.onended = () => {
        delete activeSources[key];
        const stillPlaying = Object.keys(activeSources).some(k => k.startsWith(`${sound.id}-`));
        if (!stillPlaying) setTilePlaying(sound.id, false);
    };
}

// ── Stop one sound's sources ──────────────────────────────────────────────────
function stopSoundById(id) {
    for (const key of Object.keys(activeSources)) {
        if (key.startsWith(`${id}-`)) {
            try { activeSources[key].source.stop(); } catch (_) {}
            delete activeSources[key];
        }
    }
    setTilePlaying(id, false);
}

// ── Stop all sounds ───────────────────────────────────────────────────────────
stopAllBtn.addEventListener('click', () => {
    for (const { source } of Object.values(activeSources)) {
        try { source.stop(); } catch (_) {}
    }
    activeSources = {};
    document.querySelectorAll('.sound-tile.playing').forEach(t => t.classList.remove('playing'));
});

// ── Master volume ─────────────────────────────────────────────────────────────
masterVolumeSlider.addEventListener('input', e => {
    masterVolume = parseFloat(e.target.value);
    for (const { gain } of Object.values(activeSources)) {
        gain.gain.value = masterVolume;
    }
});

// ── Tile playing indicator ────────────────────────────────────────────────────
function setTilePlaying(id, playing) {
    const el = document.querySelector(`.sound-tile[data-id="${id}"]`);
    if (el) el.classList.toggle('playing', playing);
}

// ── Playback mode toggles ─────────────────────────────────────────────────────
const modeMap = ['overlap', 'interrupt', 'loop'];
modeButtons.forEach((btn, i) => {
    btn.addEventListener('click', () => {
        playbackMode = modeMap[i];
        modeButtons.forEach((b, j) => b.classList.toggle('mode-active', j === i));
    });
});
modeButtons[0]?.classList.add('mode-active');

// ── Local Sound Library via Vite glob ─────────────────────────────────────────
let localSoundFiles = {};
try { localSoundFiles = import.meta.glob('./sounds/**/*.*', { eager: true }); } catch (_) {}

const libraryData = {};

for (const path in localSoundFiles) {
    if (path.endsWith('.md')) continue;
    const url = localSoundFiles[path]?.default;
    if (!url) continue;
    const relative = path.replace('./sounds/', '');
    const parts    = relative.split('/');
    const category = parts.length > 1 ? parts[0] : 'General';
    const filename  = parts[parts.length - 1];
    const title     = filename.replace(/\.[^/.]+$/, '');
    if (!libraryData[category]) libraryData[category] = [];
    libraryData[category].push({ title, url, path });
}

// ── Library state ─────────────────────────────────────────────────────────────
let currentLibCategory = null;
let currentPreviewAudio = null;

const libGrid    = document.getElementById('local-library-grid');
const libCatList = document.getElementById('library-category-list');
const libLabel   = document.getElementById('current-category-label');
const libCount   = document.getElementById('lib-sound-count');
const libSearch  = document.getElementById('lib-search');
const libDropZone  = document.getElementById('lib-drop-zone');
const libFileInput = document.getElementById('lib-file-input');

// ── Render library category ────────────────────────────────────────────────
function renderLibraryCategory(categoryName, filter = '') {
    currentLibCategory = categoryName;
    if (libLabel) libLabel.innerText = categoryName;

    const all    = categoryName === '__all__'
        ? Object.values(libraryData).flat()
        : (libraryData[categoryName] || []);
    const sounds = filter
        ? all.filter(s => s.title.toLowerCase().includes(filter.toLowerCase()))
        : all;

    if (libCount) libCount.innerText = `${sounds.length} sound${sounds.length !== 1 ? 's' : ''}`;
    if (!libGrid) return;
    libGrid.innerHTML = '';

    if (sounds.length === 0) {
        libGrid.innerHTML = `
            <div class="lib-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                <h3>${filter ? 'No results' : 'No sounds here yet'}</h3>
                <p>${filter ? `Nothing matches "${filter}".` : 'Use <strong>Add Files</strong> or <strong>Add Folder</strong> on the left to load your audio files.'}</p>
                ${!filter ? `<div class="lib-empty-actions">
                    <button class="lib-empty-btn" id="empty-add-files">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                        Add Files
                    </button>
                    <button class="lib-empty-btn" id="empty-add-folder">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                        Add Folder
                    </button>
                </div>` : ''}
            </div>`;
        document.getElementById('empty-add-files')?.addEventListener('click', () => libFileInput?.click());
        document.getElementById('empty-add-folder')?.addEventListener('click', pickFolder);
        return;
    }

    sounds.forEach(sound => makeLibCard(sound));
}

function makeLibCard(sound) {
    const card = document.createElement('div');
    card.className = 'lib-card';

    const PLAY_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
    const STOP_ICON = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;

    card.innerHTML = `
        <div class="lib-card-top">
            <span class="lib-card-name">${sound.title}</span>
            <button class="play-btn" title="Preview">${PLAY_ICON}</button>
        </div>
        <button class="add-board-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add to Board
        </button>
    `;

    const playBtn = card.querySelector('.play-btn');

    playBtn.addEventListener('click', () => {
        if (currentPreviewAudio && !currentPreviewAudio.paused) {
            currentPreviewAudio.pause();
            currentPreviewAudio.currentTime = 0;
            document.querySelectorAll('.play-btn.is-playing').forEach(b => {
                b.classList.remove('is-playing');
                b.innerHTML = PLAY_ICON;
            });
            if (currentPreviewAudio._soundUrl === sound.url) {
                currentPreviewAudio = null;
                return;
            }
        }
        currentPreviewAudio = new Audio(sound.url);
        currentPreviewAudio._soundUrl = sound.url;
        currentPreviewAudio.volume = masterVolume;
        currentPreviewAudio.play().catch(e => console.warn('Preview failed:', e));
        playBtn.classList.add('is-playing');
        playBtn.innerHTML = STOP_ICON;
        currentPreviewAudio.onended = () => {
            playBtn.classList.remove('is-playing');
            playBtn.innerHTML = PLAY_ICON;
        };
    });

    const addBtn = card.querySelector('.add-board-btn');
    addBtn.addEventListener('click', () => {
        addSoundToBoard({ title: sound.title, url: sound.url });
        addBtn.classList.add('added');
        addBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Added!`;
        setTimeout(() => {
            addBtn.classList.remove('added');
            addBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Add to Board`;
        }, 1500);
    });

    libGrid.appendChild(card);
}

// ── Library sidebar ────────────────────────────────────────────────────────────
function refreshLibrarySidebar() {
    if (!libCatList) return;
    libCatList.innerHTML = '';

    const categories = Object.keys(libraryData);
    const total = Object.values(libraryData).flat().length;

    const allLi = document.createElement('li');
    allLi.innerHTML = `<span>All Sounds</span><span class="cat-count">${total}</span>`;
    allLi.classList.add('active');
    allLi.addEventListener('click', () => selectCategory(allLi, '__all__'));
    libCatList.appendChild(allLi);

    categories.forEach(cat => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${cat}</span><span class="cat-count">${libraryData[cat].length}</span>`;
        li.addEventListener('click', () => selectCategory(li, cat));
        libCatList.appendChild(li);
    });

    renderLibraryCategory('__all__', libSearch?.value || '');
}

function selectCategory(li, cat) {
    libCatList.querySelectorAll('li').forEach(el => el.classList.remove('active'));
    li.classList.add('active');
    if (libSearch) libSearch.value = '';
    renderLibraryCategory(cat);
}

// ── Remote directory crawler ──────────────────────────────────────────────────
const AUDIO_EXT = /\.(mp3|wav|ogg|flac|m4a|aac|opus|webm)$/i;
let remoteCrawlDone = false;

// ── GitHub URL detection & API crawler ───────────────────────────────────────
// Handles:
//   https://raw.githubusercontent.com/owner/repo/refs/heads/branch/path/
//   https://raw.githubusercontent.com/owner/repo/branch/path/
//   https://github.com/owner/repo/tree/branch/path
function parseGitHubUrl(url) {
    // raw.githubusercontent.com
    let m = url.match(
        /^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+?)\/(?:refs\/heads\/)?([^/]+)\/?(.*)$/
    );
    if (m) return { owner: m[1], repo: m[2], branch: m[3], path: m[4].replace(/\/$/, '') };

    // github.com/owner/repo/tree/branch/path
    m = url.match(
        /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/?(.*)$/
    );
    if (m) return { owner: m[1], repo: m[2], branch: m[3], path: m[4].replace(/\/$/, '') };

    return null;
}

async function crawlGitHub(owner, repo, branch, basePath, categoryLabel) {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
    let res;
    try { res = await fetch(apiUrl, { headers: { Accept: 'application/vnd.github.v3+json' } }); }
    catch (e) { throw new Error(`Network error reaching GitHub API: ${e.message}`); }

    if (!res.ok) {
        const msg = res.status === 404
            ? `Repository "${owner}/${repo}" not found or is private.`
            : res.status === 403
            ? `GitHub API rate limit hit. Wait a minute and try again.`
            : `GitHub API returned ${res.status}.`;
        throw new Error(msg);
    }

    const data = await res.json();

    if (data.truncated) {
        console.warn('[Library] GitHub tree was truncated — very large repo; some files may be missing.');
    }

    const prefix = basePath ? basePath + '/' : '';

    let added = 0;
    for (const item of (data.tree || [])) {
        if (item.type !== 'blob') continue;
        if (!AUDIO_EXT.test(item.path)) continue;
        if (prefix && !item.path.startsWith(prefix)) continue;

        // Relative path inside the requested folder
        const rel      = prefix ? item.path.slice(prefix.length) : item.path;
        const parts    = rel.split('/');
        const filename = parts.pop();
        const subfolder = parts.join('/');

        const cat      = subfolder ? `${categoryLabel}/${subfolder}` : categoryLabel;
        const rawUrl   = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${item.path}`;
        const title    = decodeURIComponent(filename.replace(AUDIO_EXT, '')).replace(/[-_]/g, ' ');

        if (!libraryData[cat]) libraryData[cat] = [];
        if (!libraryData[cat].some(s => s.url === rawUrl)) {
            libraryData[cat].push({ title, url: rawUrl });
            added++;
        }
    }

    if (added === 0 && prefix) {
        throw new Error(`No audio files found under "${basePath}" in ${owner}/${repo}.`);
    }
}

async function crawlDirectory(baseUrl, categoryLabel) {
    // Detect GitHub URLs and use the API instead of HTML scraping
    const gh = parseGitHubUrl(baseUrl);
    if (gh) {
        await crawlGitHub(gh.owner, gh.repo, gh.branch, gh.path, categoryLabel);
        return;
    }

    let res;
    try { res = await fetch(baseUrl); } catch (e) {
        console.warn(`[Library] Fetch failed for ${baseUrl}:`, e.message); return;
    }
    if (!res.ok) { console.warn(`[Library] ${baseUrl} returned ${res.status}`); return; }

    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
        try {
            const json = await res.json();
            const items = json.sounds || json.files || json;
            if (Array.isArray(items)) {
                items.forEach(item => {
                    const url   = item.url || item.src || item.href;
                    const title = item.title || item.name || (url ? url.split('/').pop().replace(AUDIO_EXT, '') : 'Unknown');
                    const cat   = item.category || categoryLabel;
                    if (!url) return;
                    if (!libraryData[cat]) libraryData[cat] = [];
                    libraryData[cat].push({ title, url });
                });
            }
        } catch (e) { console.warn('[Library] JSON parse error:', e); }
        return;
    }

    const html = await res.text();
    const doc  = new DOMParser().parseFromString(html, 'text/html');
    const links = Array.from(doc.querySelectorAll('a[href]'));
    const crawlPromises = [];

    for (const a of links) {
        const raw = a.getAttribute('href');
        if (!raw || raw.startsWith('?') || raw.startsWith('#')) continue;
        let fullUrl;
        try { fullUrl = new URL(raw, baseUrl).href; } catch { continue; }
        if (!fullUrl.startsWith(baseUrl) && !fullUrl.startsWith(new URL(baseUrl).origin)) continue;
        if (fullUrl === baseUrl) continue;

        if (raw.endsWith('/') || (!AUDIO_EXT.test(raw) && !raw.includes('.'))) {
            const folderName = raw.replace(/\/$/, '').split('/').filter(Boolean).pop() || raw;
            const subCat     = `${categoryLabel}/${folderName}`;
            crawlPromises.push(crawlDirectory(fullUrl.endsWith('/') ? fullUrl : fullUrl + '/', subCat));
        } else if (AUDIO_EXT.test(raw)) {
            const filename = raw.split('/').pop();
            const title    = decodeURIComponent(filename.replace(AUDIO_EXT, '')).replace(/[-_]/g, ' ');
            if (!libraryData[categoryLabel]) libraryData[categoryLabel] = [];
            if (!libraryData[categoryLabel].some(s => s.url === fullUrl)) {
                libraryData[categoryLabel].push({ title, url: fullUrl });
            }
        }
    }

    await Promise.all(crawlPromises);
}

async function loadRemoteLibraries() {
    if (LIBRARY_BASE_URLS.length === 0 || remoteCrawlDone) return;
    remoteCrawlDone = true;
    showLibraryLoading(true);
    try {
        await Promise.all(
            LIBRARY_BASE_URLS.map(url => {
                const trimmed = url.trim().replace(/\/?$/, '/');
                const gh = parseGitHubUrl(trimmed);
                const label = gh
                    ? `${gh.repo}${gh.path ? '/' + gh.path : ''}`
                    : trimmed.replace(/https?:\/\//, '').replace(/\/$/, '');
                return crawlDirectory(trimmed, label);
            })
        );
    } finally {
        showLibraryLoading(false);
        refreshLibrarySidebar();
    }
}

// ── Remote URL input in library sidebar ──────────────────────────────────────
function setupRemoteUrlInput() {
    const input  = document.getElementById('lib-remote-url');
    const addBtn = document.getElementById('lib-remote-add-btn');
    if (!input || !addBtn) return;

    async function loadFromUrl() {
        const raw = input.value.trim();
        if (!raw) return;

        addBtn.disabled = true;
        showLibraryLoading(true);

        try {
            const gh = parseGitHubUrl(raw);
            let label;
            if (gh) {
                label = gh.path
                    ? gh.path.split('/').pop() || gh.repo
                    : gh.repo;
                await crawlGitHub(gh.owner, gh.repo, gh.branch, gh.path, label);
            } else {
                const trimmed = raw.replace(/\/?$/, '/');
                label = trimmed.replace(/https?:\/\//, '').replace(/\/$/, '').split('/').pop() || trimmed;
                await crawlDirectory(trimmed, label);
            }
            refreshLibrarySidebar();
            input.value = '';
        } catch (e) {
            alert('Failed to load sounds:\n' + e.message);
        } finally {
            showLibraryLoading(false);
            addBtn.disabled = false;
        }
    }

    addBtn.addEventListener('click', loadFromUrl);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') loadFromUrl(); });
}

function showLibraryLoading(on) {
    let el = document.getElementById('lib-loading');
    if (on) {
        if (!el) {
            el = document.createElement('div');
            el.id = 'lib-loading';
            el.className = 'lib-loading';
            el.innerHTML = `<div class="lib-spinner"></div><span>Loading sounds…</span>`;
            libGrid?.parentElement?.insertBefore(el, libGrid);
        }
        if (libGrid) libGrid.style.display = 'none';
    } else {
        el?.remove();
        if (libGrid) libGrid.style.display = '';
    }
}

refreshLibrarySidebar();

libSearch?.addEventListener('input', e => {
    renderLibraryCategory(currentLibCategory || '__all__', e.target.value);
});

// ── Add individual files ──────────────────────────────────────────────────────
function ingestFiles(files) {
    let count = 0;
    for (const file of files) {
        if (!/\.(mp3|wav|ogg|flac|m4a|aac|opus|webm)$/i.test(file.name) && !file.type.startsWith('audio/')) continue;
        const url   = URL.createObjectURL(file);
        const title = file.name.replace(/\.[^/.]+$/, '');
        const cat   = 'My Sounds';
        if (!libraryData[cat]) libraryData[cat] = [];
        libraryData[cat].push({ title, url, isExternal: true });
        count++;
    }
    if (count > 0) refreshLibrarySidebar();
    return count;
}

libFileInput?.addEventListener('change', e => {
    ingestFiles(Array.from(e.target.files));
    libFileInput.value = '';
});
document.getElementById('add-files-btn')?.addEventListener('click', () => libFileInput?.click());

// ── Add folder ────────────────────────────────────────────────────────────────
async function pickFolder() {
    try {
        const dirHandle = await window.showDirectoryPicker();
        let count = 0;
        async function readDir(handle, prefix = '') {
            for await (const entry of handle.values()) {
                if (entry.kind === 'file') {
                    const file = await entry.getFile();
                    if (/\.(mp3|wav|ogg|flac|m4a|aac|opus|webm)$/i.test(file.name) || file.type.startsWith('audio/')) {
                        const url   = URL.createObjectURL(file);
                        const cat   = prefix ? `${dirHandle.name} / ${prefix}` : dirHandle.name;
                        const title = file.name.replace(/\.[^/.]+$/, '');
                        if (!libraryData[cat]) libraryData[cat] = [];
                        libraryData[cat].push({ title, url, isExternal: true });
                        count++;
                    }
                } else if (entry.kind === 'directory') {
                    await readDir(entry, prefix ? `${prefix}/${entry.name}` : entry.name);
                }
            }
        }
        await readDir(dirHandle);
        if (count > 0) refreshLibrarySidebar();
        else alert('No audio files found in that folder.');
    } catch (e) {
        if (e.name !== 'AbortError') alert('Could not access folder: ' + e.message);
    }
}
document.getElementById('add-local-folder-btn')?.addEventListener('click', pickFolder);

// ── Drag and drop onto library modal ─────────────────────────────────────────
libraryModal?.addEventListener('dragover', e => {
    e.preventDefault();
    libDropZone?.classList.remove('hidden');
    libDropZone?.classList.add('drag-over');
});
libraryModal?.addEventListener('dragleave', e => {
    if (!libraryModal.contains(e.relatedTarget)) {
        libDropZone?.classList.add('hidden');
        libDropZone?.classList.remove('drag-over');
    }
});
libraryModal?.addEventListener('drop', e => {
    e.preventDefault();
    libDropZone?.classList.add('hidden');
    libDropZone?.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files);
    const added = ingestFiles(files);
    if (!added) alert('No audio files found in the dropped items.');
});

openLibraryBtn?.addEventListener('click', () => {
    libraryModal.classList.remove('hidden');
    loadRemoteLibraries();
});
closeLibraryBtn?.addEventListener('click', () => {
    libraryModal.classList.add('hidden');
    if (currentPreviewAudio) { currentPreviewAudio.pause(); currentPreviewAudio = null; }
});

// ── Add sound to board ────────────────────────────────────────────────────────
function addSoundToBoard(data) {
    // Figure out which board to add to
    let targetBoard = getCurrentBoard();
    if (!targetBoard) {
        // On "All Sounds" view — use first board; create one if none exist
        targetBoard = getDefaultBoard();
        if (!targetBoard) targetBoard = createBoard('Main');
    }

    const sound = {
        id:      ++soundIdCounter,
        title:   data.title || `Sound ${soundIdCounter}`,
        color:   data.color  || '#6c63ff',
        volume:  data.volume ?? 100,
        bass:    data.bass   ?? 0,
        keybind: data.keybind || '',
        url:     data.url    || '',
    };
    targetBoard.sounds.push(sound);
    renderMainBoard();
    saveState();
    return sound;
}

// ── Render main board ─────────────────────────────────────────────────────────
function renderMainBoard() {
    soundGrid.innerHTML = '';
    soundGrid.appendChild(addNewTileBtn);

    const sounds = getActiveSounds();

    sounds.forEach(sound => {
        const tile = document.createElement('div');
        tile.className   = 'sound-tile';
        tile.dataset.id  = sound.id;
        tile.style.setProperty('--tile-color', sound.color || '#6c63ff');
        tile.innerHTML = `
            <div class="tile-inner">
                <span class="tile-title">${sound.title}</span>
                <kbd class="tile-key">${sound.keybind ? sound.keybind.toUpperCase() : '—'}</kbd>
                <div class="tile-playing-bar"></div>
            </div>
        `;

        tile.addEventListener('click', () => playSound(sound));
        tile.addEventListener('contextmenu', e => { e.preventDefault(); openSidebar(sound); });
        soundGrid.appendChild(tile);
    });
}

// ── Right sidebar ─────────────────────────────────────────────────────────────
function openSidebar(sound) {
    currentEditSound = sound;
    populateSidebar(sound);
    editSidebar.classList.remove('hidden');
    showSourceTab('file');
}

function populateSidebar(sound) {
    sidebarTitle.innerText   = sound.title;
    volSlider.value          = sound.volume ?? 100;
    volDisplay.innerText     = `${volSlider.value}%`;
    bassSlider.value         = sound.bass ?? 0;
    bassDisplay.innerText    = `${parseInt(bassSlider.value) > 0 ? '+' : ''}${bassSlider.value} dB`;
    hotkeyDisplay.innerText  = sound.keybind ? sound.keybind.toUpperCase() : 'Set hotkey';
    headerColorDot.style.background = sound.color;
    colorSwatches.forEach(s => s.classList.toggle('active', s.dataset.color === sound.color));

    if (uploadArea) {
        uploadArea.innerHTML = sound.url
            ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"></path><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"></path></svg> File loaded — click to replace`
            : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> Choose audio file`;
        uploadArea.style.borderColor = sound.url ? 'var(--success)' : '';
        uploadArea.style.color       = sound.url ? 'var(--success)' : '';
    }
    if (urlInput) urlInput.value = (sound.url && !sound.url.startsWith('blob:')) ? sound.url : '';
}

closeSidebarBtn.addEventListener('click', () => {
    editSidebar.classList.add('hidden');
    listeningForKey = false;
});

volSlider.addEventListener('input',  e => volDisplay.innerText  = `${e.target.value}%`);
bassSlider.addEventListener('input', e => bassDisplay.innerText = `${parseInt(e.target.value) > 0 ? '+' : ''}${e.target.value} dB`);

colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', e => {
        colorSwatches.forEach(s => s.classList.remove('active'));
        e.target.classList.add('active');
        const col = e.target.dataset.color;
        headerColorDot.style.background = col;
        if (currentEditSound) currentEditSound.color = col;
    });
});

function showSourceTab(tab) {
    sourceTabs.forEach((btn, i) => btn.classList.toggle('active', (i === 0) === (tab === 'file')));
    if (uploadArea) uploadArea.style.display = tab === 'file' ? 'flex' : 'none';
    if (urlSection) urlSection.style.display = tab === 'url'  ? 'block' : 'none';
}
sourceTabs.forEach((btn, i) => btn.addEventListener('click', () => showSourceTab(i === 0 ? 'file' : 'url')));
showSourceTab('file');

tileFileInput?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file || !currentEditSound) return;
    currentEditSound.url         = URL.createObjectURL(file);
    currentEditSound.audioBuffer = null;
    currentEditSound.title       = currentEditSound.title.startsWith('Sound ')
        ? file.name.replace(/\.[^/.]+$/, '') : currentEditSound.title;
    sidebarTitle.innerText = currentEditSound.title;
    populateSidebar(currentEditSound);
    tileFileInput.value = '';
});

urlInput?.addEventListener('change', () => {
    if (!currentEditSound || !urlInput.value.trim()) return;
    currentEditSound.url         = urlInput.value.trim();
    currentEditSound.audioBuffer = null;
});

// ── Hotkey recording ──────────────────────────────────────────────────────────
setHotkeyBtn.addEventListener('click', () => {
    listeningForKey         = true;
    hotkeyDisplay.innerText = 'Press a key…';
    setHotkeyBtn.style.borderColor = 'var(--accent)';
});

document.addEventListener('keydown', e => {
    if (listeningForKey) {
        if (e.key === 'Escape') {
            listeningForKey = false;
            hotkeyDisplay.innerText = currentEditSound?.keybind?.toUpperCase() || 'Set hotkey';
            setHotkeyBtn.style.borderColor = '';
            return;
        }
        if (e.key.length === 1 && currentEditSound) {
            currentEditSound.keybind = e.key.toLowerCase();
            hotkeyDisplay.innerText  = e.key.toUpperCase();
            listeningForKey          = false;
            setHotkeyBtn.style.borderColor = '';
            e.preventDefault();
        }
        return;
    }

    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
    if (!renameModal.classList.contains('hidden')) return;

    const key = e.key.toLowerCase();
    // Search all boards for hotkey matches
    boards.forEach(board => {
        board.sounds.forEach(sound => {
            if (sound.keybind === key) playSound(sound);
        });
    });
});

// ── Save sidebar ──────────────────────────────────────────────────────────────
saveSidebarBtn.addEventListener('click', () => {
    if (!currentEditSound) return;
    currentEditSound.title  = sidebarTitle.innerText.trim() || currentEditSound.title;
    currentEditSound.volume = parseInt(volSlider.value);
    currentEditSound.bass   = parseInt(bassSlider.value);
    renderMainBoard();
    saveState();
    editSidebar.classList.add('hidden');
});

// ── Delete tile ───────────────────────────────────────────────────────────────
deleteTileBtn.addEventListener('click', () => {
    if (!currentEditSound) return;
    stopSoundById(currentEditSound.id);
    const board = getBoardForSound(currentEditSound.id);
    if (board) board.sounds = board.sounds.filter(s => s.id !== currentEditSound.id);
    renderMainBoard();
    saveState();
    editSidebar.classList.add('hidden');
    currentEditSound = null;
});

// ── Duplicate tile ────────────────────────────────────────────────────────────
duplicateTileBtn?.addEventListener('click', () => {
    if (!currentEditSound) return;
    const board = getBoardForSound(currentEditSound.id);
    if (!board) return;
    const clone = { ...currentEditSound, id: ++soundIdCounter, title: currentEditSound.title + ' (copy)', keybind: '', audioBuffer: null };
    board.sounds.push(clone);
    renderMainBoard();
    saveState();
    currentEditSound = clone;
    populateSidebar(clone);
});

// ── Add new tile ──────────────────────────────────────────────────────────────
addNewTileBtn.addEventListener('click', () => {
    const sound = addSoundToBoard({ title: `Sound ${soundIdCounter + 1}` });
    openSidebar(sound);
});

// ── Export ────────────────────────────────────────────────────────────────────
exportBtn?.addEventListener('click', () => {
    const data = {
        boards: boards.map(b => ({
            ...b,
            sounds: b.sounds.map(({ audioBuffer, ...rest }) => rest)
        }))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a    = Object.assign(document.createElement('a'), {
        href:     URL.createObjectURL(blob),
        download: 'hotkey-chaos-board.json',
    });
    a.click();
    URL.revokeObjectURL(a.href);
});

// ── Import ────────────────────────────────────────────────────────────────────
importFileInput?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        const text = await file.text();
        const data = JSON.parse(text);

        if (Array.isArray(data)) {
            // Legacy format: flat array of sounds → put into first board
            const board = boards[0] || createBoard('Main');
            board.sounds = data.map(s => ({ ...s, audioBuffer: null }));
            soundIdCounter = Math.max(soundIdCounter, ...board.sounds.map(s => s.id || 0));
        } else if (data.boards && Array.isArray(data.boards)) {
            // New format
            boards = data.boards.map(b => ({
                ...b,
                sounds: b.sounds.map(s => ({ ...s, audioBuffer: null }))
            }));
            boardIdCounter = Math.max(boardIdCounter, ...boards.map(b => b.id || 0));
            soundIdCounter = Math.max(soundIdCounter, ...boards.flatMap(b => b.sounds.map(s => s.id || 0)));
        } else {
            throw new Error('Unrecognised format');
        }

        currentBoardId = 'all';
        renderBoardTabs();
        renderMainBoard();
        saveState();
    } catch (err) {
        alert('Failed to import: ' + err.message);
    }
    importFileInput.value = '';
});

// ── LocalStorage persistence ──────────────────────────────────────────────────
function saveState() {
    try {
        const data = {
            boards: boards.map(b => ({
                ...b,
                sounds: b.sounds.map(({ audioBuffer, ...rest }) => rest)
            })),
            boardIdCounter,
            soundIdCounter,
        };
        localStorage.setItem('hkc-v2', JSON.stringify(data));
    } catch (_) {}
}

function loadState() {
    try {
        // Try new format first
        const raw = localStorage.getItem('hkc-v2');
        if (raw) {
            const data = JSON.parse(raw);
            boards = (data.boards || []).map(b => ({
                ...b,
                sounds: b.sounds.map(s => ({ ...s, audioBuffer: null }))
            }));
            boardIdCounter = data.boardIdCounter || 0;
            soundIdCounter = data.soundIdCounter || 0;
            if (boards.length === 0) boards = [{ id: ++boardIdCounter, name: 'Main', sounds: [] }];
            renderBoardTabs();
            renderMainBoard();
            return;
        }

        // Migrate legacy format
        const legacy = localStorage.getItem('hkc-board');
        if (legacy) {
            const sounds = JSON.parse(legacy);
            if (Array.isArray(sounds)) {
                const legacySounds = sounds.map(s => ({ ...s, audioBuffer: null }));
                soundIdCounter = Math.max(0, ...legacySounds.map(s => s.id || 0));
                boards = [{ id: ++boardIdCounter, name: 'Main', sounds: legacySounds }];
                renderBoardTabs();
                renderMainBoard();
                saveState();
                return;
            }
        }
    } catch (_) {}

    // Fresh start
    boards = [{ id: ++boardIdCounter, name: 'Main', sounds: [] }];
    renderBoardTabs();
    renderMainBoard();
}

loadState();
setupRemoteUrlInput();
