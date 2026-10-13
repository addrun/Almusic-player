/* Exercise async UI state with real Vue reactivity, without an account or DOM. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
const ts = require('typescript');
const vue = require('vue');

const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'src/renderer/views/kugou/index.vue');
const { descriptor, errors } = parse(fs.readFileSync(filename, 'utf8'), { filename });
assert.deepEqual(errors, []);
const script = compileScript(descriptor, { id: 'kugou-ui-check' });
const template = compileTemplate({
  source: descriptor.template.content,
  filename,
  id: 'kugou-ui-check',
  compilerOptions: { bindingMetadata: script.bindings }
});
assert.deepEqual(template.errors, []);

function evaluate(source, modules = {}, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    Error,
    Date,
    console,
    require: (name) => {
      if (name in modules) return modules[name];
      throw new Error(`Unexpected UI dependency: ${name}`);
    },
    ...globals
  });
  return module.exports;
}
const api = evaluate(fs.readFileSync(path.join(root, 'src/renderer/api/kugou.ts'), 'utf8'));
const libraryView = evaluate(
  fs.readFileSync(path.join(root, 'src/renderer/utils/kugouLibraryView.ts'), 'utf8')
);
const playbackMatch = evaluate(
  fs.readFileSync(path.join(root, 'src/renderer/utils/kugouPlaybackMatch.ts'), 'utf8')
);

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixtureTrack(extra = {}) {
  return {
    id: 'track-1',
    hash: 'a'.repeat(32),
    name: '示例歌',
    artists: [{ name: '示例歌手' }],
    albumName: '示例专辑',
    durationMs: 183000,
    albumId: 'album-1',
    albumAudioId: 'audio-1',
    ...extra
  };
}
function fixturePlaylist(id = 'list-1') {
  return {
    id,
    listId: id,
    type: 0,
    name: id,
    category: 'created',
    trackCount: 2,
    fetchedTrackCount: 2,
    complete: true,
    warnings: []
  };
}
function fixtureLibrary() {
  return {
    profile: { userId: 'user-1', nickname: '示例用户' },
    playlists: [fixturePlaylist()],
    syncedAt: 1,
    complete: true,
    warnings: []
  };
}
function mount(overrides = {}) {
  const lifecycle = { mounted: [], beforeUnmount: [] };
  const messages = [];
  const dialogs = [];
  const cancelled = [];
  const timers = new Map();
  const frames = new Map();
  const navigation = [];
  const search = {
    setSearchValue(value) {
      this.searchValue = value;
    },
    setSearchType(type) {
      this.searchType = type;
    },
    setKugouBindingTarget(song, keyword) {
      this.kugouBindingTarget = song;
      this.kugouBindingKeyword = keyword;
    }
  };
  const settings = vue.reactive({
    setData: {},
    setSetData(data) {
      this.setData = { ...this.setData, ...data };
    }
  });
  let timerId = 0;
  const service = {
    getStatus: async () => ({
      loggedIn: true,
      syncing: false,
      cacheAvailable: true,
      persistenceAvailable: true
    }),
    getLibrary: async () => fixtureLibrary(),
    getPlaylistTracks: async (id) => ({ playlist: fixturePlaylist(id), tracks: [fixtureTrack()] }),
    sync: async () => fixtureLibrary(),
    createLogin: async () => ({
      sessionId: 'qr-1',
      url: 'https://example.test/login',
      expiresAt: Date.now() + 180000
    }),
    cancelLogin: async (id) => {
      cancelled.push(id);
      return true;
    },
    checkLogin: async () => ({ state: 'waiting' }),
    logout: async () => ({
      loggedIn: false,
      syncing: false,
      cacheAvailable: false,
      persistenceAvailable: true
    }),
    onSyncProgress: () => () => {},
    ...overrides
  };
  const player = {
    playMusic: {},
    playList: [],
    isPlay: false,
    setPlayList(songs, keepIndex) {
      this.playList = songs;
      this.keepIndex = keepIndex;
    },
    async setPlay(song) {
      this.playMusic = song;
    }
  };
  const history = vue.reactive({ musicHistory: [] });
  const component = evaluate(
    script.content,
    {
      vue: {
        ...vue,
        onMounted: (callback) => lifecycle.mounted.push(callback),
        onBeforeUnmount: (callback) => lifecycle.beforeUnmount.push(callback),
        onActivated: () => {},
        onDeactivated: () => {}
      },
      'naive-ui': {
        useMessage: () =>
          Object.fromEntries(
            ['success', 'error', 'warning', 'info'].map((kind) => [
              kind,
              (text) => messages.push({ kind, text })
            ])
          ),
        useDialog: () => ({ warning: (options) => dialogs.push(options) })
      },
      '@/api/kugou': { ...api, kugouApi: service },
      '@/hooks/useOverlayNavigate': {
        useOverlayNavigate: () => ({ navigate: (...args) => navigation.push(args) })
      },
      '@/hooks/usePlaylistConfirm': {
        usePlaylistConfirm: () => ({ confirmPlaylistReplace: (callback) => callback() })
      },
      '@/store/modules/player': { usePlayerStore: () => player },
      '@/store/modules/playHistory': { usePlayHistoryStore: () => history },
      '@/store/modules/settings': { useSettingsStore: () => settings },
      '@/utils/kugouLibraryView': libraryView,
      '@/utils/kugouPlaybackMatch': playbackMatch,
      '@/store/modules/search': {
        useSearchStore: () => search
      }
    },
    {
      setTimeout: (callback) => {
        const id = ++timerId;
        timers.set(id, callback);
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
      setInterval: () => ++timerId,
      clearInterval: () => {},
      window: {
        requestAnimationFrame(callback) {
          const id = ++timerId;
          frames.set(id, callback);
          return id;
        },
        cancelAnimationFrame: (id) => frames.delete(id)
      }
    }
  ).default;
  const state = component.setup({}, { expose: () => {} });
  return {
    state,
    service,
    player,
    history,
    settings,
    messages,
    dialogs,
    cancelled,
    timers,
    frames,
    search,
    navigation,
    cleanup: () => lifecycle.beforeUnmount.forEach((callback) => callback())
  };
}

async function main() {
  const track = fixtureTrack();
  const song = api.toKugouSongResult(track);
  assert.equal(song.platform, 'kugou');
  assert.equal(song.platformId, 'A'.repeat(32));
  assert.equal(song.count, 0);
  assert.equal(song.duration, 183000);
  assert.equal(song.kugou.albumId, 'album-1');
  assert.equal(song.kugou.albumAudioId, 'audio-1');
  assert.equal(api.canPlayKugouTrack(fixtureTrack({ hash: '', unavailable: true })), false);

  // Missing playback identifiers remain visible; they do not enter the playback queue.
  const first = mount();
  await first.state.loadState();
  first.state.selectedTracks.value = {
    playlist: fixturePlaylist(),
    tracks: [track, fixtureTrack({ id: 'missing', hash: '', unavailable: true })]
  };
  assert.equal(first.state.displayTracks.value.length, 2);
  assert.equal(first.state.playableSongs.value.length, 1);
  first.player.playList = [{ id: 'existing', name: 'Existing' }];
  first.state.enqueueSongs();
  first.state.enqueueSongs();
  assert.equal(first.player.playList.length, 2);
  assert.equal(first.player.playList[0].id, 'existing');
  assert.equal(first.player.keepIndex, true);
  first.state.searchOtherSources(fixtureTrack({ name: '示例歌.mp3' }));
  assert.equal(first.search.searchValue, '示例歌 示例歌手');
  assert.equal(first.search.searchType, 1);
  assert.equal(first.search.kugouBindingTarget.id, song.id);
  assert.equal(first.search.kugouBindingTarget.name, '示例歌.mp3');
  assert.equal(first.search.kugouBindingKeyword, first.search.searchValue);
  const query = new URL(first.navigation.at(-1)[0], 'https://fixture.invalid').searchParams;
  assert.equal(query.get('keyword'), first.search.searchValue);
  assert.equal(query.get('kugouTarget'), song.id);
  first.cleanup();

  // A late response for an earlier playlist cannot overwrite the current selection.
  const pendingA = deferred();
  const pendingB = deferred();
  const second = mount({
    getPlaylistTracks: (id) => (id === 'A' ? pendingA.promise : pendingB.promise)
  });
  second.state.selectedId.value = 'A';
  const requestA = second.state.loadTracks();
  second.state.selectedId.value = 'B';
  const requestB = second.state.loadTracks();
  pendingB.resolve({ playlist: fixturePlaylist('B'), tracks: [fixtureTrack({ id: 'B-track' })] });
  await requestB;
  pendingA.resolve({ playlist: fixturePlaylist('A'), tracks: [fixtureTrack({ id: 'A-track' })] });
  await requestA;
  assert.equal(second.state.selectedTracks.value.playlist.id, 'B');
  second.cleanup();

  // A transient refresh failure retains already synchronized tracks.
  const third = mount({
    getPlaylistTracks: async () => {
      throw new Error('temporary network failure');
    }
  });
  third.state.selectedId.value = 'list-1';
  third.state.selectedTracks.value = { playlist: fixturePlaylist(), tracks: [track] };
  await third.state.loadTracks(true);
  assert.equal(third.state.selectedTracks.value.tracks.length, 1);
  assert.match(third.state.tracksError.value, /temporary network failure/);
  third.cleanup();

  // Closing a QR dialog during creation cancels that late session rather than polling it.
  const pendingQr = deferred();
  const fourth = mount({ createLogin: () => pendingQr.promise });
  const loginCreation = fourth.state.startLogin();
  await Promise.resolve();
  await Promise.resolve();
  fourth.state.loginOpen.value = false;
  await vue.nextTick();
  pendingQr.resolve({
    sessionId: 'late-qr',
    url: 'https://example.test/login',
    expiresAt: Date.now() + 180000
  });
  await loginCreation;
  assert.equal(fourth.state.loginQr.value, null);
  assert.ok(fourth.cancelled.includes('late-qr'));
  assert.equal(fourth.timers.size, 0);
  fourth.cleanup();

  // A confirmed response from a cancelled login cannot switch accounts or start a sync.
  const pendingCheck = deferred();
  let syncCalls = 0;
  const fifth = mount({
    checkLogin: () => pendingCheck.promise,
    sync: async () => {
      syncCalls++;
      return fixtureLibrary();
    }
  });
  await fifth.state.startLogin();
  const epoch = fifth.state.loginEpoch;
  const check = fifth.state.checkLogin(epoch);
  fifth.state.loginOpen.value = false;
  await vue.nextTick();
  pendingCheck.resolve({ state: 'confirmed', status: { loggedIn: true } });
  await check;
  assert.equal(syncCalls, 0);
  assert.equal(fifth.messages.length, 0);
  assert.equal(fifth.state.status.value, null);
  fifth.cleanup();

  // Sync failures retain the cache and do not present a successful completion.
  const sixth = mount({
    sync: async () => {
      throw new Error('sync interrupted');
    }
  });
  await sixth.state.loadState();
  await sixth.state.syncAll();
  assert.equal(sixth.state.library.value.playlists.length, 1);
  assert.match(sixth.state.errorText.value, /sync interrupted/);
  assert.equal(sixth.state.syncing.value, false);
  assert.equal(sixth.messages.filter((entry) => entry.kind === 'success').length, 0);
  sixth.cleanup();

  // A pre-logout snapshot cannot restore the account or cached library after logout.
  // Its finally block also cannot clear an in-flight newer read or its loading state.
  const logoutSnapshot = deferred();
  const postLogoutSnapshot = deferred();
  let logoutStatusReads = 0;
  let logoutLibraryReads = 0;
  const seventh = mount({
    getStatus: async () => ({
      loggedIn: logoutStatusReads++ === 0,
      syncing: false,
      cacheAvailable: false,
      persistenceAvailable: true
    }),
    getLibrary: () =>
      logoutLibraryReads++ === 0 ? logoutSnapshot.promise : postLogoutSnapshot.promise
  });
  const preLogoutRead = seventh.state.loadState();
  seventh.state.confirmLogout();
  await seventh.dialogs[0].onPositiveClick();
  assert.equal(seventh.state.status.value.loggedIn, false);
  assert.equal(seventh.state.library.value, null);
  seventh.state.loading.value = true;
  const postLogoutRead = seventh.state.loadState();
  logoutSnapshot.resolve(fixtureLibrary());
  await preLogoutRead;
  assert.equal(seventh.state.status.value.loggedIn, false);
  assert.equal(seventh.state.library.value, null);
  assert.equal(seventh.state.loading.value, true);
  assert.ok(seventh.state.stateRequest);
  const reusedRead = seventh.state.loadState();
  assert.equal(logoutLibraryReads, 2);
  postLogoutSnapshot.resolve(null);
  await Promise.all([postLogoutRead, reusedRead]);
  assert.equal(seventh.state.library.value, null);
  assert.equal(seventh.state.loading.value, false);
  seventh.cleanup();

  // A completed sync forces a fresh catalogue read instead of reusing a pre-sync request.
  const syncSnapshot = deferred();
  let syncLibraryReads = 0;
  const updatedLibrary = {
    ...fixtureLibrary(),
    syncedAt: 200,
    playlists: [fixturePlaylist('updated')]
  };
  const eighth = mount({
    getLibrary: () =>
      syncLibraryReads++ === 0 ? syncSnapshot.promise : Promise.resolve(updatedLibrary),
    sync: async () => updatedLibrary
  });
  eighth.state.status.value = { loggedIn: true, syncing: false };
  const preSyncRead = eighth.state.loadState();
  await eighth.state.syncAll();
  assert.ok(syncLibraryReads >= 2);
  assert.equal(eighth.state.library.value.syncedAt, 200);
  syncSnapshot.resolve(fixtureLibrary());
  await preSyncRead;
  assert.equal(eighth.state.library.value.syncedAt, 200);
  assert.equal(eighth.state.library.value.playlists[0].id, 'updated');
  eighth.cleanup();

  // An earlier logged-out/account snapshot cannot overwrite a confirmed new login.
  const loginSnapshot = deferred();
  let loginLibraryReads = 0;
  const newAccountLibrary = {
    ...fixtureLibrary(),
    profile: { userId: 'user-new', nickname: '新账号' },
    playlists: [fixturePlaylist('new-account-list')]
  };
  const newAccountStatus = {
    loggedIn: true,
    syncing: false,
    cacheAvailable: true,
    persistenceAvailable: true,
    profile: newAccountLibrary.profile
  };
  const ninth = mount({
    getStatus: async () =>
      loginLibraryReads === 0 ? { loggedIn: false, syncing: false } : newAccountStatus,
    getLibrary: () =>
      loginLibraryReads++ === 0 ? loginSnapshot.promise : Promise.resolve(newAccountLibrary),
    checkLogin: async () => ({ state: 'confirmed', status: newAccountStatus }),
    sync: async () => newAccountLibrary
  });
  const preLoginRead = ninth.state.loadState();
  await ninth.state.startLogin();
  await ninth.state.checkLogin(ninth.state.loginEpoch);
  assert.equal(ninth.state.profile.value.userId, 'user-new');
  assert.ok(loginLibraryReads >= 2);
  loginSnapshot.resolve(fixtureLibrary());
  await preLoginRead;
  assert.equal(ninth.state.status.value.loggedIn, true);
  assert.equal(ninth.state.profile.value.userId, 'user-new');
  assert.equal(ninth.state.library.value.playlists[0].id, 'new-account-list');
  ninth.cleanup();

  // Errors from invalidated reads are also discarded after logout.
  const obsoleteFailure = deferred();
  const tenth = mount({ getLibrary: () => obsoleteFailure.promise });
  const failedOldRead = tenth.state.loadState();
  tenth.state.confirmLogout();
  await tenth.dialogs[0].onPositiveClick();
  obsoleteFailure.reject(new Error('obsolete state failure'));
  await failedOldRead;
  assert.equal(tenth.state.errorText.value, '');
  assert.equal(tenth.state.library.value, null);
  tenth.cleanup();

  // Search spans name/artist/album, normalizes width and case, and keeps unavailable rows.
  // Sorting must be stable, reversible, and leave the synchronized snapshot untouched.
  const tracks = [
    fixtureTrack({
      id: 'b',
      name: 'Track 10',
      artists: [{ name: 'Beta' }],
      albumName: 'Night',
      durationMs: 240000
    }),
    fixtureTrack({
      id: 'a',
      name: 'Track 2',
      artists: [{ name: 'Alpha' }],
      albumName: 'Morning',
      durationMs: 120000
    }),
    fixtureTrack({
      id: 'tie',
      name: 'Track 2',
      artists: [{ name: 'Alpha' }],
      albumName: 'Morning',
      durationMs: 120000
    }),
    fixtureTrack({
      id: 'missing',
      name: 'Track 3',
      artists: [{ name: 'Beta' }],
      albumName: 'Night',
      durationMs: 0,
      hash: '',
      unavailable: true
    })
  ];
  const original = JSON.stringify(tracks);
  const ids = (rows) => Array.from(rows, (row) => row.track.id);
  assert.deepEqual(
    ids(libraryView.getKugouTrackRows(tracks, 'ＴＲＡＣＫ  ＢＥＴＡ night', 'default')),
    ['b', 'missing']
  );
  assert.deepEqual(ids(libraryView.getKugouTrackRows(tracks, 'Alpha night', 'default')), []);
  assert.deepEqual(ids(libraryView.getKugouTrackRows(tracks, '', 'name-asc')), [
    'a',
    'tie',
    'missing',
    'b'
  ]);
  assert.deepEqual(ids(libraryView.getKugouTrackRows(tracks, '', 'name-desc')), [
    'b',
    'missing',
    'a',
    'tie'
  ]);
  assert.deepEqual(ids(libraryView.getKugouTrackRows(tracks, '', 'artist-asc')), [
    'a',
    'tie',
    'b',
    'missing'
  ]);
  assert.deepEqual(ids(libraryView.getKugouTrackRows(tracks, '', 'album-desc')), [
    'b',
    'missing',
    'a',
    'tie'
  ]);
  assert.deepEqual(ids(libraryView.getKugouTrackRows(tracks, '', 'duration-desc')), [
    'b',
    'a',
    'tie',
    'missing'
  ]);
  assert.deepEqual(ids(libraryView.getKugouTrackRows(tracks, '', 'default')), [
    'b',
    'a',
    'tie',
    'missing'
  ]);
  assert.deepEqual(ids(libraryView.getKugouTrackRows(tracks, '', 'default-desc')), [
    'missing',
    'tie',
    'a',
    'b'
  ]);
  assert.deepEqual(ids(libraryView.getKugouTrackRows(tracks, 'Alpha', 'default-desc')), [
    'tie',
    'a'
  ]);
  assert.deepEqual(
    Array.from(libraryView.getKugouTrackRows(tracks, '', 'default-desc'), (row) => row.rowKey),
    ['missing_3', 'tie_2', 'a_1', 'b_0']
  );
  assert.equal(JSON.stringify(tracks), original);
  assert.equal(libraryView.isKugouSortKey('unknown'), false);

  // Source timestamps stay distinct from unknown values in both directions.
  const datedTracks = [
    fixtureTrack({ id: 'unknown' }),
    fixtureTrack({ id: 'new', addedAtMs: Date.UTC(2026, 9, 12) }),
    fixtureTrack({ id: 'old', addedAtMs: Date.UTC(2025, 1, 1) }),
    fixtureTrack({ id: 'same-time', addedAtMs: Date.UTC(2026, 9, 12) }),
    fixtureTrack({ id: 'zero-time', addedAtMs: 0 })
  ];
  const datedSnapshot = JSON.stringify(datedTracks);
  assert.deepEqual(ids(libraryView.getKugouTrackRows(datedTracks, '', 'added-desc')), [
    'new',
    'same-time',
    'old',
    'unknown',
    'zero-time'
  ]);
  assert.deepEqual(ids(libraryView.getKugouTrackRows(datedTracks, '', 'added-asc')), [
    'old',
    'new',
    'same-time',
    'unknown',
    'zero-time'
  ]);
  assert.equal(JSON.stringify(datedTracks), datedSnapshot);

  // Only this application's existing Kugou history counts; missing is not zero.
  const localCounts = libraryView.getKugouLocalPlayCounts([
    { id: 'kugou:new', count: 7 },
    { id: 'kugou:old', count: 0 },
    { id: 'kugou:same-time', count: 7 },
    { id: 'unknown', count: 999 },
    { id: 'qq:unknown', count: 900 },
    { id: 'kugou:unknown', count: -1 },
    { id: 'kugou:zero-time', count: NaN }
  ]);
  assert.equal(localCounts.has('unknown'), false);
  assert.equal(localCounts.get('old'), 0);
  const countContext = { localPlayCounts: localCounts };
  assert.deepEqual(
    ids(libraryView.getKugouTrackRows(datedTracks, '', 'playcount-desc', countContext)),
    ['new', 'same-time', 'old', 'unknown', 'zero-time']
  );
  assert.deepEqual(
    ids(libraryView.getKugouTrackRows(datedTracks, '', 'playcount-asc', countContext)),
    ['old', 'new', 'same-time', 'unknown', 'zero-time']
  );

  // A shuffle is a full permutation, stable under repeated reads and filtering.
  const shuffleTracks = Array.from({ length: 32 }, (_, i) =>
    fixtureTrack({
      id: `shuffle-${i}`,
      name: `Track ${i}`,
      artists: [{ name: i % 2 ? 'Odd' : 'Even' }]
    })
  );
  const shuffleSnapshot = JSON.stringify(shuffleTracks);
  const shuffleContext = { randomSeed: 12345678 };
  const shuffledRows = libraryView.getKugouTrackRows(shuffleTracks, '', 'random', shuffleContext);
  const shuffledIds = ids(shuffledRows);
  assert.deepEqual([...shuffledIds].sort(), shuffleTracks.map((track) => track.id).sort());
  assert.deepEqual(
    ids(libraryView.getKugouTrackRows(shuffleTracks, '', 'random', shuffleContext)),
    shuffledIds
  );
  assert.deepEqual(
    ids(libraryView.getKugouTrackRows(shuffleTracks, 'Odd', 'random', shuffleContext)),
    ids(shuffledRows.filter((row) => row.track.artists[0].name === 'Odd'))
  );
  assert.notDeepEqual(
    ids(libraryView.getKugouTrackRows(shuffleTracks, '', 'random', { randomSeed: 87654321 })),
    shuffledIds
  );
  assert.equal(JSON.stringify(shuffleTracks), shuffleSnapshot);
  for (const row of shuffledRows) assert.equal(row.rowKey, `${row.track.id}_${row.sourcePosition}`);

  const extended = mount();
  await extended.state.loadState();
  extended.state.selectedTracks.value = { playlist: fixturePlaylist(), tracks: datedTracks };
  extended.history.musicHistory = [
    { id: 'kugou:new', count: 7 },
    { id: 'kugou:old', count: 0 }
  ];
  extended.state.changeSort('playcount-desc');
  await vue.nextTick();
  assert.match(extended.state.sortHint.value, /本机播放记录/);
  extended.state.enqueueSongs();
  assert.deepEqual(
    Array.from(extended.player.playList, (song) => song.id),
    ['kugou:new', 'kugou:old', 'kugou:unknown', 'kugou:same-time', 'kugou:zero-time']
  );
  extended.history.musicHistory[1].count = 8;
  assert.equal(extended.state.displayTracks.value[0].track.id, 'old');
  extended.state.changeSort('added-desc');
  assert.equal(extended.state.displayTracks.value[0].track.id, 'new');
  assert.match(extended.state.sortHint.value, /来源歌单/);
  extended.state.selectedTracks.value = { playlist: fixturePlaylist(), tracks: shuffleTracks };
  assert.match(extended.state.sortHint.value, /刷新此歌单/);
  extended.state.changeSort('random');
  const initialSeed = extended.state.randomSeed.value;
  const uiShuffle = ids(extended.state.displayTracks.value);
  extended.state.trackQuery.value = 'Odd';
  assert.deepEqual(
    ids(extended.state.displayTracks.value),
    uiShuffle.filter((id) => Number(id.slice(8)) % 2 === 1)
  );
  extended.state.trackQuery.value = '';
  extended.state.selectAll(true);
  extended.history.musicHistory = [];
  assert.deepEqual(ids(extended.state.displayTracks.value), uiShuffle);
  assert.equal(extended.state.randomSeed.value, initialSeed);
  extended.player.playList = [];
  extended.state.enqueueSongs();
  assert.deepEqual(
    Array.from(extended.player.playList, (song) => song.id),
    uiShuffle.map((id) => `kugou:${id}`)
  );
  extended.state.changeSort('random');
  assert.notEqual(extended.state.randomSeed.value, initialSeed);
  assert.notDeepEqual(ids(extended.state.displayTracks.value), uiShuffle);
  extended.cleanup();

  const tools = mount();
  await tools.state.loadState();
  tools.state.selectedId.value = 'list-1';
  tools.state.selectedTracks.value = { playlist: fixturePlaylist(), tracks };
  tools.state.changeSort('name-asc');
  await vue.nextTick();
  assert.equal(tools.settings.setData.kugouUi.sortBy, 'name-asc');
  tools.state.playAll();
  assert.deepEqual(
    Array.from(tools.player.playList, (song) => song.id),
    ['kugou:a', 'kugou:tie', 'kugou:b']
  );
  assert.equal(tools.player.playMusic.id, 'kugou:a');
  tools.state.changeSort('duration-desc');
  tools.player.playList = [];
  tools.state.enqueueSongs();
  assert.deepEqual(
    Array.from(tools.player.playList, (song) => song.id),
    ['kugou:b', 'kugou:a', 'kugou:tie']
  );
  assert.equal(tools.player.keepIndex, true);
  tools.state.changeSort('unknown');
  assert.equal(tools.state.sortBy.value, 'duration-desc');
  tools.state.changeSort('default-desc');
  tools.player.playList = [];
  tools.state.playAll();
  assert.deepEqual(
    Array.from(tools.player.playList, (song) => song.id),
    ['kugou:tie', 'kugou:a', 'kugou:b']
  );
  tools.player.playList = [];
  tools.state.enqueueSongs();
  assert.deepEqual(
    Array.from(tools.player.playList, (song) => song.id),
    ['kugou:tie', 'kugou:a', 'kugou:b']
  );
  tools.state.changeSort('duration-desc');
  tools.state.savePreference({ compact: true });
  assert.equal(tools.state.compact.value, true);
  assert.equal(tools.state.sortBy.value, 'duration-desc');

  // Filtering drops hidden selections; reordering preserves the identity of selected rows.
  tools.state.selecting.value = true;
  tools.state.selectAll(true);
  await vue.nextTick();
  assert.equal(tools.state.selectedRowKeys.value.size, 4);
  assert.equal(tools.state.selectedSongs.value.length, 3);
  tools.state.trackQuery.value = 'Track 2';
  await vue.nextTick();
  assert.equal(tools.state.selectedRowKeys.value.size, 2);
  tools.state.changeSort('name-desc');
  await vue.nextTick();
  assert.equal(tools.state.selectedRowKeys.value.size, 2);
  tools.player.playList = [];
  tools.state.enqueueSongs(true);
  assert.deepEqual(
    Array.from(tools.player.playList, (song) => song.id),
    ['kugou:a', 'kugou:tie']
  );
  tools.state.trackQuery.value = '';
  await vue.nextTick();
  assert.equal(tools.state.selectedRowKeys.value.size, 2);
  tools.state.selectedId.value = 'other';
  await vue.nextTick();
  assert.equal(tools.state.selectedRowKeys.value.size, 0);
  assert.equal(tools.state.selecting.value, false);

  // Local favorites remain account-scoped and never invoke a cloud mutation.
  tools.state.togglePlaylistFavorite('list-1');
  assert.equal(tools.state.isPlaylistFavorite('list-1'), true);
  tools.state.category.value = 'favorites';
  assert.equal(tools.state.filteredPlaylists.value.length, 1);
  tools.state.library.value.profile = { userId: 'user-2', nickname: 'Second fixture' };
  assert.equal(tools.state.isPlaylistFavorite('list-1'), false);
  tools.state.togglePlaylistFavorite('list-2');
  tools.state.library.value.profile = { userId: 'user-1', nickname: 'First fixture' };
  assert.equal(tools.state.isPlaylistFavorite('list-1'), true);
  assert.equal(tools.state.isPlaylistFavorite('list-2'), false);
  tools.state.togglePlaylistFavorite('list-1');
  assert.equal(tools.state.filteredPlaylists.value.length, 0);
  assert.equal(tools.state.sortBy.value, 'name-desc');
  assert.equal(JSON.stringify(tracks), original);
  tools.cleanup();

  // One native page scrolls a large virtual playlist, including its header and sticky tools.
  const scrolling = mount();
  await scrolling.state.loadState();
  const largeTracks = Array.from({ length: 10000 }, (_, i) =>
    fixtureTrack({ id: `large-${i}`, name: `Song ${i}` })
  );
  scrolling.state.selectedId.value = 'list-1';
  scrolling.state.selectedTracks.value = { playlist: fixturePlaylist(), tracks: largeTracks };
  await vue.nextTick();
  await vue.nextTick();
  await new Promise(setImmediate);
  const scrollCalls = [];
  const page = vue.markRaw({
    scrollTop: 0,
    clientTop: 1,
    clientHeight: 600,
    getBoundingClientRect: () => ({ top: 20 }),
    scrollTo(options) {
      scrollCalls.push({ ...options });
      this.scrollTop = options.top;
    }
  });
  scrolling.state.pageScrollRef.value = page;
  scrolling.state.tracksListRef.value = vue.markRaw({
    getBoundingClientRect: () => ({ top: 20 + 1 + 420 - page.scrollTop })
  });
  scrolling.state.toolsAnchorRef.value = vue.markRaw({
    getBoundingClientRect: () => ({ top: 20 + 1 + 290 - page.scrollTop })
  });
  scrolling.state.stickyToolsRef.value = vue.markRaw({
    getBoundingClientRect: () => ({ height: 130 })
  });
  await vue.nextTick();
  scrolling.state.measurePageScroll();
  assert.equal(scrolling.state.tracksOffsetTop.value, 420);
  assert.equal(scrolling.state.stickyToolsHeight.value, 130);
  assert.equal(scrolling.state.tracksHeight.value, 10000 * 76);
  assert.equal(scrolling.state.showReturnTop.value, false);
  assert.equal(scrolling.state.toolsAreSticky.value, false);
  assert.equal(scrolling.state.visibleTracks.value[0].track.id, 'large-0');
  assert.ok(scrolling.state.visibleTracks.value.length < 30);
  page.scrollTop = 420 + 5000 * 76;
  scrolling.state.handlePageScroll();
  scrolling.state.handlePageScroll();
  assert.equal(scrolling.frames.size, 1, 'Scroll events share one animation-frame measurement');
  for (const [id, callback] of scrolling.frames) {
    scrolling.frames.delete(id);
    callback();
  }
  assert.equal(scrolling.state.tracksOffsetTop.value, 420, 'List offset is stable while scrolling');
  assert.equal(scrolling.state.virtualStart.value, 4992);
  assert.equal(scrolling.state.visibleTracks.value[0].track.id, 'large-4992');
  assert.ok(scrolling.state.visibleTracks.value.some((row) => row.track.id === 'large-5000'));
  assert.ok(scrolling.state.visibleTracks.value.length < 30);
  assert.equal(scrolling.state.showReturnTop.value, true);
  assert.equal(scrolling.state.toolsAreSticky.value, true);
  // Selection and enqueue use all songs, including those outside the render window.
  scrolling.state.selectAll(true);
  assert.equal(scrolling.state.selectedSongs.value.length, 10000);
  scrolling.state.enqueueSongs(true);
  assert.equal(scrolling.player.playList.length, 10000);
  assert.equal(scrolling.player.playList[9999].id, 'kugou:large-9999');
  page.scrollTop = 420 + 10000 * 76 - page.clientHeight + 100;
  scrolling.state.measurePageScroll();
  assert.equal(scrolling.state.visibleTracks.value.at(-1).track.id, 'large-9999');
  assert.ok(scrolling.state.visibleTracks.value.length < 30);
  // Density changes keep the same song directly below the pinned toolbar.
  page.scrollTop = 420 + 5000 * 76 - 130;
  scrolling.state.measurePageScroll();
  scrolling.state.savePreference({ compact: true });
  await vue.nextTick();
  await vue.nextTick();
  await new Promise(setImmediate);
  assert.equal(page.scrollTop, 420 + 5000 * 52 - 130);
  assert.equal(scrolling.state.tracksHeight.value, 10000 * 52);
  page.clientHeight = 940;
  scrolling.state.measurePageScroll();
  assert.ok(scrolling.state.visibleTracks.value.some((row) => row.track.id === 'large-5010'));
  // Locating a song centers it below the pinned tools, within the same page scroller.
  scrolling.player.playMusic = { id: 'kugou:large-9000' };
  await scrolling.state.locateCurrentTrack();
  assert.equal(scrollCalls.at(-1).top, 420 + 9000 * 52 - 130 - (940 - 130 - 52) / 2);
  assert.equal(scrollCalls.at(-1).behavior, 'smooth');
  scrolling.state.measurePageScroll();
  assert.ok(scrolling.state.visibleTracks.value.some((row) => row.track.id === 'large-9000'));
  scrolling.state.trackQuery.value = 'Song 9999';
  await vue.nextTick();
  await vue.nextTick();
  await new Promise(setImmediate);
  assert.equal(page.scrollTop, 290, 'Filtering returns to the first row below the sticky tools');
  assert.equal(scrolling.state.displayTracks.value.length, 1);
  assert.equal(scrolling.state.visibleTracks.value[0].track.id, 'large-9999');
  scrolling.state.returnToTop();
  assert.equal(page.scrollTop, 0);
  assert.equal(scrollCalls.at(-1).behavior, 'smooth');
  scrolling.state.reducedMotion.value = true;
  scrolling.state.returnToTop();
  assert.equal(scrollCalls.at(-1).behavior, 'auto');
  scrolling.state.reducedMotion.value = false;
  scrolling.settings.setData.noAnimate = true;
  scrolling.state.returnToTop();
  assert.equal(scrollCalls.at(-1).behavior, 'auto');
  scrolling.state.trackQuery.value = 'no matching song';
  await vue.nextTick();
  await vue.nextTick();
  await new Promise(setImmediate);
  assert.equal(scrolling.state.visibleTracks.value.length, 0);
  assert.equal(scrolling.state.tracksHeight.value, 0);
  scrolling.state.handlePageScroll();
  assert.equal(scrolling.frames.size, 1);
  scrolling.cleanup();
  assert.equal(scrolling.frames.size, 0, 'Unmount cancels pending scroll measurement');

  console.log(
    'Kugou UI checks passed: conversion, unavailable rows, queue merge, stale playlist responses, refresh cache, QR cancellation, cancelled confirmation, failed-sync cache, stale state after logout/sync/login, newer read ownership, obsolete read errors, normalized search, stable sorting and default reverse, known timestamps, local counts and real zero, unknown values last, seeded shuffle and filter stability, reshuffle, display-order playback, filtered selection, compact preference, account-scoped local favorites, 10000-row page virtualization, last row, full-list selection and queue, sticky toolbar offsets, resize, density anchor, playing-song location, search reset, return to top, reduced motion and frame cleanup.'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
