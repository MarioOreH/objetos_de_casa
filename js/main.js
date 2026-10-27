/**
 * @fileoverview Diccionario Digital Interactivo — Los objetos que utilizo en casa
 *
 * INICIO → si existe assets/video/inicio.mp4 se usa como presentación; si no, se
 * muestra en bucle el video del primer objeto.
 *
 * LECCIÓN → un VIDEO por objeto (en bucle, SIN sonido) y su frase: primero qué es y
 * luego cómo lo uso. Entre objetos hay fundido cruzado: el video nuevo aparece encima
 * del anterior, nunca se ve la pantalla vacía. La voz lee la frase.
 *
 * JUEGO → los 5 videos en recuadros, cada uno en bucle y de forma independiente;
 * se toca el video que responde a la pregunta.
 *
 * VIDEOS: cada objeto usa dos archivos en assets/video/ — uno 4:3 para la lección
 * (taza.mp4) y uno cuadrado y liviano para el juego (taza_card.mp4), recortados y
 * sin audio. Si falta el video de un objeto, se omite automáticamente.
 *
 * @version 1.0.0
 */

'use strict';

/* ============================================================
   DATOS
   ============================================================ */

const VID = './assets/video/';

/** Duración del fundido cruzado entre acciones (debe coincidir con el CSS: 1s). */
const TRANSITION_MS = 1000;

/** Video de presentación opcional de la pantalla de inicio (sin sonido). */
const INTRO_VIDEO = VID + 'inicio.mp4';
let INTRO_OK = false;

/** Los 5 objetos de la casa. Si el archivo de video no existe, el objeto se omite. */
const ITEMS = [
  {
    id: 'taza', label: 'TAZA', icon: '☕', color: '#e8588d',
    phrase:   'Taza, es un vasito hondo con un asa para agarrar.\nTomo mi leche en la taza.',
    question: '¿Quién toma leche en la taza?',
    answer:   'Toma leche en la taza.',
    video: VID + 'taza.mp4',                    // lección (4:3)
    card:  VID + 'taza_card.mp4',               // juego (cuadrado, liviano)
  },
  {
    id: 'cuchara', label: 'CUCHARA', icon: '🥄', color: '#f29a00',
    phrase:   'Cuchara, es una palita de metal para comer la comida.\nComo mi sopita con la cuchara.',
    question: '¿Quién come sopa con la cuchara?',
    answer:   'Come sopa con la cuchara.',
    video: VID + 'cuchara.mp4',
    card:  VID + 'cuchara_card.mp4',
  },
  {
    id: 'escoba', label: 'ESCOBA', icon: '🧹', color: '#3aa655',
    phrase:   'Escoba, es un palo largo con pelos para barrer el piso.\nBarro el salón con la escoba.',
    question: '¿Quién barre con la escoba?',
    answer:   'Barre el salón con la escoba.',
    video: VID + 'escoba.mp4',
    card:  VID + 'escoba_card.mp4',
  },
  {
    id: 'lampara', label: 'LÁMPARA', icon: '💡', color: '#2f80ed',
    phrase:   'Lámpara, es un foquito con tapa que ilumina la casa.\nPrendo la lámpara para ver en la noche.',
    question: '¿Quién prende la lámpara?',
    answer:   'Prende la lámpara para ver en la noche.',
    video: VID + 'lampara.mp4',
    card:  VID + 'lampara_card.mp4',
  },
  {
    id: 'cocina', label: 'COCINA', icon: '🍳', color: '#7b3fd4',
    phrase:   'Cocina, es un aparato con fuego para calentar los alimentos.\nMamá prepara la comida en la cocina.',
    question: '¿Quién prepara la comida en la cocina?',
    answer:   'Mamá prepara la comida en la cocina.',
    video: VID + 'cocina.mp4',
    card:  VID + 'cocina_card.mp4',
  },
];

/** Objetos con video disponible (se llena al iniciar). */
let ACTIVE = [];

