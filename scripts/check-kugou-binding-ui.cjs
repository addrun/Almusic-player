/* Render the real search component with Vue's in-memory renderer. No account, network or audio. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
const ts = require('typescript');
const vue = require('vue');
const pinia = require('pinia');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const filename = path.join(root, 'src/renderer/views/search/SearchResult.vue');
const { descriptor, errors } = parse(read('src/renderer/views/search/SearchResult.vue'), {
  filename
});
assert.deepEqual(errors, []);
const script = compileScript(descriptor, { id: 'kugou-binding-ui-check' });
const template = compileTemplate({
  source: descriptor.template.content,
  filename,
  id: 'kugou-binding-ui-check',
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
    AbortController,
    setTimeout,
    clearTimeout,
    require(name) {
      if (name in modules) return modules[name];
      throw new Error(`Unexpected binding UI dependency: ${name}`);
    },
    ...globals
  });
  return module.exports;
}

function node(type, text = '') {
  return { type, text, props: {}, children: [], parent: null };
}
const renderer = vue.createRenderer({
  createElement: (type) => node(type),
  createText: (text) => node('#text', text),
  createComment: (text) => node('#comment', text),
  setText: (target, text) => (target.text = text),
  setElementText(target, text) {
    target.text = text;
    target.children = [];
  },
  patchProp: (target, key, previous, value) => (target.props[key] = value),
  insert(target, parent, anchor = null) {
    if (target.parent) {
      target.parent.children.splice(target.parent.children.indexOf(target), 1);
    }
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, target);
    target.parent = parent;
  },
  remove(target) {
    if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1);
    target.parent = null;
  },
  parentNode: (target) => target.parent,
  nextSibling: (target) =>
    target.parent?.children[target.parent.children.indexOf(target) + 1] || null
});
const slotComponent = {
  setup(_, { slots }) {
    return () => vue.h('fixture-slot', null, slots.default?.());
  }
};
function textContent(target) {
  if (target.type === '#comment') return '';
  return target.text + target.children.map(textContent).join('');
}
function buttons(target, text) {
  return [
    ...(target.type === 'button' && textContent(target).includes(text) ? [target] : []),
    ...target.children.flatMap((child) => buttons(child, text))
  ];
}
function click(target) {
  assert.ok(target?.props.onClick, 'A real rendered button must have its click handler');
  target.props.onClick({ stopPropagation() {}, preventDefault() {} });
}
async function flush() {
  await vue.nextTick();
  await vue.nextTick();
  await new Promise(setImmediate);
}
function originalSong() {
  return {
    id: 'kugou:original',
    name: 'Original Version.mp3',
    ar: [{ name: 'Original Artist' }],
    al: { name: 'Original Album' },
    platform: 'kugou',
    platformId: 'A'.repeat(32),
    kugou: { albumId: '123' },
    playMusicUrl: 'https://audio.invalid/original.mp3',
    expiredAt: 9999999999999,
    dt: 183000
  };
}
function selectedSong() {
  return {
    id: 125,
    name: 'A Different Search Title',
    ar: [{ name: 'A Different Uploader' }],
    al: { name: 'Selected Album' },
    playMusicUrl: 'https://audio.invalid/temporary.mp3?token=fixture',
    dt: 183000
  };
}

async function mount({ target = true, query, failWrite = false } = {}) {
  const storage = new Map();
  const localStorage = {
    failWrite,
    getItem: (key) => storage.get(key) || null,
    setItem(key, value) {
      if (this.failWrite) throw new Error('fixture storage quota');
      storage.set(key, value);
    }
  };
  const binding = evaluate(
    read('src/renderer/utils/kugouPlaybackBinding.ts'),
    {},
    { localStorage }
  );
  pinia.setActivePinia(pinia.createPinia());
  const { useSearchStore } = evaluate(read('src/renderer/store/modules/search.ts'), {
    pinia,
    vue
  });
  const searchStore = useSearchStore();
  const original = originalSong();
  const candidate = selectedSong();
  if (target) searchStore.setKugouBindingTarget(original, 'fixture query');
  const route = vue.reactive({
    name: 'fixture-search',
    query: query || { keyword: 'fixture query', type: '1', kugouTarget: original.id }
  });
  const messages = [];
  const player = vue.reactive({
    playList: [{ ...original }, { id: 'unrelated', playMusicUrl: 'https://audio.invalid/other' }],
    originalPlayList: [{ ...original }],
    playMusic: { ...original },
    pauses: 0,
    async handlePause() {
      this.pauses++;
    },
    setPlayList() {},
    async setPlay() {},
    addToNextPlay() {}
  });
  const requests = evaluate(read('src/renderer/services/playbackRequestManager.ts'));
  const sounds = [];
  class FakeHowl {
    constructor(options) {
      this.options = options;
      this.unloaded = false;
      sounds.push(this);
    }
    state() {
      return 'loaded';
    }
    duration() {
      return 183;
    }
    unload() {
      this.unloaded = true;
    }
  }
  const { preloadService } = evaluate(read('src/renderer/services/preloadService.ts'), {
    howler: { Howl: FakeHowl }
  });
  const labels = new Map();
  const constants = evaluate(read('src/renderer/const/bar-const.ts'));
  const component = evaluate(
    script.content,
    {
      vue,
      '@vueuse/core': { useDateFormat: () => vue.ref('fixture date') },
      'naive-ui': {
        useMessage: () =>
          Object.fromEntries(
            ['success', 'error', 'info', 'warning'].map((kind) => [
              kind,
              (text) => messages.push({ kind, text })
            ])
          )
      },
      'vue-i18n': { useI18n: () => ({ t: (key) => key }) },
      'vue-router': { useRoute: () => route, useRouter: () => ({ replace() {} }) },
      '@/api/search': { getSearch: async () => ({ data: { result: { songs: [] } } }) },
      '@/api/crossPlatformSearch': { crossPlatformSearch: async () => [] },
      '@/components/common/PlayBottom.vue': { default: slotComponent },
      '@/components/common/SearchItem.vue': { default: slotComponent },
      '@/components/common/SongItem.vue': { default: slotComponent },
      '@/const/bar-const': constants,
      '@/hooks/useDownload': {
        useDownload: () => ({ isDownloading: vue.ref(false), batchDownloadMusic() {} })
      },
      '@/hooks/usePlaylistConfirm': {
        usePlaylistConfirm: () => ({ confirmPlaylistReplace: (fn) => fn() })
      },
      '@/hooks/useScrollTitle': { useScrollTitle() {} },
      '@/services/preloadService': { preloadService },
      '@/services/playbackRequestManager': requests,
      '@/services/sourceProbeService': {
        clearProbeCache: () => labels.clear(),
        getCachedLabel: (id) => labels.get(String(id)),
        probeSongsBatch() {},
        quickClassify: () => 'netease',
        setLabel: (id, label) => labels.set(String(id), label),
        SOURCE_LABEL_CONFIG: {
          netease: { text: '网易云', color: 'green', bg: 'green' },
          pending: { text: '' }
        }
      },
      '@/store/modules/player': { usePlayerStore: () => player },
      '@/store/modules/search': { useSearchStore: () => searchStore },
      '@/utils': {
        calculateAnimationDelay: () => '0s',
        isElectron: true,
        isMobile: vue.ref(false)
      },
      '@/utils/kugouPlaybackBinding': binding
    },
    { localStorage }
  ).default;
  component.render = evaluate(template.code, { vue }).render;
  let state;
  const setup = component.setup;
  component.setup = (props, context) => {
    state = setup(props, context);
    return state;
  };
  const container = node('root');
  const app = renderer.createApp(component);
  for (const name of ['n-scrollbar', 'n-spin', 'n-checkbox']) app.component(name, slotComponent);
  app.mount(container);
  await flush();
  state.searchDetail.value = { songs: [candidate] };
  await flush();
  return {
    state,
    app,
    container,
    storage,
    localStorage,
    binding,
    searchStore,
    original,
    candidate,
    route,
    player,
    requests: requests.playbackRequestManager,
    preloadService,
    sounds,
    messages
  };
}

async function main() {
  // Reused ordinary search routes must not expose or save a stale original-song target.
  for (const options of [
    { target: false },
    { query: { keyword: 'fixture query', type: '1' } },
    { query: { keyword: 'different query', type: '1', kugouTarget: 'kugou:original' } },
    { query: { keyword: 'fixture query', type: '1', kugouTarget: 'kugou:different' } }
  ]) {
    const fixture = await mount(options);
    assert.equal(fixture.state.bindingTarget.value, null);
    assert.equal(buttons(fixture.container, '用于原歌单').length, 0);
    fixture.state.useVersionForPlaylist(fixture.candidate);
    assert.equal(fixture.storage.size, 0);
    assert.equal(fixture.messages.length, 0);
    fixture.app.unmount();
  }

  const fixture = await mount();
  assert.equal(buttons(fixture.container, '用于原歌单').length, 1);
  assert.match(textContent(fixture.container), /为歌单中的「Original Version.mp3」选择音源/);
  assert.equal(
    fixture.binding.getKugouPlaybackBinding(fixture.original),
    null,
    'Showing and auditioning search results cannot bind them automatically'
  );
  const requestId = fixture.requests.createRequest(fixture.original);
  const signal = fixture.requests.getRequest(requestId).abortController.signal;
  const pendingPreload = fixture.preloadService.load(fixture.original).catch((error) => error);
  click(buttons(fixture.container, '用于原歌单')[0]);
  await flush();
  const bound = fixture.binding.getKugouPlaybackBinding(fixture.original);
  assert.equal(bound.name, fixture.candidate.name);
  assert.equal(bound.ar[0].name, fixture.candidate.ar[0].name);
  assert.equal(bound.id, fixture.candidate.id);
  assert.equal(fixture.original.name, 'Original Version.mp3');
  assert.equal(fixture.requests.getRequest(requestId).status, 'cancelled');
  assert.equal(signal.aborted, true);
  assert.equal(fixture.requests.getCurrentRequestId(), null);
  assert.match((await pendingPreload).message, /预加载已取消/);
  assert.equal(fixture.sounds[0].unloaded, true);
  assert.equal(fixture.player.pauses, 1);
  assert.equal(fixture.player.playMusic.isFirstPlay, true);
  for (const song of [
    fixture.original,
    fixture.player.playList[0],
    fixture.player.originalPlayList[0],
    fixture.player.playMusic
  ]) {
    assert.equal(song.playMusicUrl, undefined);
    assert.equal(song.expiredAt, undefined);
  }
  assert.equal(fixture.player.playList[1].playMusicUrl, 'https://audio.invalid/other');
  assert.equal(fixture.messages.filter((entry) => entry.kind === 'success').length, 1);
  assert.equal(buttons(fixture.container, '恢复自动匹配').length, 1);
  assert.match(textContent(fixture.container), /A Different Search Title/);
  assert.match(textContent(fixture.container), /A Different Uploader/);
  assert.doesNotMatch([...fixture.storage.values()][0], /playMusicUrl|token=fixture/);

  // Navigating away and back recomputes visibility; stale context cannot change a saved choice.
  fixture.route.query.keyword = 'ordinary new search';
  await flush();
  assert.equal(fixture.state.bindingTarget.value, null);
  assert.equal(buttons(fixture.container, '用于原歌单').length, 0);
  const savedChoice = [...fixture.storage.values()][0];
  fixture.state.resetBoundVersion();
  assert.equal([...fixture.storage.values()][0], savedChoice);
  fixture.route.query.keyword = 'fixture query';
  await flush();
  assert.equal(buttons(fixture.container, '用于原歌单').length, 1);
  fixture.searchStore.searchType = 10;
  await flush();
  assert.equal(buttons(fixture.container, '用于原歌单').length, 0);
  assert.doesNotMatch(textContent(fixture.container), /为歌单中的/);
  fixture.searchStore.searchType = 1;
  await flush();

  // Restoring automatic matching also cancels obsolete audio, but preserves another song's request.
  fixture.player.playMusic = { id: 'unrelated', playMusicUrl: 'https://audio.invalid/other' };
  const otherRequest = fixture.requests.createRequest(fixture.player.playMusic);
  fixture.original.playMusicUrl = 'https://audio.invalid/rebound.mp3';
  fixture.original.expiredAt = 9999999999999;
  const completedPreload = fixture.preloadService.load(fixture.original);
  const completedSound = fixture.sounds.at(-1);
  completedSound.options.onload();
  await completedPreload;
  assert.equal(fixture.preloadService.getPreloadedSound(fixture.original.id), completedSound);
  click(buttons(fixture.container, '恢复自动匹配')[0]);
  await flush();
  assert.equal(fixture.binding.getKugouPlaybackBinding(fixture.original), null);
  assert.equal(buttons(fixture.container, '恢复自动匹配').length, 0);
  assert.equal(fixture.original.playMusicUrl, undefined);
  assert.equal(completedSound.unloaded, true);
  assert.equal(fixture.preloadService.getPreloadedSound(fixture.original.id), undefined);
  assert.equal(fixture.requests.getCurrentRequestId(), otherRequest);
  assert.equal(fixture.requests.getRequest(otherRequest).status, 'pending');
  assert.equal(fixture.player.pauses, 1);
  assert.equal(fixture.messages.at(-1).text, '已恢复自动匹配');
  fixture.app.unmount();
  fixture.requests.reset();

  // Failed writes leave the playing request and caches intact, and must never announce success.
  const failure = await mount({ failWrite: true });
  const failedRequest = failure.requests.createRequest(failure.original);
  click(buttons(failure.container, '用于原歌单')[0]);
  await flush();
  assert.equal(failure.binding.getKugouPlaybackBinding(failure.original), null);
  assert.equal(failure.messages.filter((entry) => entry.kind === 'success').length, 0);
  assert.equal(failure.messages.at(-1).kind, 'error');
  assert.match(failure.messages.at(-1).text, /quota/);
  assert.equal(failure.requests.getCurrentRequestId(), failedRequest);
  assert.equal(failure.player.pauses, 0);
  assert.equal(failure.original.playMusicUrl, 'https://audio.invalid/original.mp3');
  failure.localStorage.failWrite = false;
  click(buttons(failure.container, '用于原歌单')[0]);
  await flush();
  failure.messages.length = 0;
  failure.localStorage.failWrite = true;
  const failedResetRequest = failure.requests.createRequest(failure.original);
  failure.original.playMusicUrl = 'https://audio.invalid/reset-failure.mp3';
  failure.original.expiredAt = 9999999999999;
  click(buttons(failure.container, '恢复自动匹配')[0]);
  await flush();
  assert.ok(failure.binding.getKugouPlaybackBinding(failure.original));
  assert.equal(failure.messages.filter((entry) => entry.kind === 'success').length, 0);
  assert.equal(failure.messages.at(-1).kind, 'error');
  assert.equal(buttons(failure.container, '恢复自动匹配').length, 1);
  assert.equal(failure.requests.getCurrentRequestId(), failedResetRequest);
  assert.equal(failure.original.playMusicUrl, 'https://audio.invalid/reset-failure.mp3');
  assert.equal(failure.original.expiredAt, 9999999999999);
  failure.app.unmount();
  failure.requests.reset();

  // Explicit binding also supports the cross-platform catalogue identity shown in search.
  const cross = await mount();
  const crossCandidate = {
    ...cross.candidate,
    id: 'kugou:search-item',
    name: 'Different Title Uploaded By Another Artist',
    ar: [{ name: 'Search Uploader' }],
    platform: 'kugou',
    platformId: 'B'.repeat(32),
    kugou: { albumId: 'candidate album metadata' }
  };
  cross.state.searchDetail.value = { songs: [crossCandidate] };
  await flush();
  click(buttons(cross.container, '用于原歌单')[0]);
  await flush();
  const selectedCrossVersion = cross.binding.getKugouPlaybackBinding(cross.original);
  assert.equal(selectedCrossVersion.platform, 'kugou');
  assert.equal(selectedCrossVersion.platformId, crossCandidate.platformId);
  assert.equal(selectedCrossVersion.name, crossCandidate.name);
  assert.equal(selectedCrossVersion.ar[0].name, 'Search Uploader');
  assert.equal(selectedCrossVersion.kugou, undefined);
  cross.app.unmount();
  console.log(
    'Kugou binding UI checks passed: real rendered context-only buttons, stale ordinary routes, explicit different-title/uploader selection, storage without audio URLs, original request abort, pending preload abort and unload, queue URL invalidation, pause and first-play reset, unrelated request preservation, restore automatic matching, save and reset failure reporting.'
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
