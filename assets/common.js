/* ============================================================
 *  Birthday Kit — 共享交互库
 *  所有风格页共用：名字参数 / 音效 / 生日歌 / 五彩纸屑 / 打字机 / 滚动出现
 *  纯原生实现，无任何外部依赖，可离线用 file:// 直接打开。
 * ============================================================ */
(function () {
  'use strict';

  var OPTS = window.BD_OPTS || {};
  var params = new URLSearchParams(location.search);
  var store = {
    get: function (k, d) { try { return localStorage.getItem('bd_' + k) || d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('bd_' + k, v); } catch (e) {} }
  };

  var BD = {
    // 优先级：网址参数 > 页面自带的 BD_OPTS（定制页用）> 上次填过的 > 默认值
    name: params.get('name') || OPTS.name || store.get('name', 'Jing'),
    age: params.get('age') || OPTS.age || store.get('age', ''),
    from: params.get('from') || OPTS.from || store.get('from', '爱你的人'),
    theme: params.get('theme') || ''
  };
  if (params.get('name')) store.set('name', params.get('name'));
  if (params.get('age')) store.set('age', params.get('age'));
  if (params.get('from')) store.set('from', params.get('from'));

  /* ---------- 小工具 ---------- */
  BD.$ = function (s, r) { return (r || document).querySelector(s); };
  BD.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  BD.rand = function (a, b) { return a + Math.random() * (b - a); };
  BD.randInt = function (a, b) { return Math.floor(BD.rand(a, b + 1)); };
  BD.pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  BD.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  BD.template = function (s) {
    return String(s)
      .replace(/\{name\}/g, BD.name)
      .replace(/\{age\}/g, BD.age)
      .replace(/\{from\}/g, BD.from);
  };
  BD.ready = function (fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  };
  // 兼容：字符串选择器 / 单个元素 / NodeList / 数组
  BD.list = function (el) {
    if (typeof el === 'string') return BD.$$(el);
    if (!el) return [];
    if (el.addEventListener || el === window || el === document) return [el];
    if (typeof el.length === 'number') return Array.prototype.slice.call(el);
    return [el];
  };
  BD.on = function (el, ev, fn, o) {
    var list = BD.list(el);
    list.forEach(function (n) { if (n && n.addEventListener) n.addEventListener(ev, fn, o); });
    return list;
  };
  BD.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  /* ---------- 注入基础样式（出现动画 + 控制按钮） ---------- */
  var CSS = [
    '[data-bd-reveal]{opacity:0;transform:translateY(26px);transition:opacity .9s cubic-bezier(.2,.7,.3,1),transform .9s cubic-bezier(.2,.7,.3,1)}',
    '[data-bd-reveal].bd-in{opacity:1;transform:none}',
    '#bd-kit{position:fixed;right:14px;bottom:14px;z-index:2147483000;display:flex;gap:8px;font:13px/1 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}',
    '#bd-kit button{width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.35);background:rgba(20,20,30,.42);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:#fff;font-size:17px;cursor:pointer;display:grid;place-items:center;transition:transform .18s,background .18s;padding:0;box-shadow:0 6px 18px rgba(0,0,0,.22)}',
    '#bd-kit button:hover{transform:translateY(-2px) scale(1.06);background:rgba(40,40,60,.6)}',
    '#bd-kit button:active{transform:scale(.94)}',
    '#bd-kit button.off{opacity:.45}',
    '#bd-kit .bd-tip{position:absolute;bottom:46px;right:0;white-space:nowrap;background:rgba(20,20,30,.8);color:#fff;font-size:11px;padding:4px 8px;border-radius:6px;opacity:0;transition:opacity .2s;pointer-events:none}',
    '#bd-kit button:hover .bd-tip{opacity:1}',
    '#bd-confetti{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147482000}'
  ].join('');
  var styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);

  /* ---------- 滚动出现 ---------- */
  BD.reveal = function (sel) {
    var nodes = sel ? BD.$$(sel) : BD.$$('[data-bd-reveal]');
    if (!('IntersectionObserver' in window)) {
      nodes.forEach(function (n) { n.classList.add('bd-in'); });
      return;
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) {
          var d = e.target.getAttribute('data-bd-delay') || 0;
          setTimeout(function () { e.target.classList.add('bd-in'); }, +d);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    nodes.forEach(function (n) { io.observe(n); });
  };

  /* ---------- 名字填充 ---------- */
  BD.apply = function () {
    BD.$$('[data-bd]').forEach(function (n) {
      var k = n.getAttribute('data-bd');
      if (k === 'name' || k === 'age' || k === 'from') n.textContent = BD[k];
    });
    if (!BD.age) BD.$$('[data-bd-if-age]').forEach(function (n) { n.remove(); });
    else BD.$$('[data-bd-if-noage]').forEach(function (n) { n.remove(); });
    // 支持文本里的 {name} 占位
    BD.$$('[data-bd-tpl]').forEach(function (n) { n.textContent = BD.template(n.textContent); });
  };

  /* ============================================================
   *  音效引擎（WebAudio 合成，无需音频文件）
   * ============================================================ */
  var Sound = (function () {
    var ctx = null, master = null, noiseBuf = null;
    var muted = store.get('muted', '0') === '1';

    function init() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(ctx.destination);
      // 噪声缓冲（吹蜡烛 / 礼炮）
      var len = Math.floor(ctx.sampleRate * 1.2);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return ctx;
    }
    function tone(opt) {
      if (muted || !init()) return;
      var t0 = ctx.currentTime + (opt.delay || 0);
      var dur = opt.dur || 0.18;
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = opt.type || 'sine';
      osc.frequency.setValueAtTime(opt.freq, t0);
      if (opt.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opt.to), t0 + dur);
      var vol = (opt.vol == null ? 0.18 : opt.vol);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + (opt.attack || 0.012));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(master);
      osc.start(t0); osc.stop(t0 + dur + 0.05);
    }
    function noise(opt) {
      if (muted || !init()) return;
      var t0 = ctx.currentTime + (opt.delay || 0);
      var dur = opt.dur || 0.5;
      var src = ctx.createBufferSource(); src.buffer = noiseBuf;
      var f = ctx.createBiquadFilter(); f.type = opt.filter || 'lowpass';
      f.frequency.setValueAtTime(opt.freq || 1200, t0);
      if (opt.to) f.frequency.exponentialRampToValueAtTime(Math.max(60, opt.to), t0 + dur);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(opt.vol == null ? 0.25 : opt.vol, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t0); src.stop(t0 + dur + 0.05);
    }
    var API = {
      init: init,
      get muted() { return muted; },
      setMuted: function (m) {
        muted = !!m; store.set('muted', muted ? '1' : '0');
        if (master) master.gain.value = muted ? 0 : 0.9;
        if (muted) Music.stop();
      },
      tone: tone,
      noise: noise,
      pop: function (delay) { tone({ freq: 620, to: 1500, dur: 0.12, type: 'sine', vol: 0.2, delay: delay }); },
      click: function () { tone({ freq: 900, to: 500, dur: 0.07, type: 'triangle', vol: 0.12 }); },
      chime: function (f, delay) { tone({ freq: f || 880, dur: 0.7, type: 'sine', vol: 0.16, delay: delay }); tone({ freq: (f || 880) * 2, dur: 0.5, type: 'sine', vol: 0.06, delay: delay }); },
      sparkle: function () { var b = BD.pick([1046, 1174, 1318, 1568, 1760]); tone({ freq: b, dur: 0.35, type: 'triangle', vol: 0.12 }); tone({ freq: b * 1.5, dur: 0.25, type: 'sine', vol: 0.05, delay: 0.05 }); },
      blow: function () { noise({ dur: 0.75, freq: 900, to: 180, vol: 0.3 }); },
      whoosh: function () { noise({ dur: 0.42, freq: 300, to: 2200, filter: 'bandpass', vol: 0.18 }); },
      boom: function () { noise({ dur: 0.5, freq: 260, to: 60, vol: 0.35 }); tone({ freq: 90, to: 40, dur: 0.5, type: 'sine', vol: 0.2 }); },
      fanfare: function () {
        [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) {
          tone({ freq: f, dur: 0.55, type: 'triangle', vol: 0.16, delay: i * 0.09 });
        });
      },
      success: function () {
        [659.25, 783.99, 1046.5].forEach(function (f, i) {
          tone({ freq: f, dur: 0.4, type: 'triangle', vol: 0.14, delay: i * 0.08 });
        });
      }
    };
    return API;
  })();

  /* ============================================================
   *  生日歌（音乐盒音色）
   *  · 点一下 = 播一遍，放完自动收尾，按钮自动复位成 🎵
   *  · 播放中再点 = 立刻暂停（直接掐断已排进音频图的音符，不会拖到放完）
   * ============================================================ */
  var Music = (function () {
    var playing = false, out = null, endAt = 0, tick = null;
    var F = { G4: 392.0, A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, C4: 261.63, E4: 329.63 };
    var MEL = [
      ['G4', .75], ['G4', .25], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 2],
      ['G4', .75], ['G4', .25], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 2],
      ['G4', .75], ['G4', .25], ['G5', 1], ['E5', 1], ['C5', 1], ['B4', 1], ['A4', 2],
      ['F5', .75], ['F5', .25], ['E5', 1], ['C5', 1], ['D5', 1], ['C5', 2]
    ];
    var BEAT = 0.42;

    /* 音乐走一条独立总线：要暂停时把这条总线断开，正响着的音符会立刻消失，
       不会出现"按了暂停但还在唱"或"再点一次两首歌叠着放" */
    function newBus(ctx) {
      out = ctx.createGain();
      out.gain.value = Sound.muted ? 0 : 0.9;
      out.connect(ctx.destination);
      return out;
    }
    function bus(ctx) { return (out && out.context === ctx) ? out : newBus(ctx); }

    function silence(fade) {
      fade = fade == null ? 0.09 : fade;
      var dead = out;
      out = null;                        // 下一次 start 会建一条全新的总线
      if (!dead) return;
      try {
        var t = dead.context.currentTime;
        dead.gain.cancelScheduledValues(t);
        dead.gain.setValueAtTime(dead.gain.value, t);
        dead.gain.linearRampToValueAtTime(0.0001, t + fade);
      } catch (e) {}
      setTimeout(function () { try { dead.disconnect(); } catch (e) {} }, fade * 1000 + 120);
    }

    function note(freq, at, dur) {
      var ctx = Sound.init(); if (!ctx) return;
      var t0 = ctx.currentTime + at;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      var o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      o1.type = 'triangle'; o1.frequency.value = freq;
      o2.type = 'sine'; o2.frequency.value = freq * 2;
      var g2 = ctx.createGain(); g2.gain.value = 0.25;
      o1.connect(g); o2.connect(g2); g2.connect(g);
      o1.start(t0); o2.start(t0);
      o1.stop(t0 + dur + 0.05); o2.stop(t0 + dur + 0.05);
      g.connect(bus(ctx));
    }
    function schedule() {
      var t = 0.15, total = 0;
      MEL.forEach(function (n) {
        var dur = n[1] * BEAT;
        note(F[n[0]], t, dur * 1.55);
        t += dur;
      });
      total = t;
      // 低音伴奏：每小节根音
      [0, 6, 12, 18].forEach(function (bi, i) {
        var off = 0; for (var k = 0; k < bi; k++) off += MEL[k][1] * BEAT;
        var f = [130.81, 174.61, 196.0, 174.61][i % 4];
        var ctx = Sound.init(); if (!ctx) return;
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + 0.15 + off);
        g.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.15 + off + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15 + off + 2.4);
        o.connect(g); g.connect(bus(ctx));
        o.start(ctx.currentTime + 0.15 + off); o.stop(ctx.currentTime + 0.15 + off + 2.5);
      });
      return total;
    }

    function sync() {
      document.dispatchEvent(new CustomEvent('bd:music', { detail: { playing: playing } }));
      if (window.BD_UI_SYNC) window.BD_UI_SYNC();
    }

    var API = {
      get playing() { return playing; },
      start: function () {
        if (playing) return;                       // 已经在放就直接忽略，不会叠加
        var ctx = Sound.init(); if (!ctx) return;
        silence(0.02);                             // 保险：清掉上一次的残留
        newBus(ctx);
        playing = true;
        var len = schedule();
        endAt = ctx.currentTime + len + 0.9;
        clearInterval(tick);
        // 用短轮询判断"这一遍放完了"，比长定时器稳（后台标签页节流也不会算错）
        tick = setInterval(function () {
          if (!playing) { clearInterval(tick); tick = null; return; }
          var c = out && out.context;
          if (c && c.currentTime >= endAt) API.finish();
        }, 250);
        sync();
      },
      /* 一遍播完：自动收尾，按钮复位成 🎵 */
      finish: function () {
        if (!playing) return;
        playing = false;
        clearInterval(tick); tick = null;
        silence(0.35);
        sync();
      },
      /* 用户主动暂停：立刻静音 */
      stop: function () {
        if (!playing && !out) return;
        playing = false;
        clearInterval(tick); tick = null;
        silence(0.08);
        sync();
      },
      toggle: function () { playing ? API.stop() : API.start(); return playing; },
      applyMute: function () { if (out) out.gain.value = Sound.muted ? 0 : 0.9; },
      _debug: function () { return { playing: playing, bus: !!out }; }
    };
    return API;
  })();

  /* ============================================================
   *  五彩纸屑 / 礼花
   * ============================================================ */
  var Confetti = (function () {
    var cv = null, cx = null, parts = [], raf = 0, dpr = 1, last = 0;
    var COLORS = ['#ff5c8a', '#ffd166', '#5ee1c4', '#7aa2ff', '#c77dff', '#ff8f5c', '#fff1a8', '#8ce99a'];
    var SHAPES = ['rect', 'circle', 'ribbon'];

    function ensure() {
      if (cv) return;
      cv = document.createElement('canvas');
      cv.id = 'bd-confetti';
      document.body.appendChild(cv);
      cx = cv.getContext('2d');
      resize();
      window.addEventListener('resize', resize);
    }
    function resize() {
      if (!cv) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.floor(innerWidth * dpr);
      cv.height = Math.floor(innerHeight * dpr);
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function make(x, y, o) {
      o = o || {};
      var ang = o.angle == null ? BD.rand(0, Math.PI * 2) : o.angle + BD.rand(-0.5, 0.5);
      var pow = (o.power || 9) * BD.rand(0.45, 1.15);
      return {
        x: x, y: y,
        vx: Math.cos(ang) * pow * (o.drift == null ? 1 : o.drift),
        vy: Math.sin(ang) * pow - BD.rand(0, 2.2),
        w: BD.rand(5, 11), h: BD.rand(7, 15),
        rot: BD.rand(0, 6.28), vr: BD.rand(-0.22, 0.22),
        c: (o.colors && o.colors.length ? BD.pick(o.colors) : BD.pick(COLORS)),
        shape: BD.pick(SHAPES),
        life: 1, decay: BD.rand(0.006, 0.013), wob: BD.rand(0, 6.28), wobS: BD.rand(0.03, 0.09),
        grav: o.gravity == null ? 0.19 : o.gravity, drag: o.drag == null ? 0.988 : o.drag
      };
    }
    function loop(ts) {
      var dt = Math.min((ts - last) / 16.67 || 1, 2.4); last = ts;
      cx.clearRect(0, 0, innerWidth, innerHeight);
      for (var i = parts.length - 1; i >= 0; i--) {
        var p = parts[i];
        p.wob += p.wobS;
        p.vy += p.grav * dt;
        p.vx *= Math.pow(p.drag, dt);
        p.vy *= Math.pow(p.drag, dt);
        p.x += (p.vx + Math.sin(p.wob) * 0.6) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.life -= p.decay * dt;
        if (p.y > innerHeight + 60 || p.life <= 0 || p.x < -80 || p.x > innerWidth + 80) { parts.splice(i, 1); continue; }
        cx.save();
        cx.translate(p.x, p.y);
        cx.rotate(p.rot);
        cx.globalAlpha = BD.clamp(p.life, 0, 1);
        cx.fillStyle = p.c;
        if (p.shape === 'circle') { cx.beginPath(); cx.arc(0, 0, p.w * 0.5, 0, 6.2832); cx.fill(); }
        else if (p.shape === 'ribbon') { cx.fillRect(-p.w * 0.22, -p.h * 0.7, p.w * 0.44, p.h * 1.4); }
        else { cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * (0.4 + Math.abs(Math.cos(p.rot)) * 0.6)); }
        cx.restore();
      }
      if (parts.length) raf = requestAnimationFrame(loop);
      else { raf = 0; cx.clearRect(0, 0, innerWidth, innerHeight); }
    }
    function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }

    return {
      burst: function (x, y, o) {
        ensure(); o = o || {};
        var n = o.count || 46;
        for (var i = 0; i < n; i++) parts.push(make(x, y, o));
        kick();
      },
      rain: function (o) {
        ensure(); o = o || {};
        var dur = o.duration || 3500, rate = o.rate || 90, t = 0;
        var iv = setInterval(function () {
          t += rate;
          if (t > dur) { clearInterval(iv); return; }
          for (var i = 0; i < (o.perTick || 3); i++) {
            var p = make(BD.rand(0, innerWidth), -20, {
              angle: Math.PI / 2, power: BD.rand(1.2, 3.4), gravity: 0.075, drag: 0.995, colors: o.colors
            });
            p.vr = BD.rand(-0.1, 0.1);
            parts.push(p);
          }
          kick();
        }, rate);
      },
      cannon: function (o) {
        ensure();
        Confetti.burst(0, innerHeight - 10, Object.assign({ angle: -Math.PI / 3.1, power: 15, count: 40 }, o));
        Confetti.burst(innerWidth, innerHeight - 10, Object.assign({ angle: -Math.PI + Math.PI / 3.1, power: 15, count: 40 }, o));
      },
      clear: function () { parts.length = 0; },
      get count() { return parts.length; }
    };
  })();

  /* ---------- 大礼花：一次性把气氛拉满 ---------- */
  BD.celebrate = function () {
    Confetti.cannon();
    setTimeout(function () { Confetti.cannon(); }, 260);
    Confetti.rain({ duration: 2600 });
    Sound.fanfare();
  };

  /* ---------- 打字机 ---------- */
  BD.typewriter = function (el, text, o) {
    o = o || {};
    var speed = o.speed || 55, i = 0, stopped = false, timer = null;
    el.textContent = '';
    el.classList.add('bd-typing');
    function step() {
      if (stopped) return;
      el.textContent = text.slice(0, ++i);
      if (i % 2 === 0) Sound.tone({ freq: 1400 + BD.rand(-160, 260), dur: 0.03, type: 'square', vol: 0.045 });
      if (i < text.length) timer = setTimeout(step, speed * BD.rand(0.6, 1.5));
      else { el.classList.remove('bd-typing'); o.onDone && o.onDone(); }
    }
    timer = setTimeout(step, o.delay || 240);
    return {
      skip: function () { stopped = true; clearTimeout(timer); el.textContent = text; el.classList.remove('bd-typing'); o.onDone && o.onDone(); },
      get done() { return i >= text.length; }
    };
  };

  /* ---------- 右下角控制条 ---------- */
  BD.ready(function () {
    BD.apply();
    BD.reveal();
    if (OPTS.ui === false) return;
    var kit = document.createElement('div');
    kit.id = 'bd-kit';
    kit.innerHTML =
      '<button id="bd-music" title="生日快乐歌"><span>🎵</span><span class="bd-tip">播放生日歌</span></button>' +
      '<button id="bd-mute" title="音效开关"><span>🔊</span><span class="bd-tip">音效开关</span></button>';
    document.body.appendChild(kit);
    var mb = BD.$('#bd-music'), mu = BD.$('#bd-mute');
    window.BD_UI_SYNC = function () {
      mb.classList.toggle('off', !Music.playing);
      mb.querySelector('span').textContent = Music.playing ? '⏸' : '🎵';
      mb.querySelector('.bd-tip').textContent = Music.playing ? '暂停生日歌' : '播放生日歌';
      mu.classList.toggle('off', Sound.muted);
      mu.querySelector('span').textContent = Sound.muted ? '🔇' : '🔊';
    };
    window.BD_UI_SYNC();
    mb.addEventListener('click', function () { Music.toggle(); Sound.click(); });
    mu.addEventListener('click', function () {
      Sound.setMuted(!Sound.muted);
      document.dispatchEvent(new Event('bd:mute'));
      if (!Sound.muted) Sound.click();
      window.BD_UI_SYNC();
    });
    // 首次交互解锁音频
    var unlock = function () { Sound.init(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  });

  BD.sound = Sound;
  BD.music = Music;
  BD.confetti = Confetti;
  window.BD = BD;
})();
