/* LUXOR — capa commerce: cesta AJAX + drawer, product cards, quick view,
   carrusel y bundles. Vanilla, editor-safe (shopify:section:load).
   Config global: window.LuxorShopCfg = { moneyFormat, strings } (layout/theme.liquid). */
(function () {
  'use strict'

  var CFG = window.LuxorShopCfg || {}
  var STR = CFG.strings || {}

  /* ————— dinero ————— */
  function formatMoney(cents, format) {
    if (typeof cents === 'string') cents = cents.replace('.', '')
    var value = ''
    var placeholderRegex = /\{\{\s*(\w+)\s*\}\}/
    var formatString = format || CFG.moneyFormat || '€{{amount_with_comma_separator}}'

    function formatWithDelimiters(number, precision, thousands, decimal) {
      precision = precision == null ? 2 : precision
      thousands = thousands || ','
      decimal = decimal || '.'
      if (isNaN(number) || number == null) return 0
      number = (number / 100).toFixed(precision)
      var parts = number.split('.')
      var dollarsAmount = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands)
      var centsAmount = parts[1] ? decimal + parts[1] : ''
      return dollarsAmount + centsAmount
    }

    switch (formatString.match(placeholderRegex)[1]) {
      case 'amount':
        value = formatWithDelimiters(cents, 2)
        break
      case 'amount_no_decimals':
        value = formatWithDelimiters(cents, 0)
        break
      case 'amount_with_comma_separator':
        value = formatWithDelimiters(cents, 2, '.', ',')
        break
      case 'amount_no_decimals_with_comma_separator':
        value = formatWithDelimiters(cents, 0, '.', ',')
        break
      case 'amount_with_apostrophe_separator':
        value = formatWithDelimiters(cents, 2, "'", '.')
        break
      default:
        value = formatWithDelimiters(cents, 2)
    }
    return formatString.replace(placeholderRegex, value)
  }

  /* ————— scroll lock (Lenis-aware) ————— */
  var lockCount = 0
  function lockScroll() {
    lockCount++
    if (window.__lenis) window.__lenis.stop()
    document.documentElement.classList.add('luxor-locked')
  }
  function unlockScroll() {
    lockCount = Math.max(0, lockCount - 1)
    if (lockCount === 0) {
      if (window.__lenis) window.__lenis.start()
      document.documentElement.classList.remove('luxor-locked')
    }
  }

  /* ————— Cart API ————— */
  var Cart = {
    state: null,
    fetch: function () {
      return fetch('/cart.js', { credentials: 'same-origin' })
        .then(function (r) { return r.json() })
        .then(function (cart) {
          Cart.state = cart
          document.dispatchEvent(new CustomEvent('luxor:cart:update', { detail: cart }))
          return cart
        })
    },
    add: function (items) {
      return fetch('/cart/add.js', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items }),
      }).then(function (r) {
        if (!r.ok) {
          return r.json().then(function (err) {
            throw new Error(err.description || err.message || 'error')
          })
        }
        return Cart.fetch()
      })
    },
    change: function (key, quantity) {
      return fetch('/cart/change.js', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: key, quantity: quantity }),
      }).then(function (r) { return r.json() }).then(function (cart) {
        Cart.state = cart
        document.dispatchEvent(new CustomEvent('luxor:cart:update', { detail: cart }))
        return cart
      })
    },
  }

  /* ————— Cart drawer ————— */
  var drawer = {
    root: null,
    open: false,
    lastFocus: null,
    init: function () {
      drawer.root = document.querySelector('[data-cart-drawer]')
      if (!drawer.root || drawer.root.dataset.ready) return
      drawer.root.dataset.ready = 'true'

      drawer.root.querySelectorAll('[data-cart-close]').forEach(function (el) {
        el.addEventListener('click', drawer.hide)
      })
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && drawer.open) drawer.hide()
      })
      var checkout = drawer.root.querySelector('[data-cart-checkout]')
      if (checkout)
        checkout.addEventListener('click', function () {
          window.location.href = '/checkout'
        })

      document.addEventListener('luxor:cart:update', function (e) {
        drawer.render(e.detail)
      })
      document.addEventListener('luxor:cart:open', drawer.show)

      // enlaces del header a /cart y disparadores explícitos → drawer
      document.querySelectorAll('a[href$="/cart"], a[href="/cart"], [data-cart-open]').forEach(function (a) {
        a.addEventListener('click', function (e) {
          if (e.metaKey || e.ctrlKey) return
          e.preventDefault()
          drawer.show()
        })
      })

      Cart.fetch()
    },
    show: function () {
      if (!drawer.root) return
      Cart.fetch()
      if (!drawer.open) {
        drawer.open = true
        drawer.lastFocus = document.activeElement
        drawer.root.setAttribute('aria-hidden', 'false')
        drawer.root.classList.add('is-open')
        lockScroll()
        var panel = drawer.root.querySelector('.cdrawer__panel')
        if (panel) panel.focus({ preventScroll: true })
      }
    },
    hide: function () {
      if (!drawer.root || !drawer.open) return
      drawer.open = false
      drawer.root.setAttribute('aria-hidden', 'true')
      drawer.root.classList.remove('is-open')
      unlockScroll()
      if (drawer.lastFocus && drawer.lastFocus.focus) drawer.lastFocus.focus({ preventScroll: true })
    },
    status: function (msg) {
      var el = drawer.root && drawer.root.querySelector('[data-cart-status]')
      if (!el) return
      el.textContent = msg || ''
      el.classList.toggle('is-visible', !!msg)
      if (msg)
        setTimeout(function () {
          el.classList.remove('is-visible')
        }, 4000)
    },
    render: function (cart) {
      if (!drawer.root || !cart) return
      var items = drawer.root.querySelector('[data-cart-items]')
      var empty = drawer.root.querySelector('[data-cart-empty]')
      var foot = drawer.root.querySelector('[data-cart-foot]')
      var countLabel = drawer.root.querySelector('[data-cart-count-label]')
      var subtotal = drawer.root.querySelector('[data-cart-subtotal]')

      if (countLabel) {
        countLabel.hidden = cart.item_count === 0
        countLabel.textContent = '(' + cart.item_count + ')'
      }
      document.querySelectorAll('[data-cart-count]').forEach(function (el) {
        el.textContent = cart.item_count
        el.classList.toggle('is-empty', cart.item_count === 0)
      })

      var isEmpty = !cart.items || cart.items.length === 0
      if (empty) empty.hidden = !isEmpty
      if (foot) foot.hidden = isEmpty
      if (subtotal) subtotal.textContent = formatMoney(cart.items_subtotal_price)

      if (!items) return
      items.innerHTML = ''
      ;(cart.items || []).forEach(function (item) {
        var row = document.createElement('div')
        row.className = 'cdrawer__item'
        var img = item.image
          ? '<img src="' + item.image.replace(/(\.[a-z]+)(\?|$)/, '_160x$1$2') + '" alt="" loading="lazy" width="80" height="106">'
          : ''
        var variantLine = item.variant_title && item.variant_title !== 'Default Title'
          ? '<p class="cdrawer__item-variant">' + escapeHtml(item.variant_title) + '</p>'
          : ''
        row.innerHTML =
          '<a class="cdrawer__item-media" href="' + item.url + '" tabindex="-1">' + img + '</a>' +
          '<div class="cdrawer__item-body">' +
          '<a class="cdrawer__item-title" href="' + item.url + '">' + escapeHtml(item.product_title) + '</a>' +
          variantLine +
          '<div class="cdrawer__item-row">' +
          '<span class="cdrawer__qty">' +
          '<button type="button" data-qty-minus aria-label="' + (STR.decrease || '−') + '">−</button>' +
          '<span aria-live="polite">' + item.quantity + '</span>' +
          '<button type="button" data-qty-plus aria-label="' + (STR.increase || '+') + '">+</button>' +
          '</span>' +
          '<span class="cdrawer__item-price">' + formatMoney(item.final_line_price) + '</span>' +
          '</div>' +
          '</div>' +
          '<button class="cdrawer__item-remove" type="button" data-item-remove aria-label="' + (STR.remove || 'Eliminar') + '">' +
          '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1"/></svg>' +
          '</button>'

        row.querySelector('[data-qty-minus]').addEventListener('click', function () {
          Cart.change(item.key, item.quantity - 1)
        })
        row.querySelector('[data-qty-plus]').addEventListener('click', function () {
          Cart.change(item.key, item.quantity + 1)
        })
        row.querySelector('[data-item-remove]').addEventListener('click', function () {
          Cart.change(item.key, 0)
        })
        items.appendChild(row)
      })
    },
  }

  function escapeHtml(s) {
    var div = document.createElement('div')
    div.textContent = s == null ? '' : String(s)
    return div.innerHTML
  }

  /* ————— Product cards ————— */
  function initCard(card) {
    if (card.dataset.ready) return
    card.dataset.ready = 'true'
    var dataEl = card.querySelector('[data-pcard-data]')
    if (!dataEl) return
    var data
    try {
      data = JSON.parse(dataEl.textContent)
    } catch (e) {
      return
    }

    var current = null
    for (var i = 0; i < data.variants.length; i++) {
      if (data.variants[i].available) {
        current = data.variants[i]
        break
      }
    }
    if (!current) current = data.variants[0]
    if (!current) return

    var mainImg = card.querySelector('.pcard-img--main')
    var priceCurrent = card.querySelector('[data-pcard-price-current]')
    var priceCompare = card.querySelector('[data-pcard-price-compare]')
    var saleBadge = card.querySelector('[data-pcard-badge-sale]')
    var atcBtn = card.querySelector('[data-pcard-atc]')
    var buyBtn = card.querySelector('[data-pcard-buy]')
    var quickAdd = card.querySelector('[data-pcard-quickadd]')
    var quickAddLabel = card.querySelector('[data-pcard-quickadd-label]')

    function selectedOpts() {
      return current ? current.opts.slice() : []
    }

    function findVariant(opts) {
      for (var i = 0; i < data.variants.length; i++) {
        var v = data.variants[i]
        var match = true
        for (var j = 0; j < opts.length; j++) {
          if (v.opts[j] !== opts[j]) {
            match = false
            break
          }
        }
        if (match) return v
      }
      return null
    }

    function apply(variant) {
      if (!variant) return
      current = variant
      if (priceCurrent) {
        priceCurrent.textContent = formatMoney(variant.price)
        priceCurrent.classList.toggle('is-sale', variant.compare > variant.price)
      }
      if (priceCompare) {
        var onSale = variant.compare > variant.price
        priceCompare.hidden = !onSale
        priceCompare.textContent = onSale ? formatMoney(variant.compare) : ''
      }
      if (saleBadge) saleBadge.hidden = !(variant.compare > variant.price)
      if (variant.img && mainImg) {
        mainImg.removeAttribute('srcset')
        mainImg.removeAttribute('sizes')
        mainImg.src = variant.img
      }
      var oos = !variant.available
      ;[atcBtn, buyBtn, quickAdd].forEach(function (b) {
        if (b) {
          b.disabled = oos
          b.classList.toggle('is-disabled', oos)
        }
      })
      if (quickAddLabel) quickAddLabel.textContent = oos ? (STR.soldOut || 'Agotado') : (STR.quickAdd || 'Quick add')
    }

    card.querySelectorAll('[data-pcard-swatch]').forEach(function (sw) {
      sw.addEventListener('click', function () {
        var group = sw.closest('[data-pcard-option-index]')
        var idx = parseInt(group.dataset.pcardOptionIndex, 10)
        group.querySelectorAll('[data-pcard-swatch]').forEach(function (s) {
          s.setAttribute('aria-checked', String(s === sw))
        })
        var opts = selectedOpts()
        opts[idx] = sw.dataset.value
        var v = findVariant(opts)
        if (!v) {
          // busca la primera variante con ese valor en esa opción
          for (var i = 0; i < data.variants.length; i++) {
            if (data.variants[i].opts[idx] === sw.dataset.value) {
              v = data.variants[i]
              break
            }
          }
        }
        apply(v)
        syncSelects()
      })
    })

    function syncSelects() {
      card.querySelectorAll('[data-pcard-select]').forEach(function (sel) {
        var idx = parseInt(sel.dataset.pcardOptionIndex, 10)
        if (current && current.opts[idx] != null) sel.value = current.opts[idx]
      })
    }

    card.querySelectorAll('[data-pcard-select]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var opts = selectedOpts()
        opts[parseInt(sel.dataset.pcardOptionIndex, 10)] = sel.value
        var v = findVariant(opts)
        apply(v || current)
      })
    })

    function addCurrent(thenCheckout) {
      if (!current || !current.available) return
      var btns = [atcBtn, buyBtn, quickAdd].filter(Boolean)
      btns.forEach(function (b) { b.classList.add('is-busy') })
      Cart.add([{ id: current.id, quantity: 1 }])
        .then(function () {
          if (thenCheckout) window.location.href = '/checkout'
          else drawer.show()
        })
        .catch(function (err) {
          drawer.show()
          drawer.status(err.message)
        })
        .then(function () {
          btns.forEach(function (b) { b.classList.remove('is-busy') })
        })
    }

    if (atcBtn) atcBtn.addEventListener('click', function () { addCurrent(false) })
    if (quickAdd) quickAdd.addEventListener('click', function () { addCurrent(false) })
    if (buyBtn) buyBtn.addEventListener('click', function () { addCurrent(true) })

    var qv = card.querySelector('[data-pcard-quickview]')
    if (qv)
      qv.addEventListener('click', function () {
        quickView.show(data.url)
      })

    apply(current)
    syncSelects()
  }

  /* ————— Quick view ————— */
  var quickView = {
    root: null,
    product: null,
    current: null,
    init: function () {
      quickView.root = document.querySelector('[data-quick-view]')
      if (!quickView.root || quickView.root.dataset.ready) return
      quickView.root.dataset.ready = 'true'
      quickView.root.querySelector('[data-qview-close]').addEventListener('click', quickView.hide)
      quickView.root.addEventListener('close', function () {
        unlockScroll()
      })
      quickView.root.addEventListener('click', function (e) {
        if (e.target === quickView.root) quickView.hide()
      })
      quickView.root.querySelector('[data-qview-atc]').addEventListener('click', function () {
        quickView.addCurrent(false)
      })
      quickView.root.querySelector('[data-qview-buy]').addEventListener('click', function () {
        quickView.addCurrent(true)
      })
    },
    show: function (url) {
      if (!quickView.root) return
      var body = quickView.root.querySelector('[data-qview-body]')
      var loading = quickView.root.querySelector('[data-qview-loading]')
      body.hidden = true
      loading.hidden = false
      quickView.root.showModal()
      lockScroll()
      var base = url.split('?')[0]
      fetch(base + '.js', { credentials: 'same-origin' })
        .then(function (r) { return r.json() })
        .then(function (p) {
          quickView.product = p
          quickView.render(p, url)
          loading.hidden = true
          body.hidden = false
        })
        .catch(function () {
          window.location.href = url
        })
    },
    hide: function () {
      if (quickView.root && quickView.root.open) quickView.root.close()
    },
    render: function (p, url) {
      var root = quickView.root
      var gallery = root.querySelector('[data-qview-gallery]')
      gallery.innerHTML = ''
      ;(p.images || []).slice(0, 4).forEach(function (src, i) {
        var img = document.createElement('img')
        img.src = sized(src, 720)
        img.alt = ''
        img.loading = i === 0 ? 'eager' : 'lazy'
        img.className = i === 0 ? 'is-active' : ''
        img.addEventListener('click', function () {
          gallery.querySelectorAll('img').forEach(function (im) { im.classList.remove('is-active') })
          img.classList.add('is-active')
        })
        gallery.appendChild(img)
      })

      root.querySelector('[data-qview-kind]').textContent = p.type || p.vendor || ''
      root.querySelector('[data-qview-title]').textContent = p.title
      var desc = document.createElement('div')
      desc.innerHTML = p.description || ''
      var text = (desc.textContent || '').trim()
      root.querySelector('[data-qview-desc]').textContent = text.length > 220 ? text.slice(0, 220) + '…' : text
      var link = root.querySelector('[data-qview-link]')
      link.href = url

      var optsHost = root.querySelector('[data-qview-options]')
      optsHost.innerHTML = ''
      quickView.current = null
      for (var i = 0; i < p.variants.length; i++) {
        if (p.variants[i].available) {
          quickView.current = p.variants[i]
          break
        }
      }
      if (!quickView.current) quickView.current = p.variants[0]

      if (p.variants.length > 1) {
        p.options.forEach(function (name, idx) {
          var values = []
          p.variants.forEach(function (v) {
            var val = v.options[idx]
            if (values.indexOf(val) === -1) values.push(val)
          })
          var label = document.createElement('label')
          label.className = 'qview__opt'
          var span = document.createElement('span')
          span.textContent = name
          var sel = document.createElement('select')
          values.forEach(function (val) {
            var o = document.createElement('option')
            o.value = val
            o.textContent = val
            if (quickView.current && quickView.current.options[idx] === val) o.selected = true
            sel.appendChild(o)
          })
          sel.addEventListener('change', function () {
            var chosen = []
            optsHost.querySelectorAll('select').forEach(function (s) { chosen.push(s.value) })
            var v = p.variants.filter(function (v) {
              return v.options.every(function (o, j) { return o === chosen[j] })
            })[0]
            if (v) {
              quickView.current = v
              quickView.paintPrice()
              if (v.featured_image && v.featured_image.src) {
                var first = gallery.querySelector('img')
                if (first) first.src = sized(v.featured_image.src, 720)
              }
            }
          })
          label.appendChild(span)
          label.appendChild(sel)
          optsHost.appendChild(label)
        })
      }
      quickView.paintPrice()
    },
    paintPrice: function () {
      var v = quickView.current
      if (!v) return
      var root = quickView.root
      root.querySelector('[data-qview-price]').textContent = formatMoney(v.price)
      var cmp = root.querySelector('[data-qview-compare]')
      var onSale = v.compare_at_price && v.compare_at_price > v.price
      cmp.hidden = !onSale
      cmp.textContent = onSale ? formatMoney(v.compare_at_price) : ''
      var atc = root.querySelector('[data-qview-atc]')
      var buy = root.querySelector('[data-qview-buy]')
      ;[atc, buy].forEach(function (b) {
        b.disabled = !v.available
        b.classList.toggle('is-disabled', !v.available)
      })
    },
    addCurrent: function (thenCheckout) {
      var v = quickView.current
      if (!v || !v.available) return
      Cart.add([{ id: v.id, quantity: 1 }])
        .then(function () {
          quickView.hide()
          if (thenCheckout) window.location.href = '/checkout'
          else drawer.show()
        })
        .catch(function (err) {
          quickView.hide()
          drawer.show()
          drawer.status(err.message)
        })
    },
  }

  function sized(src, width) {
    return src.replace(/(\.[a-zA-Z]+)(\?|$)/, '_' + width + 'x$1$2')
  }

  /* ————— Carrusel ————— */
  function initCarousel(root) {
    if (root.dataset.ready) return
    root.dataset.ready = 'true'
    var track = root.querySelector('[data-carousel-track]')
    var prev = root.querySelector('[data-carousel-prev]')
    var next = root.querySelector('[data-carousel-next]')
    var dotsHost = root.querySelector('[data-carousel-dots]')
    if (!track) return

    function pages() {
      return Math.max(1, Math.round(track.scrollWidth / track.clientWidth))
    }
    function activePage() {
      return Math.min(pages() - 1, Math.round(track.scrollLeft / track.clientWidth))
    }
    function buildDots() {
      if (!dotsHost) return
      dotsHost.innerHTML = ''
      var n = pages()
      if (n < 2) return
      for (var i = 0; i < n; i++) {
        var dot = document.createElement('button')
        dot.type = 'button'
        dot.className = 'lcarousel__dot'
        dot.setAttribute('aria-label', (STR.goToPage || 'Página') + ' ' + (i + 1))
        ;(function (i) {
          dot.addEventListener('click', function () {
            track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' })
          })
        })(i)
        dotsHost.appendChild(dot)
      }
      paint()
    }
    function paint() {
      var a = activePage()
      if (dotsHost)
        Array.prototype.forEach.call(dotsHost.children, function (d, i) {
          d.classList.toggle('is-active', i === a)
        })
      if (prev) prev.disabled = track.scrollLeft <= 4
      if (next) next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4
    }
    if (prev)
      prev.addEventListener('click', function () {
        track.scrollBy({ left: -track.clientWidth, behavior: 'smooth' })
      })
    if (next)
      next.addEventListener('click', function () {
        track.scrollBy({ left: track.clientWidth, behavior: 'smooth' })
      })
    var raf = null
    track.addEventListener('scroll', function () {
      if (raf) return
      raf = requestAnimationFrame(function () {
        raf = null
        paint()
      })
    })
    window.addEventListener('resize', buildDots)
    buildDots()
  }

  /* ————— Bundle ————— */
  function initBundle(root) {
    if (root.dataset.ready) return
    root.dataset.ready = 'true'
    var totalEl = root.querySelector('[data-bundle-total]')
    var compareEl = root.querySelector('[data-bundle-compare]')
    var countEl = root.querySelector('[data-bundle-count]')
    var btn = root.querySelector('[data-bundle-atc]')
    var discount = parseFloat(root.dataset.bundleDiscount || '0')

    function items() {
      var out = []
      root.querySelectorAll('[data-bundle-item]').forEach(function (item) {
        var check = item.querySelector('[data-bundle-check]')
        if (check && !check.checked) return
        var sel = item.querySelector('[data-bundle-variant]')
        var id, price
        if (sel) {
          var opt = sel.options[sel.selectedIndex]
          id = parseInt(opt.value, 10)
          price = parseInt(opt.dataset.price, 10)
        } else {
          id = parseInt(item.dataset.variantId, 10)
          price = parseInt(item.dataset.price, 10)
        }
        if (id) out.push({ id: id, quantity: 1, price: price })
      })
      return out
    }

    function paint() {
      var list = items()
      var sum = list.reduce(function (acc, it) { return acc + (it.price || 0) }, 0)
      var final = discount > 0 ? Math.round(sum * (100 - discount) / 100) : sum
      if (totalEl) totalEl.textContent = formatMoney(final)
      if (compareEl) {
        compareEl.hidden = !(discount > 0 && sum > 0)
        compareEl.textContent = discount > 0 ? formatMoney(sum) : ''
      }
      if (countEl) countEl.textContent = list.length
      if (btn) btn.disabled = list.length === 0
    }

    root.querySelectorAll('[data-bundle-check], [data-bundle-variant]').forEach(function (el) {
      el.addEventListener('change', paint)
    })
    if (btn)
      btn.addEventListener('click', function () {
        var list = items().map(function (it) {
          return { id: it.id, quantity: it.quantity }
        })
        if (!list.length) return
        btn.classList.add('is-busy')
        Cart.add(list)
          .then(function () {
            drawer.show()
          })
          .catch(function (err) {
            drawer.show()
            drawer.status(err.message)
          })
          .then(function () {
            btn.classList.remove('is-busy')
          })
      })
    paint()
  }

  /* ————— intercepta forms nativos de cesta (PDP, configurador real) ————— */
  function interceptCartForms() {
    document.addEventListener('submit', function (e) {
      var form = e.target
      if (!form.matches || !form.action || form.action.indexOf('/cart/add') === -1) return
      var idInput = form.querySelector('input[name="id"], select[name="id"]')
      if (!idInput || !idInput.value) return
      e.preventDefault()
      var qty = form.querySelector('input[name="quantity"]')
      Cart.add([{ id: parseInt(idInput.value, 10), quantity: qty ? parseInt(qty.value, 10) || 1 : 1 }])
        .then(function () {
          drawer.show()
        })
        .catch(function (err) {
          drawer.show()
          drawer.status(err.message)
        })
    })
  }

  /* ————— init ————— */
  function initAll(scope) {
    ;(scope || document).querySelectorAll('[data-pcard]').forEach(initCard)
    ;(scope || document).querySelectorAll('[data-carousel]').forEach(initCarousel)
    ;(scope || document).querySelectorAll('[data-bundle]').forEach(initBundle)
  }

  function boot() {
    drawer.init()
    quickView.init()
    interceptCartForms()
    initAll(document)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()

  document.addEventListener('shopify:section:load', function (e) {
    initAll(e.target)
  })

  window.LuxorShop = { Cart: Cart, drawer: drawer, quickView: quickView, formatMoney: formatMoney }
})()