/* ============================================================
   UTILIDADES
   ============================================================ */

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ============================================================
   VOZ VIRTUAL (SpeechSynthesis del navegador, sin archivos de audio)
   ============================================================ */

class VoiceManager {
  constructor() {
    this._synth  = 'speechSynthesis' in window ? window.speechSynthesis : null;
    this._voice  = null;
    this._muted  = false;
    this._timer  = 0;
    this._resolve = null;
    if (this._synth) {
      this._pickVoice();
      this._synth.addEventListener?.('voiceschanged', () => this._pickVoice());
    }
  }

  get muted()    { return this._muted; }
  get hasVoice() { return !!this._voice; }

  /** Elige la mejor voz en español disponible (prefiere es-PE / es-419 / es-US / es-MX). */
  _pickVoice() {
    const all = this._synth.getVoices();
    const es  = all.filter((v) => /^es([-_]|$)/i.test(v.lang));
    if (!es.length) { this._voice = null; return; }
    const rank = (v) => {
      const lang = v.lang.replace('_', '-').toLowerCase();
      const order = ['es-pe', 'es-419', 'es-us', 'es-mx', 'es-co', 'es-ar', 'es-es'];
      let s = order.indexOf(lang); s = s < 0 ? order.length : s;
      if (/google|natural|online|neural|premium|paulina|monica|sabina|helena|laura/i.test(v.name)) s -= 0.5;
      return s;
    };
    this._voice = es.sort((a, b) => rank(a) - rank(b))[0];
  }

  /** Lee el texto. Devuelve una promesa que se cumple al terminar (o al cancelarse). */
  speak(text) {
    this.stop();
    if (!this._synth || this._muted) return Promise.resolve();
    return new Promise((resolve) => {
      this._resolve = resolve;
      const u = new SpeechSynthesisUtterance(text);
      u.lang   = this._voice ? this._voice.lang : 'es-PE';
      if (this._voice) u.voice = this._voice;
      u.rate   = 0.9;     // un poco más lento para niños
      u.pitch  = 1.1;
      const done = () => { clearTimeout(this._timer); if (this._resolve === resolve) this._resolve = null; resolve(); };
      u.onend = done; u.onerror = done;
      // Respaldo: si el navegador nunca avisa que terminó
      this._timer = setTimeout(done, 1500 + text.length * 110);
      // Pequeño retraso: evita que cancel() + speak() seguidos se pierdan en Chrome
      setTimeout(() => { if (this._resolve === resolve) this._synth.speak(u); }, 60);
    });
  }

  stop() {
    clearTimeout(this._timer);
    if (this._synth) this._synth.cancel();
    if (this._resolve) { const r = this._resolve; this._resolve = null; r(); }
  }

  toggleMute() {
    this._muted = !this._muted;
    if (this._muted) this.stop();
    return this._muted;
  }
}

/** Comprueba si un video existe/carga. Solo se descarta si el navegador da error. */
function probeVideo(src) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    let finished = false;
    const done = (ok) => {
      if (finished) return;
      finished = true;
      v.onloadedmetadata = v.onerror = null;
      v.removeAttribute('src');
      resolve(ok);
    };
    v.onloadedmetadata = () => done(true);
    v.onerror = () => done(false);
    setTimeout(() => done(true), 4000);   // sin respuesta: se asume que existe
    v.src = src;
  });
}

/* ============================================================
   ESCENA (videos con fundido cruzado / tarjetas del juego)
   ============================================================ */

class SceneController {
  constructor(slidesEl, gridEl, stageEl) {
    this._slides  = slidesEl;
    this._grid    = gridEl;
    this._stage   = stageEl;
    this._layout  = stageEl.parentElement;   // .layout (se ensancha en el juego)
    this._current = null;
  }

  _makeSlide(src) {
    const slide = document.createElement('div');
    slide.className = 'slide';
    const v = document.createElement('video');
    v.className = 'slide-video';
    v.muted = true;                       // los videos van siempre sin sonido
    v.defaultMuted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.setAttribute('disablepictureinpicture', '');
    v.src = src;
    slide.appendChild(v);
    return slide;
  }

