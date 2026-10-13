var __sh_lyricAdapter_DacD9jKh_js={};

/**
* @vue/shared v3.5.39
* (c_2) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
// @__NO_SIDE_EFFECTS__
var en=function en(t_2) {
var e_2 = /* @__PURE__ */ Object.create(null);
  for (const n_2 of t_2.split(",")) e_2[n_2] = 1;
  return (n_2) => n_2 in e_2;
}
var te_2 = {}, nn = [], Ct = () => {
}, sn = (t_2) => t_2.charCodeAt(0) === 111 && t_2.charCodeAt(1) === 110 && // uppercase letter
(t_2.charCodeAt(2) > 122 || t_2.charCodeAt(2) < 97), rn = (t_2) => t_2.startsWith("onUpdate:"), St = Object.assign, on = Object.prototype.hasOwnProperty, zt = (t_2, e_2) => on.call(t_2, e_2), y = Array.isArray, rt = (t_2) => Nt(t_2) === "[object Map]", be = (t_2) => Nt(t_2) === "[object Set]", w = (t_2) => typeof t_2 == "function", O = (t_2) => typeof t_2 == "string", et = (t_2) => typeof t_2 == "symbol", S = (t_2) => t_2 !== null && typeof t_2 == "object", ln = (t_2) => (S(t_2) || w(t_2)) && w(t_2.then) && w(t_2.catch), Se = Object.prototype.toString, Nt = (t_2) => Se.call(t_2), cn = (t_2) => Nt(t_2).slice(8, -1), Te = (t_2) => Nt(t_2) === "[object Object]", ee = (t_2) => O(t_2) && t_2 !== "NaN" && t_2[0] !== "-" && "" + parseInt(t_2, 10) === t_2, j = (t_2, e_2) => !Object.is(t_2, e_2), ms = (t_2) => {
var e_2 = O(t_2) ? Number(t_2) : NaN;
  return isNaN(e_2) ? t_2 : e_2;
};
var pe;
var ne = () => pe || (pe = typeof globalThis < "u_2" ? globalThis : typeof self < "u_2" ? self : typeof window < "u_2" ? window : typeof global < "u_2" ? global : {});
var se=function se(t_2) {
  if (y(t_2)) {
var e_2 = {};
    for (let n_2 = 0; n_2 < t_2.length; n_2++) {
var r_2 = t_2[n_2], s_2 = O(r_2) ? hn(r_2) : se(r_2);
      if (s_2)
        for (const i_2 in s_2)
          e_2[i_2] = s_2[i_2];
    }
    return e_2;
  } else if (O(t_2) || S(t_2))
    return t_2;
}
var an = /;(?![^(]*\))/g_2, fn = /:([^]+)/, un = /\/\*[^]*?\*\//g_2;
var hn=function hn(t_2) {
var e_2 = {};
  return t_2.replace(un, "").split(an).forEach((n_2) => {
    if (n_2) {
var r_2 = n_2.split(fn);
      r_2.length > 1 && (e_2[r_2[0].trim()] = r_2[1].trim());
    }
  }), e_2;
}
var re=function re(t_2) {
var e_2 = "";
  if (O(t_2))
    e_2 = t_2;
  else if (y(t_2))
    for (let n_2 = 0; n_2 < t_2.length; n_2++) {
var r_2 = re(t_2[n_2]);
      r_2 && (e_2 += r_2 + " ");
    }
  else if (S(t_2))
    for (const n_2 in t_2)
      t_2[n_2] && (e_2 += n_2 + " ");
  return e_2.trim();
}
var ve = (t_2) => !!(t_2 && t_2.__v_isRef === !0), dn = (t_2) => O(t_2) ? t_2 : t_2 == null ? "" : y(t_2) || S(t_2) && (t_2.toString === Se || !w(t_2.toString)) ? ve(t_2) ? dn(t_2.value) : JSON.stringify(t_2, we, 2) : String(t_2), we = (t_2, e_2) => ve(e_2) ? we(t_2, e_2.value) : rt(e_2) ? {
  [`Map(${e_2.size})`]: [...e_2.entries()].reduce(
    (n_2, [r_2, s_2], i_2) => (n_2[Vt(r_2, i_2) + " =>"] = s_2, n_2),
    {}
  )
} : be(e_2) ? {
  [`Set(${e_2.size})`]: [...e_2.values()].map((n_2) => Vt(n_2))
} : et(e_2) ? Vt(e_2) : S(e_2) && !y(e_2) && !Te(e_2) ? String(e_2) : e_2, Vt = (t_2, e_2 = "") => {
  var n_2;
  return (
    // Symbol.description in es2019+ so we need to cast here to pass
    // the lib: es2016 check
    et(t_2) ? `Symbol(${(n_2 = t_2.description) != null ? n_2 : e_2})` : t_2
  );
};
/**
* @vue/reactivity v3.5.39
* (c_2) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
var m;
var Bt = /* @__PURE__ */ new WeakSet();
var pn = class  {
  constructor(e_2) {
    this.fn = e_2, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0;
  }
  pause() {
    this.flags |= 64;
  }
  resume() {
    this.flags & 64 && (this.flags &= -65, Bt.has(this) && (Bt.delete(this), this.trigger()));
  }
  /**
   * @internal
   */
  notify() {
    this.flags & 2 && !(this.flags & 32) || this.flags & 8 || Ce(this);
  }
  run() {
    if (!(this.flags & 1))
      return this.fn();
    this.flags |= 2, ge(this), Ie(this);
var e_2 = m, n_2 = N;
    m = this, N = !0;
    try {
      return this.fn();
    } finally {
      Re(this), m = e_2, N = n_2, this.flags &= -3;
    }
  }
  stop() {
    if (this.flags & 1) {
      for (let e_2 = this.deps; e_2; e_2 = e_2.nextDep)
        le(e_2);
      this.deps = this.depsTail = void 0, ge(this), this.onStop && this.onStop(), this.flags &= -2;
    }
  }
  trigger() {
    this.flags & 64 ? Bt.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
  }
  /**
   * @internal
   */
  runIfDirty() {
    Ut(this) && this.run();
  }
  get dirty() {
    return Ut(this);
  }
}
var xe = 0, ht, dt;
var Ce=function Ce(t_2, e_2 = !1) {
  if (t_2.flags |= 8, e_2) {
    t_2.next = dt, dt = t_2;
    return;
  }
  t_2.next = ht, ht = t_2;
}
var ie=function ie() {
  xe++;
}
var oe=function oe() {
  if (--xe > 0)
    return;
  if (dt) {
var e_2 = dt;
    for (dt = void 0; e_2; ) {
var n_2 = e_2.next;
      e_2.next = void 0, e_2.flags &= -9, e_2 = n_2;
    }
  }
var t_2;
  for (; ht; ) {
var e_2 = ht;
    for (ht = void 0; e_2; ) {
var n_2 = e_2.next;
      if (e_2.next = void 0, e_2.flags &= -9, e_2.flags & 1)
        try {
          e_2.trigger();
        } catch (r_2) {
          t_2 || (t_2 = r_2);
        }
      e_2 = n_2;
    }
  }
  if (t_2) throw t_2;
}
var Ie=function Ie(t_2) {
  for (let e_2 = t_2.deps; e_2; e_2 = e_2.nextDep)
    e_2.version = -1, e_2.prevActiveLink = e_2.dep.activeLink, e_2.dep.activeLink = e_2;
}
var Re=function Re(t_2) {
var e_2, n_2 = t_2.depsTail, r_2 = n_2;
  for (; r_2; ) {
var s_2 = r_2.prevDep;
    r_2.version === -1 ? (r_2 === n_2 && (n_2 = s_2), le(r_2), gn(r_2)) : e_2 = r_2, r_2.dep.activeLink = r_2.prevActiveLink, r_2.prevActiveLink = void 0, r_2 = s_2;
  }
  t_2.deps = e_2, t_2.depsTail = n_2;
}
var Ut=function Ut(t_2) {
  for (let e_2 = t_2.deps; e_2; e_2 = e_2.nextDep)
    if (e_2.dep.version !== e_2.version || e_2.dep.computed && (Ae(e_2.dep.computed) || e_2.dep.version !== e_2.version))
      return !0;
  return !!t_2._dirty;
}
var Ae=function Ae(t_2) {
  if (t_2.flags & 4 && !(t_2.flags & 16) || (t_2.flags &= -17, t_2.globalVersion === pt) || (t_2.globalVersion = pt, !t_2.isSSR && t_2.flags & 128 && (!t_2.deps && !t_2._dirty || !Ut(t_2))))
    return;
  t_2.flags |= 2;
var e_2 = t_2.dep, n_2 = m, r_2 = N;
  m = t_2, N = !0;
  try {
    Ie(t_2);
var s_2 = t_2.fn(t_2._value);
    (e_2.version === 0 || j(s_2, t_2._value)) && (t_2.flags |= 128, t_2._value = s_2, e_2.version++);
  } catch (s_2) {
    throw e_2.version++, s_2;
  } finally {
    m = n_2, N = r_2, Re(t_2), t_2.flags &= -3;
  }
}
var le=function le(t_2, e_2 = !1) {
var { dep: n_2, prevSub: r_2, nextSub: s_2 } = t_2;
  if (r_2 && (r_2.nextSub = s_2, t_2.prevSub = void 0), s_2 && (s_2.prevSub = r_2, t_2.nextSub = void 0), n_2.subs === t_2 && (n_2.subs = r_2, !r_2 && n_2.computed)) {
    n_2.computed.flags &= -5;
    for (let i_2 = n_2.computed.deps; i_2; i_2 = i_2.nextDep)
      le(i_2, !0);
  }
  !e_2 && !--n_2.sc && n_2.map && n_2.map.delete(n_2.key);
}
var gn=function gn(t_2) {
var { prevDep: e_2, nextDep: n_2 } = t_2;
  e_2 && (e_2.nextDep = n_2, t_2.prevDep = void 0), n_2 && (n_2.prevDep = e_2, t_2.nextDep = void 0);
}
var N = !0;
var Ee = [];
var Ot=function Ot() {
  Ee.push(N), N = !1;
}
var Dt=function Dt() {
var t_2 = Ee.pop();
  N = t_2 === void 0 ? !0 : t_2;
}
var ge=function ge(t_2) {
var { cleanup: e_2 } = t_2;
  if (t_2.cleanup = void 0, e_2) {
var n_2 = m;
    m = void 0;
    try {
      e_2();
    } finally {
      m = n_2;
    }
  }
}
var pt = 0;
var _n = class  {
  constructor(e_2, n_2) {
    this.sub = e_2, this.dep = n_2, this.version = n_2.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
  }
}
var ce = class  {
  // TODO isolatedDeclarations "__v_skip"
  constructor(e_2) {
    this.computed = e_2, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0;
  }
  track(e_2) {
    if (!m || !N || m === this.computed)
      return;
var n_2 = this.activeLink;
    if (n_2 === void 0 || n_2.sub !== m)
      n_2 = this.activeLink = new _n(m, this), m.deps ? (n_2.prevDep = m.depsTail, m.depsTail.nextDep = n_2, m.depsTail = n_2) : m.deps = m.depsTail = n_2, Le(n_2);
    else if (n_2.version === -1 && (n_2.version = this.version, n_2.nextDep)) {
var r_2 = n_2.nextDep;
      r_2.prevDep = n_2.prevDep, n_2.prevDep && (n_2.prevDep.nextDep = r_2), n_2.prevDep = m.depsTail, n_2.nextDep = void 0, m.depsTail.nextDep = n_2, m.depsTail = n_2, m.deps === n_2 && (m.deps = r_2);
    }
    return n_2;
  }
  trigger(e_2) {
    this.version++, pt++, this.notify(e_2);
  }
  notify(e_2) {
    ie();
    try {
      for (let n_2 = this.subs; n_2; n_2 = n_2.prevSub)
        n_2.sub.notify() && n_2.sub.dep.notify();
    } finally {
      oe();
    }
  }
}
var Le=function Le(t_2) {
  if (t_2.dep.sc++, t_2.sub.flags & 4) {
var e_2 = t_2.dep.computed;
    if (e_2 && !t_2.dep.subs) {
      e_2.flags |= 20;
      for (let r_2 = e_2.deps; r_2; r_2 = r_2.nextDep)
        Le(r_2);
    }
var n_2 = t_2.dep.subs;
    n_2 !== t_2 && (t_2.prevSub = n_2, n_2 && (n_2.nextSub = t_2)), t_2.dep.subs = t_2;
  }
}
var Jt = /* @__PURE__ */ new WeakMap(), tt = /* @__PURE__ */ Symbol(
  ""
), $t_2 = /* @__PURE__ */ Symbol(
  ""
), gt = /* @__PURE__ */ Symbol(
  ""
);
var v=function v(t_2, e_2, n_2) {
  if (N && m) {
var r_2 = Jt.get(t_2);
    r_2 || Jt.set(t_2, r_2 = /* @__PURE__ */ new Map());
var s_2 = r_2.get(n_2);
    s_2 || (r_2.set(n_2, s_2 = new ce()), s_2.map = r_2, s_2.key = n_2), s_2.track();
  }
}
var q_2=function q_2(t_2, e_2, n_2, r_2, s_2, i_2) {
var l_2 = Jt.get(t_2);
  if (!l_2) {
    pt++;
    return;
  }
var c_2 = (o_2) => {
    o_2 && o_2.trigger();
  };
  if (ie(), e_2 === "clear")
    l_2.forEach(c_2);
  else {
var o_2 = y(t_2), f_2 = o_2 && ee(n_2);
    if (o_2 && n_2 === "length") {
var a_2 = Number(r_2);
      l_2.forEach((u_2, p) => {
        (p === "length" || p === gt || !et(p) && p >= a_2) && c_2(u_2);
      });
    } else
      switch ((n_2 !== void 0 || l_2.has(void 0)) && c_2(l_2.get(n_2)), f_2 && c_2(l_2.get(gt)), e_2) {
        case "add":
          o_2 ? f_2 && c_2(l_2.get("length")) : (c_2(l_2.get(tt)), rt(t_2) && c_2(l_2.get($t_2)));
          break;
        case "delete":
          o_2 || (c_2(l_2.get(tt)), rt(t_2) && c_2(l_2.get($t_2)));
          break;
        case "set":
          rt(t_2) && c_2(l_2.get(tt));
          break;
      }
  }
  oe();
}
var nt=function nt(t_2) {
var e_2 = /* @__PURE__ */ _(t_2);
  return e_2 === t_2 ? e_2 : (v(e_2, "iterate", gt), /* @__PURE__ */ L(t_2) ? e_2 : e_2.map(D));
}
var Pt=function Pt(t_2) {
  return v(t_2 = /* @__PURE__ */ _(t_2), "iterate", gt), t_2;
}
var F_2=function F_2(t_2, e_2) {
  return /* @__PURE__ */ U(t_2) ? lt(/* @__PURE__ */ it(t_2) ? D(e_2) : e_2) : D(e_2);
}
var mn = {
  __proto__: null,
  [Symbol.iterator]() {
    return Ht(this, Symbol.iterator, (t_2) => F_2(this, t_2));
  },
  concat(...t_2) {
    return nt(this).concat(
      ...t_2.map((e_2) => y(e_2) ? nt(e_2) : e_2)
    );
  },
  entries() {
    return Ht(this, "entries", (t_2) => (t_2[1] = F_2(this, t_2[1]), t_2));
  },
  every(t_2, e_2) {
    return K(this, "every", t_2, e_2, void 0, arguments);
  },
  filter(t_2, e_2) {
    return K(
      this,
      "filter",
      t_2,
      e_2,
      (n_2) => n_2.map((r_2) => F_2(this, r_2)),
      arguments
    );
  },
  find(t_2, e_2) {
    return K(
      this,
      "find",
      t_2,
      e_2,
      (n_2) => F_2(this, n_2),
      arguments
    );
  },
  findIndex(t_2, e_2) {
    return K(this, "findIndex", t_2, e_2, void 0, arguments);
  },
  findLast(t_2, e_2) {
    return K(
      this,
      "findLast",
      t_2,
      e_2,
      (n_2) => F_2(this, n_2),
      arguments
    );
  },
  findLastIndex(t_2, e_2) {
    return K(this, "findLastIndex", t_2, e_2, void 0, arguments);
  },
  // flat, flatMap could benefit from ARRAY_ITERATE but are not straight-forward to implement
  forEach(t_2, e_2) {
    return K(this, "forEach", t_2, e_2, void 0, arguments);
  },
  includes(...t_2) {
    return Wt(this, "includes", t_2);
  },
  indexOf(...t_2) {
    return Wt(this, "indexOf", t_2);
  },
  join(t_2) {
    return nt(this).join(t_2);
  },
  // keys() iterator only reads `length`, no optimization required
  lastIndexOf(...t_2) {
    return Wt(this, "lastIndexOf", t_2);
  },
  map(t_2, e_2) {
    return K(this, "map", t_2, e_2, void 0, arguments);
  },
  pop() {
    return ft(this, "pop");
  },
  push(...t_2) {
    return ft(this, "push", t_2);
  },
  reduce(t_2, ...e_2) {
    return _e(this, "reduce", t_2, e_2);
  },
  reduceRight(t_2, ...e_2) {
    return _e(this, "reduceRight", t_2, e_2);
  },
  shift() {
    return ft(this, "shift");
  },
  // slice could use ARRAY_ITERATE but also seems to beg for range tracking
  some(t_2, e_2) {
    return K(this, "some", t_2, e_2, void 0, arguments);
  },
  splice(...t_2) {
    return ft(this, "splice", t_2);
  },
  toReversed() {
    return nt(this).toReversed();
  },
  toSorted(t_2) {
    return nt(this).toSorted(t_2);
  },
  toSpliced(...t_2) {
    return nt(this).toSpliced(...t_2);
  },
  unshift(...t_2) {
    return ft(this, "unshift", t_2);
  },
  values() {
    return Ht(this, "values", (t_2) => F_2(this, t_2));
  }
};
var Ht=function Ht(t_2, e_2, n_2) {
var r_2 = Pt(t_2), s_2 = r_2[e_2]();
  return r_2 !== t_2 && !/* @__PURE__ */ L(t_2) && (s_2._next = s_2.next, s_2.next = () => {
var i_2 = s_2._next();
    return i_2.done || (i_2.value = n_2(i_2.value)), i_2;
  }), s_2;
}
var yn = Array.prototype;
var K=function K(t_2, e_2, n_2, r_2, s_2, i_2) {
var l_2 = Pt(t_2), c_2 = l_2 !== t_2 && !/* @__PURE__ */ L(t_2), o_2 = l_2[e_2];
  if (o_2 !== yn[e_2]) {
var u_2 = o_2.apply(t_2, i_2);
    return c_2 ? D(u_2) : u_2;
  }
var f_2 = n_2;
  l_2 !== t_2 && (c_2 ? f_2 = function(u_2, p) {
    return n_2.call(this, F_2(t_2, u_2), p, t_2);
  } : n_2.length > 2 && (f_2 = function(u_2, p) {
    return n_2.call(this, u_2, p, t_2);
  }));
var a_2 = o_2.call(l_2, f_2, r_2);
  return c_2 && s_2 ? s_2(a_2) : a_2;
}
var _e=function _e(t_2, e_2, n_2, r_2) {
var s_2 = Pt(t_2), i_2 = s_2 !== t_2 && !/* @__PURE__ */ L(t_2);
var l_2 = n_2, c_2 = !1;
  s_2 !== t_2 && (i_2 ? (c_2 = r_2.length === 0, l_2 = function(f_2, a_2, u_2) {
    return c_2 && (c_2 = !1, f_2 = F_2(t_2, f_2)), n_2.call(this, f_2, F_2(t_2, a_2), u_2, t_2);
  }) : n_2.length > 3 && (l_2 = function(f_2, a_2, u_2) {
    return n_2.call(this, f_2, a_2, u_2, t_2);
  }));
var o_2 = s_2[e_2](l_2, ...r_2);
  return c_2 ? F_2(t_2, o_2) : o_2;
}
var Wt=function Wt(t_2, e_2, n_2) {
var r_2 = /* @__PURE__ */ _(t_2);
  v(r_2, "iterate", gt);
var s_2 = r_2[e_2](...n_2);
  return (s_2 === -1 || s_2 === !1) && /* @__PURE__ */ ae(n_2[0]) ? (n_2[0] = /* @__PURE__ */ _(n_2[0]), r_2[e_2](...n_2)) : s_2;
}
var ft=function ft(t_2, e_2, n_2 = []) {
  Ot(), ie();
var r_2 = (/* @__PURE__ */ _(t_2))[e_2].apply(t_2, n_2);
  return oe(), Dt(), r_2;
}
var bn = /* @__PURE__ */ en("__proto__,__v_isRef,__isVue"), Me = new Set(
  /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((t_2) => t_2 !== "arguments" && t_2 !== "caller").map((t_2) => Symbol[t_2]).filter(et)
);
var Sn=function Sn(t_2) {
  et(t_2) || (t_2 = String(t_2));
var e_2 = /* @__PURE__ */ _(this);
  return v(e_2, "has", t_2), e_2.hasOwnProperty(t_2);
}
var Ne = class  {
  constructor(e_2 = !1, n_2 = !1) {
    this._isReadonly = e_2, this._isShallow = n_2;
  }
  get(e_2, n_2, r_2) {
    if (n_2 === "__v_skip") return e_2.__v_skip;
var s_2 = this._isReadonly, i_2 = this._isShallow;
    if (n_2 === "__v_isReactive")
      return !s_2;
    if (n_2 === "__v_isReadonly")
      return s_2;
    if (n_2 === "__v_isShallow")
      return i_2;
    if (n_2 === "__v_raw")
      return r_2 === (s_2 ? i_2 ? Ln : Pe : i_2 ? En : De).get(e_2) || // receiver is not the reactive proxy, but has the same prototype
      // this means the receiver is a_2 user proxy of the reactive proxy
      Object.getPrototypeOf(e_2) === Object.getPrototypeOf(r_2) ? e_2 : void 0;
var l_2 = y(e_2);
    if (!s_2) {
var o_2;
      if (l_2 && (o_2 = mn[n_2]))
        return o_2;
      if (n_2 === "hasOwnProperty")
        return Sn;
    }
var c_2 = Reflect.get(
      e_2,
      n_2,
      // if this is a_2 proxy wrapping a_2 ref, return methods using the raw ref
      // as receiver so that we don't_2 have to call `toRaw` on the ref in all
      // its class methods
      /* @__PURE__ */ H(e_2) ? e_2 : r_2
    );
    if ((et(n_2) ? Me.has(n_2) : bn(n_2)) || (s_2 || v(e_2, "get", n_2), i_2))
      return c_2;
    if (/* @__PURE__ */ H(c_2)) {
var o_2 = l_2 && ee(n_2) ? c_2 : c_2.value;
      return s_2 && S(o_2) ? /* @__PURE__ */ Yt(o_2) : o_2;
    }
    return S(c_2) ? s_2 ? /* @__PURE__ */ Yt(c_2) : /* @__PURE__ */ Fe(c_2) : c_2;
  }
}
var Tn = class extends Ne {
  constructor(e_2 = !1) {
    super(!1, e_2);
  }
  set(e_2, n_2, r_2, s_2) {
var i_2 = e_2[n_2];
var l_2 = y(e_2) && ee(n_2);
    if (!this._isShallow) {
var f_2 = /* @__PURE__ */ U(i_2);
      if (!/* @__PURE__ */ L(r_2) && !/* @__PURE__ */ U(r_2) && (i_2 = /* @__PURE__ */ _(i_2), r_2 = /* @__PURE__ */ _(r_2)), !l_2 && /* @__PURE__ */ H(i_2) && !/* @__PURE__ */ H(r_2))
        return f_2 || (i_2.value = r_2), !0;
    }
var c_2 = l_2 ? Number(n_2) < e_2.length : zt(e_2, n_2), o_2 = Reflect.set(
      e_2,
      n_2,
      r_2,
      /* @__PURE__ */ H(e_2) ? e_2 : s_2
    );
    return e_2 === /* @__PURE__ */ _(s_2) && o_2 && (c_2 ? j(r_2, i_2) && q_2(e_2, "set", n_2, r_2) : q_2(e_2, "add", n_2, r_2)), o_2;
  }
  deleteProperty(e_2, n_2) {
var r_2 = zt(e_2, n_2);
    e_2[n_2];
var s_2 = Reflect.deleteProperty(e_2, n_2);
    return s_2 && r_2 && q_2(e_2, "delete", n_2, void 0), s_2;
  }
  has(e_2, n_2) {
var r_2 = Reflect.has(e_2, n_2);
    return (!et(n_2) || !Me.has(n_2)) && v(e_2, "has", n_2), r_2;
  }
  ownKeys(e_2) {
    return v(
      e_2,
      "iterate",
      y(e_2) ? "length" : tt
    ), Reflect.ownKeys(e_2);
  }
}
var vn = class extends Ne {
  constructor(e_2 = !1) {
    super(!0, e_2);
  }
  set(e_2, n_2) {
    return !0;
  }
  deleteProperty(e_2, n_2) {
    return !0;
  }
}
var wn = /* @__PURE__ */ new Tn(), xn = /* @__PURE__ */ new vn(), qt = (t_2) => t_2, vt = (t_2) => Reflect.getPrototypeOf(t_2);
var Cn=function Cn(t_2, e_2, n_2) {
  return function(...r_2) {
var s_2 = this.__v_raw, i_2 = /* @__PURE__ */ _(s_2), l_2 = rt(i_2), c_2 = t_2 === "entries" || t_2 === Symbol.iterator && l_2, o_2 = t_2 === "keys" && l_2, f_2 = s_2[t_2](...r_2), a_2 = n_2 ? qt : e_2 ? lt : D;
    return !e_2 && v(
      i_2,
      "iterate",
      o_2 ? $t_2 : tt
    ), St(
      // inheriting all iterator properties
      Object.create(f_2),
      {
        // iterator protocol
        next() {
var { value: u_2, done: p } = f_2.next();
          return p ? { value: u_2, done: p } : {
            value: c_2 ? [a_2(u_2[0]), a_2(u_2[1])] : a_2(u_2),
            done: p
          };
        }
      }
    );
  };
}
var wt=function wt(t_2) {
  return function(...e_2) {
    return t_2 === "delete" ? !1 : t_2 === "clear" ? void 0 : this;
  };
}
var In=function In(t_2, e_2) {
var n_2 = {
    get(s_2) {
var i_2 = this.__v_raw, l_2 = /* @__PURE__ */ _(i_2), c_2 = /* @__PURE__ */ _(s_2);
      t_2 || (j(s_2, c_2) && v(l_2, "get", s_2), v(l_2, "get", c_2));
var { has: o_2 } = vt(l_2), f_2 = e_2 ? qt : t_2 ? lt : D;
      if (o_2.call(l_2, s_2))
        return f_2(i_2.get(s_2));
      if (o_2.call(l_2, c_2))
        return f_2(i_2.get(c_2));
      i_2 !== l_2 && i_2.get(s_2);
    },
    get size() {
var s_2 = this.__v_raw;
      return !t_2 && v(/* @__PURE__ */ _(s_2), "iterate", tt), s_2.size;
    },
    has(s_2) {
var i_2 = this.__v_raw, l_2 = /* @__PURE__ */ _(i_2), c_2 = /* @__PURE__ */ _(s_2);
      return t_2 || (j(s_2, c_2) && v(l_2, "has", s_2), v(l_2, "has", c_2)), s_2 === c_2 ? i_2.has(s_2) : i_2.has(s_2) || i_2.has(c_2);
    },
    forEach(s_2, i_2) {
var l_2 = this, c_2 = l_2.__v_raw, o_2 = /* @__PURE__ */ _(c_2), f_2 = e_2 ? qt : t_2 ? lt : D;
      return !t_2 && v(o_2, "iterate", tt), c_2.forEach((a_2, u_2) => s_2.call(i_2, f_2(a_2), f_2(u_2), l_2));
    }
  };
  return St(
    n_2,
    t_2 ? {
      add: wt("add"),
      set: wt("set"),
      delete: wt("delete"),
      clear: wt("clear")
    } : {
      add(s_2) {
var i_2 = /* @__PURE__ */ _(this), l_2 = vt(i_2), c_2 = /* @__PURE__ */ _(s_2), o_2 = !e_2 && !/* @__PURE__ */ L(s_2) && !/* @__PURE__ */ U(s_2) ? c_2 : s_2;
        return l_2.has.call(i_2, o_2) || j(s_2, o_2) && l_2.has.call(i_2, s_2) || j(c_2, o_2) && l_2.has.call(i_2, c_2) || (i_2.add(o_2), q_2(i_2, "add", o_2, o_2)), this;
      },
      set(s_2, i_2) {
        !e_2 && !/* @__PURE__ */ L(i_2) && !/* @__PURE__ */ U(i_2) && (i_2 = /* @__PURE__ */ _(i_2));
var l_2 = /* @__PURE__ */ _(this), { has: c_2, get: o_2 } = vt(l_2);
var f_2 = c_2.call(l_2, s_2);
        f_2 || (s_2 = /* @__PURE__ */ _(s_2), f_2 = c_2.call(l_2, s_2));
var a_2 = o_2.call(l_2, s_2);
        return l_2.set(s_2, i_2), f_2 ? j(i_2, a_2) && q_2(l_2, "set", s_2, i_2) : q_2(l_2, "add", s_2, i_2), this;
      },
      delete(s_2) {
var i_2 = /* @__PURE__ */ _(this), { has: l_2, get: c_2 } = vt(i_2);
var o_2 = l_2.call(i_2, s_2);
        o_2 || (s_2 = /* @__PURE__ */ _(s_2), o_2 = l_2.call(i_2, s_2)), c_2 && c_2.call(i_2, s_2);
var f_2 = i_2.delete(s_2);
        return o_2 && q_2(i_2, "delete", s_2, void 0), f_2;
      },
      clear() {
var s_2 = /* @__PURE__ */ _(this), i_2 = s_2.size !== 0, l_2 = s_2.clear();
        return i_2 && q_2(
          s_2,
          "clear",
          void 0,
          void 0
        ), l_2;
      }
    }
  ), [
    "keys",
    "values",
    "entries",
    Symbol.iterator
  ].forEach((s_2) => {
    n_2[s_2] = Cn(s_2, t_2, e_2);
  }), n_2;
}
var Oe=function Oe(t_2, e_2) {
var n_2 = In(t_2, e_2);
  return (r_2, s_2, i_2) => s_2 === "__v_isReactive" ? !t_2 : s_2 === "__v_isReadonly" ? t_2 : s_2 === "__v_raw" ? r_2 : Reflect.get(
    zt(n_2, s_2) && s_2 in r_2 ? n_2 : r_2,
    s_2,
    i_2
  );
}
var Rn = {
  get: /* @__PURE__ */ Oe(!1, !1)
}, An = {
  get: /* @__PURE__ */ Oe(!0, !1)
}, De = /* @__PURE__ */ new WeakMap(), En = /* @__PURE__ */ new WeakMap(), Pe = /* @__PURE__ */ new WeakMap(), Ln = /* @__PURE__ */ new WeakMap();
var Mn=function Mn(t_2) {
  switch (t_2) {
    case "Object":
    case "Array":
      return 1;
    case "Map":
    case "Set":
    case "WeakMap":
    case "WeakSet":
      return 2;
    default:
      return 0;
  }
}
// @__NO_SIDE_EFFECTS__
var Fe=function Fe(t_2) {
  return /* @__PURE__ */ U(t_2) ? t_2 : je(
    t_2,
    !1,
    wn,
    Rn,
    De
  );
}
// @__NO_SIDE_EFFECTS__
var Yt=function Yt(t_2) {
  return je(
    t_2,
    !0,
    xn,
    An,
    Pe
  );
}
var je=function je(t_2, e_2, n_2, r_2, s_2) {
  if (!S(t_2) || t_2.__v_raw && !(e_2 && t_2.__v_isReactive) || t_2.__v_skip || !Object.isExtensible(t_2))
    return t_2;
var i_2 = s_2.get(t_2);
  if (i_2)
    return i_2;
var l_2 = Mn(cn(t_2));
  if (l_2 === 0)
    return t_2;
var c_2 = new Proxy(
    t_2,
    l_2 === 2 ? r_2 : n_2
  );
  return s_2.set(t_2, c_2), c_2;
}
// @__NO_SIDE_EFFECTS__
var it=function it(t_2) {
  return /* @__PURE__ */ U(t_2) ? /* @__PURE__ */ it(t_2.__v_raw) : !!(t_2 && t_2.__v_isReactive);
}
// @__NO_SIDE_EFFECTS__
var U=function U(t_2) {
  return !!(t_2 && t_2.__v_isReadonly);
}
// @__NO_SIDE_EFFECTS__
var L=function L(t_2) {
  return !!(t_2 && t_2.__v_isShallow);
}
// @__NO_SIDE_EFFECTS__
var ae=function ae(t_2) {
  return t_2 ? !!t_2.__v_raw : !1;
}
// @__NO_SIDE_EFFECTS__
var _=function _(t_2) {
var e_2 = t_2 && t_2.__v_raw;
  return e_2 ? /* @__PURE__ */ _(e_2) : t_2;
}
var D = (t_2) => S(t_2) ? /* @__PURE__ */ Fe(t_2) : t_2, lt = (t_2) => S(t_2) ? /* @__PURE__ */ Yt(t_2) : t_2;
// @__NO_SIDE_EFFECTS__
var H=function H(t_2) {
  return t_2 ? t_2.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
var ys=function ys(t_2) {
  return Nn(t_2, !1);
}
var Nn=function Nn(t_2, e_2) {
  return /* @__PURE__ */ H(t_2) ? t_2 : new On(t_2, e_2);
}
var On = class  {
  constructor(e_2, n_2) {
    this.dep = new ce(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = n_2 ? e_2 : /* @__PURE__ */ _(e_2), this._value = n_2 ? e_2 : D(e_2), this.__v_isShallow = n_2;
  }
  get value() {
    return this.dep.track(), this._value;
  }
  set value(e_2) {
var n_2 = this._rawValue, r_2 = this.__v_isShallow || /* @__PURE__ */ L(e_2) || /* @__PURE__ */ U(e_2);
    e_2 = r_2 ? e_2 : /* @__PURE__ */ _(e_2), j(e_2, n_2) && (this._rawValue = e_2, this._value = r_2 ? e_2 : D(e_2), this.dep.trigger());
  }
}
var Dn = class  {
  constructor(e_2, n_2, r_2) {
    this.fn = e_2, this.setter = n_2, this._value = void 0, this.dep = new ce(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = pt - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !n_2, this.isSSR = r_2;
  }
  /**
   * @internal
   */
  notify() {
    if (this.flags |= 16, !(this.flags & 8) && // avoid infinite self recursion
    m !== this)
      return Ce(this, !0), !0;
  }
  get value() {
var e_2 = this.dep.track();
    return Ae(this), e_2 && (e_2.version = this.dep.version), this._value;
  }
  set value(e_2) {
    this.setter && this.setter(e_2);
  }
}
// @__NO_SIDE_EFFECTS__
var Pn=function Pn(t_2, e_2, n_2 = !1) {
var r_2, s_2;
  return w(t_2) ? r_2 = t_2 : (r_2 = t_2.get, s_2 = t_2.set), new Dn(r_2, s_2, n_2);
}
var xt = {}, At = /* @__PURE__ */ new WeakMap();

var Fn=function Fn(t_2, e_2 = !1, n_2 = X) {
  if (n_2) {
var r_2 = At.get(n_2);
    r_2 || At.set(n_2, r_2 = []), r_2.push(t_2);
  }
}
var jn=function jn(t_2, e_2, n_2 = te_2) {
var { immediate: r_2, deep: s_2, once: i_2, scheduler: l_2, augmentJob: c_2, call: o_2 } = n_2, f_2 = (h_2) => s_2 ? h_2 : /* @__PURE__ */ L(h_2) || s_2 === !1 || s_2 === 0 ? Y(h_2, 1) : Y(h_2);
var a_2, u_2, p, g_2, I = !1, P = !1;
  if (/* @__PURE__ */ H(t_2) ? (u_2 = () => t_2.value, I = /* @__PURE__ */ L(t_2)) : /* @__PURE__ */ it(t_2) ? (u_2 = () => f_2(t_2), I = !0) : y(t_2) ? (P = !0, I = t_2.some((h_2) => /* @__PURE__ */ it(h_2) || /* @__PURE__ */ L(h_2)), u_2 = () => t_2.map((h_2) => {
    if (/* @__PURE__ */ H(h_2))
      return h_2.value;
    if (/* @__PURE__ */ it(h_2))
      return f_2(h_2);
    if (w(h_2))
      return o_2 ? o_2(h_2, 2) : h_2();
  })) : w(t_2) ? e_2 ? u_2 = o_2 ? () => o_2(t_2, 2) : t_2 : u_2 = () => {
    if (p) {
      Ot();
      try {
        p();
      } finally {
        Dt();
      }
    }
var h_2 = X;
    X = a_2;
    try {
      return o_2 ? o_2(t_2, 3, [g_2]) : t_2(g_2);
    } finally {
      X = h_2;
    }
  } : u_2 = Ct, e_2 && s_2) {
var h_2 = u_2, x = s_2 === !0 ? 1 / 0 : s_2;
    u_2 = () => Y(h_2(), x);
  }
var J = () => {
    a_2.stop();
  };
  if (i_2 && e_2) {
var h_2 = e_2;
    e_2 = (...x) => {
var M_2 = h_2(...x);
      return J(), M_2;
    };
  }
var W = P ? new Array(t_2.length).fill(xt) : xt;
var G = (h_2) => {
    if (!(!(a_2.flags & 1) || !a_2.dirty && !h_2))
      if (e_2) {
var x = a_2.run();
        if (h_2 || s_2 || I || (P ? x.some((M_2, R) => j(M_2, W[R])) : j(x, W))) {
          p && p();
var M_2 = X;
          X = a_2;
          try {
var R = [
              x,
              // pass undefined as the old value when it's_2 changed for the first time
              W === xt ? void 0 : P && W[0] === xt ? [] : W,
              g_2
            ];
            W = x, o_2 ? o_2(e_2, 3, R) : (
              // @ts-expect-error
              e_2(...R)
            );
          } finally {
            X = M_2;
          }
        }
      } else
        a_2.run();
  };
  return c_2 && c_2(G), a_2 = new pn(u_2), a_2.scheduler = l_2 ? () => l_2(G, !1) : G, g_2 = (h_2) => Fn(h_2, !1, a_2), p = a_2.onStop = () => {
var h_2 = At.get(a_2);
    if (h_2) {
      if (o_2)
        o_2(h_2, 4);
      else
        for (const x of h_2) x();
      At.delete(a_2);
    }
  }, e_2 ? r_2 ? G(!0) : W = a_2.run() : l_2 ? l_2(G.bind(null, !0), !0) : a_2.run(), J.pause = a_2.pause.bind(a_2), J.resume = a_2.resume.bind(a_2), J.stop = J, J;
}
var Y=function Y(t_2, e_2 = 1 / 0, n_2) {
  if (e_2 <= 0 || !S(t_2) || t_2.__v_skip || (n_2 = n_2 || /* @__PURE__ */ new Map(), (n_2.get(t_2) || 0) >= e_2))
    return t_2;
  if (n_2.set(t_2, e_2), e_2--, /* @__PURE__ */ H(t_2))
    Y(t_2.value, e_2, n_2);
  else if (y(t_2))
    for (let r_2 = 0; r_2 < t_2.length; r_2++)
      Y(t_2[r_2], e_2, n_2);
  else if (be(t_2) || rt(t_2))
    t_2.forEach((r_2) => {
      Y(r_2, e_2, n_2);
    });
  else if (Te(t_2)) {
    for (const r_2 in t_2)
      Y(t_2[r_2], e_2, n_2);
    for (const r_2 of Object.getOwnPropertySymbols(t_2))
      Object.prototype.propertyIsEnumerable.call(t_2, r_2) && Y(t_2[r_2], e_2, n_2);
  }
  return t_2;
}
/**
* @vue/runtime-core v3.5.39
* (c_2) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
var fe=function fe(t_2, e_2, n_2, r_2) {
  try {
    return r_2 ? t_2(...r_2) : t_2();
  } catch (s_2) {
    Ve(s_2, e_2, n_2);
  }
}
var Ft=function Ft(t_2, e_2, n_2, r_2) {
  if (w(t_2)) {
var s_2 = fe(t_2, e_2, n_2, r_2);
    return s_2 && ln(s_2) && s_2.catch((i_2) => {
      Ve(i_2, e_2, n_2);
    }), s_2;
  }
  if (y(t_2)) {
var s_2 = [];
    for (let i_2 = 0; i_2 < t_2.length; i_2++)
      s_2.push(Ft(t_2[i_2], e_2, n_2, r_2));
    return s_2;
  }
}
var Ve=function Ve(t_2, e_2, n_2, r_2 = !0) {
var s_2 = e_2 ? e_2.vnode : null, { errorHandler: i_2, throwUnhandledErrorInProduction: l_2 } = e_2 && e_2.appContext.config || te_2;
  if (e_2) {
var c_2 = e_2.parent;
var o_2 = e_2.proxy, f_2 = `https://vuejs.org/error-reference/#runtime-${n_2}`;
    for (; c_2; ) {
var a_2 = c_2.ec;
      if (a_2) {
        for (let u_2 = 0; u_2 < a_2.length; u_2++)
          if (a_2[u_2](t_2, o_2, f_2) === !1)
            return;
      }
      c_2 = c_2.parent;
    }
    if (i_2) {
      Ot(), fe(i_2, null, 10, [
        t_2,
        o_2,
        f_2
      ]), Dt();
      return;
    }
  }
  Vn(t_2, n_2, s_2, r_2, l_2);
}
var Vn=function Vn(t_2, e_2, n_2, r_2 = !0, s_2 = !1) {
  if (s_2)
    throw t_2;
  console.error(t_2);
}
var E = [];
var k = -1;
var ot = [];
var $ = null, st = 0;
var Bn = /* @__PURE__ */ Promise.resolve();
var Gt = null;
var Hn=function Hn(t_2) {
var e_2 = k + 1, n_2 = E.length;
  for (; e_2 < n_2; ) {
var r_2 = e_2 + n_2 >>> 1, s_2 = E[r_2], i_2 = _t(s_2);
    i_2 < t_2 || i_2 === t_2 && s_2.flags & 2 ? e_2 = r_2 + 1 : n_2 = r_2;
  }
  return e_2;
}
var Wn=function Wn(t_2) {
  if (!(t_2.flags & 1)) {
var e_2 = _t(t_2), n_2 = E[E.length - 1];
    !n_2 || // fast path when the job id is larger than the tail
    !(t_2.flags & 2) && e_2 >= _t(n_2) ? E.push(t_2) : E.splice(Hn(e_2), 0, t_2), t_2.flags |= 1, Be();
  }
}
var Be=function Be() {
  Gt || (Gt = Bn.then(He));
}
var Kn=function Kn(t_2) {
  y(t_2) ? ot.push(...t_2) : $ && t_2.id === -1 ? $.splice(st + 1, 0, t_2) : t_2.flags & 1 || (ot.push(t_2), t_2.flags |= 1), Be();
}
var kn=function kn(t_2) {
  if (ot.length) {
var e_2 = [...new Set(ot)].sort(
      (n_2, r_2) => _t(n_2) - _t(r_2)
    );
    if (ot.length = 0, $) {
      $.push(...e_2);
      return;
    }
    for ($ = e_2, st = 0; st < $.length; st++) {
var n_2 = $[st];
      n_2.flags & 4 && (n_2.flags &= -2), n_2.flags & 8 || n_2(), n_2.flags &= -2;
    }
    $ = null, st = 0;
  }
}
var _t = (t_2) => t_2.id == null ? t_2.flags & 2 ? -1 : 1 / 0 : t_2.id;
var He=function He(t_2) {
  try {
    for (k = 0; k < E.length; k++) {
var e_2 = E[k];
      e_2 && !(e_2.flags & 8) && (e_2.flags & 4 && (e_2.flags &= -2), fe(
        e_2,
        e_2.i_2,
        e_2.i_2 ? 15 : 14
      ), e_2.flags & 4 || (e_2.flags &= -2));
    }
  } finally {
    for (; k < E.length; k++) {
var e_2 = E[k];
      e_2 && (e_2.flags &= -2);
    }
    k = -1, E.length = 0, kn(), Gt = null, (E.length || ot.length) && He();
  }
}
var B = null, We = null;
var me=function me(t_2) {
var e_2 = B;
  return B = t_2, We = t_2 && t_2.type.__scopeId || null, e_2;
}
var bs=function bs(t_2, e_2 = B, n_2) {
  if (!e_2 || t_2._n)
    return t_2;
var r_2 = (...s_2) => {
    r_2._d && Lt(-1);
var i_2 = me(e_2);
var l_2;
    try {
      l_2 = t_2(...s_2);
    } finally {
      me(i_2), r_2._d && Lt(1);
    }
    return l_2;
  };
  return r_2._n = !0, r_2._c = !0, r_2._d = !0, r_2;
}
var zn=function zn(t_2, e_2, n_2 = !1) {
var r_2 = Ze();
  if (r_2 || es) {
var s_2 = r_2 ? r_2.parent == null || r_2.ce ? r_2.vnode.appContext && r_2.vnode.appContext.provides : r_2.parent.provides : void 0;
    if (s_2 && t_2 in s_2)
      return s_2[t_2];
    if (arguments.length > 1)
      return n_2 && w(e_2) ? e_2.call(r_2 && r_2.proxy) : e_2;
  }
}
var Un = /* @__PURE__ */ Symbol.for("v-scx"), Jn = () => zn(Un);
var Ss=function Ss(t_2, e_2, n_2) {
  return $n_2(t_2, e_2, n_2);
}
var $n_2=function $n_2(t_2, e_2, n_2 = te_2) {
var { immediate: r_2, deep: s_2, flush: i_2, once: l_2 } = n_2, c_2 = St({}, n_2), o_2 = e_2 && r_2 || !e_2 && i_2 !== "post";
var f_2;
  if (bt) {
    if (i_2 === "sync") {
var g_2 = Jn();
      f_2 = g_2.__watcherHandles || (g_2.__watcherHandles = []);
    } else if (!o_2) {
var g_2 = () => {
      };
      return g_2.stop = Ct, g_2.resume = Ct, g_2.pause = Ct, g_2;
    }
  }
var a_2 = ct;
  c_2.call = (g_2, I, P) => Ft(g_2, a_2, I, P);
var u_2 = !1;
  i_2 === "post" ? c_2.scheduler = (g_2) => {
    ss(g_2, a_2 && a_2.suspense);
  } : i_2 !== "sync" && (u_2 = !0, c_2.scheduler = (g_2, I) => {
    I ? g_2() : Wn(g_2);
  }), c_2.augmentJob = (g_2) => {
    e_2 && (g_2.flags |= 4), u_2 && (g_2.flags |= 2, a_2 && (g_2.id = a_2.uid, g_2.i_2 = a_2));
  };
var p = jn(t_2, e_2, c_2);
  return bt && (f_2 ? f_2.push(p) : o_2 && p()), p;
}
var Ke = (t_2) => t_2.__isTeleport, z = /* @__PURE__ */ Symbol("_leaveCb"), ut = /* @__PURE__ */ Symbol("_enterCb");
var qn=function qn() {
var t_2 = {
    isMounted: !1,
    isLeaving: !1,
    isUnmounting: !1,
    leavingVNodes: /* @__PURE__ */ new Map()
  };
  return Xn(() => {
    t_2.isMounted = !0;
  }), Zn(() => {
    t_2.isUnmounting = !0;
  }), t_2;
}
var A = [Function, Array], Yn = {
  mode: String,
  appear: Boolean,
  persisted: Boolean,
  // enter
  onBeforeEnter: A,
  onEnter: A,
  onAfterEnter: A,
  onEnterCancelled: A,
  // leave
  onBeforeLeave: A,
  onLeave: A,
  onAfterLeave: A,
  onLeaveCancelled: A,
  // appear
  onBeforeAppear: A,
  onAppear: A,
  onAfterAppear: A,
  onAppearCancelled: A
}, ke = (t_2) => {
var e_2 = t_2.subTree;
  return e_2.component ? ke(e_2.component) : e_2;
}, Gn = {
  name: "BaseTransition",
  props: Yn,
  setup(t_2, { slots: e_2 }) {
var n_2 = Ze(), r_2 = qn();
    return () => {
var s_2 = e_2.default && Je(e_2.default(), !0), i_2 = s_2 && s_2.length ? ze(s_2) : (
        // Keep explicit default-slot conditionals on the same transition path
        // as regular v-if branches, which render a_2 comment placeholder.
        n_2.subTree ? ds() : void 0
      );
      if (!i_2)
        return;
var l_2 = /* @__PURE__ */ _(t_2), { mode: c_2 } = l_2;
      if (r_2.isLeaving)
        return Kt(i_2);
var o_2 = ye(i_2);
      if (!o_2)
        return Kt(i_2);
var f_2 = Qt(
        o_2,
        l_2,
        r_2,
        n_2,
        // #11061, ensure enterHooks is fresh after clone
        (u_2) => f_2 = u_2
      );
      o_2.type !== V && Et(o_2, f_2);
var a_2 = n_2.subTree && ye(n_2.subTree);
      if (a_2 && a_2.type !== V && !Ge(a_2, o_2) && ke(n_2).type !== V) {
var u_2 = Qt(
          a_2,
          l_2,
          r_2,
          n_2
        );
        if (Et(a_2, u_2), c_2 === "out-in" && o_2.type !== V)
          return r_2.isLeaving = !0, u_2.afterLeave = () => {
            r_2.isLeaving = !1, n_2.job.flags & 8 || n_2.update(), delete u_2.afterLeave, a_2 = void 0;
          }, Kt(i_2);
        c_2 === "in-out" && o_2.type !== V ? u_2.delayLeave = (p, g_2, I) => {
var P = Ue(
            r_2,
            a_2
          );
          P[String(a_2.key)] = a_2, p[z] = () => {
            g_2(), p[z] = void 0, delete f_2.delayedLeave, a_2 = void 0;
          }, f_2.delayedLeave = () => {
            I(), delete f_2.delayedLeave, a_2 = void 0;
          };
        } : a_2 = void 0;
      } else a_2 && (a_2 = void 0);
      return i_2;
    };
  }
};
var ze=function ze(t_2) {
var e_2 = t_2[0];
  if (t_2.length > 1) {
    for (const n_2 of t_2)
      if (n_2.type !== V) {
        e_2 = n_2;
        break;
      }
  }
  return e_2;
}
var Ts = Gn;
var Ue=function Ue(t_2, e_2) {
var { leavingVNodes: n_2 } = t_2;
var r_2 = n_2.get(e_2.type);
  return r_2 || (r_2 = /* @__PURE__ */ Object.create(null), n_2.set(e_2.type, r_2)), r_2;
}
var Qt=function Qt(t_2, e_2, n_2, r_2, s_2) {
var {
    appear: i_2,
    mode: l_2,
    persisted: c_2 = !1,
    onBeforeEnter: o_2,
    onEnter: f_2,
    onAfterEnter: a_2,
    onEnterCancelled: u_2,
    onBeforeLeave: p,
    onLeave: g_2,
    onAfterLeave: I,
    onLeaveCancelled: P,
    onBeforeAppear: J,
    onAppear: W,
    onAfterAppear: G,
    onAppearCancelled: h_2
  } = e_2, x = String(t_2.key), M_2 = Ue(n_2, t_2), R = (d, b_2) => {
    d && Ft(
      d,
      r_2,
      9,
      b_2
    );
  }, de = (d, b_2) => {
var T_2 = b_2[1];
    R(d, b_2), y(d) ? d.every((Q) => Q.length <= 1) && T_2() : d.length <= 1 && T_2();
  }, jt = {
    mode: l_2,
    persisted: c_2,
    beforeEnter(d) {
var b_2 = o_2;
      if (!n_2.isMounted)
        if (i_2)
          b_2 = J || o_2;
        else
          return;
      d[z] && d[z](
        !0
        /* cancelled */
      );
var T_2 = M_2[x];
      T_2 && Ge(t_2, T_2) && T_2.el[z] && T_2.el[z](), R(b_2, [d]);
    },
    enter(d) {
      if (M_2[x] === t_2) return;
var b_2 = f_2, T_2 = a_2, Q = u_2;
      if (!n_2.isMounted)
        if (i_2)
          b_2 = W || f_2, T_2 = G || a_2, Q = h_2 || u_2;
        else
          return;
var at_2 = !1;
      d[ut] = (tn) => {
        at_2 || (at_2 = !0, tn ? R(Q, [d]) : R(T_2, [d]), jt.delayedLeave && jt.delayedLeave(), d[ut] = void 0);
      };
var Tt = d[ut].bind(null, !1);
      b_2 ? de(b_2, [d, Tt]) : Tt();
    },
    leave(d, b_2) {
var T_2 = String(t_2.key);
      if (d[ut] && d[ut](
        !0
        /* cancelled */
      ), n_2.isUnmounting)
        return b_2();
      R(p, [d]);
var Q = !1;
      d[z] = (Tt) => {
        Q || (Q = !0, b_2(), Tt ? R(P, [d]) : R(I, [d]), d[z] = void 0, M_2[T_2] === t_2 && delete M_2[T_2]);
      };
var at_2 = d[z].bind(null, !1);
      M_2[T_2] = t_2, g_2 ? de(g_2, [d, at_2]) : at_2();
    },
    clone(d) {
var b_2 = Qt(
        d,
        e_2,
        n_2,
        r_2,
        s_2
      );
      return s_2 && s_2(b_2), b_2;
    }
  };
  return jt;
}
var Kt=function Kt(t_2) {
  if ($e_2(t_2))
    return t_2 = yt(t_2), t_2.children = null, t_2;
}
var ye=function ye(t_2) {
  if (!$e_2(t_2))
    return Ke(t_2.type) && t_2.children ? ze(t_2.children) : t_2;
  if (t_2.component)
    return t_2.component.subTree;
var { shapeFlag: e_2, children: n_2 } = t_2;
  if (n_2) {
    if (e_2 & 16)
      return n_2[0];
    if (e_2 & 32 && w(n_2.default))
      return n_2.default();
  }
}
var Et=function Et(t_2, e_2) {
  t_2.shapeFlag & 6 && t_2.component ? (t_2.transition = e_2, Et(t_2.component.subTree, e_2)) : t_2.shapeFlag & 128 ? (t_2.ssContent.transition = e_2.clone(t_2.ssContent), t_2.ssFallback.transition = e_2.clone(t_2.ssFallback)) : t_2.transition = e_2;
}
var Je=function Je(t_2, e_2 = !1, n_2) {
var r_2 = [], s_2 = 0;
  for (let i_2 = 0; i_2 < t_2.length; i_2++) {
var l_2 = t_2[i_2];
var c_2 = n_2 == null ? l_2.key : String(n_2) + String(l_2.key != null ? l_2.key : i_2);
    l_2.type === he ? (l_2.patchFlag & 128 && s_2++, r_2 = r_2.concat(
      Je(l_2.children, e_2, c_2)
    )) : (e_2 || l_2.type !== V) && r_2.push(c_2 != null ? yt(l_2, { key: c_2 }) : l_2);
  }
  if (s_2 > 1)
    for (let i_2 = 0; i_2 < r_2.length; i_2++)
      r_2[i_2].patchFlag = -2;
  return r_2;
}
ne().requestIdleCallback;
ne().cancelIdleCallback;
var $e_2 = (t_2) => t_2.type.__isKeepAlive;
var Qn=function Qn(t_2, e_2, n_2 = ct, r_2 = !1) {
  if (n_2) {
var s_2 = n_2[t_2] || (n_2[t_2] = []), i_2 = e_2.__weh || (e_2.__weh = (...l_2) => {
      Ot();
var c_2 = gs(n_2), o_2 = Ft(e_2, n_2, t_2, l_2);
      return c_2(), Dt(), o_2;
    });
    return r_2 ? s_2.unshift(i_2) : s_2.push(i_2), i_2;
  }
}
var ue = (t_2) => (e_2, n_2 = ct) => {
  (!bt || t_2 === "sp") && Qn(t_2, (...r_2) => e_2(...r_2), n_2);
}, Xn = ue("m"), Zn = ue(
  "bum"
), vs = ue("um"), ts = /* @__PURE__ */ Symbol.for("v-ndc");
var ws=function ws(t_2, e_2, n_2, r_2) {
var s_2;
var i_2 = n_2, l_2 = y(t_2);
  if (l_2 || O(t_2)) {
var c_2 = l_2 && /* @__PURE__ */ it(t_2);
var o_2 = !1, f_2 = !1;
    c_2 && (o_2 = !/* @__PURE__ */ L(t_2), f_2 = /* @__PURE__ */ U(t_2), t_2 = Pt(t_2)), s_2 = new Array(t_2.length);
    for (let a_2 = 0, u_2 = t_2.length; a_2 < u_2; a_2++)
      s_2[a_2] = e_2(
        o_2 ? f_2 ? lt(D(t_2[a_2])) : D(t_2[a_2]) : t_2[a_2],
        a_2,
        void 0,
        i_2
      );
  } else if (typeof t_2 == "number") {
    s_2 = new Array(t_2);
    for (let c_2 = 0; c_2 < t_2; c_2++)
      s_2[c_2] = e_2(c_2 + 1, c_2, void 0, i_2);
  } else if (S(t_2))
    if (t_2[Symbol.iterator])
      s_2 = Array.from(
        t_2,
        (c_2, o_2) => e_2(c_2, o_2, void 0, i_2)
      );
    else {
var c_2 = Object.keys(t_2);
      s_2 = new Array(c_2.length);
      for (let o_2 = 0, f_2 = c_2.length; o_2 < f_2; o_2++) {
var a_2 = c_2[o_2];
        s_2[o_2] = e_2(t_2[a_2], a_2, o_2, i_2);
      }
    }
  else
    s_2 = [];
  return s_2;
}
var es = null;
var ns = {}, qe = (t_2) => Object.getPrototypeOf(t_2) === ns, ss = is, rs = (t_2) => t_2.__isSuspense;
var is=function is(t_2, e_2) {
  e_2 && e_2.pendingBranch ? y(t_2) ? e_2.effects.push(...t_2) : e_2.effects.push(t_2) : Kn(t_2);
}
var he = /* @__PURE__ */ Symbol.for("v-fgt"), os = /* @__PURE__ */ Symbol.for("v-txt"), V = /* @__PURE__ */ Symbol.for("v-cmt"), It = [];
var C = null;
var ls=function ls(t_2 = !1) {
  It.push(C = t_2 ? null : []);
}
var cs=function cs() {
  It.pop(), C = It[It.length - 1] || null;
}
var mt = 1;
var Lt=function Lt(t_2, e_2 = !1) {
  mt += t_2, t_2 < 0 && C && e_2 && (C.hasOnce = !0);
}
var Ye=function Ye(t_2) {
  return t_2.dynamicChildren = mt > 0 ? C || nn : null, cs(), mt > 0 && C && C.push(t_2), t_2;
}
var xs=function xs(t_2, e_2, n_2, r_2, s_2, i_2) {
  return Ye(
    Xe(
      t_2,
      e_2,
      n_2,
      r_2,
      s_2,
      i_2,
      !0
    )
  );
}
var as=function as(t_2, e_2, n_2, r_2, s_2) {
  return Ye(
    Z(
      t_2,
      e_2,
      n_2,
      r_2,
      s_2,
      !0
    )
  );
}
var Xt=function Xt(t_2) {
  return t_2 ? t_2.__v_isVNode === !0 : !1;
}
var Ge=function Ge(t_2, e_2) {
  return t_2.type === e_2.type && t_2.key === e_2.key;
}
var Qe = ({ key: t_2 }) => t_2 ?? null, Rt = ({
  ref: t_2,
  ref_key: e_2,
  ref_for: n_2
}) => (typeof t_2 == "number" && (t_2 = "" + t_2), t_2 != null ? O(t_2) || /* @__PURE__ */ H(t_2) || w(t_2) ? { i_2: B, r_2: t_2, k: e_2, f_2: !!n_2 } : t_2 : null);
var Xe=function Xe(t_2, e_2 = null, n_2 = null, r_2 = 0, s_2 = null, i_2 = t_2 === he ? 0 : 1, l_2 = !1, c_2 = !1) {
var o_2 = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: t_2,
    props: e_2,
    key: e_2 && Qe(e_2),
    ref: e_2 && Rt(e_2),
    scopeId: We,
    slotScopeIds: null,
    children: n_2,
    component: null,
    suspense: null,
    ssContent: null,
    ssFallback: null,
    dirs: null,
    transition: null,
    el: null,
    anchor: null,
    target: null,
    targetStart: null,
    targetAnchor: null,
    staticCount: 0,
    shapeFlag: i_2,
    patchFlag: r_2,
    dynamicProps: s_2,
    dynamicChildren: null,
    appContext: null,
    ctx: B
  };
  return c_2 ? (Mt(o_2, n_2), i_2 & 128 && t_2.normalize(o_2)) : n_2 && (o_2.shapeFlag |= O(n_2) ? 8 : 16), mt > 0 && // avoid a_2 block node from tracking itself
  !l_2 && // has current parent block
  C && // presence of a_2 patch flag indicates this node needs patching on updates.
  // component nodes also should always be patched, because even if the
  // component doesn't_2 need to update, it needs to persist the instance on to
  // the next vnode so that it can be properly unmounted later.
  (o_2.patchFlag > 0 || i_2 & 6) && // the EVENTS flag is only for hydration and if it is the only flag, the
  // vnode should not be considered dynamic due to handler caching.
  o_2.patchFlag !== 32 && C.push(o_2), o_2;
}
var Z = fs;
var fs=function fs(t_2, e_2 = null, n_2 = null, r_2 = 0, s_2 = null, i_2 = !1) {
  if ((!t_2 || t_2 === ts) && (t_2 = V), Xt(t_2)) {
var c_2 = yt(
      t_2,
      e_2,
      !0
      /* mergeRef: true */
    );
    return n_2 && Mt(c_2, n_2), mt > 0 && !i_2 && C && (c_2.shapeFlag & 6 ? C[C.indexOf(t_2)] = c_2 : C.push(c_2)), c_2.patchFlag = -2, c_2;
  }
  if (_s(t_2) && (t_2 = t_2.__vccOpts), e_2) {
    e_2 = us(e_2);
var { class: c_2, style: o_2 } = e_2;
    c_2 && !O(c_2) && (e_2.class = re(c_2)), S(o_2) && (/* @__PURE__ */ ae(o_2) && !y(o_2) && (o_2 = St({}, o_2)), e_2.style = se(o_2));
  }
var l_2 = O(t_2) ? 1 : rs(t_2) ? 128 : Ke(t_2) ? 64 : S(t_2) ? 4 : w(t_2) ? 2 : 0;
  return Xe(
    t_2,
    e_2,
    n_2,
    r_2,
    s_2,
    l_2,
    i_2,
    !0
  );
}
var us=function us(t_2) {
  return t_2 ? /* @__PURE__ */ ae(t_2) || qe(t_2) ? St({}, t_2) : t_2 : null;
}
var yt=function yt(t_2, e_2, n_2 = !1, r_2 = !1) {
var { props: s_2, ref: i_2, patchFlag: l_2, children: c_2, transition: o_2 } = t_2, f_2 = e_2 ? ps(s_2 || {}, e_2) : s_2, a_2 = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: t_2.type,
    props: f_2,
    key: f_2 && Qe(f_2),
    ref: e_2 && e_2.ref ? (
      // #2078 in the case of <component :is="vnode" ref="extra"/>
      // if the vnode itself already has a_2 ref, cloneVNode will need to merge
      // the refs so the single vnode can be set on multiple refs
      n_2 && i_2 ? y(i_2) ? i_2.concat(Rt(e_2)) : [i_2, Rt(e_2)] : Rt(e_2)
    ) : i_2,
    scopeId: t_2.scopeId,
    slotScopeIds: t_2.slotScopeIds,
    children: c_2,
    target: t_2.target,
    targetStart: t_2.targetStart,
    targetAnchor: t_2.targetAnchor,
    staticCount: t_2.staticCount,
    shapeFlag: t_2.shapeFlag,
    // if the vnode is cloned with extra props, we can no longer assume its
    // existing patch flag to be reliable and need to add the FULL_PROPS flag.
    // note: preserve flag for fragments since they use the flag for children
    // fast paths only.
    patchFlag: e_2 && t_2.type !== he ? l_2 === -1 ? 16 : l_2 | 16 : l_2,
    dynamicProps: t_2.dynamicProps,
    dynamicChildren: t_2.dynamicChildren,
    appContext: t_2.appContext,
    dirs: t_2.dirs,
    transition: o_2,
    // These should technically only be non-null on mounted VNodes. However,
    // they *should* be copied for kept-alive vnodes. So we just always copy
    // them since them being non-null during a_2 mount doesn't_2 affect the logic as
    // they will simply be overwritten.
    component: t_2.component,
    suspense: t_2.suspense,
    ssContent: t_2.ssContent && yt(t_2.ssContent),
    ssFallback: t_2.ssFallback && yt(t_2.ssFallback),
    placeholder: t_2.placeholder,
    el: t_2.el,
    anchor: t_2.anchor,
    ctx: t_2.ctx,
    ce: t_2.ce
  };
  return o_2 && r_2 && Et(
    a_2,
    o_2.clone(a_2)
  ), a_2;
}
var hs=function hs(t_2 = " ", e_2 = 0) {
  return Z(os, null, t_2, e_2);
}
var ds=function ds(t_2 = "", e_2 = !1) {
  return e_2 ? (ls(), as(V, null, t_2)) : Z(V, null, t_2);
}
var Mt=function Mt(t_2, e_2) {
var n_2 = 0;
var { shapeFlag: r_2 } = t_2;
  if (e_2 == null)
    e_2 = null;
  else if (y(e_2))
    n_2 = 16;
  else if (typeof e_2 == "object")
    if (r_2 & 65) {
var s_2 = e_2.default;
      s_2 && (s_2._c && (s_2._d = !1), Mt(t_2, s_2()), s_2._c && (s_2._d = !0));
      return;
    } else {
      n_2 = 32;
var s_2 = e_2._;
      !s_2 && !qe(e_2) ? e_2._ctx = B : s_2 === 3 && B && (B.slots._ === 1 ? e_2._ = 1 : (e_2._ = 2, t_2.patchFlag |= 1024));
    }
  else if (w(e_2)) {
    if (r_2 & 65) {
      Mt(t_2, { default: e_2 });
      return;
    }
    e_2 = { default: e_2, _ctx: B }, n_2 = 32;
  } else
    e_2 = String(e_2), r_2 & 64 ? (n_2 = 16, e_2 = [hs(e_2)]) : n_2 = 8;
  t_2.children = e_2, t_2.shapeFlag |= n_2;
}
var ps=function ps(...t_2) {
var e_2 = {};
  for (let n_2 = 0; n_2 < t_2.length; n_2++) {
var r_2 = t_2[n_2];
    for (const s_2 in r_2)
      if (s_2 === "class")
        e_2.class !== r_2.class && (e_2.class = re([e_2.class, r_2.class]));
      else if (s_2 === "style")
        e_2.style = se([e_2.style, r_2.style]);
      else if (sn(s_2)) {
var i_2 = e_2[s_2], l_2 = r_2[s_2];
        l_2 && i_2 !== l_2 && !(y(i_2) && i_2.includes(l_2)) ? e_2[s_2] = i_2 ? [].concat(i_2, l_2) : l_2 : l_2 == null && i_2 == null && // mergeProps({ 'onUpdate:modelValue': undefined }) should not retain
        // the model listener.
        !rn(s_2) && (e_2[s_2] = l_2);
      } else s_2 !== "" && (e_2[s_2] = r_2[s_2]);
  }
  return e_2;
}
var ct = null;
var Ze = () => ct || B;
var Zt;
{
var t_2 = ne(), e_2 = (n_2, r_2) => {
var s_2;
    return (s_2 = t_2[n_2]) || (s_2 = t_2[n_2] = []), s_2.push(r_2), (i_2) => {
      s_2.length > 1 ? s_2.forEach((l_2) => l_2(i_2)) : s_2[0](i_2);
    };
  };
  Zt = e_2(
    "__VUE_INSTANCE_SETTERS__",
    (n_2) => ct = n_2
  ), e_2(
    "__VUE_SSR_SETTERS__",
    (n_2) => bt = n_2
  );
}
var gs = (t_2) => {
var e_2 = ct;
  return Zt(t_2), t_2.scope.on(), () => {
    t_2.scope.off(), Zt(e_2);
  };
};
var bt = !1;
var _s=function _s(t_2) {
  return w(t_2) && "__vccOpts" in t_2;
}
var kt = (t_2, e_2) => /* @__PURE__ */ Pn(t_2, e_2, bt);
var Cs=function Cs(t_2, e_2, n_2) {
  try {
    Lt(-1);
var r_2 = arguments.length;
    return r_2 === 2 ? S(e_2) && !y(e_2) ? Xt(e_2) ? Z(t_2, null, [e_2]) : Z(t_2, e_2) : Z(t_2, null, e_2) : (r_2 > 3 ? n_2 = Array.prototype.slice.call(arguments, 2) : r_2 === 3 && Xt(n_2) && (n_2 = [n_2]), Z(t_2, e_2, n_2));
  } finally {
    Lt(1);
  }
}
var Is=function Is(t_2, e_2 = {}) {
var n_2 = kt(() => t_2.currentTime ?? 0), r_2 = kt(() => {
var o_2 = t_2.lyricLines || [];
    for (let f_2 = 0; f_2 < o_2.length; f_2++) {
var a_2 = o_2[f_2];
      if (t_2.currentTime >= (a_2.startTime ?? 0) && t_2.currentTime < (a_2.endTime ?? 1 / 0))
        return f_2;
    }
    return o_2.length > 0 && t_2.currentTime >= (o_2[o_2.length - 1].endTime ?? 0) ? o_2.length - 1 : -1;
  }), s_2 = kt(() => (t_2.lyricLines || []).map((o_2) => ({
    text: o_2.text || "",
    trText: o_2.translatedText || "",
    startTime: o_2.startTime || 0,
    duration: (o_2.endTime ?? 0) - (o_2.startTime ?? 0),
    words: o_2.words ? o_2.words.map((f_2) => ({
      text: f_2.text || "",
      startTime: (f_2.startTime ?? 0) - (o_2.startTime ?? 0),
      duration: (f_2.endTime ?? 0) - (f_2.startTime ?? 0)
    })) : void 0
  })));
  var i_2=function i_2() {
var o_2 = t_2.coverColor;
    return typeof o_2 == "string" ? { primary: o_2, average: o_2 } : o_2 && typeof o_2 == "object" ? { primary: o_2.primary || "#ffffff", average: o_2.average || o_2.primary || "#ffffff" } : { primary: "#ffffff", average: "#ffffff" };
  }
  var l_2=function l_2() {
    return {
      isInClimax: !!t_2.isClimax,
      segments: t_2.climaxSegments || [],
      energy: t_2.energy ?? 0,
      isBeat: !!t_2.isBeat,
      kickEnergy: t_2.kickEnergy ?? 0,
      bpm: t_2.bpm ?? 120
    };
  }
  var c_2=function c_2(o_2, f_2) {
    if (e_2[o_2] !== void 0) return e_2[o_2];
    try {
var a_2 = localStorage.getItem("music-full-config");
      if (a_2) {
var u_2 = JSON.parse(a_2);
        if (u_2[o_2] !== void 0) return u_2[o_2];
      }
    } catch {
    }
    return f_2;
  }
  return { nowTime: n_2, nowIndex: r_2, lrcArray: s_2, getCoverColor: i_2, getClimaxState: l_2, getConfigValue: c_2 };
}
var Rs=function Rs(t_2, e_2) {
  return t_2.map((n_2, r_2) => {
var s_2 = e_2[r_2] ?? n_2.startTime ?? 0, i_2 = e_2[r_2 + 1] ?? (n_2.duration != null ? s_2 + n_2.duration : s_2 + 5), l_2 = n_2.text || "", c_2 = [];
    if (n_2.words && n_2.words.length > 0) {
var o_2 = 0;
      for (const f_2 of n_2.words) {
var a_2 = s_2 + (f_2.startTime || 0), u_2 = s_2 + (f_2.startTime || 0) + (f_2.duration || 0.3), p = l_2.slice(o_2, o_2 + (f_2.text || "").length) || f_2.text || "";
        o_2 += (f_2.text || "").length, c_2.push({
          text: p,
          startTime: a_2,
          endTime: u_2
        });
      }
    } else {
var o_2 = Array.from(l_2), f_2 = Math.max((i_2 - s_2) / Math.max(o_2.length, 1), 0.05);
      o_2.forEach((a_2, u_2) => {
        c_2.push({
          text: a_2,
          startTime: s_2 + u_2 * f_2,
          endTime: s_2 + (u_2 + 1) * f_2
        });
      });
    }
    return {
      words: c_2,
      startTime: s_2,
      endTime: i_2 || s_2 + 5,
      fullText: l_2,
      translation: n_2.trText || void 0
    };
  });
}
__sh_lyricAdapter_DacD9jKh_js.B=Yn;__sh_lyricAdapter_DacD9jKh_js.F_2=he;__sh_lyricAdapter_DacD9jKh_js.a_2=vs;__sh_lyricAdapter_DacD9jKh_js.b_2=xs;__sh_lyricAdapter_DacD9jKh_js.c_2=Is;__sh_lyricAdapter_DacD9jKh_js.d=Xe;__sh_lyricAdapter_DacD9jKh_js.e_2=ys;__sh_lyricAdapter_DacD9jKh_js.f_2=kt;__sh_lyricAdapter_DacD9jKh_js.g_2=ls;__sh_lyricAdapter_DacD9jKh_js.h_2=Z;__sh_lyricAdapter_DacD9jKh_js.i_2=bs;__sh_lyricAdapter_DacD9jKh_js.j=ds;__sh_lyricAdapter_DacD9jKh_js.k=re;__sh_lyricAdapter_DacD9jKh_js.l_2=St;__sh_lyricAdapter_DacD9jKh_js.m=Cs;__sh_lyricAdapter_DacD9jKh_js.n_2=se;__sh_lyricAdapter_DacD9jKh_js.o_2=Xn;__sh_lyricAdapter_DacD9jKh_js.p=Ts;__sh_lyricAdapter_DacD9jKh_js.q_2=S;__sh_lyricAdapter_DacD9jKh_js.r_2=ws;__sh_lyricAdapter_DacD9jKh_js.s_2=y;__sh_lyricAdapter_DacD9jKh_js.t_2=dn;__sh_lyricAdapter_DacD9jKh_js.u_2=ms;__sh_lyricAdapter_DacD9jKh_js.w=Ss;__sh_lyricAdapter_DacD9jKh_js.z=Rs;
var te_2 = { class: "folia-fume-root w-full h_2-full overflow-hidden pointer-events-none select-none" }, oe = {
  __name: "FumeTheme",
  props: {
    currentTime: { type: Number, default: 0 },
    lyricLines: { type: Array, default: () => [] },
    coverColor: { type: [String, Object], default: "#ffffff" },
    isClimax: { type: Boolean, default: !1 },
    energy: { type: Number, default: 0 },
    settings: { type: Object, default: () => ({}) }
  },
  setup(k) {
var F_2 = k, l_2 = X(F_2, F_2.settings), z = o_2(() => l_2.nowTime.value), S = o_2(() => l_2.lrcArray.value), E = o_2(() => S.value.map((t_2) => t_2.startTime ?? 0)), N = o_2(() => l_2.getCoverColor()), x = o_2(() => N.value.primary || "#ffffff"), A = o_2(() => l_2.getClimaxState().isInClimax ? "#ff6b6b" : x.value), f_2 = o_2(() => ee(S.value, E.value)), P = o_2(() => f_2.value.length === 0 ? 120 : Math.max(f_2.value[f_2.value.length - 1]?.endTime || 120, 120)), C = Q(null);
var n_2 = 0;
var q_2 = o_2(() => {
var t_2 = [];
      for (const e_2 of f_2.value)
        for (const a_2 of e_2.words)
          t_2.push({ text: a_2.text, time: a_2.startTime, endTime: a_2.endTime });
      return t_2;
    }), D = o_2(() => l_2.getConfigValue("foliaFumeScrollSpeed") ?? 1), R = o_2(() => l_2.getConfigValue("foliaFumeFontSize") ?? 0.025);
    function r_2() {
var t_2 = C.value;
      if (!t_2) {
        n_2 = requestAnimationFrame(r_2);
        return;
      }
var e_2 = t_2.getContext("2d");
      if (!e_2) {
        n_2 = requestAnimationFrame(r_2);
        return;
      }
var a_2 = window.devicePixelRatio || 1, i_2 = t_2.clientWidth, c_2 = t_2.clientHeight;
      t_2.width !== i_2 * a_2 && (t_2.width = i_2 * a_2), t_2.height !== c_2 * a_2 && (t_2.height = c_2 * a_2), e_2.setTransform(a_2, 0, 0, a_2, 0, 0), e_2.clearRect(0, 0, i_2, c_2);
var b_2 = z.value, m = Math.min(36, Math.max(14, i_2 * R.value));
      e_2.font = `400 ${m}px "Noto Sans SC", PingFang SC, sans-serif`, e_2.textBaseline = "top";
var d = m * 1.5, B = 24, T_2 = 16, V = Math.max(m * 6, (i_2 - B * 2 - T_2) / 3), h_2 = q_2.value;
      if (h_2.length === 0) {
        n_2 = requestAnimationFrame(r_2);
        return;
      }
var I = P.value, L = D.value, W = Math.min(1, b_2 / I), j = Math.max(0, h_2.length / 2 * d - c_2 * 0.5), H = W * j * L, M_2 = h_2.length, _ = Math.ceil(M_2 / 3);
      e_2.save();
      for (let p = 0; p < 3; p++) {
var y = p * _, O = Math.min(y + _, M_2), G = B + p * (V + T_2);
        for (let v = y; v < O; v++) {
var g_2 = h_2[v], w = (v - y) * d - H + 40;
          if (w < -d || w > c_2 + d) continue;
var s_2 = (b_2 - g_2.time) / Math.max(g_2.endTime - g_2.time, 0.5), U = s_2 > 1;
          if (s_2 >= 0 && s_2 <= 1) {
var u_2 = Math.min(1, 0.6 + s_2 * 0.4);
            e_2.globalAlpha = u_2, e_2.shadowColor = A.value, e_2.shadowBlur = m * 0.6, e_2.fillStyle = A.value;
          } else if (U) {
var u_2 = Math.max(0.08, 0.4 - s_2 * 0.3);
            e_2.globalAlpha = u_2, e_2.shadowBlur = 0, e_2.fillStyle = x.value;
          } else {
var u_2 = Math.max(0.1, 0.3 + s_2 * 0.3);
            e_2.globalAlpha = u_2, e_2.shadowBlur = 0, e_2.fillStyle = x.value;
          }
          e_2.fillText(g_2.text, G, w), e_2.shadowBlur = 0;
        }
      }
      e_2.restore(), e_2.globalAlpha = 1, n_2 = requestAnimationFrame(r_2);
    }
    return Y(() => {
      n_2 = requestAnimationFrame(r_2);
    }), $(() => {
      cancelAnimationFrame(n_2);
    }), (t_2, e_2) => (Z(), J("div", te_2, [
      K("canvas", {
        ref_key: "canvasRef",
        ref: C,
        class: "absolute inset-0 w-full h_2-full"
      }, null, 512)
    ]));
  }
};
oe.settings = [
  { key: "foliaShowTranslation", type: "boolean", label: "显示翻译", default: !0 },
  { key: "foliaFumeScrollSpeed", type: "slider", label: "滚动速度", min: 0.3, max: 3, step: 0.1, marks: ["慢", "快"], default: 1 },
  { key: "foliaFumeFontSize", type: "slider", label: "字号比例", min: 0.015, max: 0.04, step: 5e-3, marks: ["小", "大"], default: 0.025 }
];
return { default: oe };
