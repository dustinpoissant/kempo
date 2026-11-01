export default class Audio extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.currentTime = 0;
    this.duration = 0;
    this.isPlaying = false;
    this.audio = null;
    this.lastSrc = '';
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'src' && newValue !== this.lastSrc) {
      this.lastSrc = newValue;
      this.render();
    }
  }

  static get observedAttributes() {
    return ['src', 'controls', 'autoplay', 'loop', 'muted', 'preload'];
  }

  formatTime(seconds) {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  render() {
    const src = this.getAttribute('src') || '';
    const controls = this.getAttribute('controls') || '';
    const autoplay = this.hasAttribute('autoplay');
    const loop = this.hasAttribute('loop');
    const muted = this.hasAttribute('muted');
    const preload = this.getAttribute('preload') || 'metadata';

    const showControls = controls !== '';

    if (!src) {
      this.shadowRoot.innerHTML = `
        <style>
          :host { display: block; margin-bottom: var(--spacer, 1rem); }
          .empty { padding: var(--spacer, 1rem); border: 1px dashed var(--c_border, #888); text-align: center; opacity: 0.7; }
        </style>
        <div class="empty">Choose an audio file.</div>
      `;
      return;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; margin-bottom: var(--spacer, 1rem); }
        .player { background: var(--c_surface, #f5f5f5); border-radius: 0.25rem; padding: 0.75rem; }
        .controls { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
        .play-btn { width: 2rem; height: 2rem; display: flex; align-items: center; justify-content: center; background: var(--c_primary, #36f); color: white; border: none; border-radius: 50%; cursor: pointer; font-size: 0.9rem; }
        .play-btn:hover { opacity: 0.8; }
        .progress { flex: 1; height: 0.25rem; background: var(--c_border, #ddd); border-radius: 0.125rem; cursor: pointer; }
        .progress-fill { height: 100%; background: var(--c_primary, #36f); border-radius: 0.125rem; }
        .time { font-size: 0.85rem; color: var(--c_text_muted, #666); min-width: 4rem; }
        .volume-control { display: flex; align-items: center; gap: 0.25rem; }
      </style>
      <div class="player">
        ${showControls ? `
          <div class="controls">
            <button class="play-btn">▶</button>
            <div class="progress">
              <div class="progress-fill"></div>
            </div>
            <span class="time">0:00 / 0:00</span>
            ${controls === 'full' ? `
              <div class="volume-control">
                <span>🔊</span>
                <input type="range" min="0" max="100" value="100">
              </div>
            ` : ''}
          </div>
        ` : ''}
        <audio src="${src}" preload="${preload}" ${autoplay ? 'autoplay' : ''} ${loop ? 'loop' : ''} ${muted ? 'muted' : ''}></audio>
      </div>
    `;

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.audio = this.shadowRoot.querySelector('audio');
    if (!this.audio) return;

    const controls = this.getAttribute('controls') || '';
    const showControls = controls !== '';

    if (!showControls) return;

    const playBtn = this.shadowRoot.querySelector('.play-btn');
    const progressBar = this.shadowRoot.querySelector('.progress');
    const volumeInput = this.shadowRoot.querySelector('input[type="range"]');

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (this.audio.paused) {
          this.audio.play();
        } else {
          this.audio.pause();
        }
      });
    }

    if (progressBar) {
      progressBar.addEventListener('click', (e) => {
        if (!isFinite(this.audio.duration)) return;
        const rect = progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        this.audio.currentTime = percent * this.audio.duration;
      });
    }

    if (volumeInput) {
      volumeInput.addEventListener('input', (e) => {
        this.audio.volume = e.target.value / 100;
      });
    }

    this.audio.addEventListener('timeupdate', () => {
      this.currentTime = this.audio.currentTime;
      this.duration = this.audio.duration;
      this.updateProgress();
    });

    this.audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.updatePlayButton();
    });

    this.audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this.updatePlayButton();
    });

    this.audio.addEventListener('loadedmetadata', () => {
      this.duration = this.audio.duration;
      this.updateTime();
    });
  }

  updateProgress() {
    const progressFill = this.shadowRoot.querySelector('.progress-fill');
    if (progressFill && isFinite(this.duration)) {
      const percent = (this.currentTime / this.duration) * 100;
      progressFill.style.width = percent + '%';
    }
    this.updateTime();
  }

  updateTime() {
    const timeEl = this.shadowRoot.querySelector('.time');
    if (timeEl) {
      timeEl.textContent = `${this.formatTime(this.currentTime)} / ${this.formatTime(this.duration)}`;
    }
  }

  updatePlayButton() {
    const playBtn = this.shadowRoot.querySelector('.play-btn');
    if (playBtn) {
      playBtn.textContent = this.isPlaying ? '⏸' : '▶';
    }
  }
}

if (!customElements.get('k-audio')) {
  customElements.define('k-audio', Audio);
}