  _lastVideo() { return this._slides.lastElementChild?.querySelector('video') || null; }

  /**
   * Muestra el video de una acción con fundido cruzado: el nuevo aparece ENCIMA
   * del anterior (que sigue reproduciéndose debajo), así nunca hay un cuadro vacío.
   * Si ya es el video actual, sigue reproduciéndose sin reiniciar.
   */
  async show(src, instant = false) {
    this._stage.classList.remove('is-game');
    this._layout.classList.remove('is-game');
    this._grid.hidden   = true;
    this._slides.hidden = false;

    if (src === this._current) {
      const cur = this._lastVideo();
      if (cur && cur.paused) cur.play().catch(() => {});
      return;
    }
    this._current = src;

    const slide = this._makeSlide(src);
    const v = slide.firstChild;
    this._slides.appendChild(slide);

    // Esperar a que haya imagen lista (o 1.5 s como máximo) antes de mostrarlo
    await new Promise((resolve) => {
      if (v.readyState >= 2) { resolve(); return; }
      v.addEventListener('loadeddata', resolve, { once: true });
      v.addEventListener('error', resolve, { once: true });
      setTimeout(resolve, 1500);
    });
    v.play().catch(() => {});

    if (instant) slide.classList.add('instant');
    void slide.offsetWidth;
    slide.classList.add('in');

    // Al terminar el fundido, se quitan (y detienen) los videos anteriores
    const cleanup = () => {
      while (slide.parentNode === this._slides && this._slides.firstChild !== slide) {
        const old = this._slides.firstChild;
        old.querySelector('video')?.pause();
        this._slides.removeChild(old);
      }
    };
    if (instant) cleanup(); else setTimeout(cleanup, TRANSITION_MS + 80);
  }

  /** Reinicia el video actual desde el principio (al repetir). */
  replay() {
    const v = this._lastVideo();
    if (!v) return;
    v.currentTime = 0;
    v.play().catch(() => {});
  }

  /** Pantalla de inicio: el video de presentación en bucle (o el 1.er objeto si falta). */
  showHome(instant = false) {
    if (INTRO_OK) return this.show(INTRO_VIDEO, instant);
    return ACTIVE.length ? this.show(ACTIVE[0].video, instant) : Promise.resolve();
  }

  /** Juego: pausa los videos de la lección y muestra las tarjetas. */
  showGame() {
    this._slides.querySelectorAll('video').forEach((v) => v.pause());
    this._slides.hidden = true;
    this._stage.classList.add('is-game');
    this._layout.classList.add('is-game');
    this._grid.hidden   = false;
  }
}

/* ============================================================
   ESTADO
   ============================================================ */

class StateManager {
  constructor() {
    this._mode  = 'welcome';
    this._epoch = 0;
  }
  get mode()  { return this._mode; }
  get epoch() { return this._epoch; }
  newEpoch()  { return ++this._epoch; }

  show(name) {
    this._mode = name;
    ['welcome', 'lesson', 'game', 'finish'].forEach((id) => { $(id).hidden = id !== name; });
    $('controls').hidden = name === 'welcome' || name === 'finish';
    $('prev').hidden     = name === 'game';
    $('next').hidden     = name === 'game';
  }

  updateProgress(current, total) {
    $('dots').innerHTML = Array.from({ length: total }, (_, n) => {
      const cls = n === current ? 'current' : n < current ? 'done' : '';
      return `<span class="dot ${cls}"></span>`;
    }).join('');
  }
}

/* ============================================================
   LECCIÓN
   ============================================================ */

class LessonMode {
  constructor(scene, state, voice) {
    this._scene = scene;
    this._state = state;
    this._voice = voice;
    this._index = 0;
  }

  get total() { return ACTIVE.length; }

