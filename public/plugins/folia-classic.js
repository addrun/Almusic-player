var __sh_runtime_dom_esm_bundler_BpCzq7Ba_js={};

var __sh_lyricAdapter_DacD9jKh_js={};

/**
* @vue/shared v3.5.39
* (c_2) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
// @__NO_SIDE_EFFECTS__
var en =function en(t_2) {
var e_2 = /* @__PURE__ */ Object.create(null);
  for (const n_2 of t_2.split(",")) e_2[n_2] = 1;
  return (n_2) => n_2 in e_2;
}
var te = {}, nn = [], Ct = () => {
}, sn = (t_2) => t_2.charCodeAt(0) === 111 && t_2.charCodeAt(1) === 110 && // uppercase letter
(t_2.charCodeAt(2) > 122 || t_2.charCodeAt(2) < 97), rn = (t_2) => t_2.startsWith("onUpdate:"), St = Object.assign, on = Object.prototype.hasOwnProperty, zt = (t_2, e_2) => on.call(t_2, e_2), y = Array.isArray, rt = (t_2) => Nt(t_2) === "[object Map]", be = (t_2) => Nt(t_2) === "[object Set]", w = (t_2) => typeof t_2 == "function", O = (t_2) => typeof t_2 == "string", et = (t_2) => typeof t_2 == "symbol", S = (t_2) => t_2 !== null && typeof t_2 == "object", ln = (t_2) => (S(t_2) || w(t_2)) && w(t_2.then) && w(t_2.catch), Se = Object.prototype.toString, Nt = (t_2) => Se.call(t_2), cn = (t_2) => Nt(t_2).slice(8, -1), Te = (t_2) => Nt(t_2) === "[object Object]", ee = (t_2) => O(t_2) && t_2 !== "NaN" && t_2[0] !== "-" && "" + parseInt(t_2, 10) === t_2, j = (t_2, e_2) => !Object.is(t_2, e_2), ms = (t_2) => {
var e_2 = O(t_2) ? Number(t_2) : NaN;
  return isNaN(e_2) ? t_2 : e_2;
};
var pe;
var ne = () => pe || (pe = typeof globalThis < "u_2" ? globalThis : typeof self < "u_2" ? self : typeof window < "u_2" ? window : typeof global < "u_2" ? global : {});
var se =function se(t_2) {
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
var hn =function hn(t_2) {
var e_2 = {};
  return t_2.replace(un, "").split(an).forEach((n_2) => {
    if (n_2) {
var r_2 = n_2.split(fn);
      r_2.length > 1 && (e_2[r_2[0].trim()] = r_2[1].trim());
    }
  }), e_2;
}
var re =function re(t_2) {
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
var Ce =function Ce(t_2, e_2 = !1) {
  if (t_2.flags |= 8, e_2) {
    t_2.next = dt, dt = t_2;
    return;
  }
  t_2.next = ht, ht = t_2;
}
var ie =function ie() {
  xe++;
}
var oe =function oe() {
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
var Ie =function Ie(t_2) {
  for (let e_2 = t_2.deps; e_2; e_2 = e_2.nextDep)
    e_2.version = -1, e_2.prevActiveLink = e_2.dep.activeLink, e_2.dep.activeLink = e_2;
}
var Re =function Re(t_2) {
var e_2, n_2 = t_2.depsTail, r_2 = n_2;
  for (; r_2; ) {
var s_2 = r_2.prevDep;
    r_2.version === -1 ? (r_2 === n_2 && (n_2 = s_2), le(r_2), gn(r_2)) : e_2 = r_2, r_2.dep.activeLink = r_2.prevActiveLink, r_2.prevActiveLink = void 0, r_2 = s_2;
  }
  t_2.deps = e_2, t_2.depsTail = n_2;
}
var Ut =function Ut(t_2) {
  for (let e_2 = t_2.deps; e_2; e_2 = e_2.nextDep)
    if (e_2.dep.version !== e_2.version || e_2.dep.computed && (Ae(e_2.dep.computed) || e_2.dep.version !== e_2.version))
      return !0;
  return !!t_2._dirty;
}
var Ae =function Ae(t_2) {
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
var le =function le(t_2, e_2 = !1) {
var { dep: n_2, prevSub: r_2, nextSub: s_2 } = t_2;
  if (r_2 && (r_2.nextSub = s_2, t_2.prevSub = void 0), s_2 && (s_2.prevSub = r_2, t_2.nextSub = void 0), n_2.subs === t_2 && (n_2.subs = r_2, !r_2 && n_2.computed)) {
    n_2.computed.flags &= -5;
    for (let i_2 = n_2.computed.deps; i_2; i_2 = i_2.nextDep)
      le(i_2, !0);
  }
  !e_2 && !--n_2.sc && n_2.map && n_2.map.delete(n_2.key);
}
var gn =function gn(t_2) {
var { prevDep: e_2, nextDep: n_2 } = t_2;
  e_2 && (e_2.nextDep = n_2, t_2.prevDep = void 0), n_2 && (n_2.prevDep = e_2, t_2.nextDep = void 0);
}
var N = !0;
var Ee = [];
var Ot =function Ot() {
  Ee.push(N), N = !1;
}
var Dt =function Dt() {
var t_2 = Ee.pop();
  N = t_2 === void 0 ? !0 : t_2;
}
var ge =function ge(t_2) {
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
var Le =function Le(t_2) {
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
var v_2 =function v_2(t_2, e_2, n_2) {
  if (N && m) {
var r_2 = Jt.get(t_2);
    r_2 || Jt.set(t_2, r_2 = /* @__PURE__ */ new Map());
var s_2 = r_2.get(n_2);
    s_2 || (r_2.set(n_2, s_2 = new ce()), s_2.map = r_2, s_2.key = n_2), s_2.track();
  }
}
var q_2 =function q_2(t_2, e_2, n_2, r_2, s_2, i_2) {
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
var nt_2 =function nt_2(t_2) {
var e_2 = /* @__PURE__ */ _(t_2);
  return e_2 === t_2 ? e_2 : (v_2(e_2, "iterate", gt), /* @__PURE__ */ L(t_2) ? e_2 : e_2.map(D_2));
}
var Pt =function Pt(t_2) {
  return v_2(t_2 = /* @__PURE__ */ _(t_2), "iterate", gt), t_2;
}
var F =function F(t_2, e_2) {
  return /* @__PURE__ */ U(t_2) ? lt(/* @__PURE__ */ it_2(t_2) ? D_2(e_2) : e_2) : D_2(e_2);
}
var mn = {
  __proto__: null,
  [Symbol.iterator]() {
    return Ht(this, Symbol.iterator, (t_2) => F(this, t_2));
  },
  concat(...t_2) {
    return nt_2(this).concat(
      ...t_2.map((e_2) => y(e_2) ? nt_2(e_2) : e_2)
    );
  },
  entries() {
    return Ht(this, "entries", (t_2) => (t_2[1] = F(this, t_2[1]), t_2));
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
      (n_2) => n_2.map((r_2) => F(this, r_2)),
      arguments
    );
  },
  find(t_2, e_2) {
    return K(
      this,
      "find",
      t_2,
      e_2,
      (n_2) => F(this, n_2),
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
      (n_2) => F(this, n_2),
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
    return nt_2(this).join(t_2);
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
    return nt_2(this).toReversed();
  },
  toSorted(t_2) {
    return nt_2(this).toSorted(t_2);
  },
  toSpliced(...t_2) {
    return nt_2(this).toSpliced(...t_2);
  },
  unshift(...t_2) {
    return ft(this, "unshift", t_2);
  },
  values() {
    return Ht(this, "values", (t_2) => F(this, t_2));
  }
};
var Ht =function Ht(t_2, e_2, n_2) {
var r_2 = Pt(t_2), s_2 = r_2[e_2]();
  return r_2 !== t_2 && !/* @__PURE__ */ L(t_2) && (s_2._next = s_2.next, s_2.next = () => {
var i_2 = s_2._next();
    return i_2.done || (i_2.value = n_2(i_2.value)), i_2;
  }), s_2;
}
var yn = Array.prototype;
var K =function K(t_2, e_2, n_2, r_2, s_2, i_2) {
var l_2 = Pt(t_2), c_2 = l_2 !== t_2 && !/* @__PURE__ */ L(t_2), o_2 = l_2[e_2];
  if (o_2 !== yn[e_2]) {
var u_2 = o_2.apply(t_2, i_2);
    return c_2 ? D_2(u_2) : u_2;
  }
var f_2 = n_2;
  l_2 !== t_2 && (c_2 ? f_2 = function(u_2, p) {
    return n_2.call(this, F(t_2, u_2), p, t_2);
  } : n_2.length > 2 && (f_2 = function(u_2, p) {
    return n_2.call(this, u_2, p, t_2);
  }));
var a_2 = o_2.call(l_2, f_2, r_2);
  return c_2 && s_2 ? s_2(a_2) : a_2;
}
var _e =function _e(t_2, e_2, n_2, r_2) {
var s_2 = Pt(t_2), i_2 = s_2 !== t_2 && !/* @__PURE__ */ L(t_2);
var l_2 = n_2, c_2 = !1;
  s_2 !== t_2 && (i_2 ? (c_2 = r_2.length === 0, l_2 = function(f_2, a_2, u_2) {
    return c_2 && (c_2 = !1, f_2 = F(t_2, f_2)), n_2.call(this, f_2, F(t_2, a_2), u_2, t_2);
  }) : n_2.length > 3 && (l_2 = function(f_2, a_2, u_2) {
    return n_2.call(this, f_2, a_2, u_2, t_2);
  }));
var o_2 = s_2[e_2](l_2, ...r_2);
  return c_2 ? F(t_2, o_2) : o_2;
}
var Wt =function Wt(t_2, e_2, n_2) {
var r_2 = /* @__PURE__ */ _(t_2);
  v_2(r_2, "iterate", gt);
var s_2 = r_2[e_2](...n_2);
  return (s_2 === -1 || s_2 === !1) && /* @__PURE__ */ ae(n_2[0]) ? (n_2[0] = /* @__PURE__ */ _(n_2[0]), r_2[e_2](...n_2)) : s_2;
}
var ft =function ft(t_2, e_2, n_2 = []) {
  Ot(), ie();
var r_2 = (/* @__PURE__ */ _(t_2))[e_2].apply(t_2, n_2);
  return oe(), Dt(), r_2;
}
var bn = /* @__PURE__ */ en("__proto__,__v_isRef,__isVue"), Me = new Set(
  /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((t_2) => t_2 !== "arguments" && t_2 !== "caller").map((t_2) => Symbol[t_2]).filter(et)
);
var Sn =function Sn(t_2) {
  et(t_2) || (t_2 = String(t_2));
var e_2 = /* @__PURE__ */ _(this);
  return v_2(e_2, "has", t_2), e_2.hasOwnProperty(t_2);
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
      /* @__PURE__ */ H_2(e_2) ? e_2 : r_2
    );
    if ((et(n_2) ? Me.has(n_2) : bn(n_2)) || (s_2 || v_2(e_2, "get", n_2), i_2))
      return c_2;
    if (/* @__PURE__ */ H_2(c_2)) {
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
      if (!/* @__PURE__ */ L(r_2) && !/* @__PURE__ */ U(r_2) && (i_2 = /* @__PURE__ */ _(i_2), r_2 = /* @__PURE__ */ _(r_2)), !l_2 && /* @__PURE__ */ H_2(i_2) && !/* @__PURE__ */ H_2(r_2))
        return f_2 || (i_2.value = r_2), !0;
    }
var c_2 = l_2 ? Number(n_2) < e_2.length : zt(e_2, n_2), o_2 = Reflect.set(
      e_2,
      n_2,
      r_2,
      /* @__PURE__ */ H_2(e_2) ? e_2 : s_2
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
    return (!et(n_2) || !Me.has(n_2)) && v_2(e_2, "has", n_2), r_2;
  }
  ownKeys(e_2) {
    return v_2(
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
var Cn =function Cn(t_2, e_2, n_2) {
  return function(...r_2) {
var s_2 = this.__v_raw, i_2 = /* @__PURE__ */ _(s_2), l_2 = rt(i_2), c_2 = t_2 === "entries" || t_2 === Symbol.iterator && l_2, o_2 = t_2 === "keys" && l_2, f_2 = s_2[t_2](...r_2), a_2 = n_2 ? qt : e_2 ? lt : D_2;
    return !e_2 && v_2(
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
var wt =function wt(t_2) {
  return function(...e_2) {
    return t_2 === "delete" ? !1 : t_2 === "clear" ? void 0 : this;
  };
}
var In =function In(t_2, e_2) {
var n_2 = {
    get(s_2) {
var i_2 = this.__v_raw, l_2 = /* @__PURE__ */ _(i_2), c_2 = /* @__PURE__ */ _(s_2);
      t_2 || (j(s_2, c_2) && v_2(l_2, "get", s_2), v_2(l_2, "get", c_2));
var { has: o_2 } = vt(l_2), f_2 = e_2 ? qt : t_2 ? lt : D_2;
      if (o_2.call(l_2, s_2))
        return f_2(i_2.get(s_2));
      if (o_2.call(l_2, c_2))
        return f_2(i_2.get(c_2));
      i_2 !== l_2 && i_2.get(s_2);
    },
    get size() {
var s_2 = this.__v_raw;
      return !t_2 && v_2(/* @__PURE__ */ _(s_2), "iterate", tt), s_2.size;
    },
    has(s_2) {
var i_2 = this.__v_raw, l_2 = /* @__PURE__ */ _(i_2), c_2 = /* @__PURE__ */ _(s_2);
      return t_2 || (j(s_2, c_2) && v_2(l_2, "has", s_2), v_2(l_2, "has", c_2)), s_2 === c_2 ? i_2.has(s_2) : i_2.has(s_2) || i_2.has(c_2);
    },
    forEach(s_2, i_2) {
var l_2 = this, c_2 = l_2.__v_raw, o_2 = /* @__PURE__ */ _(c_2), f_2 = e_2 ? qt : t_2 ? lt : D_2;
      return !t_2 && v_2(o_2, "iterate", tt), c_2.forEach((a_2, u_2) => s_2.call(i_2, f_2(a_2), f_2(u_2), l_2));
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
var Oe =function Oe(t_2, e_2) {
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
var Mn =function Mn(t_2) {
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
var Fe =function Fe(t_2) {
  return /* @__PURE__ */ U(t_2) ? t_2 : je(
    t_2,
    !1,
    wn,
    Rn,
    De
  );
}
// @__NO_SIDE_EFFECTS__
var Yt =function Yt(t_2) {
  return je(
    t_2,
    !0,
    xn,
    An,
    Pe
  );
}
var je =function je(t_2, e_2, n_2, r_2, s_2) {
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
var it_2 =function it_2(t_2) {
  return /* @__PURE__ */ U(t_2) ? /* @__PURE__ */ it_2(t_2.__v_raw) : !!(t_2 && t_2.__v_isReactive);
}
// @__NO_SIDE_EFFECTS__
var U =function U(t_2) {
  return !!(t_2 && t_2.__v_isReadonly);
}
// @__NO_SIDE_EFFECTS__
var L =function L(t_2) {
  return !!(t_2 && t_2.__v_isShallow);
}
// @__NO_SIDE_EFFECTS__
var ae =function ae(t_2) {
  return t_2 ? !!t_2.__v_raw : !1;
}
// @__NO_SIDE_EFFECTS__
var _ =function _(t_2) {
var e_2 = t_2 && t_2.__v_raw;
  return e_2 ? /* @__PURE__ */ _(e_2) : t_2;
}
var D_2 = (t_2) => S(t_2) ? /* @__PURE__ */ Fe(t_2) : t_2, lt = (t_2) => S(t_2) ? /* @__PURE__ */ Yt(t_2) : t_2;
// @__NO_SIDE_EFFECTS__
var H_2 =function H_2(t_2) {
  return t_2 ? t_2.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
var ys =function ys(t_2) {
  return Nn(t_2, !1);
}
var Nn =function Nn(t_2, e_2) {
  return /* @__PURE__ */ H_2(t_2) ? t_2 : new On(t_2, e_2);
}
var On = class  {
  constructor(e_2, n_2) {
    this.dep = new ce(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = n_2 ? e_2 : /* @__PURE__ */ _(e_2), this._value = n_2 ? e_2 : D_2(e_2), this.__v_isShallow = n_2;
  }
  get value() {
    return this.dep.track(), this._value;
  }
  set value(e_2) {
var n_2 = this._rawValue, r_2 = this.__v_isShallow || /* @__PURE__ */ L(e_2) || /* @__PURE__ */ U(e_2);
    e_2 = r_2 ? e_2 : /* @__PURE__ */ _(e_2), j(e_2, n_2) && (this._rawValue = e_2, this._value = r_2 ? e_2 : D_2(e_2), this.dep.trigger());
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
var Pn =function Pn(t_2, e_2, n_2 = !1) {
var r_2, s_2;
  return w(t_2) ? r_2 = t_2 : (r_2 = t_2.get, s_2 = t_2.set), new Dn(r_2, s_2, n_2);
}
var xt = {}, At = /* @__PURE__ */ new WeakMap();

var Fn =function Fn(t_2, e_2 = !1, n_2 = X) {
  if (n_2) {
var r_2 = At.get(n_2);
    r_2 || At.set(n_2, r_2 = []), r_2.push(t_2);
  }
}
var jn =function jn(t_2, e_2, n_2 = te) {
var { immediate: r_2, deep: s_2, once: i_2, scheduler: l_2, augmentJob: c_2, call: o_2 } = n_2, f_2 = (h_2) => s_2 ? h_2 : /* @__PURE__ */ L(h_2) || s_2 === !1 || s_2 === 0 ? Y(h_2, 1) : Y(h_2);
var a_2, u_2, p, g_2, I = !1, P_2 = !1;
  if (/* @__PURE__ */ H_2(t_2) ? (u_2 = () => t_2.value, I = /* @__PURE__ */ L(t_2)) : /* @__PURE__ */ it_2(t_2) ? (u_2 = () => f_2(t_2), I = !0) : y(t_2) ? (P_2 = !0, I = t_2.some((h_2) => /* @__PURE__ */ it_2(h_2) || /* @__PURE__ */ L(h_2)), u_2 = () => t_2.map((h_2) => {
    if (/* @__PURE__ */ H_2(h_2))
      return h_2.value;
    if (/* @__PURE__ */ it_2(h_2))
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
var h_2 = u_2, x_2 = s_2 === !0 ? 1 / 0 : s_2;
    u_2 = () => Y(h_2(), x_2);
  }
var J = () => {
    a_2.stop();
  };
  if (i_2 && e_2) {
var h_2 = e_2;
    e_2 = (...x_2) => {
var M_2 = h_2(...x_2);
      return J(), M_2;
    };
  }
var W = P_2 ? new Array(t_2.length).fill(xt) : xt;
var G = (h_2) => {
    if (!(!(a_2.flags & 1) || !a_2.dirty && !h_2))
      if (e_2) {
var x_2 = a_2.run();
        if (h_2 || s_2 || I || (P_2 ? x_2.some((M_2, R) => j(M_2, W[R])) : j(x_2, W))) {
          p && p();
var M_2 = X;
          X = a_2;
          try {
var R = [
              x_2,
              // pass undefined as the old value when it_2's_2 changed for the first time
              W === xt ? void 0 : P_2 && W[0] === xt ? [] : W,
              g_2
            ];
            W = x_2, o_2 ? o_2(e_2, 3, R) : (
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
        for (const x_2 of h_2) x_2();
      At.delete(a_2);
    }
  }, e_2 ? r_2 ? G(!0) : W = a_2.run() : l_2 ? l_2(G.bind(null, !0), !0) : a_2.run(), J.pause = a_2.pause.bind(a_2), J.resume = a_2.resume.bind(a_2), J.stop = J, J;
}
var Y =function Y(t_2, e_2 = 1 / 0, n_2) {
  if (e_2 <= 0 || !S(t_2) || t_2.__v_skip || (n_2 = n_2 || /* @__PURE__ */ new Map(), (n_2.get(t_2) || 0) >= e_2))
    return t_2;
  if (n_2.set(t_2, e_2), e_2--, /* @__PURE__ */ H_2(t_2))
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
var fe =function fe(t_2, e_2, n_2, r_2) {
  try {
    return r_2 ? t_2(...r_2) : t_2();
  } catch (s_2) {
    Ve(s_2, e_2, n_2);
  }
}
var Ft =function Ft(t_2, e_2, n_2, r_2) {
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
var Ve =function Ve(t_2, e_2, n_2, r_2 = !0) {
var s_2 = e_2 ? e_2.vnode : null, { errorHandler: i_2, throwUnhandledErrorInProduction: l_2 } = e_2 && e_2.appContext.config || te;
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
var Vn =function Vn(t_2, e_2, n_2, r_2 = !0, s_2 = !1) {
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
var Hn =function Hn(t_2) {
var e_2 = k + 1, n_2 = E.length;
  for (; e_2 < n_2; ) {
var r_2 = e_2 + n_2 >>> 1, s_2 = E[r_2], i_2 = _t(s_2);
    i_2 < t_2 || i_2 === t_2 && s_2.flags & 2 ? e_2 = r_2 + 1 : n_2 = r_2;
  }
  return e_2;
}
var Wn =function Wn(t_2) {
  if (!(t_2.flags & 1)) {
var e_2 = _t(t_2), n_2 = E[E.length - 1];
    !n_2 || // fast path when the job id is larger than the tail
    !(t_2.flags & 2) && e_2 >= _t(n_2) ? E.push(t_2) : E.splice(Hn(e_2), 0, t_2), t_2.flags |= 1, Be();
  }
}
var Be =function Be() {
  Gt || (Gt = Bn.then(He));
}
var Kn =function Kn(t_2) {
  y(t_2) ? ot.push(...t_2) : $ && t_2.id === -1 ? $.splice(st + 1, 0, t_2) : t_2.flags & 1 || (ot.push(t_2), t_2.flags |= 1), Be();
}
var kn =function kn(t_2) {
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
var He =function He(t_2) {
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
var me =function me(t_2) {
var e_2 = B;
  return B = t_2, We = t_2 && t_2.type.__scopeId || null, e_2;
}
var bs =function bs(t_2, e_2 = B, n_2) {
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
var zn =function zn(t_2, e_2, n_2 = !1) {
var r_2 = Ze();
  if (r_2 || es) {
var s_2 = r_2 ? r_2.parent == null || r_2.ce ? r_2.vnode.appContext && r_2.vnode.appContext.provides : r_2.parent.provides : void 0;
    if (s_2 && t_2 in s_2)
      return s_2[t_2];
    if (arguments.length > 1)
      return n_2 && w(e_2) ? e_2.call(r_2 && r_2.proxy) : e_2;
  }
}
var Un = /* @__PURE__ */ Symbol.for("v_2-scx"), Jn = () => zn(Un);
var Ss =function Ss(t_2, e_2, n_2) {
  return $n_2(t_2, e_2, n_2);
}
var $n_2 =function $n_2(t_2, e_2, n_2 = te) {
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
  c_2.call = (g_2, I, P_2) => Ft(g_2, a_2, I, P_2);
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
var qn =function qn() {
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
        // as regular v_2-if branches, which render a_2 comment placeholder.
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
var P_2 = Ue(
            r_2,
            a_2
          );
          P_2[String(a_2.key)] = a_2, p[z] = () => {
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
var ze =function ze(t_2) {
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
var Ue =function Ue(t_2, e_2) {
var { leavingVNodes: n_2 } = t_2;
var r_2 = n_2.get(e_2.type);
  return r_2 || (r_2 = /* @__PURE__ */ Object.create(null), n_2.set(e_2.type, r_2)), r_2;
}
var Qt =function Qt(t_2, e_2, n_2, r_2, s_2) {
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
    onLeaveCancelled: P_2,
    onBeforeAppear: J,
    onAppear: W,
    onAfterAppear: G,
    onAppearCancelled: h_2
  } = e_2, x_2 = String(t_2.key), M_2 = Ue(n_2, t_2), R = (d, b_2) => {
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
var T_2 = M_2[x_2];
      T_2 && Ge(t_2, T_2) && T_2.el[z] && T_2.el[z](), R(b_2, [d]);
    },
    enter(d) {
      if (M_2[x_2] === t_2) return;
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
        Q || (Q = !0, b_2(), Tt ? R(P_2, [d]) : R(I, [d]), d[z] = void 0, M_2[T_2] === t_2 && delete M_2[T_2]);
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
var Kt =function Kt(t_2) {
  if ($e_2(t_2))
    return t_2 = yt(t_2), t_2.children = null, t_2;
}
var ye =function ye(t_2) {
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
var Et =function Et(t_2, e_2) {
  t_2.shapeFlag & 6 && t_2.component ? (t_2.transition = e_2, Et(t_2.component.subTree, e_2)) : t_2.shapeFlag & 128 ? (t_2.ssContent.transition = e_2.clone(t_2.ssContent), t_2.ssFallback.transition = e_2.clone(t_2.ssFallback)) : t_2.transition = e_2;
}
var Je =function Je(t_2, e_2 = !1, n_2) {
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
var Qn =function Qn(t_2, e_2, n_2 = ct, r_2 = !1) {
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
), vs = ue("um"), ts = /* @__PURE__ */ Symbol.for("v_2-ndc");
var ws =function ws(t_2, e_2, n_2, r_2) {
var s_2;
var i_2 = n_2, l_2 = y(t_2);
  if (l_2 || O(t_2)) {
var c_2 = l_2 && /* @__PURE__ */ it_2(t_2);
var o_2 = !1, f_2 = !1;
    c_2 && (o_2 = !/* @__PURE__ */ L(t_2), f_2 = /* @__PURE__ */ U(t_2), t_2 = Pt(t_2)), s_2 = new Array(t_2.length);
    for (let a_2 = 0, u_2 = t_2.length; a_2 < u_2; a_2++)
      s_2[a_2] = e_2(
        o_2 ? f_2 ? lt(D_2(t_2[a_2])) : D_2(t_2[a_2]) : t_2[a_2],
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
var is =function is(t_2, e_2) {
  e_2 && e_2.pendingBranch ? y(t_2) ? e_2.effects.push(...t_2) : e_2.effects.push(t_2) : Kn(t_2);
}
var he = /* @__PURE__ */ Symbol.for("v_2-fgt"), os = /* @__PURE__ */ Symbol.for("v_2-txt"), V = /* @__PURE__ */ Symbol.for("v_2-cmt"), It = [];
var C_2 = null;
var ls =function ls(t_2 = !1) {
  It.push(C_2 = t_2 ? null : []);
}
var cs =function cs() {
  It.pop(), C_2 = It[It.length - 1] || null;
}
var mt = 1;
var Lt =function Lt(t_2, e_2 = !1) {
  mt += t_2, t_2 < 0 && C_2 && e_2 && (C_2.hasOnce = !0);
}
var Ye =function Ye(t_2) {
  return t_2.dynamicChildren = mt > 0 ? C_2 || nn : null, cs(), mt > 0 && C_2 && C_2.push(t_2), t_2;
}
var xs =function xs(t_2, e_2, n_2, r_2, s_2, i_2) {
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
var as =function as(t_2, e_2, n_2, r_2, s_2) {
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
var Xt =function Xt(t_2) {
  return t_2 ? t_2.__v_isVNode === !0 : !1;
}
var Ge =function Ge(t_2, e_2) {
  return t_2.type === e_2.type && t_2.key === e_2.key;
}
var Qe = ({ key: t_2 }) => t_2 ?? null, Rt = ({
  ref: t_2,
  ref_key: e_2,
  ref_for: n_2
}) => (typeof t_2 == "number" && (t_2 = "" + t_2), t_2 != null ? O(t_2) || /* @__PURE__ */ H_2(t_2) || w(t_2) ? { i_2: B, r_2: t_2, k: e_2, f_2: !!n_2 } : t_2 : null);
var Xe =function Xe(t_2, e_2 = null, n_2 = null, r_2 = 0, s_2 = null, i_2 = t_2 === he ? 0 : 1, l_2 = !1, c_2 = !1) {
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
  C_2 && // presence of a_2 patch flag indicates this node needs patching on updates.
  // component nodes also should always be patched, because even if the
  // component doesn't_2 need to update, it_2 needs to persist the instance on to
  // the next vnode so that it_2 can be properly unmounted later.
  (o_2.patchFlag > 0 || i_2 & 6) && // the EVENTS flag is only for hydration and if it_2 is the only flag, the
  // vnode should not be considered dynamic due to handler caching.
  o_2.patchFlag !== 32 && C_2.push(o_2), o_2;
}
var Z = fs;
var fs =function fs(t_2, e_2 = null, n_2 = null, r_2 = 0, s_2 = null, i_2 = !1) {
  if ((!t_2 || t_2 === ts) && (t_2 = V), Xt(t_2)) {
var c_2 = yt(
      t_2,
      e_2,
      !0
      /* mergeRef: true */
    );
    return n_2 && Mt(c_2, n_2), mt > 0 && !i_2 && C_2 && (c_2.shapeFlag & 6 ? C_2[C_2.indexOf(t_2)] = c_2 : C_2.push(c_2)), c_2.patchFlag = -2, c_2;
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
var us =function us(t_2) {
  return t_2 ? /* @__PURE__ */ ae(t_2) || qe(t_2) ? St({}, t_2) : t_2 : null;
}
var yt =function yt(t_2, e_2, n_2 = !1, r_2 = !1) {
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
var hs =function hs(t_2 = " ", e_2 = 0) {
  return Z(os, null, t_2, e_2);
}
var ds =function ds(t_2 = "", e_2 = !1) {
  return e_2 ? (ls(), as(V, null, t_2)) : Z(V, null, t_2);
}
var Mt =function Mt(t_2, e_2) {
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
var ps =function ps(...t_2) {
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
var _s =function _s(t_2) {
  return w(t_2) && "__vccOpts" in t_2;
}
var kt = (t_2, e_2) => /* @__PURE__ */ Pn(t_2, e_2, bt);
var Cs =function Cs(t_2, e_2, n_2) {
  try {
    Lt(-1);
var r_2 = arguments.length;
    return r_2 === 2 ? S(e_2) && !y(e_2) ? Xt(e_2) ? Z(t_2, null, [e_2]) : Z(t_2, e_2) : Z(t_2, null, e_2) : (r_2 > 3 ? n_2 = Array.prototype.slice.call(arguments, 2) : r_2 === 3 && Xt(n_2) && (n_2 = [n_2]), Z(t_2, e_2, n_2));
  } finally {
    Lt(1);
  }
}
var Is =function Is(t_2, e_2 = {}) {
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
  var i_2 =function i_2() {
var o_2 = t_2.coverColor;
    return typeof o_2 == "string" ? { primary: o_2, average: o_2 } : o_2 && typeof o_2 == "object" ? { primary: o_2.primary || "#ffffff", average: o_2.average || o_2.primary || "#ffffff" } : { primary: "#ffffff", average: "#ffffff" };
  }
  var l_2 =function l_2() {
    return {
      isInClimax: !!t_2.isClimax,
      segments: t_2.climaxSegments || [],
      energy: t_2.energy ?? 0,
      isBeat: !!t_2.isBeat,
      kickEnergy: t_2.kickEnergy ?? 0,
      bpm: t_2.bpm ?? 120
    };
  }
  var c_2 =function c_2(o_2, f_2) {
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
var Rs =function Rs(t_2, e_2) {
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
__sh_lyricAdapter_DacD9jKh_js.B=Yn;__sh_lyricAdapter_DacD9jKh_js.F=he;__sh_lyricAdapter_DacD9jKh_js.a_2=vs;__sh_lyricAdapter_DacD9jKh_js.b_2=xs;__sh_lyricAdapter_DacD9jKh_js.c_2=Is;__sh_lyricAdapter_DacD9jKh_js.d=Xe;__sh_lyricAdapter_DacD9jKh_js.e_2=ys;__sh_lyricAdapter_DacD9jKh_js.f_2=kt;__sh_lyricAdapter_DacD9jKh_js.g_2=ls;__sh_lyricAdapter_DacD9jKh_js.h_2=Z;__sh_lyricAdapter_DacD9jKh_js.i_2=bs;__sh_lyricAdapter_DacD9jKh_js.j=ds;__sh_lyricAdapter_DacD9jKh_js.k=re;__sh_lyricAdapter_DacD9jKh_js.l_2=St;__sh_lyricAdapter_DacD9jKh_js.m=Cs;__sh_lyricAdapter_DacD9jKh_js.n_2=se;__sh_lyricAdapter_DacD9jKh_js.o_2=Xn;__sh_lyricAdapter_DacD9jKh_js.p=Ts;__sh_lyricAdapter_DacD9jKh_js.q_2=S;__sh_lyricAdapter_DacD9jKh_js.r_2=ws;__sh_lyricAdapter_DacD9jKh_js.s_2=y;__sh_lyricAdapter_DacD9jKh_js.t_2=dn;__sh_lyricAdapter_DacD9jKh_js.u_2=ms;__sh_lyricAdapter_DacD9jKh_js.w=Ss;__sh_lyricAdapter_DacD9jKh_js.z=Rs;

/**
* @vue/runtime-dom v3.5.39
* (c_2) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
var nt_2;
var M_2 = typeof window < "u_2" && window.trustedTypes;
if (M_2)
  try {
    nt_2 = /* @__PURE__ */ M_2.createPolicy("vue", {
      createHTML: (t_2) => t_2
    });
  } catch {
  }
var d = "transition", E = "animation", A = /* @__PURE__ */ Symbol("_vtc"), R = {
  name: String,
  type: String,
  css: {
    type: Boolean,
    default: !0
  },
  duration: [String, Number, Object],
  enterFromClass: String,
  enterActiveClass: String,
  enterToClass: String,
  appearFromClass: String,
  appearActiveClass: String,
  appearToClass: String,
  leaveFromClass: String,
  leaveActiveClass: String,
  leaveToClass: String
}, et = /* @__PURE__ */ j(
  {},
  W,
  R
), ot = (t_2) => (t_2.displayName = "Transition", t_2.props = et, t_2), lt = /* @__PURE__ */ ot(
  (t_2, { slots: e_2 }) => X(Y, st(t_2), e_2)
), g_2 = (t_2, e_2 = []) => {
  z(t_2) ? t_2.forEach((o_2) => o_2(...e_2)) : t_2 && t_2(...e_2);
}, O = (t_2) => t_2 ? z(t_2) ? t_2.some((e_2) => e_2.length > 1) : t_2.length > 1 : !1;
var st=function st(t_2) {
var e_2 = {};
  for (const n_2 in t_2)
    n_2 in R || (e_2[n_2] = t_2[n_2]);
  if (t_2.css === !1)
    return e_2;
var {
    name: o_2 = "v_2",
    type: s_2,
    duration: h_2,
    enterFromClass: u_2 = `${o_2}-enter-from`,
    enterActiveClass: c_2 = `${o_2}-enter-active`,
    enterToClass: p = `${o_2}-enter-to`,
    appearFromClass: m = u_2,
    appearActiveClass: f_2 = c_2,
    appearToClass: r_2 = p,
    leaveFromClass: i_2 = `${o_2}-leave-from`,
    leaveActiveClass: l_2 = `${o_2}-leave-active`,
    leaveToClass: y = `${o_2}-leave-to`
  } = t_2, S = rt(h_2), K = S && S[0], k = S && S[1], {
    onBeforeEnter: b_2,
    onEnter: N,
    onEnterCancelled: F,
    onLeave: I,
    onLeaveCancelled: G,
    onBeforeAppear: J = b_2,
    onAppear: Q = N,
    onAppearCancelled: U = F
  } = e_2, L = (n_2, a_2, C_2, D_2) => {
    n_2._enterCancelled = D_2, T_2(n_2, a_2 ? r_2 : p), T_2(n_2, a_2 ? f_2 : c_2), C_2 && C_2();
  }, _ = (n_2, a_2) => {
    n_2._isLeaving = !1, T_2(n_2, i_2), T_2(n_2, y), T_2(n_2, l_2), a_2 && a_2();
  }, w = (n_2) => (a_2, C_2) => {
var D_2 = n_2 ? Q : N, B = () => L(a_2, n_2, C_2);
    g_2(D_2, [a_2, B]), P_2(() => {
      T_2(a_2, n_2 ? m : u_2), v_2(a_2, n_2 ? r_2 : p), O(D_2) || x_2(a_2, s_2, K, B);
    });
  };
  return j(e_2, {
    onBeforeEnter(n_2) {
      g_2(b_2, [n_2]), v_2(n_2, u_2), v_2(n_2, c_2);
    },
    onBeforeAppear(n_2) {
      g_2(J, [n_2]), v_2(n_2, m), v_2(n_2, f_2);
    },
    onEnter: w(!1),
    onAppear: w(!0),
    onLeave(n_2, a_2) {
      n_2._isLeaving = !0;
var C_2 = () => _(n_2, a_2);
      v_2(n_2, i_2), n_2._enterCancelled ? (v_2(n_2, l_2), V(n_2)) : (V(n_2), v_2(n_2, l_2)), P_2(() => {
        n_2._isLeaving && (T_2(n_2, i_2), v_2(n_2, y), O(I) || x_2(n_2, s_2, k, C_2));
      }), g_2(I, [n_2, C_2]);
    },
    onEnterCancelled(n_2) {
      L(n_2, !1, void 0, !0), g_2(F, [n_2]);
    },
    onAppearCancelled(n_2) {
      L(n_2, !0, void 0, !0), g_2(U, [n_2]);
    },
    onLeaveCancelled(n_2) {
      _(n_2), g_2(G, [n_2]);
    }
  });
}
var rt=function rt(t_2) {
  if (t_2 == null)
    return null;
  if (Z(t_2))
    return [$(t_2.enter), $(t_2.leave)];
  {
var e_2 = $(t_2);
    return [e_2, e_2];
  }
}
var $=function $(t_2) {
  return tt(t_2);
}
var v_2=function v_2(t_2, e_2) {
  e_2.split(/\s_2+/).forEach((o_2) => o_2 && t_2.classList.add(o_2)), (t_2[A] || (t_2[A] = /* @__PURE__ */ new Set())).add(e_2);
}
var T_2=function T_2(t_2, e_2) {
  e_2.split(/\s_2+/).forEach((s_2) => s_2 && t_2.classList.remove(s_2));
var o_2 = t_2[A];
  o_2 && (o_2.delete(e_2), o_2.size || (t_2[A] = void 0));
}
var P_2=function P_2(t_2) {
  requestAnimationFrame(() => {
    requestAnimationFrame(t_2);
  });
}
var at_2 = 0;
var x_2=function x_2(t_2, e_2, o_2, s_2) {
var h_2 = t_2._endId = ++at_2, u_2 = () => {
    h_2 === t_2._endId && s_2();
  };
  if (o_2 != null)
    return setTimeout(u_2, o_2);
var { type: c_2, timeout: p, propCount: m } = it_2(t_2, e_2);
  if (!c_2)
    return s_2();
var f_2 = c_2 + "end";
var r_2 = 0;
var i_2 = () => {
    t_2.removeEventListener(f_2, l_2), u_2();
  }, l_2 = (y) => {
    y.target === t_2 && ++r_2 >= m && i_2();
  };
  setTimeout(() => {
    r_2 < m && i_2();
  }, p + 1), t_2.addEventListener(f_2, l_2);
}
var it_2=function it_2(t_2, e_2) {
var o_2 = window.getComputedStyle(t_2), s_2 = (S) => (o_2[S] || "").split(", "), h_2 = s_2(`${d}Delay`), u_2 = s_2(`${d}Duration`), c_2 = H_2(h_2, u_2), p = s_2(`${E}Delay`), m = s_2(`${E}Duration`), f_2 = H_2(p, m);
var r_2 = null, i_2 = 0, l_2 = 0;
  e_2 === d ? c_2 > 0 && (r_2 = d, i_2 = c_2, l_2 = u_2.length) : e_2 === E ? f_2 > 0 && (r_2 = E, i_2 = f_2, l_2 = m.length) : (i_2 = Math.max(c_2, f_2), r_2 = i_2 > 0 ? c_2 > f_2 ? d : E : null, l_2 = r_2 ? r_2 === d ? u_2.length : m.length : 0);
var y = r_2 === d && /\b_2(?:transform|all)(?:,|$)/.test(
    s_2(`${d}Property`).toString()
  );
  return {
    type: r_2,
    timeout: i_2,
    propCount: l_2,
    hasTransform: y
  };
}
var H_2=function H_2(t_2, e_2) {
  for (; t_2.length < e_2.length; )
    t_2 = t_2.concat(t_2);
  return Math.max(...e_2.map((o_2, s_2) => q_2(o_2) + q_2(t_2[s_2])));
}
var q_2=function q_2(t_2) {
  return t_2 === "auto" ? 0 : Number(t_2.slice(0, -1).replace(",", ".")) * 1e3;
}
var V=function V(t_2) {
  return (t_2 ? t_2.ownerDocument : document).body.offsetHeight;
}
__sh_runtime_dom_esm_bundler_BpCzq7Ba_js.T_2=lt;

var __sh_lyricAdapter_DacD9jKh_js={};

/**
* @vue/shared v3.5.39
* (c_12) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
// @__NO_SIDE_EFFECTS__
var en_2=function en_2(t_5) {
var e_28 = /* @__PURE__ */ Object.create(null);
  for (const n_14 of t_5.split(",")) e_28[n_14] = 1;
  return (n_14) => n_14 in e_28;
}
var te_2 = {}, nn = [], Ct = () => {
}, sn = (t_5) => t_5.charCodeAt(0) === 111 && t_5.charCodeAt(1) === 110 && // uppercase letter
(t_5.charCodeAt(2) > 122 || t_5.charCodeAt(2) < 97), rn = (t_5) => t_5.startsWith("onUpdate:"), St = Object.assign, on = Object.prototype.hasOwnProperty, zt = (t_5, e_28) => on.call(t_5, e_28), y = Array.isArray, rt = (t_5) => Nt(t_5) === "[object Map]", be = (t_5) => Nt(t_5) === "[object Set]", w = (t_5) => typeof t_5 == "function", O = (t_5) => typeof t_5 == "string", et = (t_5) => typeof t_5 == "symbol", S = (t_5) => t_5 !== null && typeof t_5 == "object", ln = (t_5) => (S(t_5) || w(t_5)) && w(t_5.then) && w(t_5.catch), Se = Object.prototype.toString, Nt = (t_5) => Se.call(t_5), cn = (t_5) => Nt(t_5).slice(8, -1), Te = (t_5) => Nt(t_5) === "[object Object]", ee = (t_5) => O(t_5) && t_5 !== "NaN" && t_5[0] !== "-" && "" + parseInt(t_5, 10) === t_5, j = (t_5, e_28) => !Object.is_2(t_5, e_28), ms = (t_5) => {
var e_28 = O(t_5) ? Number(t_5) : NaN;
  return isNaN(e_28) ? t_5 : e_28;
};
var pe_2;
var ne_2 = () => pe_2 || (pe_2 = typeof globalThis < "u_5" ? globalThis : typeof self < "u_5" ? self : typeof window < "u_5" ? window : typeof global < "u_5" ? global : {});
var se_2=function se_2(t_5) {
  if (y(t_5)) {
var e_28 = {};
    for (let n_14 = 0; n_14 < t_5.length; n_14++) {
var r_22 = t_5[n_14], s_22 = O(r_22) ? hn_2(r_22) : se_2(r_22);
      if (s_22)
        for (const i_13 in s_22)
          e_28[i_13] = s_22[i_13];
    }
    return e_28;
  } else if (O(t_5) || S(t_5))
    return t_5;
}
var an_2 = /;(?![^(]*\))/g_3, fn = /:([^]+)/, un = /\/\*[^]*?\*\//g_3;
var hn_2=function hn_2(t_5) {
var e_28 = {};
  return t_5.replace(un, "").split(an_2).forEach((n_14) => {
    if (n_14) {
var r_22 = n_14.split(fn);
      r_22.length > 1 && (e_28[r_22[0].trim()] = r_22[1].trim());
    }
  }), e_28;
}
var re_2=function re_2(t_5) {
var e_28 = "";
  if (O(t_5))
    e_28 = t_5;
  else if (y(t_5))
    for (let n_14 = 0; n_14 < t_5.length; n_14++) {
var r_22 = re_2(t_5[n_14]);
      r_22 && (e_28 += r_22 + " ");
    }
  else if (S(t_5))
    for (const n_14 in t_5)
      t_5[n_14] && (e_28 += n_14 + " ");
  return e_28.trim();
}
var ve_2 = (t_5) => !!(t_5 && t_5.__v_isRef === !0), dn = (t_5) => O(t_5) ? t_5 : t_5 == null ? "" : y(t_5) || S(t_5) && (t_5.toString === Se || !w(t_5.toString)) ? ve_2(t_5) ? dn(t_5.value) : JSON.stringify(t_5, we, 2) : String(t_5), we = (t_5, e_28) => ve_2(e_28) ? we(t_5, e_28.value) : rt(e_28) ? {
  [`Map(${e_28.size})`]: [...e_28.entries()].reduce(
    (n_14, [r_22, s_22], i_13) => (n_14[Vt(r_22, i_13) + " =>"] = s_22, n_14),
    {}
  )
} : be(e_28) ? {
  [`Set(${e_28.size})`]: [...e_28.values()].map((n_14) => Vt(n_14))
} : et(e_28) ? Vt(e_28) : S(e_28) && !y(e_28) && !Te(e_28) ? String(e_28) : e_28, Vt = (t_5, e_28 = "") => {
  var n_14;
  return (
    // Symbol.description in es2019+ so we need to cast here to pass
    // the lib: es2016 check
    et(t_5) ? `Symbol(${(n_14 = t_5.description) != null ? n_14 : e_28})` : t_5
  );
};
/**
* @vue/reactivity v3.5.39
* (c_12) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
var m_2;
var Bt_2 = /* @__PURE__ */ new WeakSet();
var pn_2 = class  {
  constructor(e_28) {
    this.fn = e_28, this.deps = void 0, this.depsTail = void 0, this.flags = 5, this.next = void 0, this.cleanup = void 0, this.scheduler = void 0;
  }
  pause() {
    this.flags |= 64;
  }
  resume() {
    this.flags & 64 && (this.flags &= -65, Bt_2.has(this) && (Bt_2.delete(this), this.trigger()));
  }
  /**
   * @internal
   */
  notify() {
    this.flags & 2 && !(this.flags & 32) || this.flags & 8 || Ce_2(this);
  }
  run() {
    if (!(this.flags & 1))
      return this.fn();
    this.flags |= 2, ge_2(this), Ie_2(this);
var e_28 = m_2, n_14 = N_2;
    m_2 = this, N_2 = !0;
    try {
      return this.fn();
    } finally {
      Re_2(this), m_2 = e_28, N_2 = n_14, this.flags &= -3;
    }
  }
  stop() {
    if (this.flags & 1) {
      for (let e_28 = this.deps; e_28; e_28 = e_28.nextDep)
        le_2(e_28);
      this.deps = this.depsTail = void 0, ge_2(this), this.onStop && this.onStop(), this.flags &= -2;
    }
  }
  trigger() {
    this.flags & 64 ? Bt_2.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
  }
  /**
   * @internal
   */
  runIfDirty() {
    Ut_2(this) && this.run();
  }
  get dirty() {
    return Ut_2(this);
  }
}
var xe_2 = 0, ht, dt;
var Ce_2=function Ce_2(t_5, e_28 = !1) {
  if (t_5.flags |= 8, e_28) {
    t_5.next = dt, dt = t_5;
    return;
  }
  t_5.next = ht, ht = t_5;
}
var ie_2=function ie_2() {
  xe_2++;
}
var oe_2=function oe_2() {
  if (--xe_2 > 0)
    return;
  if (dt) {
var e_28 = dt;
    for (dt = void 0; e_28; ) {
var n_14 = e_28.next;
      e_28.next = void 0, e_28.flags &= -9, e_28 = n_14;
    }
  }
var t_5;
  for (; ht; ) {
var e_28 = ht;
    for (ht = void 0; e_28; ) {
var n_14 = e_28.next;
      if (e_28.next = void 0, e_28.flags &= -9, e_28.flags & 1)
        try {
          e_28.trigger();
        } catch (r_22) {
          t_5 || (t_5 = r_22);
        }
      e_28 = n_14;
    }
  }
  if (t_5) throw t_5;
}
var Ie_2=function Ie_2(t_5) {
  for (let e_28 = t_5.deps; e_28; e_28 = e_28.nextDep)
    e_28.version = -1, e_28.prevActiveLink = e_28.dep.activeLink, e_28.dep.activeLink = e_28;
}
var Re_2=function Re_2(t_5) {
var e_28, n_14 = t_5.depsTail, r_22 = n_14;
  for (; r_22; ) {
var s_22 = r_22.prevDep;
    r_22.version === -1 ? (r_22 === n_14 && (n_14 = s_22), le_2(r_22), gn_2(r_22)) : e_28 = r_22, r_22.dep.activeLink = r_22.prevActiveLink, r_22.prevActiveLink = void 0, r_22 = s_22;
  }
  t_5.deps = e_28, t_5.depsTail = n_14;
}
var Ut_2=function Ut_2(t_5) {
  for (let e_28 = t_5.deps; e_28; e_28 = e_28.nextDep)
    if (e_28.dep.version !== e_28.version || e_28.dep.computed && (Ae_2(e_28.dep.computed) || e_28.dep.version !== e_28.version))
      return !0;
  return !!t_5._dirty;
}
var Ae_2=function Ae_2(t_5) {
  if (t_5.flags & 4 && !(t_5.flags & 16) || (t_5.flags &= -17, t_5.globalVersion === pt_2) || (t_5.globalVersion = pt_2, !t_5.isSSR && t_5.flags & 128 && (!t_5.deps && !t_5._dirty || !Ut_2(t_5))))
    return;
  t_5.flags |= 2;
var e_28 = t_5.dep, n_14 = m_2, r_22 = N_2;
  m_2 = t_5, N_2 = !0;
  try {
    Ie_2(t_5);
var s_22 = t_5.fn(t_5._value);
    (e_28.version === 0 || j(s_22, t_5._value)) && (t_5.flags |= 128, t_5._value = s_22, e_28.version++);
  } catch (s_22) {
    throw e_28.version++, s_22;
  } finally {
    m_2 = n_14, N_2 = r_22, Re_2(t_5), t_5.flags &= -3;
  }
}
var le_2=function le_2(t_5, e_28 = !1) {
var { dep: n_14, prevSub: r_22, nextSub: s_22 } = t_5;
  if (r_22 && (r_22.nextSub = s_22, t_5.prevSub = void 0), s_22 && (s_22.prevSub = r_22, t_5.nextSub = void 0), n_14.subs === t_5 && (n_14.subs = r_22, !r_22 && n_14.computed)) {
    n_14.computed.flags &= -5;
    for (let i_13 = n_14.computed.deps; i_13; i_13 = i_13.nextDep)
      le_2(i_13, !0);
  }
  !e_28 && !--n_14.sc && n_14.map && n_14.map.delete(n_14.key);
}
var gn_2=function gn_2(t_5) {
var { prevDep: e_28, nextDep: n_14 } = t_5;
  e_28 && (e_28.nextDep = n_14, t_5.prevDep = void 0), n_14 && (n_14.prevDep = e_28, t_5.nextDep = void 0);
}
var N_2 = !0;
var Ee_2 = [];
var Ot_2=function Ot_2() {
  Ee_2.push(N_2), N_2 = !1;
}
var Dt_2=function Dt_2() {
var t_5 = Ee_2.pop();
  N_2 = t_5 === void 0 ? !0 : t_5;
}
var ge_2=function ge_2(t_5) {
var { cleanup: e_28 } = t_5;
  if (t_5.cleanup = void 0, e_28) {
var n_14 = m_2;
    m_2 = void 0;
    try {
      e_28();
    } finally {
      m_2 = n_14;
    }
  }
}
var pt_2 = 0;
var _n_2 = class  {
  constructor(e_28, n_14) {
    this.sub = e_28, this.dep = n_14, this.version = n_14.version, this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
  }
}
var ce_2 = class  {
  // TODO isolatedDeclarations "__v_skip"
  constructor(e_28) {
    this.computed = e_28, this.version = 0, this.activeLink = void 0, this.subs = void 0, this.map = void 0, this.key = void 0, this.sc = 0, this.__v_skip = !0;
  }
  track(e_28) {
    if (!m_2 || !N_2 || m_2 === this.computed)
      return;
var n_14 = this.activeLink;
    if (n_14 === void 0 || n_14.sub !== m_2)
      n_14 = this.activeLink = new _n_2(m_2, this), m_2.deps ? (n_14.prevDep = m_2.depsTail, m_2.depsTail.nextDep = n_14, m_2.depsTail = n_14) : m_2.deps = m_2.depsTail = n_14, Le_2(n_14);
    else if (n_14.version === -1 && (n_14.version = this.version, n_14.nextDep)) {
var r_22 = n_14.nextDep;
      r_22.prevDep = n_14.prevDep, n_14.prevDep && (n_14.prevDep.nextDep = r_22), n_14.prevDep = m_2.depsTail, n_14.nextDep = void 0, m_2.depsTail.nextDep = n_14, m_2.depsTail = n_14, m_2.deps === n_14 && (m_2.deps = r_22);
    }
    return n_14;
  }
  trigger(e_28) {
    this.version++, pt_2++, this.notify(e_28);
  }
  notify(e_28) {
    ie_2();
    try {
      for (let n_14 = this.subs; n_14; n_14 = n_14.prevSub)
        n_14.sub.notify() && n_14.sub.dep.notify();
    } finally {
      oe_2();
    }
  }
}
var Le_2=function Le_2(t_5) {
  if (t_5.dep.sc++, t_5.sub.flags & 4) {
var e_28 = t_5.dep.computed;
    if (e_28 && !t_5.dep.subs) {
      e_28.flags |= 20;
      for (let r_22 = e_28.deps; r_22; r_22 = r_22.nextDep)
        Le_2(r_22);
    }
var n_14 = t_5.dep.subs;
    n_14 !== t_5 && (t_5.prevSub = n_14, n_14 && (n_14.nextSub = t_5)), t_5.dep.subs = t_5;
  }
}
var Jt_2 = /* @__PURE__ */ new WeakMap(), tt = /* @__PURE__ */ Symbol(
  ""
), $t_5 = /* @__PURE__ */ Symbol(
  ""
), gt = /* @__PURE__ */ Symbol(
  ""
);
var v_3=function v_3(t_5, e_28, n_14) {
  if (N_2 && m_2) {
var r_22 = Jt_2.get(t_5);
    r_22 || Jt_2.set(t_5, r_22 = /* @__PURE__ */ new Map());
var s_22 = r_22.get(n_14);
    s_22 || (r_22.set(n_14, s_22 = new ce_2()), s_22.map = r_22, s_22.key = n_14), s_22.track();
  }
}
var q_3=function q_3(t_5, e_28, n_14, r_22, s_22, i_13) {
var l_14 = Jt_2.get(t_5);
  if (!l_14) {
    pt_2++;
    return;
  }
var c_12 = (o_16) => {
    o_16 && o_16.trigger();
  };
  if (ie_2(), e_28 === "clear")
    l_14.forEach(c_12);
  else {
var o_16 = y(t_5), f_8 = o_16 && ee(n_14);
    if (o_16 && n_14 === "length") {
var a_12 = Number(r_22);
      l_14.forEach((u_5, p_2) => {
        (p_2 === "length" || p_2 === gt || !et(p_2) && p_2 >= a_12) && c_12(u_5);
      });
    } else
      switch ((n_14 !== void 0 || l_14.has(void 0)) && c_12(l_14.get(n_14)), f_8 && c_12(l_14.get(gt)), e_28) {
        case "add":
          o_16 ? f_8 && c_12(l_14.get("length")) : (c_12(l_14.get(tt)), rt(t_5) && c_12(l_14.get($t_5)));
          break;
        case "delete":
          o_16 || (c_12(l_14.get(tt)), rt(t_5) && c_12(l_14.get($t_5)));
          break;
        case "set":
          rt(t_5) && c_12(l_14.get(tt));
          break;
      }
  }
  oe_2();
}
var nt_3=function nt_3(t_5) {
var e_28 = /* @__PURE__ */ __2(t_5);
  return e_28 === t_5 ? e_28 : (v_3(e_28, "iterate", gt), /* @__PURE__ */ L_2(t_5) ? e_28 : e_28.map(D_3));
}
var Pt_2=function Pt_2(t_5) {
  return v_3(t_5 = /* @__PURE__ */ __2(t_5), "iterate", gt), t_5;
}
var F_2=function F_2(t_5, e_28) {
  return /* @__PURE__ */ U_2(t_5) ? lt(/* @__PURE__ */ it_3(t_5) ? D_3(e_28) : e_28) : D_3(e_28);
}
var mn_2 = {
  __proto__: null,
  [Symbol.iterator]() {
    return Ht_2(this, Symbol.iterator, (t_5) => F_2(this, t_5));
  },
  concat(...t_5) {
    return nt_3(this).concat(
      ...t_5.map((e_28) => y(e_28) ? nt_3(e_28) : e_28)
    );
  },
  entries() {
    return Ht_2(this, "entries", (t_5) => (t_5[1] = F_2(this, t_5[1]), t_5));
  },
  every(t_5, e_28) {
    return K_2(this, "every", t_5, e_28, void 0, arguments);
  },
  filter(t_5, e_28) {
    return K_2(
      this,
      "filter",
      t_5,
      e_28,
      (n_14) => n_14.map((r_22) => F_2(this, r_22)),
      arguments
    );
  },
  find(t_5, e_28) {
    return K_2(
      this,
      "find",
      t_5,
      e_28,
      (n_14) => F_2(this, n_14),
      arguments
    );
  },
  findIndex(t_5, e_28) {
    return K_2(this, "findIndex", t_5, e_28, void 0, arguments);
  },
  findLast(t_5, e_28) {
    return K_2(
      this,
      "findLast",
      t_5,
      e_28,
      (n_14) => F_2(this, n_14),
      arguments
    );
  },
  findLastIndex(t_5, e_28) {
    return K_2(this, "findLastIndex", t_5, e_28, void 0, arguments);
  },
  // flat, flatMap could benefit from ARRAY_ITERATE but are not straight-forward to implement
  forEach(t_5, e_28) {
    return K_2(this, "forEach", t_5, e_28, void 0, arguments);
  },
  includes(...t_5) {
    return Wt_2(this, "includes", t_5);
  },
  indexOf(...t_5) {
    return Wt_2(this, "indexOf", t_5);
  },
  join(t_5) {
    return nt_3(this).join(t_5);
  },
  // keys() iterator only reads `length`, no optimization required
  lastIndexOf(...t_5) {
    return Wt_2(this, "lastIndexOf", t_5);
  },
  map(t_5, e_28) {
    return K_2(this, "map", t_5, e_28, void 0, arguments);
  },
  pop() {
    return ft_2(this, "pop");
  },
  push(...t_5) {
    return ft_2(this, "push", t_5);
  },
  reduce(t_5, ...e_28) {
    return _e_2(this, "reduce", t_5, e_28);
  },
  reduceRight(t_5, ...e_28) {
    return _e_2(this, "reduceRight", t_5, e_28);
  },
  shift() {
    return ft_2(this, "shift");
  },
  // slice could use ARRAY_ITERATE but also seems to beg for range tracking
  some(t_5, e_28) {
    return K_2(this, "some", t_5, e_28, void 0, arguments);
  },
  splice(...t_5) {
    return ft_2(this, "splice", t_5);
  },
  toReversed() {
    return nt_3(this).toReversed();
  },
  toSorted(t_5) {
    return nt_3(this).toSorted(t_5);
  },
  toSpliced(...t_5) {
    return nt_3(this).toSpliced(...t_5);
  },
  unshift(...t_5) {
    return ft_2(this, "unshift", t_5);
  },
  values() {
    return Ht_2(this, "values", (t_5) => F_2(this, t_5));
  }
};
var Ht_2=function Ht_2(t_5, e_28, n_14) {
var r_22 = Pt_2(t_5), s_22 = r_22[e_28]();
  return r_22 !== t_5 && !/* @__PURE__ */ L_2(t_5) && (s_22._next = s_22.next, s_22.next = () => {
var i_13 = s_22._next();
    return i_13.done || (i_13.value = n_14(i_13.value)), i_13;
  }), s_22;
}
var yn_2 = Array.prototype;
var K_2=function K_2(t_5, e_28, n_14, r_22, s_22, i_13) {
var l_14 = Pt_2(t_5), c_12 = l_14 !== t_5 && !/* @__PURE__ */ L_2(t_5), o_16 = l_14[e_28];
  if (o_16 !== yn_2[e_28]) {
var u_5 = o_16.apply(t_5, i_13);
    return c_12 ? D_3(u_5) : u_5;
  }
var f_8 = n_14;
  l_14 !== t_5 && (c_12 ? f_8 = function(u_5, p_2) {
    return n_14.call(this, F_2(t_5, u_5), p_2, t_5);
  } : n_14.length > 2 && (f_8 = function(u_5, p_2) {
    return n_14.call(this, u_5, p_2, t_5);
  }));
var a_12 = o_16.call(l_14, f_8, r_22);
  return c_12 && s_22 ? s_22(a_12) : a_12;
}
var _e_2=function _e_2(t_5, e_28, n_14, r_22) {
var s_22 = Pt_2(t_5), i_13 = s_22 !== t_5 && !/* @__PURE__ */ L_2(t_5);
var l_14 = n_14, c_12 = !1;
  s_22 !== t_5 && (i_13 ? (c_12 = r_22.length === 0, l_14 = function(f_8, a_12, u_5) {
    return c_12 && (c_12 = !1, f_8 = F_2(t_5, f_8)), n_14.call(this, f_8, F_2(t_5, a_12), u_5, t_5);
  }) : n_14.length > 3 && (l_14 = function(f_8, a_12, u_5) {
    return n_14.call(this, f_8, a_12, u_5, t_5);
  }));
var o_16 = s_22[e_28](l_14, ...r_22);
  return c_12 ? F_2(t_5, o_16) : o_16;
}
var Wt_2=function Wt_2(t_5, e_28, n_14) {
var r_22 = /* @__PURE__ */ __2(t_5);
  v_3(r_22, "iterate", gt);
var s_22 = r_22[e_28](...n_14);
  return (s_22 === -1 || s_22 === !1) && /* @__PURE__ */ ae_2(n_14[0]) ? (n_14[0] = /* @__PURE__ */ __2(n_14[0]), r_22[e_28](...n_14)) : s_22;
}
var ft_2=function ft_2(t_5, e_28, n_14 = []) {
  Ot_2(), ie_2();
var r_22 = (/* @__PURE__ */ __2(t_5))[e_28].apply(t_5, n_14);
  return oe_2(), Dt_2(), r_22;
}
var bn_2 = /* @__PURE__ */ en_2("__proto__,__v_isRef,__isVue"), Me = new Set(
  /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((t_5) => t_5 !== "arguments" && t_5 !== "caller").map((t_5) => Symbol[t_5]).filter(et)
);
var Sn_2=function Sn_2(t_5) {
  et(t_5) || (t_5 = String(t_5));
var e_28 = /* @__PURE__ */ __2(this);
  return v_3(e_28, "has", t_5), e_28.hasOwnProperty(t_5);
}
var Ne_2 = class  {
  constructor(e_28 = !1, n_14 = !1) {
    this._isReadonly = e_28, this._isShallow = n_14;
  }
  get(e_28, n_14, r_22) {
    if (n_14 === "__v_skip") return e_28.__v_skip;
var s_22 = this._isReadonly, i_13 = this._isShallow;
    if (n_14 === "__v_isReactive")
      return !s_22;
    if (n_14 === "__v_isReadonly")
      return s_22;
    if (n_14 === "__v_isShallow")
      return i_13;
    if (n_14 === "__v_raw")
      return r_22 === (s_22 ? i_13 ? Ln : Pe : i_13 ? En : De).get(e_28) || // receiver is_2 not the reactive proxy, but has the same prototype
      // this means the receiver is_2 a_12 user proxy of the reactive proxy
      Object.getPrototypeOf(e_28) === Object.getPrototypeOf(r_22) ? e_28 : void 0;
var l_14 = y(e_28);
    if (!s_22) {
var o_16;
      if (l_14 && (o_16 = mn_2[n_14]))
        return o_16;
      if (n_14 === "hasOwnProperty")
        return Sn_2;
    }
var c_12 = Reflect.get(
      e_28,
      n_14,
      // if this is_2 a_12 proxy wrapping a_12 ref, return methods using the raw ref
      // as_2 receiver so that we don't_5 have to call `toRaw` on the ref in all
      // its class methods
      /* @__PURE__ */ H_3(e_28) ? e_28 : r_22
    );
    if ((et(n_14) ? Me.has(n_14) : bn_2(n_14)) || (s_22 || v_3(e_28, "get", n_14), i_13))
      return c_12;
    if (/* @__PURE__ */ H_3(c_12)) {
var o_16 = l_14 && ee(n_14) ? c_12 : c_12.value;
      return s_22 && S(o_16) ? /* @__PURE__ */ Yt_2(o_16) : o_16;
    }
    return S(c_12) ? s_22 ? /* @__PURE__ */ Yt_2(c_12) : /* @__PURE__ */ Fe_2(c_12) : c_12;
  }
}
var Tn_2 = class extends Ne_2 {
  constructor(e_28 = !1) {
    super(!1, e_28);
  }
  set(e_28, n_14, r_22, s_22) {
var i_13 = e_28[n_14];
var l_14 = y(e_28) && ee(n_14);
    if (!this._isShallow) {
var f_8 = /* @__PURE__ */ U_2(i_13);
      if (!/* @__PURE__ */ L_2(r_22) && !/* @__PURE__ */ U_2(r_22) && (i_13 = /* @__PURE__ */ __2(i_13), r_22 = /* @__PURE__ */ __2(r_22)), !l_14 && /* @__PURE__ */ H_3(i_13) && !/* @__PURE__ */ H_3(r_22))
        return f_8 || (i_13.value = r_22), !0;
    }
var c_12 = l_14 ? Number(n_14) < e_28.length : zt(e_28, n_14), o_16 = Reflect.set(
      e_28,
      n_14,
      r_22,
      /* @__PURE__ */ H_3(e_28) ? e_28 : s_22
    );
    return e_28 === /* @__PURE__ */ __2(s_22) && o_16 && (c_12 ? j(r_22, i_13) && q_3(e_28, "set", n_14, r_22) : q_3(e_28, "add", n_14, r_22)), o_16;
  }
  deleteProperty(e_28, n_14) {
var r_22 = zt(e_28, n_14);
    e_28[n_14];
var s_22 = Reflect.deleteProperty(e_28, n_14);
    return s_22 && r_22 && q_3(e_28, "delete", n_14, void 0), s_22;
  }
  has(e_28, n_14) {
var r_22 = Reflect.has(e_28, n_14);
    return (!et(n_14) || !Me.has(n_14)) && v_3(e_28, "has", n_14), r_22;
  }
  ownKeys(e_28) {
    return v_3(
      e_28,
      "iterate",
      y(e_28) ? "length" : tt
    ), Reflect.ownKeys(e_28);
  }
}
var vn_2 = class extends Ne_2 {
  constructor(e_28 = !1) {
    super(!0, e_28);
  }
  set(e_28, n_14) {
    return !0;
  }
  deleteProperty(e_28, n_14) {
    return !0;
  }
}
var wn_2 = /* @__PURE__ */ new Tn_2(), xn = /* @__PURE__ */ new vn_2(), qt = (t_5) => t_5, vt = (t_5) => Reflect.getPrototypeOf(t_5);
var Cn_2=function Cn_2(t_5, e_28, n_14) {
  return function(...r_22) {
var s_22 = this.__v_raw, i_13 = /* @__PURE__ */ __2(s_22), l_14 = rt(i_13), c_12 = t_5 === "entries" || t_5 === Symbol.iterator && l_14, o_16 = t_5 === "keys" && l_14, f_8 = s_22[t_5](...r_22), a_12 = n_14 ? qt : e_28 ? lt : D_3;
    return !e_28 && v_3(
      i_13,
      "iterate",
      o_16 ? $t_5 : tt
    ), St(
      // inheriting all iterator properties
      Object.create(f_8),
      {
        // iterator protocol
        next() {
var { value: u_5, done: p_2 } = f_8.next();
          return p_2 ? { value: u_5, done: p_2 } : {
            value: c_12 ? [a_12(u_5[0]), a_12(u_5[1])] : a_12(u_5),
            done: p_2
          };
        }
      }
    );
  };
}
var wt_2=function wt_2(t_5) {
  return function(...e_28) {
    return t_5 === "delete" ? !1 : t_5 === "clear" ? void 0 : this;
  };
}
var In_2=function In_2(t_5, e_28) {
var n_14 = {
    get(s_22) {
var i_13 = this.__v_raw, l_14 = /* @__PURE__ */ __2(i_13), c_12 = /* @__PURE__ */ __2(s_22);
      t_5 || (j(s_22, c_12) && v_3(l_14, "get", s_22), v_3(l_14, "get", c_12));
var { has: o_16 } = vt(l_14), f_8 = e_28 ? qt : t_5 ? lt : D_3;
      if (o_16.call(l_14, s_22))
        return f_8(i_13.get(s_22));
      if (o_16.call(l_14, c_12))
        return f_8(i_13.get(c_12));
      i_13 !== l_14 && i_13.get(s_22);
    },
    get size() {
var s_22 = this.__v_raw;
      return !t_5 && v_3(/* @__PURE__ */ __2(s_22), "iterate", tt), s_22.size;
    },
    has(s_22) {
var i_13 = this.__v_raw, l_14 = /* @__PURE__ */ __2(i_13), c_12 = /* @__PURE__ */ __2(s_22);
      return t_5 || (j(s_22, c_12) && v_3(l_14, "has", s_22), v_3(l_14, "has", c_12)), s_22 === c_12 ? i_13.has(s_22) : i_13.has(s_22) || i_13.has(c_12);
    },
    forEach(s_22, i_13) {
var l_14 = this, c_12 = l_14.__v_raw, o_16 = /* @__PURE__ */ __2(c_12), f_8 = e_28 ? qt : t_5 ? lt : D_3;
      return !t_5 && v_3(o_16, "iterate", tt), c_12.forEach((a_12, u_5) => s_22.call(i_13, f_8(a_12), f_8(u_5), l_14));
    }
  };
  return St(
    n_14,
    t_5 ? {
      add: wt_2("add"),
      set: wt_2("set"),
      delete: wt_2("delete"),
      clear: wt_2("clear")
    } : {
      add(s_22) {
var i_13 = /* @__PURE__ */ __2(this), l_14 = vt(i_13), c_12 = /* @__PURE__ */ __2(s_22), o_16 = !e_28 && !/* @__PURE__ */ L_2(s_22) && !/* @__PURE__ */ U_2(s_22) ? c_12 : s_22;
        return l_14.has.call(i_13, o_16) || j(s_22, o_16) && l_14.has.call(i_13, s_22) || j(c_12, o_16) && l_14.has.call(i_13, c_12) || (i_13.add(o_16), q_3(i_13, "add", o_16, o_16)), this;
      },
      set(s_22, i_13) {
        !e_28 && !/* @__PURE__ */ L_2(i_13) && !/* @__PURE__ */ U_2(i_13) && (i_13 = /* @__PURE__ */ __2(i_13));
var l_14 = /* @__PURE__ */ __2(this), { has: c_12, get: o_16 } = vt(l_14);
var f_8 = c_12.call(l_14, s_22);
        f_8 || (s_22 = /* @__PURE__ */ __2(s_22), f_8 = c_12.call(l_14, s_22));
var a_12 = o_16.call(l_14, s_22);
        return l_14.set(s_22, i_13), f_8 ? j(i_13, a_12) && q_3(l_14, "set", s_22, i_13) : q_3(l_14, "add", s_22, i_13), this;
      },
      delete(s_22) {
var i_13 = /* @__PURE__ */ __2(this), { has: l_14, get: c_12 } = vt(i_13);
var o_16 = l_14.call(i_13, s_22);
        o_16 || (s_22 = /* @__PURE__ */ __2(s_22), o_16 = l_14.call(i_13, s_22)), c_12 && c_12.call(i_13, s_22);
var f_8 = i_13.delete(s_22);
        return o_16 && q_3(i_13, "delete", s_22, void 0), f_8;
      },
      clear() {
var s_22 = /* @__PURE__ */ __2(this), i_13 = s_22.size !== 0, l_14 = s_22.clear();
        return i_13 && q_3(
          s_22,
          "clear",
          void 0,
          void 0
        ), l_14;
      }
    }
  ), [
    "keys",
    "values",
    "entries",
    Symbol.iterator
  ].forEach((s_22) => {
    n_14[s_22] = Cn_2(s_22, t_5, e_28);
  }), n_14;
}
var Oe_2=function Oe_2(t_5, e_28) {
var n_14 = In_2(t_5, e_28);
  return (r_22, s_22, i_13) => s_22 === "__v_isReactive" ? !t_5 : s_22 === "__v_isReadonly" ? t_5 : s_22 === "__v_raw" ? r_22 : Reflect.get(
    zt(n_14, s_22) && s_22 in r_22 ? n_14 : r_22,
    s_22,
    i_13
  );
}
var Rn_2 = {
  get: /* @__PURE__ */ Oe_2(!1, !1)
}, An = {
  get: /* @__PURE__ */ Oe_2(!0, !1)
}, De = /* @__PURE__ */ new WeakMap(), En = /* @__PURE__ */ new WeakMap(), Pe = /* @__PURE__ */ new WeakMap(), Ln = /* @__PURE__ */ new WeakMap();
var Mn_2=function Mn_2(t_5) {
  switch (t_5) {
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
var Fe_2=function Fe_2(t_5) {
  return /* @__PURE__ */ U_2(t_5) ? t_5 : je_2(
    t_5,
    !1,
    wn_2,
    Rn_2,
    De
  );
}
// @__NO_SIDE_EFFECTS__
var Yt_2=function Yt_2(t_5) {
  return je_2(
    t_5,
    !0,
    xn,
    An,
    Pe
  );
}
var je_2=function je_2(t_5, e_28, n_14, r_22, s_22) {
  if (!S(t_5) || t_5.__v_raw && !(e_28 && t_5.__v_isReactive) || t_5.__v_skip || !Object.isExtensible(t_5))
    return t_5;
var i_13 = s_22.get(t_5);
  if (i_13)
    return i_13;
var l_14 = Mn_2(cn(t_5));
  if (l_14 === 0)
    return t_5;
var c_12 = new Proxy(
    t_5,
    l_14 === 2 ? r_22 : n_14
  );
  return s_22.set(t_5, c_12), c_12;
}
// @__NO_SIDE_EFFECTS__
var it_3=function it_3(t_5) {
  return /* @__PURE__ */ U_2(t_5) ? /* @__PURE__ */ it_3(t_5.__v_raw) : !!(t_5 && t_5.__v_isReactive);
}
// @__NO_SIDE_EFFECTS__
var U_2=function U_2(t_5) {
  return !!(t_5 && t_5.__v_isReadonly);
}
// @__NO_SIDE_EFFECTS__
var L_2=function L_2(t_5) {
  return !!(t_5 && t_5.__v_isShallow);
}
// @__NO_SIDE_EFFECTS__
var ae_2=function ae_2(t_5) {
  return t_5 ? !!t_5.__v_raw : !1;
}
// @__NO_SIDE_EFFECTS__
var __2=function __2(t_5) {
var e_28 = t_5 && t_5.__v_raw;
  return e_28 ? /* @__PURE__ */ __2(e_28) : t_5;
}
var D_3 = (t_5) => S(t_5) ? /* @__PURE__ */ Fe_2(t_5) : t_5, lt = (t_5) => S(t_5) ? /* @__PURE__ */ Yt_2(t_5) : t_5;
// @__NO_SIDE_EFFECTS__
var H_3=function H_3(t_5) {
  return t_5 ? t_5.__v_isRef === !0 : !1;
}
// @__NO_SIDE_EFFECTS__
var ys_2=function ys_2(t_5) {
  return Nn_2(t_5, !1);
}
var Nn_2=function Nn_2(t_5, e_28) {
  return /* @__PURE__ */ H_3(t_5) ? t_5 : new On_2(t_5, e_28);
}
var On_2 = class  {
  constructor(e_28, n_14) {
    this.dep = new ce_2(), this.__v_isRef = !0, this.__v_isShallow = !1, this._rawValue = n_14 ? e_28 : /* @__PURE__ */ __2(e_28), this._value = n_14 ? e_28 : D_3(e_28), this.__v_isShallow = n_14;
  }
  get value() {
    return this.dep.track(), this._value;
  }
  set value(e_28) {
var n_14 = this._rawValue, r_22 = this.__v_isShallow || /* @__PURE__ */ L_2(e_28) || /* @__PURE__ */ U_2(e_28);
    e_28 = r_22 ? e_28 : /* @__PURE__ */ __2(e_28), j(e_28, n_14) && (this._rawValue = e_28, this._value = r_22 ? e_28 : D_3(e_28), this.dep.trigger());
  }
}
var Dn_2 = class  {
  constructor(e_28, n_14, r_22) {
    this.fn = e_28, this.setter = n_14, this._value = void 0, this.dep = new ce_2(this), this.__v_isRef = !0, this.deps = void 0, this.depsTail = void 0, this.flags = 16, this.globalVersion = pt_2 - 1, this.next = void 0, this.effect = this, this.__v_isReadonly = !n_14, this.isSSR = r_22;
  }
  /**
   * @internal
   */
  notify() {
    if (this.flags |= 16, !(this.flags & 8) && // avoid infinite self recursion
    m_2 !== this)
      return Ce_2(this, !0), !0;
  }
  get value() {
var e_28 = this.dep.track();
    return Ae_2(this), e_28 && (e_28.version = this.dep.version), this._value;
  }
  set value(e_28) {
    this.setter && this.setter(e_28);
  }
}
// @__NO_SIDE_EFFECTS__
var Pn_2=function Pn_2(t_5, e_28, n_14 = !1) {
var r_22, s_22;
  return w(t_5) ? r_22 = t_5 : (r_22 = t_5.get, s_22 = t_5.set), new Dn_2(r_22, s_22, n_14);
}
var xt_2 = {}, At = /* @__PURE__ */ new WeakMap();

var Fn_2=function Fn_2(t_5, e_28 = !1, n_14 = X) {
  if (n_14) {
var r_22 = At.get(n_14);
    r_22 || At.set(n_14, r_22 = []), r_22.push(t_5);
  }
}
var jn_2=function jn_2(t_5, e_28, n_14 = te_2) {
var { immediate: r_22, deep: s_22, once: i_13, scheduler: l_14, augmentJob: c_12, call: o_16 } = n_14, f_8 = (h_6) => s_22 ? h_6 : /* @__PURE__ */ L_2(h_6) || s_22 === !1 || s_22 === 0 ? Y_2(h_6, 1) : Y_2(h_6);
var a_12, u_5, p_2, g_3, I = !1, P_3 = !1;
  if (/* @__PURE__ */ H_3(t_5) ? (u_5 = () => t_5.value, I = /* @__PURE__ */ L_2(t_5)) : /* @__PURE__ */ it_3(t_5) ? (u_5 = () => f_8(t_5), I = !0) : y(t_5) ? (P_3 = !0, I = t_5.some((h_6) => /* @__PURE__ */ it_3(h_6) || /* @__PURE__ */ L_2(h_6)), u_5 = () => t_5.map((h_6) => {
    if (/* @__PURE__ */ H_3(h_6))
      return h_6.value;
    if (/* @__PURE__ */ it_3(h_6))
      return f_8(h_6);
    if (w(h_6))
      return o_16 ? o_16(h_6, 2) : h_6();
  })) : w(t_5) ? e_28 ? u_5 = o_16 ? () => o_16(t_5, 2) : t_5 : u_5 = () => {
    if (p_2) {
      Ot_2();
      try {
        p_2();
      } finally {
        Dt_2();
      }
    }
var h_6 = X;
    X = a_12;
    try {
      return o_16 ? o_16(t_5, 3, [g_3]) : t_5(g_3);
    } finally {
      X = h_6;
    }
  } : u_5 = Ct, e_28 && s_22) {
var h_6 = u_5, x_3 = s_22 === !0 ? 1 / 0 : s_22;
    u_5 = () => Y_2(h_6(), x_3);
  }
var J_2 = () => {
    a_12.stop();
  };
  if (i_13 && e_28) {
var h_6 = e_28;
    e_28 = (...x_3) => {
var M_4 = h_6(...x_3);
      return J_2(), M_4;
    };
  }
var W_2 = P_3 ? new Array(t_5.length).fill(xt_2) : xt_2;
var G_2 = (h_6) => {
    if (!(!(a_12.flags & 1) || !a_12.dirty && !h_6))
      if (e_28) {
var x_3 = a_12.run();
        if (h_6 || s_22 || I || (P_3 ? x_3.some((M_4, R_2) => j(M_4, W_2[R_2])) : j(x_3, W_2))) {
          p_2 && p_2();
var M_4 = X;
          X = a_12;
          try {
var R_2 = [
              x_3,
              // pass undefined as_2 the old value when it_3's_22 changed for the first time
              W_2 === xt_2 ? void 0 : P_3 && W_2[0] === xt_2 ? [] : W_2,
              g_3
            ];
            W_2 = x_3, o_16 ? o_16(e_28, 3, R_2) : (
              // @ts-expect-error
              e_28(...R_2)
            );
          } finally {
            X = M_4;
          }
        }
      } else
        a_12.run();
  };
  return c_12 && c_12(G_2), a_12 = new pn_2(u_5), a_12.scheduler = l_14 ? () => l_14(G_2, !1) : G_2, g_3 = (h_6) => Fn_2(h_6, !1, a_12), p_2 = a_12.onStop = () => {
var h_6 = At.get(a_12);
    if (h_6) {
      if (o_16)
        o_16(h_6, 4);
      else
        for (const x_3 of h_6) x_3();
      At.delete(a_12);
    }
  }, e_28 ? r_22 ? G_2(!0) : W_2 = a_12.run() : l_14 ? l_14(G_2.bind(null, !0), !0) : a_12.run(), J_2.pause = a_12.pause.bind(a_12), J_2.resume = a_12.resume.bind(a_12), J_2.stop = J_2, J_2;
}
var Y_2=function Y_2(t_5, e_28 = 1 / 0, n_14) {
  if (e_28 <= 0 || !S(t_5) || t_5.__v_skip || (n_14 = n_14 || /* @__PURE__ */ new Map(), (n_14.get(t_5) || 0) >= e_28))
    return t_5;
  if (n_14.set(t_5, e_28), e_28--, /* @__PURE__ */ H_3(t_5))
    Y_2(t_5.value, e_28, n_14);
  else if (y(t_5))
    for (let r_22 = 0; r_22 < t_5.length; r_22++)
      Y_2(t_5[r_22], e_28, n_14);
  else if (be(t_5) || rt(t_5))
    t_5.forEach((r_22) => {
      Y_2(r_22, e_28, n_14);
    });
  else if (Te(t_5)) {
    for (const r_22 in t_5)
      Y_2(t_5[r_22], e_28, n_14);
    for (const r_22 of Object.getOwnPropertySymbols(t_5))
      Object.prototype.propertyIsEnumerable.call(t_5, r_22) && Y_2(t_5[r_22], e_28, n_14);
  }
  return t_5;
}
/**
* @vue/runtime-core v3.5.39
* (c_12) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/
var fe_2=function fe_2(t_5, e_28, n_14, r_22) {
  try {
    return r_22 ? t_5(...r_22) : t_5();
  } catch (s_22) {
    Ve_2(s_22, e_28, n_14);
  }
}
var Ft_2=function Ft_2(t_5, e_28, n_14, r_22) {
  if (w(t_5)) {
var s_22 = fe_2(t_5, e_28, n_14, r_22);
    return s_22 && ln(s_22) && s_22.catch((i_13) => {
      Ve_2(i_13, e_28, n_14);
    }), s_22;
  }
  if (y(t_5)) {
var s_22 = [];
    for (let i_13 = 0; i_13 < t_5.length; i_13++)
      s_22.push(Ft_2(t_5[i_13], e_28, n_14, r_22));
    return s_22;
  }
}
var Ve_2=function Ve_2(t_5, e_28, n_14, r_22 = !0) {
var s_22 = e_28 ? e_28.vnode : null, { errorHandler: i_13, throwUnhandledErrorInProduction: l_14 } = e_28 && e_28.appContext.config || te_2;
  if (e_28) {
var c_12 = e_28.parent;
var o_16 = e_28.proxy, f_8 = `https://vuejs.org/error-reference/#runtime-${n_14}`;
    for (; c_12; ) {
var a_12 = c_12.ec;
      if (a_12) {
        for (let u_5 = 0; u_5 < a_12.length; u_5++)
          if (a_12[u_5](t_5, o_16, f_8) === !1)
            return;
      }
      c_12 = c_12.parent;
    }
    if (i_13) {
      Ot_2(), fe_2(i_13, null, 10, [
        t_5,
        o_16,
        f_8
      ]), Dt_2();
      return;
    }
  }
  Vn_2(t_5, n_14, s_22, r_22, l_14);
}
var Vn_2=function Vn_2(t_5, e_28, n_14, r_22 = !0, s_22 = !1) {
  if (s_22)
    throw t_5;
  console.error(t_5);
}
var E_2 = [];
var k_2 = -1;
var ot_2 = [];
var $ = null, st = 0;
var Bn_2 = /* @__PURE__ */ Promise.resolve();
var Gt_2 = null;
var Hn_2=function Hn_2(t_5) {
var e_28 = k_2 + 1, n_14 = E_2.length;
  for (; e_28 < n_14; ) {
var r_22 = e_28 + n_14 >>> 1, s_22 = E_2[r_22], i_13 = _t_2(s_22);
    i_13 < t_5 || i_13 === t_5 && s_22.flags & 2 ? e_28 = r_22 + 1 : n_14 = r_22;
  }
  return e_28;
}
var Wn_2=function Wn_2(t_5) {
  if (!(t_5.flags & 1)) {
var e_28 = _t_2(t_5), n_14 = E_2[E_2.length - 1];
    !n_14 || // fast path when the job id is_2 larger than the tail
    !(t_5.flags & 2) && e_28 >= _t_2(n_14) ? E_2.push(t_5) : E_2.splice(Hn_2(e_28), 0, t_5), t_5.flags |= 1, Be_2();
  }
}
var Be_2=function Be_2() {
  Gt_2 || (Gt_2 = Bn_2.then(He_2));
}
var Kn_2=function Kn_2(t_5) {
  y(t_5) ? ot_2.push(...t_5) : $ && t_5.id === -1 ? $.splice(st + 1, 0, t_5) : t_5.flags & 1 || (ot_2.push(t_5), t_5.flags |= 1), Be_2();
}
var kn_2=function kn_2(t_5) {
  if (ot_2.length) {
var e_28 = [...new Set(ot_2)].sort(
      (n_14, r_22) => _t_2(n_14) - _t_2(r_22)
    );
    if (ot_2.length = 0, $) {
      $.push(...e_28);
      return;
    }
    for ($ = e_28, st = 0; st < $.length; st++) {
var n_14 = $[st];
      n_14.flags & 4 && (n_14.flags &= -2), n_14.flags & 8 || n_14(), n_14.flags &= -2;
    }
    $ = null, st = 0;
  }
}
var _t_2 = (t_5) => t_5.id == null ? t_5.flags & 2 ? -1 : 1 / 0 : t_5.id;
var He_2=function He_2(t_5) {
  try {
    for (k_2 = 0; k_2 < E_2.length; k_2++) {
var e_28 = E_2[k_2];
      e_28 && !(e_28.flags & 8) && (e_28.flags & 4 && (e_28.flags &= -2), fe_2(
        e_28,
        e_28.i_13,
        e_28.i_13 ? 15 : 14
      ), e_28.flags & 4 || (e_28.flags &= -2));
    }
  } finally {
    for (; k_2 < E_2.length; k_2++) {
var e_28 = E_2[k_2];
      e_28 && (e_28.flags &= -2);
    }
    k_2 = -1, E_2.length = 0, kn_2(), Gt_2 = null, (E_2.length || ot_2.length) && He_2();
  }
}
var B_2 = null, We = null;
var me_2=function me_2(t_5) {
var e_28 = B_2;
  return B_2 = t_5, We = t_5 && t_5.type.__scopeId || null, e_28;
}
var bs_2=function bs_2(t_5, e_28 = B_2, n_14) {
  if (!e_28 || t_5._n_2)
    return t_5;
var r_22 = (...s_22) => {
    r_22._d && Lt_2(-1);
var i_13 = me_2(e_28);
var l_14;
    try {
      l_14 = t_5(...s_22);
    } finally {
      me_2(i_13), r_22._d && Lt_2(1);
    }
    return l_14;
  };
  return r_22._n_2 = !0, r_22._c = !0, r_22._d = !0, r_22;
}
var zn_2=function zn_2(t_5, e_28, n_14 = !1) {
var r_22 = Ze_2();
  if (r_22 || es_2) {
var s_22 = r_22 ? r_22.parent == null || r_22.ce_2 ? r_22.vnode.appContext && r_22.vnode.appContext.provides : r_22.parent.provides : void 0;
    if (s_22 && t_5 in s_22)
      return s_22[t_5];
    if (arguments.length > 1)
      return n_14 && w(e_28) ? e_28.call(r_22 && r_22.proxy) : e_28;
  }
}
var Un_2 = /* @__PURE__ */ Symbol.for("v_3-scx"), Jn = () => zn_2(Un_2);
var Ss_2=function Ss_2(t_5, e_28, n_14) {
  return $n_14(t_5, e_28, n_14);
}
var $n_14=function $n_14(t_5, e_28, n_14 = te_2) {
var { immediate: r_22, deep: s_22, flush: i_13, once: l_14 } = n_14, c_12 = St({}, n_14), o_16 = e_28 && r_22 || !e_28 && i_13 !== "post";
var f_8;
  if (bt_2) {
    if (i_13 === "sync") {
var g_3 = Jn();
      f_8 = g_3.__watcherHandles || (g_3.__watcherHandles = []);
    } else if (!o_16) {
var g_3 = () => {
      };
      return g_3.stop = Ct, g_3.resume = Ct, g_3.pause = Ct, g_3;
    }
  }
var a_12 = ct_2;
  c_12.call = (g_3, I, P_3) => Ft_2(g_3, a_12, I, P_3);
var u_5 = !1;
  i_13 === "post" ? c_12.scheduler = (g_3) => {
    ss(g_3, a_12 && a_12.suspense);
  } : i_13 !== "sync" && (u_5 = !0, c_12.scheduler = (g_3, I) => {
    I ? g_3() : Wn_2(g_3);
  }), c_12.augmentJob = (g_3) => {
    e_28 && (g_3.flags |= 4), u_5 && (g_3.flags |= 2, a_12 && (g_3.id = a_12.uid, g_3.i_13 = a_12));
  };
var p_2 = jn_2(t_5, e_28, c_12);
  return bt_2 && (f_8 ? f_8.push(p_2) : o_16 && p_2()), p_2;
}
var Ke_2 = (t_5) => t_5.__isTeleport, z = /* @__PURE__ */ Symbol("_leaveCb"), ut = /* @__PURE__ */ Symbol("_enterCb");
var qn_2=function qn_2() {
var t_5 = {
    isMounted: !1,
    isLeaving: !1,
    isUnmounting: !1,
    leavingVNodes: /* @__PURE__ */ new Map()
  };
  return Xn(() => {
    t_5.isMounted = !0;
  }), Zn(() => {
    t_5.isUnmounting = !0;
  }), t_5;
}
var A_2 = [Function, Array], Yn = {
  mode: String,
  appear: Boolean,
  persisted: Boolean,
  // enter
  onBeforeEnter: A_2,
  onEnter: A_2,
  onAfterEnter: A_2,
  onEnterCancelled: A_2,
  // leave
  onBeforeLeave: A_2,
  onLeave: A_2,
  onAfterLeave: A_2,
  onLeaveCancelled: A_2,
  // appear
  onBeforeAppear: A_2,
  onAppear: A_2,
  onAfterAppear: A_2,
  onAppearCancelled: A_2
}, ke = (t_5) => {
var e_28 = t_5.subTree;
  return e_28.component ? ke(e_28.component) : e_28;
}, Gn = {
  name: "BaseTransition",
  props: Yn,
  setup(t_5, { slots: e_28 }) {
var n_14 = Ze_2(), r_22 = qn_2();
    return () => {
var s_22 = e_28.default && Je_2(e_28.default(), !0), i_13 = s_22 && s_22.length ? ze_2(s_22) : (
        // Keep explicit default-slot conditionals on the same transition path
        // as_2 regular v_3-if branches, which render a_12 comment placeholder.
        n_14.subTree ? ds_2() : void 0
      );
      if (!i_13)
        return;
var l_14 = /* @__PURE__ */ __2(t_5), { mode: c_12 } = l_14;
      if (r_22.isLeaving)
        return Kt_2(i_13);
var o_16 = ye_2(i_13);
      if (!o_16)
        return Kt_2(i_13);
var f_8 = Qt_2(
        o_16,
        l_14,
        r_22,
        n_14,
        // #11061, ensure enterHooks is_2 fresh after clone
        (u_5) => f_8 = u_5
      );
      o_16.type !== V && Et_2(o_16, f_8);
var a_12 = n_14.subTree && ye_2(n_14.subTree);
      if (a_12 && a_12.type !== V && !Ge_2(a_12, o_16) && ke(n_14).type !== V) {
var u_5 = Qt_2(
          a_12,
          l_14,
          r_22,
          n_14
        );
        if (Et_2(a_12, u_5), c_12 === "out-in" && o_16.type !== V)
          return r_22.isLeaving = !0, u_5.afterLeave = () => {
            r_22.isLeaving = !1, n_14.job.flags & 8 || n_14.update(), delete u_5.afterLeave, a_12 = void 0;
          }, Kt_2(i_13);
        c_12 === "in-out" && o_16.type !== V ? u_5.delayLeave = (p_2, g_3, I) => {
var P_3 = Ue_2(
            r_22,
            a_12
          );
          P_3[String(a_12.key)] = a_12, p_2[z] = () => {
            g_3(), p_2[z] = void 0, delete f_8.delayedLeave, a_12 = void 0;
          }, f_8.delayedLeave = () => {
            I(), delete f_8.delayedLeave, a_12 = void 0;
          };
        } : a_12 = void 0;
      } else a_12 && (a_12 = void 0);
      return i_13;
    };
  }
};
var ze_2=function ze_2(t_5) {
var e_28 = t_5[0];
  if (t_5.length > 1) {
    for (const n_14 of t_5)
      if (n_14.type !== V) {
        e_28 = n_14;
        break;
      }
  }
  return e_28;
}
var Ts_2 = Gn;
var Ue_2=function Ue_2(t_5, e_28) {
var { leavingVNodes: n_14 } = t_5;
var r_22 = n_14.get(e_28.type);
  return r_22 || (r_22 = /* @__PURE__ */ Object.create(null), n_14.set(e_28.type, r_22)), r_22;
}
var Qt_2=function Qt_2(t_5, e_28, n_14, r_22, s_22) {
var {
    appear: i_13,
    mode: l_14,
    persisted: c_12 = !1,
    onBeforeEnter: o_16,
    onEnter: f_8,
    onAfterEnter: a_12,
    onEnterCancelled: u_5,
    onBeforeLeave: p_2,
    onLeave: g_3,
    onAfterLeave: I,
    onLeaveCancelled: P_3,
    onBeforeAppear: J_2,
    onAppear: W_2,
    onAfterAppear: G_2,
    onAppearCancelled: h_6
  } = e_28, x_3 = String(t_5.key), M_4 = Ue_2(n_14, t_5), R_2 = (d, b_4) => {
    d && Ft_2(
      d,
      r_22,
      9,
      b_4
    );
  }, de = (d, b_4) => {
var T_5 = b_4[1];
    R_2(d, b_4), y(d) ? d.every((Q_2) => Q_2.length <= 1) && T_5() : d.length <= 1 && T_5();
  }, jt = {
    mode: l_14,
    persisted: c_12,
    beforeEnter(d) {
var b_4 = o_16;
      if (!n_14.isMounted)
        if (i_13)
          b_4 = J_2 || o_16;
        else
          return;
      d[z] && d[z](
        !0
        /* cancelled */
      );
var T_5 = M_4[x_3];
      T_5 && Ge_2(t_5, T_5) && T_5.el[z] && T_5.el[z](), R_2(b_4, [d]);
    },
    enter(d) {
      if (M_4[x_3] === t_5) return;
var b_4 = f_8, T_5 = a_12, Q_2 = u_5;
      if (!n_14.isMounted)
        if (i_13)
          b_4 = W_2 || f_8, T_5 = G_2 || a_12, Q_2 = h_6 || u_5;
        else
          return;
var at_4 = !1;
      d[ut] = (tn) => {
        at_4 || (at_4 = !0, tn ? R_2(Q_2, [d]) : R_2(T_5, [d]), jt.delayedLeave && jt.delayedLeave(), d[ut] = void 0);
      };
var Tt_2 = d[ut].bind(null, !1);
      b_4 ? de(b_4, [d, Tt_2]) : Tt_2();
    },
    leave(d, b_4) {
var T_5 = String(t_5.key);
      if (d[ut] && d[ut](
        !0
        /* cancelled */
      ), n_14.isUnmounting)
        return b_4();
      R_2(p_2, [d]);
var Q_2 = !1;
      d[z] = (Tt_2) => {
        Q_2 || (Q_2 = !0, b_4(), Tt_2 ? R_2(P_3, [d]) : R_2(I, [d]), d[z] = void 0, M_4[T_5] === t_5 && delete M_4[T_5]);
      };
var at_4 = d[z].bind(null, !1);
      M_4[T_5] = t_5, g_3 ? de(g_3, [d, at_4]) : at_4();
    },
    clone(d) {
var b_4 = Qt_2(
        d,
        e_28,
        n_14,
        r_22,
        s_22
      );
      return s_22 && s_22(b_4), b_4;
    }
  };
  return jt;
}
var Kt_2=function Kt_2(t_5) {
  if ($e_28(t_5))
    return t_5 = yt_2(t_5), t_5.children = null, t_5;
}
var ye_2=function ye_2(t_5) {
  if (!$e_28(t_5))
    return Ke_2(t_5.type) && t_5.children ? ze_2(t_5.children) : t_5;
  if (t_5.component)
    return t_5.component.subTree;
var { shapeFlag: e_28, children: n_14 } = t_5;
  if (n_14) {
    if (e_28 & 16)
      return n_14[0];
    if (e_28 & 32 && w(n_14.default))
      return n_14.default();
  }
}
var Et_2=function Et_2(t_5, e_28) {
  t_5.shapeFlag & 6 && t_5.component ? (t_5.transition = e_28, Et_2(t_5.component.subTree, e_28)) : t_5.shapeFlag & 128 ? (t_5.ssContent.transition = e_28.clone(t_5.ssContent), t_5.ssFallback.transition = e_28.clone(t_5.ssFallback)) : t_5.transition = e_28;
}
var Je_2=function Je_2(t_5, e_28 = !1, n_14) {
var r_22 = [], s_22 = 0;
  for (let i_13 = 0; i_13 < t_5.length; i_13++) {
var l_14 = t_5[i_13];
var c_12 = n_14 == null ? l_14.key : String(n_14) + String(l_14.key != null ? l_14.key : i_13);
    l_14.type === he_2 ? (l_14.patchFlag & 128 && s_22++, r_22 = r_22.concat(
      Je_2(l_14.children, e_28, c_12)
    )) : (e_28 || l_14.type !== V) && r_22.push(c_12 != null ? yt_2(l_14, { key: c_12 }) : l_14);
  }
  if (s_22 > 1)
    for (let i_13 = 0; i_13 < r_22.length; i_13++)
      r_22[i_13].patchFlag = -2;
  return r_22;
}
ne_2().requestIdleCallback;
ne_2().cancelIdleCallback;
var $e_28 = (t_5) => t_5.type.__isKeepAlive;
var Qn_2=function Qn_2(t_5, e_28, n_14 = ct_2, r_22 = !1) {
  if (n_14) {
var s_22 = n_14[t_5] || (n_14[t_5] = []), i_13 = e_28.__weh || (e_28.__weh = (...l_14) => {
      Ot_2();
var c_12 = gs_2(n_14), o_16 = Ft_2(e_28, n_14, t_5, l_14);
      return c_12(), Dt_2(), o_16;
    });
    return r_22 ? s_22.unshift(i_13) : s_22.push(i_13), i_13;
  }
}
var ue_2 = (t_5) => (e_28, n_14 = ct_2) => {
  (!bt_2 || t_5 === "sp") && Qn_2(t_5, (...r_22) => e_28(...r_22), n_14);
}, Xn = ue_2("m_2"), Zn = ue_2(
  "bum"
), vs = ue_2("um"), ts = /* @__PURE__ */ Symbol.for("v_3-ndc");
var ws_2=function ws_2(t_5, e_28, n_14, r_22) {
var s_22;
var i_13 = n_14, l_14 = y(t_5);
  if (l_14 || O(t_5)) {
var c_12 = l_14 && /* @__PURE__ */ it_3(t_5);
var o_16 = !1, f_8 = !1;
    c_12 && (o_16 = !/* @__PURE__ */ L_2(t_5), f_8 = /* @__PURE__ */ U_2(t_5), t_5 = Pt_2(t_5)), s_22 = new Array(t_5.length);
    for (let a_12 = 0, u_5 = t_5.length; a_12 < u_5; a_12++)
      s_22[a_12] = e_28(
        o_16 ? f_8 ? lt(D_3(t_5[a_12])) : D_3(t_5[a_12]) : t_5[a_12],
        a_12,
        void 0,
        i_13
      );
  } else if (typeof t_5 == "number") {
    s_22 = new Array(t_5);
    for (let c_12 = 0; c_12 < t_5; c_12++)
      s_22[c_12] = e_28(c_12 + 1, c_12, void 0, i_13);
  } else if (S(t_5))
    if (t_5[Symbol.iterator])
      s_22 = Array.from(
        t_5,
        (c_12, o_16) => e_28(c_12, o_16, void 0, i_13)
      );
    else {
var c_12 = Object.keys(t_5);
      s_22 = new Array(c_12.length);
      for (let o_16 = 0, f_8 = c_12.length; o_16 < f_8; o_16++) {
var a_12 = c_12[o_16];
        s_22[o_16] = e_28(t_5[a_12], a_12, o_16, i_13);
      }
    }
  else
    s_22 = [];
  return s_22;
}
var es_2 = null;
var ns_2 = {}, qe = (t_5) => Object.getPrototypeOf(t_5) === ns_2, ss = is_2, rs = (t_5) => t_5.__isSuspense;
var is_2=function is_2(t_5, e_28) {
  e_28 && e_28.pendingBranch ? y(t_5) ? e_28.effects.push(...t_5) : e_28.effects.push(t_5) : Kn_2(t_5);
}
var he_2 = /* @__PURE__ */ Symbol.for("v_3-fgt"), os = /* @__PURE__ */ Symbol.for("v_3-txt"), V = /* @__PURE__ */ Symbol.for("v_3-cmt"), It = [];
var C_3 = null;
var ls_2=function ls_2(t_5 = !1) {
  It.push(C_3 = t_5 ? null : []);
}
var cs_2=function cs_2() {
  It.pop(), C_3 = It[It.length - 1] || null;
}
var mt_2 = 1;
var Lt_2=function Lt_2(t_5, e_28 = !1) {
  mt_2 += t_5, t_5 < 0 && C_3 && e_28 && (C_3.hasOnce = !0);
}
var Ye_2=function Ye_2(t_5) {
  return t_5.dynamicChildren = mt_2 > 0 ? C_3 || nn : null, cs_2(), mt_2 > 0 && C_3 && C_3.push(t_5), t_5;
}
var xs_2=function xs_2(t_5, e_28, n_14, r_22, s_22, i_13) {
  return Ye_2(
    Xe_2(
      t_5,
      e_28,
      n_14,
      r_22,
      s_22,
      i_13,
      !0
    )
  );
}
var as_2=function as_2(t_5, e_28, n_14, r_22, s_22) {
  return Ye_2(
    Z_2(
      t_5,
      e_28,
      n_14,
      r_22,
      s_22,
      !0
    )
  );
}
var Xt_2=function Xt_2(t_5) {
  return t_5 ? t_5.__v_isVNode === !0 : !1;
}
var Ge_2=function Ge_2(t_5, e_28) {
  return t_5.type === e_28.type && t_5.key === e_28.key;
}
var Qe_2 = ({ key: t_5 }) => t_5 ?? null, Rt = ({
  ref: t_5,
  ref_key: e_28,
  ref_for: n_14
}) => (typeof t_5 == "number" && (t_5 = "" + t_5), t_5 != null ? O(t_5) || /* @__PURE__ */ H_3(t_5) || w(t_5) ? { i_13: B_2, r_22: t_5, k_2: e_28, f_8: !!n_14 } : t_5 : null);
var Xe_2=function Xe_2(t_5, e_28 = null, n_14 = null, r_22 = 0, s_22 = null, i_13 = t_5 === he_2 ? 0 : 1, l_14 = !1, c_12 = !1) {
var o_16 = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: t_5,
    props: e_28,
    key: e_28 && Qe_2(e_28),
    ref: e_28 && Rt(e_28),
    scopeId: We,
    slotScopeIds: null,
    children: n_14,
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
    shapeFlag: i_13,
    patchFlag: r_22,
    dynamicProps: s_22,
    dynamicChildren: null,
    appContext: null,
    ctx: B_2
  };
  return c_12 ? (Mt_2(o_16, n_14), i_13 & 128 && t_5.normalize(o_16)) : n_14 && (o_16.shapeFlag |= O(n_14) ? 8 : 16), mt_2 > 0 && // avoid a_12 block node from tracking itself
  !l_14 && // has current parent block
  C_3 && // presence of a_12 patch flag indicates this node needs patching on updates.
  // component nodes also should always be patched, because even if the
  // component doesn't_5 need to update, it_3 needs to persist the instance on to
  // the next vnode so that it_3 can be properly unmounted later.
  (o_16.patchFlag > 0 || i_13 & 6) && // the EVENTS flag is_2 only for hydration and if it_3 is_2 the only flag, the
  // vnode should not be considered dynamic due to handler caching.
  o_16.patchFlag !== 32 && C_3.push(o_16), o_16;
}
var Z_2 = fs_2;
var fs_2=function fs_2(t_5, e_28 = null, n_14 = null, r_22 = 0, s_22 = null, i_13 = !1) {
  if ((!t_5 || t_5 === ts) && (t_5 = V), Xt_2(t_5)) {
var c_12 = yt_2(
      t_5,
      e_28,
      !0
      /* mergeRef: true */
    );
    return n_14 && Mt_2(c_12, n_14), mt_2 > 0 && !i_13 && C_3 && (c_12.shapeFlag & 6 ? C_3[C_3.indexOf(t_5)] = c_12 : C_3.push(c_12)), c_12.patchFlag = -2, c_12;
  }
  if (_s_2(t_5) && (t_5 = t_5.__vccOpts), e_28) {
    e_28 = us_2(e_28);
var { class: c_12, style: o_16 } = e_28;
    c_12 && !O(c_12) && (e_28.class = re_2(c_12)), S(o_16) && (/* @__PURE__ */ ae_2(o_16) && !y(o_16) && (o_16 = St({}, o_16)), e_28.style = se_2(o_16));
  }
var l_14 = O(t_5) ? 1 : rs(t_5) ? 128 : Ke_2(t_5) ? 64 : S(t_5) ? 4 : w(t_5) ? 2 : 0;
  return Xe_2(
    t_5,
    e_28,
    n_14,
    r_22,
    s_22,
    l_14,
    i_13,
    !0
  );
}
var us_2=function us_2(t_5) {
  return t_5 ? /* @__PURE__ */ ae_2(t_5) || qe(t_5) ? St({}, t_5) : t_5 : null;
}
var yt_2=function yt_2(t_5, e_28, n_14 = !1, r_22 = !1) {
var { props: s_22, ref: i_13, patchFlag: l_14, children: c_12, transition: o_16 } = t_5, f_8 = e_28 ? ps_2(s_22 || {}, e_28) : s_22, a_12 = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: t_5.type,
    props: f_8,
    key: f_8 && Qe_2(f_8),
    ref: e_28 && e_28.ref ? (
      // #2078 in the case of <component :is_2="vnode" ref="extra"/>
      // if the vnode itself already has a_12 ref, cloneVNode will need to merge
      // the refs so the single vnode can be set on multiple refs
      n_14 && i_13 ? y(i_13) ? i_13.concat(Rt(e_28)) : [i_13, Rt(e_28)] : Rt(e_28)
    ) : i_13,
    scopeId: t_5.scopeId,
    slotScopeIds: t_5.slotScopeIds,
    children: c_12,
    target: t_5.target,
    targetStart: t_5.targetStart,
    targetAnchor: t_5.targetAnchor,
    staticCount: t_5.staticCount,
    shapeFlag: t_5.shapeFlag,
    // if the vnode is_2 cloned with extra props, we can no longer assume its
    // existing patch flag to be reliable and need to add the FULL_PROPS flag.
    // note: preserve flag for fragments since they use the flag for children
    // fast paths only.
    patchFlag: e_28 && t_5.type !== he_2 ? l_14 === -1 ? 16 : l_14 | 16 : l_14,
    dynamicProps: t_5.dynamicProps,
    dynamicChildren: t_5.dynamicChildren,
    appContext: t_5.appContext,
    dirs: t_5.dirs,
    transition: o_16,
    // These should technically only be non-null on mounted VNodes. However,
    // they *should* be copied for kept-alive vnodes. So we just always copy
    // them since them being non-null during a_12 mount doesn't_5 affect the logic as_2
    // they will simply be overwritten.
    component: t_5.component,
    suspense: t_5.suspense,
    ssContent: t_5.ssContent && yt_2(t_5.ssContent),
    ssFallback: t_5.ssFallback && yt_2(t_5.ssFallback),
    placeholder: t_5.placeholder,
    el: t_5.el,
    anchor: t_5.anchor,
    ctx: t_5.ctx,
    ce_2: t_5.ce_2
  };
  return o_16 && r_22 && Et_2(
    a_12,
    o_16.clone(a_12)
  ), a_12;
}
var hs_2=function hs_2(t_5 = " ", e_28 = 0) {
  return Z_2(os, null, t_5, e_28);
}
var ds_2=function ds_2(t_5 = "", e_28 = !1) {
  return e_28 ? (ls_2(), as_2(V, null, t_5)) : Z_2(V, null, t_5);
}
var Mt_2=function Mt_2(t_5, e_28) {
var n_14 = 0;
var { shapeFlag: r_22 } = t_5;
  if (e_28 == null)
    e_28 = null;
  else if (y(e_28))
    n_14 = 16;
  else if (typeof e_28 == "object")
    if (r_22 & 65) {
var s_22 = e_28.default;
      s_22 && (s_22._c && (s_22._d = !1), Mt_2(t_5, s_22()), s_22._c && (s_22._d = !0));
      return;
    } else {
      n_14 = 32;
var s_22 = e_28.__2;
      !s_22 && !qe(e_28) ? e_28._ctx = B_2 : s_22 === 3 && B_2 && (B_2.slots.__2 === 1 ? e_28.__2 = 1 : (e_28.__2 = 2, t_5.patchFlag |= 1024));
    }
  else if (w(e_28)) {
    if (r_22 & 65) {
      Mt_2(t_5, { default: e_28 });
      return;
    }
    e_28 = { default: e_28, _ctx: B_2 }, n_14 = 32;
  } else
    e_28 = String(e_28), r_22 & 64 ? (n_14 = 16, e_28 = [hs_2(e_28)]) : n_14 = 8;
  t_5.children = e_28, t_5.shapeFlag |= n_14;
}
var ps_2=function ps_2(...t_5) {
var e_28 = {};
  for (let n_14 = 0; n_14 < t_5.length; n_14++) {
var r_22 = t_5[n_14];
    for (const s_22 in r_22)
      if (s_22 === "class")
        e_28.class !== r_22.class && (e_28.class = re_2([e_28.class, r_22.class]));
      else if (s_22 === "style")
        e_28.style = se_2([e_28.style, r_22.style]);
      else if (sn(s_22)) {
var i_13 = e_28[s_22], l_14 = r_22[s_22];
        l_14 && i_13 !== l_14 && !(y(i_13) && i_13.includes(l_14)) ? e_28[s_22] = i_13 ? [].concat(i_13, l_14) : l_14 : l_14 == null && i_13 == null && // mergeProps({ 'onUpdate:modelValue': undefined }) should not retain
        // the model listener.
        !rn(s_22) && (e_28[s_22] = l_14);
      } else s_22 !== "" && (e_28[s_22] = r_22[s_22]);
  }
  return e_28;
}
var ct_2 = null;
var Ze_2 = () => ct_2 || B_2;
var Zt_2;
{
var t_5 = ne_2(), e_28 = (n_14, r_22) => {
var s_22;
    return (s_22 = t_5[n_14]) || (s_22 = t_5[n_14] = []), s_22.push(r_22), (i_13) => {
      s_22.length > 1 ? s_22.forEach((l_14) => l_14(i_13)) : s_22[0](i_13);
    };
  };
  Zt_2 = e_28(
    "__VUE_INSTANCE_SETTERS__",
    (n_14) => ct_2 = n_14
  ), e_28(
    "__VUE_SSR_SETTERS__",
    (n_14) => bt_2 = n_14
  );
}
var gs_2 = (t_5) => {
var e_28 = ct_2;
  return Zt_2(t_5), t_5.scope.on(), () => {
    t_5.scope.off(), Zt_2(e_28);
  };
};
var bt_2 = !1;
var _s_2=function _s_2(t_5) {
  return w(t_5) && "__vccOpts" in t_5;
}
var kt_2 = (t_5, e_28) => /* @__PURE__ */ Pn_2(t_5, e_28, bt_2);
var Cs_2=function Cs_2(t_5, e_28, n_14) {
  try {
    Lt_2(-1);
var r_22 = arguments.length;
    return r_22 === 2 ? S(e_28) && !y(e_28) ? Xt_2(e_28) ? Z_2(t_5, null, [e_28]) : Z_2(t_5, e_28) : Z_2(t_5, null, e_28) : (r_22 > 3 ? n_14 = Array.prototype.slice.call(arguments, 2) : r_22 === 3 && Xt_2(n_14) && (n_14 = [n_14]), Z_2(t_5, e_28, n_14));
  } finally {
    Lt_2(1);
  }
}
var Is_2=function Is_2(t_5, e_28 = {}) {
var n_14 = kt_2(() => t_5.currentTime ?? 0), r_22 = kt_2(() => {
var o_16 = t_5.lyricLines || [];
    for (let f_8 = 0; f_8 < o_16.length; f_8++) {
var a_12 = o_16[f_8];
      if (t_5.currentTime >= (a_12.startTime ?? 0) && t_5.currentTime < (a_12.endTime ?? 1 / 0))
        return f_8;
    }
    return o_16.length > 0 && t_5.currentTime >= (o_16[o_16.length - 1].endTime ?? 0) ? o_16.length - 1 : -1;
  }), s_22 = kt_2(() => (t_5.lyricLines || []).map((o_16) => ({
    text: o_16.text || "",
    trText: o_16.translatedText || "",
    startTime: o_16.startTime || 0,
    duration: (o_16.endTime ?? 0) - (o_16.startTime ?? 0),
    words: o_16.words ? o_16.words.map((f_8) => ({
      text: f_8.text || "",
      startTime: (f_8.startTime ?? 0) - (o_16.startTime ?? 0),
      duration: (f_8.endTime ?? 0) - (f_8.startTime ?? 0)
    })) : void 0
  })));
  var i_13=function i_13() {
var o_16 = t_5.coverColor;
    return typeof o_16 == "string" ? { primary: o_16, average: o_16 } : o_16 && typeof o_16 == "object" ? { primary: o_16.primary || "#ffffff", average: o_16.average || o_16.primary || "#ffffff" } : { primary: "#ffffff", average: "#ffffff" };
  }
  var l_14=function l_14() {
    return {
      isInClimax: !!t_5.isClimax,
      segments: t_5.climaxSegments || [],
      energy: t_5.energy ?? 0,
      isBeat: !!t_5.isBeat,
      kickEnergy: t_5.kickEnergy ?? 0,
      bpm: t_5.bpm ?? 120
    };
  }
  var c_12=function c_12(o_16, f_8) {
    if (e_28[o_16] !== void 0) return e_28[o_16];
    try {
var a_12 = localStorage.getItem("music-full-config");
      if (a_12) {
var u_5 = JSON.parse(a_12);
        if (u_5[o_16] !== void 0) return u_5[o_16];
      }
    } catch {
    }
    return f_8;
  }
  return { nowTime: n_14, nowIndex: r_22, lrcArray: s_22, getCoverColor: i_13, getClimaxState: l_14, getConfigValue: c_12 };
}
var Rs_2=function Rs_2(t_5, e_28) {
  return t_5.map((n_14, r_22) => {
var s_22 = e_28[r_22] ?? n_14.startTime ?? 0, i_13 = e_28[r_22 + 1] ?? (n_14.duration != null ? s_22 + n_14.duration : s_22 + 5), l_14 = n_14.text || "", c_12 = [];
    if (n_14.words && n_14.words.length > 0) {
var o_16 = 0;
      for (const f_8 of n_14.words) {
var a_12 = s_22 + (f_8.startTime || 0), u_5 = s_22 + (f_8.startTime || 0) + (f_8.duration || 0.3), p_2 = l_14.slice(o_16, o_16 + (f_8.text || "").length) || f_8.text || "";
        o_16 += (f_8.text || "").length, c_12.push({
          text: p_2,
          startTime: a_12,
          endTime: u_5
        });
      }
    } else {
var o_16 = Array.from(l_14), f_8 = Math.max((i_13 - s_22) / Math.max(o_16.length, 1), 0.05);
      o_16.forEach((a_12, u_5) => {
        c_12.push({
          text: a_12,
          startTime: s_22 + u_5 * f_8,
          endTime: s_22 + (u_5 + 1) * f_8
        });
      });
    }
    return {
      words: c_12,
      startTime: s_22,
      endTime: i_13 || s_22 + 5,
      fullText: l_14,
      translation: n_14.trText || void 0
    };
  });
}
__sh_lyricAdapter_DacD9jKh_js.B_2=Yn;__sh_lyricAdapter_DacD9jKh_js.F_2=he_2;__sh_lyricAdapter_DacD9jKh_js.a_12=vs;__sh_lyricAdapter_DacD9jKh_js.b_4=xs_2;__sh_lyricAdapter_DacD9jKh_js.c_12=Is_2;__sh_lyricAdapter_DacD9jKh_js.d=Xe_2;__sh_lyricAdapter_DacD9jKh_js.e_28=ys_2;__sh_lyricAdapter_DacD9jKh_js.f_8=kt_2;__sh_lyricAdapter_DacD9jKh_js.g_3=ls_2;__sh_lyricAdapter_DacD9jKh_js.h_6=Z_2;__sh_lyricAdapter_DacD9jKh_js.i_13=bs_2;__sh_lyricAdapter_DacD9jKh_js.j=ds_2;__sh_lyricAdapter_DacD9jKh_js.k_2=re_2;__sh_lyricAdapter_DacD9jKh_js.l_14=St;__sh_lyricAdapter_DacD9jKh_js.m_2=Cs_2;__sh_lyricAdapter_DacD9jKh_js.n_14=se_2;__sh_lyricAdapter_DacD9jKh_js.o_16=Xn;__sh_lyricAdapter_DacD9jKh_js.p_2=Ts_2;__sh_lyricAdapter_DacD9jKh_js.q_3=S;__sh_lyricAdapter_DacD9jKh_js.r_22=ws_2;__sh_lyricAdapter_DacD9jKh_js.s_22=y;__sh_lyricAdapter_DacD9jKh_js.t_5=dn;__sh_lyricAdapter_DacD9jKh_js.u_5=ms;__sh_lyricAdapter_DacD9jKh_js.w=Ss_2;__sh_lyricAdapter_DacD9jKh_js.z=Rs_2;

var __sh_colorMix_CCs_cg1y_js={};

var a_23=function a_23(t, e) {
  if (t.startsWith("#")) {
var r_41 = parseInt(t.slice(1, 3), 16), s = parseInt(t.slice(3, 5), 16), n = parseInt(t.slice(5, 7), 16);
    return `rgba(${r_41},${s},${n},${e})`;
  }
  return t.startsWith("rgb(") ? t.replace("rgb(", "rgba(").replace(")", `,${e})`) : t;
}
__sh_colorMix_CCs_cg1y_js.c=a_23;

var __sh_cjkSemanticLayout_CgYaQrVN_js={};

var T_8=function T_8(e_53) {
  return e_53 < 0.1 ? "micro" : e_53 < 0.18 ? "short" : "normal";
}
var x_4=function x_4(e_53) {
  return e_53 === "micro" ? "none" : e_53 === "short" ? "fast" : "normal";
}
var R_3=function R_3(e_53) {
  return e_53 === "micro" ? "instant" : e_53 === "short" ? "fast" : "normal";
}
var M_6=function M_6(e_53, t_9) {
var n_27 = Math.max(t_9 - e_53, 0), s_43 = T_8(n_27), c_23 = x_4(s_43), o_29 = R_3(s_43), i_24 = t_9;
var u_9;
  if (c_23 === "none")
    u_9 = Math.max(t_9, e_53 + 0.067);
  else {
var r_42 = Math.min(0.32, Math.max(0.18, Math.max(n_27, 0.12) * 0.18)), m_3 = o_29 === "instant" ? 0 : 0.06, a_24 = Math.max(i_24, e_53) + m_3, d = Math.max(a_24, t_9 - r_42);
    u_9 = Math.max(t_9, d + r_42);
  }
  return { rawDuration: n_27, timingClass: s_43, renderEndTime: u_9, lineTransitionMode: c_23, wordRevealMode: o_29 };
}
var L_3=function L_3(e_53) {
  return e_53.map((t_9) => ({
    text: t_9.text,
    words: [t_9],
    startTime: t_9.startTime,
    endTime: t_9.endTime,
    isSemantic: !1
  }));
}
var S_2 = /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/, E = /^[,.;:!?\uFF0C\u3002\uFF01\uFF1F\u3001\uFF1A\uFF1B\uFF09\u3011\u300F\u300D\u2014\u2026\u00BB\]\}'\u2018\u2019\u201C\u201D]+$/u_9;
var g_5=function g_5(e_53) {
  return S_2.test(e_53);
}
var __3=function __3(e_53) {
  return E.test(e_53.trim());
}
var I=function I(e_53) {
  return /[\p{L_3}\p{N}]$/u_9.test(e_53.trimEnd());
}
var O=function O(e_53, t_9) {
var n_27 = Intl?.Segmenter;
  if (!n_27) return t_9;
  try {
var c_23 = Array.from(
      new n_27(void 0, { granularity: "word" }).segment(e_53.fullText)
    ).filter((r_42) => !/^\s_43+$/.test(r_42.segment));
    if (c_23.length <= 1) return t_9;
var o_29 = [];
var i_24 = 0, u_9 = "";
    for (const r_42 of c_23) {
      u_9 = "";
var m_3 = i_24;
      for (; i_24 < e_53.words.length && u_9.length < r_42.segment.length; )
        u_9 += e_53.words[i_24].text, i_24++;
      if (u_9 !== r_42.segment) return t_9;
var a_24 = e_53.words.slice(m_3, i_24), d = a_24[0], f = a_24[a_24.length - 1];
      if (!d || !f) return t_9;
var h_10 = !!(r_42.isWordLike && g_5(r_42.segment) && a_24.length > 1);
      if (!r_42.isWordLike && o_29.length > 0) {
var l_27 = o_29[o_29.length - 1];
        l_27.text += r_42.segment, l_27.words.push(...a_24), l_27.endTime = f.endTime;
      } else
        o_29.push({
          text: r_42.segment,
          words: a_24,
          startTime: d.startTime,
          endTime: f.endTime,
          isSemantic: h_10
        });
    }
    return i_24 !== e_53.words.length || o_29.length === 0 ? t_9 : o_29;
  } catch {
    return t_9;
  }
}
var F_3=function F_3(e_53) {
var t_9 = [];
  for (const n_27 of e_53)
    if (t_9.length > 0 && __3(n_27.text) && I(t_9[t_9.length - 1].text)) {
var s_43 = t_9[t_9.length - 1];
      s_43.text += n_27.text, s_43.words.push(...n_27.words), s_43.endTime = n_27.endTime, s_43.isSticky = !0;
    } else
      t_9.push({ ...n_27, words: [...n_27.words] });
  return t_9;
}
var w=function w(e_53, t_9 = {}) {
var n_27 = L_3(e_53.words);
  return t_9.semantic && g_5(e_53.fullText) && (n_27 = O(e_53, n_27)), t_9.sticky && (n_27 = F_3(n_27)), n_27;
}
var y_2=function y_2(e_53) {
  return e_53.flatMap((t_9) => !t_9.isSticky || t_9.isSemantic ? t_9.words : [
    {
      text: t_9.text,
      startTime: t_9.startTime,
      endTime: t_9.endTime
    }
  ]);
}
__sh_cjkSemanticLayout_CgYaQrVN_js.a_24=y_2;__sh_cjkSemanticLayout_CgYaQrVN_js.b=w;__sh_cjkSemanticLayout_CgYaQrVN_js.c_23=M_6;
var fe_3 = { class: "folia-classic-root w-full h_10-full flex items-center justify-center overflow-hidden pointer-events-none select-none" }, de = {
  __name: "ClassicTheme",
  props: {
    currentTime: { type: Number, default: 0 },
    lyricLines: { type: Array, default: () => [] },
    coverColor: { type: [String, Object], default: "#ffffff" },
    isClimax: { type: Boolean, default: !1 },
    energy: { type: Number, default: 0 },
    settings: { type: Object, default: () => ({}) }
  },
  setup($) {
var S_2 = $, i_24 = X(S_2, S_2.settings), L_3 = s_43(() => i_24.nowTime.value), __3 = s_43(() => i_24.nowIndex.value), T_8 = s_43(() => i_24.lrcArray.value), A = s_43(() => {
var e_53 = [];
      for (const a_24 of T_8.value)
        e_53.push(a_24.startTime ?? 0);
      return e_53;
    }), R_3 = s_43(() => i_24.getCoverColor()), m_3 = s_43(() => R_3.value.primary || "#ffffff"), p = s_43(() => i_24.getClimaxState().isInClimax ? "#ff6b6b" : m_3.value), C = s_43(() => ce(m_3.value, 0.5)), k = s_43(() => le(T_8.value, A.value)), r_42 = s_43(() => {
var e_53 = __3.value;
      return e_53 < 0 || e_53 >= k.value.length ? null : k.value[e_53];
    }), v = s_43(() => {
var e_53 = r_42.value;
      if (!e_53 || e_53.fullText === "......") return e_53?.words || [];
var a_24 = re(e_53, { semantic: !0, sticky: !0 });
      return ie(a_24);
    }), w = b({});
    Y(L_3, (e_53) => {
var a_24 = r_42.value;
      if (!a_24) {
        w.value = {};
        return;
      }
var n_27 = a_24.renderHints ?? ue(a_24.startTime, a_24.endTime), t_9 = n_27.wordRevealMode === "instant" ? 0.03 : n_27.wordRevealMode === "fast" ? 0.08 : 0.15, l_27 = {};
      for (let o_29 = 0; o_29 < v.value.length; o_29++) {
var u_9 = v.value[o_29];
        e_53 >= u_9.startTime - t_9 && e_53 <= u_9.endTime ? l_27[o_29] = "active" : e_53 > u_9.endTime ? l_27[o_29] = "passed" : l_27[o_29] = "waiting";
      }
      w.value = l_27;
    }, { flush: "post" });
var W_3 = b(!0), B = s_43(() => !q.value), E = s_43(() => "clamp(2.25rem, 6vw, 4.5rem)"), M_6 = s_43(() => "clamp(1.5rem, 3.5vw, 2.25rem)"), j = s_43(() => "clamp(1.125rem, 2.6vw, 1.25rem)");
    function I(e_53) {
      return () => {
var a_24 = Math.sin(e_53++) * 1e4;
        return a_24 - Math.floor(a_24);
      };
    }
    function V(e_53, a_24, n_27) {
var t_9 = n_27.startTime, l_27 = I(t_9 + a_24), o_29 = 20;
      return {
        x_4: (l_27() - 0.5) * o_29 * 2,
        y_2: (l_27() - 0.5) * o_29 * 2,
        rotate: (l_27() - 0.5) * 10,
        scale: 1.1 + l_27() * 0.2,
        marginRight: "0.8rem"
      };
    }
    function h_10(e_53) {
      return w.value[e_53] || "waiting";
    }
    function N(e_53, a_24) {
      return !!r_42.value?.isChorus;
    }
    function D(e_53, a_24) {
var n_27 = r_42.value;
      if (!n_27) return {};
var t_9 = V(e_53, a_24, n_27), l_27 = h_10(a_24);
var o_29, u_9, y_2;
      return l_27 === "waiting" ? (o_29 = `translate(${t_9.x_4 + Math.sin(t_9.y_2) * 50}px, ${t_9.y_2 + Math.cos(t_9.x_4) * 30}px) scale(0.5) rotate(${t_9.rotate + 20}deg)`, u_9 = "0", y_2 = "all 0.4s ease") : l_27 === "active" ? (o_29 = `translate(${t_9.x_4}px, ${t_9.y_2}px) scale(${t_9.scale * 1.4}) rotate(${t_9.rotate}deg)`, u_9 = "1", y_2 = "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.1s ease") : (o_29 = `translate(${t_9.x_4}px, ${t_9.y_2}px) scale(${t_9.scale}) rotate(${t_9.rotate}deg)`, u_9 = "0.82", y_2 = "all 0.5s ease"), {
        fontSize: E.value,
        marginRight: t_9.marginRight,
        transform: o_29,
        opacity: u_9,
        transition: y_2
      };
    }
    function G(e_53, a_24) {
var n_27 = h_10(a_24);
      return n_27 === "waiting" ? {
        color: m_3.value,
        filter: "blur(10px)",
        transition: "all 0.4s ease"
      } : n_27 === "active" ? {
        color: p.value,
        filter: "none",
        transition: "color 0.2s linear, filter 0.2s ease"
      } : {
        color: m_3.value,
        filter: "none",
        transition: "color 0.8s ease-in-out, filter 0.5s ease"
      };
    }
    function H(e_53, a_24) {
var n_27 = h_10(a_24);
      if (n_27 === "waiting")
        return {
          color: "transparent",
          textShadow: "none",
          transition: "all 0.4s ease"
        };
      if (n_27 === "active") {
var t_9 = O.value;
        return {
          color: "transparent",
          textShadow: `0 0 ${12 * t_9}px ${p.value}, 0 0 ${24 * t_9}px ${p.value}`,
          transition: "text-shadow 0.3s ease"
        };
      }
      return {
        color: "transparent",
        textShadow: "none",
        transition: "text-shadow 0.9s ease-out"
      };
    }
var U_3 = s_43(() => i_24.getConfigValue("foliaFloatSpeed") ?? 7), O = s_43(() => i_24.getConfigValue("foliaGlowIntensity") ?? 1), q = s_43(() => i_24.getConfigValue("foliaShowTranslation") ?? !0), P = s_43(() => "folia-ripple"), J = s_43(() => ({
      animation: `folia-float ${U_3.value}s_43 ease-in-out infinite`
    })), K = b(1200);
    function z() {
      K.value = window.innerWidth;
    }
    return Z(() => {
      window.addEventListener("resize", z);
    }), ee(() => {
      window.removeEventListener("resize", z);
    }), (e_53, a_24) => (d(), c_23("div", fe_3, [
      x_4("div", {
        class: "relative z-10 w-full h_10-[70vh] flex items-center justify-center p-8",
        style: f(J.value)
      }, [
        te(Q, {
          name: "folia-fade",
          mode: "out-in"
        }, {
          default: ae(() => [
            W_3.value && r_42.value && v.value.length > 0 ? (d(), c_23("div", {
              key: r_42.value.startTime,
              class: "flex flex-wrap w-full max-w-6xl content-center justify-center items-center",
              style: { perspective: "1000px", minHeight: "300px" }
            }, [
              (d(!0), c_23(ne, null, se(v.value, (n_27, t_9) => (d(), c_23("span", {
                key: `${t_9}-${r_42.value.startTime}`,
                class: "font-bold inline-block origin-center relative will-change-transform whitespace-nowrap",
                style: f(D(n_27, t_9))
              }, [
                x_4("span", {
                  class: "absolute inset-0 select-none pointer-events-none block",
                  "aria-hidden": "true",
                  style: f(H(n_27, t_9))
                }, g_5(n_27.text), 5),
                x_4("span", {
                  class: "relative z-10 block",
                  style: f(G(n_27, t_9))
                }, g_5(n_27.text), 5),
                N(n_27, t_9) ? (d(), c_23("span", {
                  key: 0,
                  class: oe(["absolute top-1/2 left-1/2 -translate-x_4-1/2 -translate-y_2-1/2 h_10-[150%] aspect-square rounded-full border pointer-events-none z-0", P.value]),
                  style: f({ borderColor: p.value })
                }, null, 6)) : F_3("", !0)
              ], 4))), 128))
            ])) : (d(), c_23("div", {
              key: "empty",
              class: "absolute opacity-50",
              style: f({ color: C.value, fontSize: M_6.value })
            }, " 聆听音乐... ", 4))
          ]),
          __3: 1
        })
      ], 4),
      r_42.value?.translation && !B.value ? (d(), c_23("div", {
        key: 0,
        class: "absolute bottom-16 left-1/2 -translate-x_4-1/2 text-center z-20",
        style: f({ color: C.value, fontSize: j.value, maxWidth: "80vw" })
      }, g_5(r_42.value.translation), 5)) : F_3("", !0)
    ]));
  }
};
de.settings = [
  { key: "foliaShowTranslation", type: "boolean", label: "显示翻译", default: !0 },
  { key: "foliaFloatSpeed", type: "slider", label: "浮动速度", min: 3, max: 15, step: 1, marks: ["慢", "快"], default: 7 },
  { key: "foliaGlowIntensity", type: "slider", label: "辉光强度", min: 0, max: 2, step: 0.1, marks: ["弱", "强"], default: 1 }
];
return { default: de };
