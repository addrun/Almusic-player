/* Verify startup exits even when animation events or optional browser APIs fail. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const vue = require('vue');
const { parse, compileScript, compileTemplate } = require('@vue/compiler-sfc');
const filename = path.resolve(__dirname, '../src/renderer/components/splash/SplashScreen.vue');
const { descriptor, errors } = parse(fs.readFileSync(filename, 'utf8'), { filename });
assert.equal(errors.length, 0);
const script = compileScript(descriptor, { id: 'splash-ui-check' });
assert.equal(
  compileTemplate({
    source: descriptor.template.content,
    filename,
    id: 'splash-ui-check',
    compilerOptions: { bindingMetadata: script.bindings }
  }).errors.length,
  0
);
const code = ts.transpileModule(script.content, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
function mount({ still = false, disabled = false, brokenPreference = false } = {}) {
  const hooks = { mounted: [], beforeUnmount: [] };
  const events = [];
  const listeners = new Map();
  const timers = new Map();
  const settings = vue.reactive({ theme: 'light', setData: { noAnimate: disabled } });
  let time = 0;
  let serial = 0;
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (name) =>
      name === 'vue'
        ? {
            ...vue,
            onMounted: (callback) => hooks.mounted.push(callback),
            onBeforeUnmount: (callback) => hooks.beforeUnmount.push(callback)
          }
        : { useSettingsStore: () => settings },
    setTimeout: (callback, delay) => {
      const id = ++serial;
      timers.set(id, { callback, due: time + delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    window: {
      matchMedia: () => {
        if (brokenPreference) throw new Error('unsupported preference API');
        return {
          matches: still,
          addEventListener: (name, callback) => listeners.set('media:' + name, callback),
          removeEventListener: (name) => listeners.delete('media:' + name)
        };
      },
      addEventListener: (name, callback) => listeners.set(name, callback),
      removeEventListener: (name) => listeners.delete(name)
    }
  });
  const state = module.exports.default.setup(
    {},
    { expose: () => {}, emit: (event) => events.push(event) }
  );
  hooks.mounted.forEach((callback) => callback());
  return {
    state,
    events,
    timers,
    listeners,
    settings,
    advance(ms) {
      const end = time + ms;
      while (true) {
        const next = [...timers.entries()].sort((a, b) => a[1].due - b[1].due)[0];
        if (!next || next[1].due > end) break;
        time = next[1].due;
        timers.delete(next[0]);
        next[1].callback();
      }
      time = end;
    },
    cleanup: () => hooks.beforeUnmount.forEach((callback) => callback())
  };
}
const normal = mount();
normal.advance(1199);
assert.equal(normal.events.length, 0);
normal.advance(801);
assert.deepEqual(normal.events, ['finish']);
normal.state.leave();
normal.advance(2000);
assert.equal(normal.events.length, 1);
normal.cleanup();
assert.equal(normal.listeners.size, 0);
const skip = mount();
skip.state.leave();
skip.state.leave();
skip.advance(400);
assert.deepEqual(skip.events, ['finish']);
skip.cleanup();
const escape = mount();
escape.listeners.get('keydown')({ key: 'Escape' });
escape.advance(400);
assert.deepEqual(escape.events, ['finish']);
escape.cleanup();
for (const options of [{ still: true }, { disabled: true }, { brokenPreference: true }]) {
  const instant = mount(options);
  assert.deepEqual(instant.events, ['finish']);
  assert.equal(instant.timers.size, 0);
  instant.cleanup();
}
const disposed = mount();
disposed.cleanup();
disposed.advance(3000);
assert.equal(disposed.events.length, 0);
assert.equal(disposed.listeners.size, 0);
console.log(
  'Splash UI checks passed: bounded startup without transition events, skip, Escape, reduced motion, disabled animation, preference failure, single completion, unmount cleanup.'
);