  async goTo(i) {
    const token = this._reset();
    this._index = i;
    this._state.show('lesson');

    $('prev').disabled     = i === 0;
    $('next').textContent  = i === this.total - 1 ? 'JUGAR →' : 'SIGUIENTE →';
    $('count').textContent = `${i + 1} DE ${this.total}`;
    this._state.updateProgress(i, this.total);

    await this._play(i, token, false);
  }

  /** Muestra el texto y el video; la voz dice la acción y luego su texto. */
  async _play(i, token, restart) {
    const a = ACTIVE[i];
    $('word').textContent       = a.label;
    $('word').style.setProperty('--w', a.color);
    $('word').className         = a.label.length >= 11 ? 'xlong' : a.label.length >= 8 ? 'long' : '';
    $('phrase').textContent     = a.phrase;
    $('lessonIcon').textContent = a.icon;
    $('lessonIcon').hidden      = false;

    // La frase ya empieza con el objeto: "Taza, es un vasito hondo..."
    this._voice.speak(a.phrase.replace(/\n/g, ' '));
    await this._scene.show(a.video);
    if (restart) this._scene.replay();
  }

  /** Vuelve a mostrar el video desde el inicio y a decir la acción. */
  async repeat() {
    const token = this._reset();
    this._state.show('lesson');
    await this._play(this._index, token, true);
  }

  prev() { if (this._index > 0) this.goTo(this._index - 1); }

  next() {
    if (this._index < this.total - 1) { this.goTo(this._index + 1); return false; }
    return true; // → iniciar juego
  }

  _reset() {
    const token = this._state.newEpoch();
    this._voice.stop();
    $('celebration').hidden = true;
    $('stage').classList.remove('encourage');
    return token;
  }
}

/* ============================================================
   JUEGO
   ============================================================ */

class GameMode {
  constructor(scene, state, voice) {
    this._scene  = scene;
    this._state  = state;
    this._voice  = voice;
    this._queue  = [];
    this._turn   = 0;
    this._ready  = false;
    this._locked = false;
  }

  start() {
    this._scene.showGame();
    this._queue = shuffle(ACTIVE);
    this._turn  = 0;
    this._ask();
  }

  _ask() {
    const token = this._state.newEpoch();
    $('celebration').hidden = true;
    this._state.show('game');
    const cur = this._queue[this._turn];
    $('question').textContent  = cur.question;
    $('feedback').textContent  = '👆 TOCA EL VIDEO';
    $('gameCount').textContent = `${this._turn + 1} DE ${this._queue.length}`;

    // Todos los videos en recuadros, cada uno en bucle y por su cuenta.
    // Cambian de lugar en cada pregunta y empiezan en un punto distinto.
    const grid = $('gameGrid');
    grid.innerHTML = '';
    shuffle(ACTIVE).forEach((a, n) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'act-card';
      b.dataset.id = a.id;
      b.setAttribute('aria-label', `Video ${n + 1}`);
      const v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.preload = 'auto';
      v.setAttribute('disablepictureinpicture', '');
      v.addEventListener('loadedmetadata', () => {
        if (isFinite(v.duration)) v.currentTime = Math.random() * v.duration;
        v.play().catch(() => {});
      }, { once: true });
      v.src = a.card;
      b.appendChild(v);
      b.addEventListener('click', () => this.pick(b, token));
      grid.appendChild(b);
    });
    this._ready  = true;
    this._locked = false;
    this._voice.speak(cur.question);
  }

  repeatQuestion() {
    if (!this._locked && this._queue[this._turn]) this._voice.speak(this._queue[this._turn].question);
  }

  async pick(card, token) {
    if (!this._ready || this._locked || token !== this._state.epoch) return;
    this._locked = true;
    const cur = this._queue[this._turn];

    if (card.dataset.id === cur.id) {
      card.classList.add('correct');
      document.querySelectorAll('.act-card').forEach((c) => { c.disabled = true; if (c !== card) c.classList.add('dim'); });
      $('feedback').textContent = `¡MUY BIEN! ${cur.answer}`;
      $('celebration').hidden   = false;
      await Promise.all([sleep(2400), this._voice.speak(`¡Muy bien! ${cur.answer}`)]);
      if (token !== this._state.epoch) return;
      this._turn++;
      if (this._turn < this._queue.length) this._ask();
      else this._finish();
    } else {
      card.classList.add('wrong', 'dim');
      card.disabled = true;
      $('feedback').textContent = '¡INTÉNTALO OTRA VEZ!';
      this._voice.speak('Inténtalo otra vez');
      await sleep(700);
      if (token !== this._state.epoch) return;
      card.classList.remove('wrong');
      $('feedback').textContent = '👆 TOCA EL VIDEO';
      this._locked = false;
    }
  }

  _finish() {
    this._state.newEpoch();
    $('celebration').hidden = true;
    this._state.show('finish');
    this._voice.speak('¡Excelente trabajo! ¡Ya conoces los objetos de tu casa!');
  }
}

