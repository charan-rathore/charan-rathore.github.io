/* Originkit-inspired effects + site interactions — light theme */

// ===== Originkit: Kinetic Grid =====
(function initKineticGrid() {
    const container = document.getElementById('kineticGrid');
    if (!container) return;

    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const spacing = 56;
    let w, h, cols, rows, dots = [];
    let mouse = { x: -9999, y: -9999 };
    const influence = 90;
    const maxOffset = 14;

    function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
        cols = Math.ceil(w / spacing) + 1;
        rows = Math.ceil(h / spacing) + 1;
        dots = [];
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                dots.push({
                    ox: x * spacing,
                    oy: y * spacing,
                    x: x * spacing,
                    y: y * spacing
                });
            }
        }
    }

    function draw() {
        ctx.clearRect(0, 0, w, h);
        dots.forEach(dot => {
            const dx = mouse.x - dot.ox;
            const dy = mouse.y - dot.oy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            let tx = dot.ox;
            let ty = dot.oy;

            if (dist < influence) {
                const force = (1 - dist / influence) * maxOffset;
                const angle = Math.atan2(dy, dx);
                tx = dot.ox - Math.cos(angle) * force;
                ty = dot.oy - Math.sin(angle) * force;
            }

            dot.x += (tx - dot.x) * 0.12;
            dot.y += (ty - dot.y) * 0.12;

            const proximity = Math.max(0, 1 - dist / influence);
            const alpha = 0.025 + proximity * 0.07;
            const radius = 0.8 + proximity * 0.6;

            ctx.beginPath();
            ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(140, 125, 110, ${alpha})`;
            ctx.fill();
        });
        requestAnimationFrame(draw);
    }

    window.addEventListener('mousemove', e => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });
    window.addEventListener('mouseleave', () => {
        mouse.x = -9999;
        mouse.y = -9999;
    });

    resize();
    draw();
    window.addEventListener('resize', resize);
})();

// ===== Originkit: Mesh Text Hover (canvas displacement) =====
function initMeshText(el) {
    if (!el) return;
    const text = el.dataset.meshText || el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.className = 'mesh-text-canvas';
    el.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let mouse = { x: -999, y: -999 };
    let w, h, dpr;

    const fontFamily = getComputedStyle(document.documentElement).getPropertyValue('--display').trim() || 'Syne, sans-serif';

    function getFontSize() {
        const parent = el.closest('.hero-title') || el.parentElement;
        const size = parseFloat(getComputedStyle(parent || el).fontSize);
        return size > 20 ? size : Math.min(window.innerWidth * 0.12, 72);
    }

    function render() {
        if (!w || !h) return;
        ctx.clearRect(0, 0, w, h);
        const fontSize = getFontSize();
        ctx.font = `800 ${fontSize}px ${fontFamily}`;
        ctx.textBaseline = 'middle';

        const textW = ctx.measureText(text).width;
        const startX = (w - textW) / 2;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const charW = ctx.measureText(char).width;
            const cx = startX + ctx.measureText(text.slice(0, i)).width + charW / 2;
            const cy = h / 2;

            const dx = mouse.x - cx;
            const dy = mouse.y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            let ox = 0, oy = 0, scale = 1;

            if (dist < 140) {
                const t = 1 - dist / 140;
                const wave = Math.sin(t * Math.PI) * 14;
                ox = (dx / (dist || 1)) * wave * t;
                oy = (dy / (dist || 1)) * wave * t;
                scale = 1 + t * 0.1;
            }

            ctx.save();
            ctx.translate(cx + ox, cy + oy);
            ctx.scale(scale, scale);

            if (el.classList.contains('mesh-accent')) {
                const grad = ctx.createLinearGradient(-charW, 0, charW, 0);
                grad.addColorStop(0, '#3B6FD4');
                grad.addColorStop(0.55, '#7C5CBF');
                grad.addColorStop(1, '#141414');
                ctx.fillStyle = grad;
            } else {
                ctx.fillStyle = '#141414';
            }

            ctx.fillText(char, -charW / 2, 0);
            ctx.restore();
        }
    }

    function resize() {
        dpr = window.devicePixelRatio || 1;
        const fontSize = getFontSize();
        ctx.font = `800 ${fontSize}px ${fontFamily}`;
        const textW = ctx.measureText(text).width;
        w = textW + 24;
        h = fontSize * 1.15;
        el.style.width = w + 'px';
        el.style.height = h + 'px';
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        render();
    }

    el.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
        render();
    });
    el.addEventListener('mouseleave', () => {
        mouse.x = -999;
        mouse.y = -999;
        render();
    });

    resize();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
    window.addEventListener('resize', resize);
    setTimeout(resize, 150);
}

document.querySelectorAll('[data-mesh-text]').forEach(initMeshText);

// ===== Originkit: Flicker Text (section tags only) =====
document.querySelectorAll('.flicker-text:not(.heading-fx)').forEach(el => {
    const original = el.textContent;
    setInterval(() => {
        if (Math.random() > 0.92) {
            const chars = original.split('');
            const idx = Math.floor(Math.random() * chars.length);
            if (chars[idx] === ' ') return;
            const glitch = '!@#$%&*0123456789'[Math.floor(Math.random() * 14)];
            chars[idx] = glitch;
            el.textContent = chars.join('');
            setTimeout(() => { el.textContent = original; }, 60 + Math.random() * 80);
        }
    }, 120);
});

// ===== Originkit: Magnetic elements =====
document.querySelectorAll('.magnetic').forEach(el => {
    el.addEventListener('mousemove', e => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        el.style.transform = `translate(${x * 0.18}px, ${y * 0.18}px)`;
    });
    el.addEventListener('mouseleave', () => {
        el.style.transform = '';
    });
});

// ===== Originkit: Random Letter Swap / Scramble =====
function scrambleText(el, finalText, duration = 1400) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$&';
    const start = performance.now();

    function frame(now) {
        const progress = Math.min((now - start) / duration, 1);
        const revealed = Math.floor(progress * finalText.length);
        let result = '';
        for (let i = 0; i < finalText.length; i++) {
            if (finalText[i] === ' ') { result += ' '; continue; }
            result += i < revealed ? finalText[i] : chars[Math.floor(Math.random() * chars.length)];
        }
        el.textContent = result;
        if (progress < 1) requestAnimationFrame(frame);
        else el.textContent = finalText;
    }
    requestAnimationFrame(frame);
}

document.querySelectorAll('[data-scramble]').forEach(el => {
    const text = el.dataset.scramble;
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !el.dataset.scrambled) {
                el.dataset.scrambled = 'true';
                scrambleText(el, text);
            }
        });
    }, { threshold: 0.4 });
    observer.observe(el);
});

const heroScramble = document.getElementById('heroScramble');
if (heroScramble) {
    setTimeout(() => scrambleText(heroScramble, heroScramble.dataset.scramble, 1800), 500);
}

// ===== Originkit: Text Morph (hero rotating words) =====
(function initTextMorph() {
    const el = document.getElementById('textMorph');
    if (!el) return;
    const words = ['think.', 'scale.', 'ship.', 'debug.'];
    let idx = 0;

    setInterval(() => {
        idx = (idx + 1) % words.length;
        scrambleText(el, words[idx], 550);
    }, 3400);
})();

// ===== Originkit: Direction Hover + Text Lift + Pixel Drift on headings =====
function initHeadingFx(heading) {
    heading.querySelectorAll('.heading-line').forEach(line => {
        const text = line.textContent;
        line.textContent = '';

        const wrap = document.createElement('span');
        wrap.className = 'dh-wrap';

        const base = document.createElement('span');
        base.className = 'dh-base';
        const fill = document.createElement('span');
        fill.className = 'dh-fill';
        fill.setAttribute('aria-hidden', 'true');

        [...text].forEach((char, i) => {
            const ch = char === ' ' ? '\u00A0' : char;
            const delay = `${i * 0.025}s`;

            const pd = document.createElement('span');
            pd.className = 'pd-char';
            const lift = document.createElement('span');
            lift.className = 'lift-char';
            lift.textContent = ch;
            lift.style.transitionDelay = delay;
            pd.appendChild(lift);

            if (char !== ' ' && i % 3 === 0) {
                const px = document.createElement('span');
                px.className = 'pd-pixel';
                px.style.setProperty('--drift-x', `${(Math.random() * 10 - 5).toFixed(0)}px`);
                px.style.setProperty('--drift-y', `${(-6 - Math.random() * 8).toFixed(0)}px`);
                px.style.animationDelay = `${(i * 0.12).toFixed(2)}s`;
                pd.appendChild(px);
            }

            base.appendChild(pd);

            const liftFill = document.createElement('span');
            liftFill.className = 'lift-char';
            liftFill.textContent = ch;
            liftFill.style.transitionDelay = delay;
            fill.appendChild(liftFill);
        });

        wrap.appendChild(base);
        wrap.appendChild(fill);
        line.appendChild(wrap);
    });

    heading.addEventListener('mousemove', e => {
        const rect = heading.getBoundingClientRect();
        heading.style.setProperty('--dh-x', `${((e.clientX - rect.left) / rect.width) * 100}%`);
        heading.style.setProperty('--dh-y', `${((e.clientY - rect.top) / rect.height) * 100}%`);
        heading.classList.add('direction-active');
    });

    heading.addEventListener('mouseleave', () => heading.classList.remove('direction-active'));
}

document.querySelectorAll('.heading-fx').forEach(initHeadingFx);

// ===== Text Lift (project titles) =====
document.querySelectorAll('.lift-text').forEach(el => {
    const text = el.textContent;
    el.textContent = '';
    [...text].forEach((char, i) => {
        const span = document.createElement('span');
        span.textContent = char === ' ' ? '\u00A0' : char;
        span.style.transitionDelay = `${i * 0.018}s`;
        el.appendChild(span);
    });
});

// ===== Project card spotlight =====
document.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
        card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
    });
});

// ===== Nav =====
const navFloat = document.getElementById('navFloat');
const navLinks = document.getElementById('navLinks');
const sections = document.querySelectorAll('section[id]');

function updateNav() {
    if (navFloat) navFloat.classList.toggle('scrolled', window.scrollY > 40);
    const scrollPos = window.scrollY + 120;
    sections.forEach(section => {
        const link = navLinks?.querySelector(`a[href="#${section.id}"]`);
        if (!link) return;
        const top = section.offsetTop;
        const bottom = top + section.offsetHeight;
        link.classList.toggle('active', scrollPos >= top && scrollPos < bottom);
    });
}

window.addEventListener('scroll', updateNav, { passive: true });
updateNav();

const hamburger = document.getElementById('hamburger');
if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => navLinks.classList.toggle('active'));
    navLinks.querySelectorAll('a').forEach(link =>
        link.addEventListener('click', () => navLinks.classList.remove('active'))
    );
}

// ===== Scroll reveal =====
const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
    });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ===== Scroll progress =====
const scrollProgressFill = document.getElementById('scrollProgress');
function updateScrollProgress() {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0;
    if (scrollProgressFill) scrollProgressFill.style.width = progress + '%';
}
window.addEventListener('scroll', updateScrollProgress, { passive: true });
updateScrollProgress();

// ===== Music player =====
(function initMusicPlayer() {
    const audio = document.getElementById('audioEl');
    const musicToggle = document.getElementById('musicToggle');
    const musicPlayer = document.getElementById('musicPlayer');
    const musicClose = document.getElementById('musicClose');
    const musicIcon = document.getElementById('musicIcon');
    const mpDisc = document.getElementById('mpDisc');
    const mpTitle = document.getElementById('mpTitle');
    const mpArtist = document.getElementById('mpArtist');
    const mpPlay = document.getElementById('mpPlay');
    const mpPrev = document.getElementById('mpPrev');
    const mpNext = document.getElementById('mpNext');
    const mpFill = document.getElementById('mpFill');
    const mpProgress = document.getElementById('mpProgress');
    const mpCur = document.getElementById('mpCur');
    const mpDur = document.getElementById('mpDur');

    if (!audio || !musicToggle) return;

    let musicOpen = false;
    let trackIdx = 0;
    let trackLoaded = false;
    let pendingPlay = false;

    const playlist = [
        { title: 'Chill Groove', artist: 'SoundHelix', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
        { title: 'Mellow Beats', artist: 'SoundHelix', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
        { title: 'Night Drive', artist: 'SoundHelix', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
        { title: 'Sunset Waves', artist: 'SoundHelix', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
        { title: 'Deep Focus', artist: 'SoundHelix', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3' }
    ];

    function setPlayingUI(playing) {
        if (mpPlay) mpPlay.innerHTML = playing ? '&#x23F8;' : '&#x25B6;';
        if (musicIcon) musicIcon.innerHTML = playing ? '&#x23F8;' : '&#x25B6;';
        if (mpDisc) mpDisc.classList.toggle('spinning', playing);
        musicToggle.classList.toggle('playing', playing);
    }

    function fmtTime(s) {
        if (!s || isNaN(s)) return '0:00';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return m + ':' + (sec < 10 ? '0' : '') + sec;
    }

    function openPlayer() {
        musicOpen = true;
        if (musicPlayer) musicPlayer.classList.add('open');
    }

    async function tryPlay() {
        pendingPlay = true;
        try {
            await audio.play();
            pendingPlay = false;
        } catch (err) {
            pendingPlay = false;
            console.warn('Playback blocked or failed:', err);
        }
    }

    function attemptPlay() {
        if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
            tryPlay();
        }
    }

    function loadTrack(idx, andPlay) {
        trackIdx = ((idx % playlist.length) + playlist.length) % playlist.length;
        const t = playlist[trackIdx];
        if (mpTitle) mpTitle.textContent = t.title;
        if (mpArtist) mpArtist.textContent = t.artist;
        if (mpFill) mpFill.style.width = '0%';
        if (mpCur) mpCur.textContent = '0:00';
        if (mpDur) mpDur.textContent = '0:00';
        trackLoaded = false;

        const onReady = () => {
            trackLoaded = true;
            if (mpDur) mpDur.textContent = fmtTime(audio.duration);
            if (andPlay || pendingPlay) attemptPlay();
        };

        audio.removeEventListener('canplay', onReady);
        audio.removeEventListener('loadeddata', onReady);
        audio.addEventListener('canplay', onReady, { once: true });
        audio.addEventListener('loadeddata', onReady, { once: true });

        audio.src = t.src;
        audio.load();

        if (andPlay) {
            pendingPlay = true;
            if (audio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
                onReady();
            }
        }
    }

    function togglePlayPause() {
        openPlayer();
        if (!trackLoaded) {
            loadTrack(trackIdx, true);
            return;
        }
        if (audio.paused) tryPlay();
        else audio.pause();
    }

    audio.addEventListener('play', () => setPlayingUI(true));
    audio.addEventListener('pause', () => setPlayingUI(false));
    audio.addEventListener('timeupdate', () => {
        if (audio.duration && mpFill && mpCur) {
            mpFill.style.width = (audio.currentTime / audio.duration * 100) + '%';
            mpCur.textContent = fmtTime(audio.currentTime);
        }
    });
    audio.addEventListener('ended', () => loadTrack(trackIdx + 1, true));
    audio.addEventListener('error', () => {
        trackLoaded = false;
        pendingPlay = false;
        if (mpTitle) mpTitle.textContent = 'Track unavailable';
        if (mpArtist) mpArtist.textContent = 'Try another song';
    });

    if (mpPlay) {
        mpPlay.addEventListener('click', e => {
            e.stopPropagation();
            togglePlayPause();
        });
    }

    if (mpPrev) {
        mpPrev.addEventListener('click', e => {
            e.stopPropagation();
            openPlayer();
            loadTrack(trackIdx - 1, true);
        });
    }

    if (mpNext) {
        mpNext.addEventListener('click', e => {
            e.stopPropagation();
            openPlayer();
            loadTrack(trackIdx + 1, true);
        });
    }

    if (mpProgress) {
        mpProgress.addEventListener('click', e => {
            if (audio.duration) {
                audio.currentTime = (e.offsetX / mpProgress.offsetWidth) * audio.duration;
            }
        });
    }

    musicToggle.addEventListener('click', e => {
        e.stopPropagation();
        if (!musicOpen) {
            openPlayer();
            togglePlayPause();
            return;
        }
        togglePlayPause();
    });

    if (musicClose) {
        musicClose.addEventListener('click', e => {
            e.stopPropagation();
            musicOpen = false;
            if (musicPlayer) musicPlayer.classList.remove('open');
            audio.pause();
        });
    }
})();

// ===== Journey train =====
const journeyWrapper = document.getElementById('journeyWrapper');
const journeyTrack = document.getElementById('journeyTrack');
const journeyTrain = document.getElementById('journeyTrain');
const stations = document.querySelectorAll('.journey-station');

function updateJourney() {
    if (!journeyWrapper || !journeyTrack || !journeyTrain) return;

    const wrapperRect = journeyWrapper.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1,
        (window.innerHeight * 0.5 - wrapperRect.top) / wrapperRect.height
    ));

    journeyTrack.style.setProperty('--track-fill', (progress * 100) + '%');
    journeyTrain.style.setProperty('--train-top', (progress * 100) + '%');

    const dotIndicators = document.querySelectorAll('.journey-dot-indicator');
    let currentIdx = -1;

    stations.forEach((station, i) => {
        const stationRect = station.getBoundingClientRect();
        const stationCenter = stationRect.top + stationRect.height / 2;
        if (stationCenter < window.innerHeight * 0.5 + 80) {
            station.classList.add('visible', 'active');
            currentIdx = i;
        } else {
            station.classList.remove('active');
        }
    });

    dotIndicators.forEach((dot, i) => {
        dot.classList.remove('reached', 'current');
        if (i < currentIdx) dot.classList.add('reached');
        else if (i === currentIdx) dot.classList.add('current');
    });
}

window.addEventListener('scroll', updateJourney, { passive: true });
updateJourney();

document.querySelectorAll('.journey-dot-indicator').forEach(dot => {
    dot.addEventListener('click', function () {
        const idx = parseInt(this.dataset.station);
        if (stations[idx]) stations[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
});

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});
