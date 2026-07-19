/* LUXOR — motion + interactividad (port 1:1 del sitio original).
   Globals: gsap, ScrollTrigger, Lenis (vendorizados en assets).
   Editor-safe: init por sección + shopify:section:load/unload. */
(function () {
  'use strict'

  var gsap = window.gsap
  var ST = window.ScrollTrigger
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  var EDITOR = !!(window.Shopify && window.Shopify.designMode)
  var MOTION = !REDUCED && !!gsap && !!ST
  var EASE = 'expo.out'

  if (gsap && ST) gsap.registerPlugin(ST)

  /* ————— preloader ————— */
  function hidePreloader() {
    var pre = document.querySelector('.preloader')
    if (!pre) return Promise.resolve()
    if (!MOTION || EDITOR) {
      pre.remove()
      return Promise.resolve()
    }
    return new Promise(function (resolve) {
      var done = function () {
        gsap
          .timeline({
            onComplete: function () {
              pre.remove()
              resolve()
            },
          })
          .to(pre.children, { opacity: 0, y: -12, duration: 0.3, stagger: 0.05, ease: 'power2.in' })
          .to(pre, { yPercent: -100, duration: 0.55, ease: 'expo.inOut' }, '-=0.1')
      }
      var settled = false
      var settle = function () {
        if (!settled) {
          settled = true
          done()
        }
      }
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle)
      setTimeout(settle, 800)
    })
  }

  /* ————— Lenis ————— */
  var lenis = null
  function initLenis() {
    if (!MOTION || EDITOR || !window.Lenis) return
    lenis = new window.Lenis({ lerp: 0.09, wheelMultiplier: 1 })
    lenis.on('scroll', ST.update)
    gsap.ticker.add(function (time) {
      lenis.raf(time * 1000)
    })
    gsap.ticker.lagSmoothing(0)
    window.__lenis = lenis
  }

  function initAnchors(scope) {
    var links = (scope || document).querySelectorAll('a[href^="#"], a[href*="/#"]')
    links.forEach(function (link) {
      if (link.dataset.luxorAnchor) return
      link.dataset.luxorAnchor = 'true'
      link.addEventListener('click', function (e) {
        var href = link.getAttribute('href')
        var hash = href.indexOf('#') >= 0 ? href.slice(href.indexOf('#')) : null
        if (!hash || hash === '#') return
        var target = document.querySelector(hash)
        if (!target) return
        e.preventDefault()
        history.pushState(null, '', hash)
        var focusTarget = function () {
          target.setAttribute('tabindex', '-1')
          target.focus({ preventScroll: true })
        }
        if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.4, onComplete: focusTarget })
        else {
          target.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' })
          focusTarget()
        }
      })
    })
  }

  /* ————— nav ————— */
  function navState() {
    var nav = document.querySelector('.nav')
    if (!nav) return
    var hero = document.querySelector('.hero')
    if (!hero || !ST) {
      nav.classList.add('is-stuck')
      return
    }
    ST.create({
      trigger: hero,
      start: 'bottom 88px',
      onEnter: function () {
        nav.classList.add('is-stuck')
      },
      onLeaveBack: function () {
        nav.classList.remove('is-stuck')
      },
    })
  }

  /* ————— secciones ————— */
  function heroInit(container) {
    var media = container.querySelector('.hero__media img')
    var lines = container.querySelectorAll('.hero__line > span')
    var eyebrow = container.querySelector('.hero__eyebrow')
    var rest = [container.querySelector('.hero__sub'), container.querySelector('.hero__actions')].filter(Boolean)
    if (!MOTION || !media) return

    gsap.set(media, { scale: 1.14 })
    gsap.set(lines, { yPercent: 112 })
    gsap.set([eyebrow].concat(rest), { opacity: 0, y: 18 })

    hidePreloader().then(function () {
      gsap
        .timeline({ defaults: { ease: EASE } })
        .to(media, { scale: 1, duration: 2.4, ease: 'expo.out' }, 0)
        .to(eyebrow, { opacity: 1, y: 0, duration: 0.9 }, 0.15)
        .to(lines, { yPercent: 0, duration: 1.3, stagger: 0.14 }, 0.25)
        .to(rest, { opacity: 1, y: 0, duration: 0.9, stagger: 0.12 }, 0.85)
    })

    gsap.to(media, {
      yPercent: 14,
      ease: 'none',
      scrollTrigger: { trigger: container, start: 'top top', end: 'bottom top', scrub: true },
    })
    gsap.to(container.querySelector('.hero__content'), {
      yPercent: -8,
      opacity: 0.25,
      ease: 'none',
      scrollTrigger: { trigger: container, start: '40% top', end: 'bottom top', scrub: true },
    })
  }

  function manifestoInit(container) {
    if (!MOTION) return
    container.querySelectorAll('.manifesto__line').forEach(function (line) {
      if (line.dataset.split) return
      line.dataset.split = 'true'
      var text = line.textContent.trim()
      var words = text.split(/\s+/)
      line.setAttribute('aria-label', text)
      line.innerHTML =
        '<span class="sr-only">' +
        text +
        '</span><span aria-hidden="true">' +
        words
          .map(function (w) {
            return '<span class="word">' + w + '</span>'
          })
          .join(' ') +
        '</span>'
      gsap.fromTo(
        line.querySelectorAll('.word'),
        { opacity: 0.14 },
        {
          opacity: 1,
          stagger: 0.06,
          ease: 'none',
          scrollTrigger: { trigger: line, start: 'top 82%', end: 'top 38%', scrub: true },
        }
      )
    })
  }

  function materialsInteractivity(container) {
    var mapHost = container.querySelector('[data-map]')
    var panels = container.querySelectorAll('[data-material-panel-item]')
    var tabs = container.querySelectorAll('[data-material-index] button')
    if (!panels.length) return
    var nodes = mapHost ? mapHost.querySelectorAll('.map__node') : []
    var arcs = mapHost ? mapHost.querySelectorAll('.map__arc') : []

    function setActive(key) {
      nodes.forEach(function (n) {
        n.classList.toggle('is-active', n.dataset.material === key)
      })
      arcs.forEach(function (a) {
        a.classList.toggle('is-active', a.dataset.material === key)
      })
      tabs.forEach(function (t) {
        var selected = t.dataset.key === key
        t.setAttribute('aria-selected', String(selected))
        t.setAttribute('tabindex', selected ? '0' : '-1')
      })
      panels.forEach(function (p) {
        var active = p.dataset.materialPanelItem === key
        p.hidden = !active
        if (active && MOTION) {
          gsap.fromTo(
            p.children,
            { opacity: 0, y: 14 },
            { opacity: 1, y: 0, duration: 0.55, stagger: 0.06, ease: 'power2.out', overwrite: 'auto' }
          )
        }
      })
    }

    nodes.forEach(function (n) {
      n.addEventListener('click', function () {
        setActive(n.dataset.material)
      })
      n.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          setActive(n.dataset.material)
        }
      })
    })
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () {
        setActive(t.dataset.key)
      })
      t.addEventListener('keydown', function (e) {
        var target = null
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') target = tabs[(i + 1) % tabs.length]
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') target = tabs[(i - 1 + tabs.length) % tabs.length]
        if (!target) return
        e.preventDefault()
        setActive(target.dataset.key)
        target.focus()
      })
    })

    var first = panels[0] ? panels[0].dataset.materialPanelItem : null
    var preselected = container.querySelector('[data-material-panel-item]:not([hidden])')
    setActive(preselected ? preselected.dataset.materialPanelItem : first)
  }

  function materialsMotion(container) {
    if (!MOTION) return
    var svg = container.querySelector('.map')
    if (!svg || svg.dataset.revealed) return
    svg.dataset.revealed = 'true'

    var coasts = svg.querySelectorAll('.map__coast path')
    var arcs = svg.querySelectorAll('.map__arc')
    var nodes = svg.querySelectorAll('.map__node')
    var atelier = svg.querySelector('.map__atelier')
    var grat = svg.querySelector('.map__grat')
    var gratlbl = svg.querySelector('.map__gratlbl')

    coasts.forEach(function (p) {
      var len = p.getTotalLength()
      p.style.strokeDasharray = String(len)
      p.style.strokeDashoffset = String(len)
    })
    arcs.forEach(function (a) {
      a.style.strokeDashoffset = '32'
      a.style.opacity = '0'
    })

    gsap
      .timeline({
        scrollTrigger: { trigger: container, start: 'top 62%', once: true },
        defaults: { ease: 'power2.inOut' },
      })
      .fromTo(grat, { opacity: 0 }, { opacity: 0.14, duration: 1 }, 0)
      .fromTo(gratlbl, { opacity: 0 }, { opacity: 0.4, duration: 1 }, 0)
      .to(coasts, { strokeDashoffset: 0, duration: 2.2, stagger: 0.12 }, 0.1)
      .to(
        arcs,
        {
          opacity: 0.5,
          strokeDashoffset: 0,
          duration: 1.4,
          stagger: 0.15,
          onComplete: function () {
            gsap.set(arcs, { clearProps: 'opacity' })
          },
        },
        1.2
      )
      .fromTo(atelier, { opacity: 0, scale: 0.6, transformOrigin: '327px 193px' }, { opacity: 1, scale: 1, duration: 0.7, ease: 'back.out(2)' }, 1.5)
      .fromTo(nodes, { opacity: 0, scale: 0.5, transformOrigin: 'center' }, { opacity: 1, scale: 1, duration: 0.7, stagger: 0.1, ease: 'back.out(2)' }, 1.7)
      .fromTo(container.querySelector('.materials__panel'), { opacity: 0, x: 26 }, { opacity: 1, x: 0, duration: 0.9, ease: EASE }, 2)
      .fromTo(
        container.querySelectorAll('.materials__index button'),
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.07, ease: EASE },
        2.1
      )
  }

  function lookbookInit(container) {
    if (!MOTION) return
    container.querySelectorAll('.piece').forEach(function (piece, i) {
      if (piece.dataset.revealed) return
      piece.dataset.revealed = 'true'
      var img = piece.querySelector('img')
      var fromLeft = i % 2 === 0
      gsap
        .timeline({ scrollTrigger: { trigger: piece, start: 'top 86%', once: true } })
        .fromTo(
          piece,
          { clipPath: fromLeft ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)' },
          { clipPath: 'inset(0 0% 0 0%)', duration: 1.2, ease: 'expo.inOut' }
        )
        .fromTo(img, { scale: 1.25 }, { scale: 1.001, duration: 1.6, ease: EASE, clearProps: 'transform' }, 0.15)
    })
  }

  function configInit(container) {
    if (!MOTION) return
    gsap
      .timeline({
        scrollTrigger: { trigger: container, start: 'top 65%', once: true },
        defaults: { ease: EASE },
      })
      .fromTo(container.querySelector('.config__stage'), { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: 1.1 })
      .fromTo(
        container.querySelectorAll('.config__group, .config__summary'),
        { opacity: 0, y: 26 },
        { opacity: 1, y: 0, duration: 0.8, stagger: 0.12 },
        0.25
      )
  }

  function processInit(container) {
    if (!MOTION) return
    container.querySelectorAll('.process__step').forEach(function (step, i) {
      if (step.dataset.revealed) return
      step.dataset.revealed = 'true'
      gsap.fromTo(
        step,
        { opacity: 0, x: i % 2 ? 30 : -30 },
        { opacity: 1, x: 0, duration: 0.9, ease: EASE, scrollTrigger: { trigger: step, start: 'top 84%', once: true } }
      )
    })
    var img = container.querySelector('.process__figure img')
    if (img)
      gsap.fromTo(
        img,
        { scale: 1.12 },
        { scale: 1, ease: 'none', scrollTrigger: { trigger: container.querySelector('.process__media'), start: 'top 90%', end: 'bottom 20%', scrub: true } }
      )
  }

  function studioInit(container) {
    if (!MOTION) return
    var img = container.querySelector('.studio__media img')
    if (img)
      gsap.fromTo(
        img,
        { yPercent: -12 },
        { yPercent: 4, ease: 'none', scrollTrigger: { trigger: container, start: 'top bottom', end: 'bottom top', scrub: true } }
      )
    var body = container.querySelector('.studio__body')
    if (body)
      gsap.fromTo(
        body,
        { y: 70, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.1, ease: EASE, scrollTrigger: { trigger: body, start: 'top 88%', once: true } }
      )
  }

  function ctaInit(container) {
    if (!MOTION) return
    var lines = container.querySelectorAll('.cta__line > span')
    if (lines.length)
      gsap.fromTo(lines, { yPercent: 112 }, { yPercent: 0, duration: 1.2, stagger: 0.14, ease: EASE, scrollTrigger: { trigger: container, start: 'top 72%', once: true } })
    var actions = container.querySelector('.cta__actions')
    if (actions)
      gsap.fromTo(
        actions,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8, ease: EASE, delay: 0.2, scrollTrigger: { trigger: container, start: 'top 72%', once: true } }
      )
  }

  var INITS = {
    hero: [heroInit],
    manifesto: [manifestoInit],
    materials: [materialsInteractivity, materialsMotion],
    lookbook: [lookbookInit],
    config: [configInit],
    process: [processInit],
    studio: [studioInit],
    cta: [ctaInit],
  }

  function initSection(container) {
    var el = container.matches && container.matches('[data-section]') ? container : container.querySelector('[data-section]')
    if (!el) return
    var fns = INITS[el.dataset.section]
    if (fns)
      fns.forEach(function (fn) {
        fn(el)
      })
    initAnchors(el)
  }

  function boot() {
    initLenis()
    navState()
    initAnchors(document)

    var heroEl = document.querySelector('[data-section="hero"]')
    if (heroEl && MOTION) heroInit(heroEl)
    else hidePreloader()

    // resto de coreografías en cola idle (una por slice), como en el sitio original
    var rest = Array.prototype.filter.call(document.querySelectorAll('[data-section]'), function (el) {
      return el.dataset.section !== 'hero'
    })
    var idle = window.requestIdleCallback
      ? function (fn) {
          window.requestIdleCallback(fn, { timeout: 300 })
        }
      : function (fn) {
          setTimeout(fn, 120)
        }
    var next = function () {
      var el = rest.shift()
      if (!el) return
      var fns = INITS[el.dataset.section]
      if (fns)
        fns.forEach(function (fn) {
          fn(el)
        })
      idle(next)
    }
    idle(next)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()

  document.addEventListener('shopify:section:load', function (e) {
    initSection(e.target)
    if (ST) ST.refresh()
  })
  document.addEventListener('shopify:section:unload', function (e) {
    if (!ST) return
    ST.getAll().forEach(function (t) {
      if (t.trigger && e.target.contains(t.trigger)) t.kill()
    })
  })
})()
