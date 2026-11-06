// Insite Integrative Wellness — shared site behaviour (nav, reveals, glow, particles, parallax).
(function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // nav: mobile toggle, solid-on-scroll, current page
  var nav = document.getElementById('nav');
  var links = document.getElementById('navLinks');
  var toggle = nav && nav.querySelector('.menu-toggle');
  if (toggle) toggle.addEventListener('click', function () {
    var open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
  var onScroll = function () { nav && nav.classList.toggle('solid', scrollY > 40); };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  var here = location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('#navLinks a').forEach(function (a) {
    var p = a.getAttribute('href').replace(/\/$/, '') || '/';
    if (p !== '/' && (here === p || (p === '/lab' && here.indexOf('/lab') === 0))) a.setAttribute('aria-current', 'page');
  });
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  // scroll reveals
  var io = 'IntersectionObserver' in window && new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(function (el) { io ? io.observe(el) : el.classList.add('in'); });

  // Lab tools hand their results to the contact form via sessionStorage (kept out of URLs/logs).
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-note]');
    if (a) try { sessionStorage.setItem('insite-note', a.dataset.note); } catch (_) {}
  });

  // cursor-follow gold edge on cards
  document.addEventListener('pointermove', function (e) {
    var c = e.target.closest && e.target.closest('.card');
    if (!c) return;
    var r = c.getBoundingClientRect();
    c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    c.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });

  if (reduce) return;

  // gentle parallax on page-hero backgrounds
  var bgs = document.querySelectorAll('.page-hero .bg img, .page-hero .bg video, .hero-media video, .hero-media img');
  if (bgs.length) addEventListener('scroll', function () {
    var y = scrollY;
    if (y < innerHeight * 1.2) bgs.forEach(function (b) { b.style.transform = 'scale(1.08) translateY(' + (y * 0.18) + 'px)'; });
  }, { passive: true });

  // rising gold dust
  var cv = document.getElementById('particles');
  if (cv) {
    var ctx = cv.getContext('2d'), dots = [], dpr = Math.min(devicePixelRatio || 1, 2);
    var size = function () { cv.width = cv.offsetWidth * dpr; cv.height = cv.offsetHeight * dpr; };
    size(); addEventListener('resize', size);
    for (var i = 0; i < 70; i++) dots.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.8 + .4, s: Math.random() * .0006 + .0002, p: Math.random() * 6.28 });
    (function tick(t) {
      ctx.clearRect(0, 0, cv.width, cv.height);
      dots.forEach(function (d) {
        d.y -= d.s; if (d.y < -0.02) { d.y = 1.02; d.x = Math.random(); }
        var a = .35 + .35 * Math.sin(t / 900 + d.p);
        ctx.beginPath();
        ctx.arc((d.x + Math.sin(t / 4000 + d.p) * .01) * cv.width, d.y * cv.height, d.r * dpr, 0, 6.28);
        ctx.fillStyle = 'rgba(248,214,140,' + a + ')';
        ctx.shadowColor = 'rgba(248,214,140,.9)'; ctx.shadowBlur = 8 * dpr;
        ctx.fill();
      });
      requestAnimationFrame(tick);
    })(0);
  }
})();