/* ============================================================
   APP
   ============================================================ */

class App {
  constructor() {
    this.scene  = new SceneController($('slides'), $('gameGrid'), $('stage'));
    this.voice  = new VoiceManager();
    this.state  = new StateManager();
    this.lesson = new LessonMode(this.scene, this.state, this.voice);
    this.game   = new GameMode(this.scene, this.state, this.voice);

    this.state.show('welcome');
    this._bind();
    this._voiceStatus();
    this._init();
  }

  /** Detecta qué videos existen y prepara la pantalla de inicio. */
  async _init() {
    const [introOk, ...found] = await Promise.all([INTRO_VIDEO, ...ITEMS.map((a) => a.video)].map(probeVideo));
    INTRO_OK = introOk;
    ACTIVE = ITEMS.filter((_, i) => found[i]);
    if (!ACTIVE.length) {
      $('status').textContent = 'AGREGA LOS VIDEOS EN LA CARPETA assets/video/ (taza.mp4, cuchara.mp4, escoba.mp4…).';
      $('start').disabled = true;
      return;
    }
    this.scene.showHome(true);
  }

  /** Aviso si el dispositivo no tiene voz en español. */
  _voiceStatus() {
    const show = () => {
      if ($('start').disabled) return;
      $('status').textContent = ('speechSynthesis' in window && !this.voice.hasVoice)
        ? 'SI NO ESCUCHAS LA VOZ, INSTALA UNA VOZ EN ESPAÑOL EN TU DISPOSITIVO.' : '';
    };
    setTimeout(show, 1500);
    window.speechSynthesis?.addEventListener?.('voiceschanged', show);
  }

  _bind() {
    $('start').onclick      = () => this.lesson.goTo(0);
    $('prev').onclick       = () => { if (this.state.mode === 'lesson') this.lesson.prev(); };
    $('next').onclick       = () => {
      if (this.state.mode === 'lesson' && this.lesson.next()) this.game.start();
    };
    $('listen').onclick     = () => { if (this.state.mode === 'lesson') this.lesson.repeat(); };
    $('repeat').onclick     = () => {
      if (this.state.mode === 'lesson') this.lesson.repeat();
      else if (this.state.mode === 'game') this.game.repeatQuestion();
    };
    $('home').onclick       = () => {
      this.state.newEpoch();
      this.voice.stop();
      $('celebration').hidden = true;
      this.scene.showHome();
      this.state.show('welcome');
    };
    $('again').onclick      = () => this.game.start();
    $('dictionary').onclick = () => this.lesson.goTo(0);

    $('sound').onclick = () => {
      const muted = this.voice.toggleMute();
      $('sound').setAttribute('aria-label', muted ? 'Activar voz' : 'Desactivar voz');
      $('sound').setAttribute('aria-pressed', String(!muted));
      if (!muted) {
        if (this.state.mode === 'lesson') this.lesson.repeat();
        else if (this.state.mode === 'game') this.game.repeatQuestion();
      }
    };

    document.addEventListener('visibilitychange', () => { if (document.hidden) this.voice.stop(); });
  }
}

const app = new App();
