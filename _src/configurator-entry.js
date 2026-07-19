// LUXOR — configurador 3D para Shopify (bundle IIFE con Three.js incluido).
// Contrato: la sección inyecta un <script type="application/json" data-config-data>
// con { materials[{name,tex,thumb}], finishes[{name}], sizes[{name}], variants[
// {id,option1,option2,option3,price,sku,available}], leadDefault, leadL, demo }.
// gsap llega como global (gsap.min.js del tema). Re-init seguro para el editor
// de temas vía window.LuxorConfigurator.init(sectionEl).

import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches
const gsap = window.gsap

const MATERIAL_PARAMS = {
  travertino: { roughness: [0.95, 0.5], metalness: 0, emissive: 0.05 },
  alabastro: { roughness: [0.6, 0.32], metalness: 0, emissive: 0.55 },
  laton: { roughness: [0.45, 0.16], metalness: 1, emissive: 0.02 },
  cedro: { roughness: [0.85, 0.45], metalness: 0, emissive: 0.04 },
  default: { roughness: [0.8, 0.4], metalness: 0, emissive: 0.05 },
}
const SIZE_SCALE = [0.78, 1, 1.22]

function handleize(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function cmFromName(name, index) {
  const m = /(\d+)\s*cm/i.exec(name)
  return m ? parseInt(m[1], 10) : [28, 42, 60][index] ?? 42
}

function tween(target, vars) {
  if (gsap) gsap.to(target, vars)
  else Object.assign(target, Object.fromEntries(Object.entries(vars).filter(([k]) => !['duration', 'ease'].includes(k))))
}

function initSection(root) {
  if (!root || root.dataset.luxorConfigInit === 'true') return
  const dataEl = root.querySelector('[data-config-data]')
  const canvas = root.querySelector('[data-config-canvas]')
  const stage = root.querySelector('.config__stage')
  if (!dataEl || !canvas || !stage) return
  root.dataset.luxorConfigInit = 'true'

  let data
  try {
    data = JSON.parse(dataEl.textContent)
  } catch {
    return
  }

  const materials = (data.materials || []).map((m) => ({ ...m, key: handleize(m.name) }))
  const finishes = (data.finishes || []).map((f) => ({ ...f, key: handleize(f.name) }))
  const sizes = (data.sizes || []).map((s, i) => ({ ...s, key: ['s', 'm', 'l'][i] ?? String(i), cm: cmFromName(s.name, i) }))
  const variants = data.variants || []
  const inEditor = window.Shopify && window.Shopify.designMode

  // ————— estado (deep-link ?material=&acabado=&tamano= como en el sitio original) —————
  const q = new URLSearchParams(location.search)
  const pick = (value, list, fallback) => (list.some((x) => x.key === value) ? value : fallback)
  const state = {
    material: pick(q.get('material'), materials, materials[1]?.key ?? materials[0]?.key),
    finish: pick(q.get('acabado'), finishes, finishes[0]?.key),
    size: pick(q.get('tamano'), sizes, sizes[1]?.key ?? sizes[0]?.key),
  }
  function syncQuery() {
    if (inEditor) return
    const qs = new URLSearchParams({ material: state.material, acabado: state.finish, tamano: state.size })
    history.replaceState(null, '', `${location.pathname}?${qs}${location.hash}`)
  }

  function findVariant() {
    const mat = materials.find((m) => m.key === state.material)
    const fin = finishes.find((f) => f.key === state.finish)
    const siz = sizes.find((s) => s.key === state.size)
    const exact = variants.find((v) => v.option1 === mat?.name && v.option2 === fin?.name && v.option3 === siz?.name)
    return exact || (variants.length === 1 ? variants[0] : undefined)
  }

  // ————— UI de controles (vive aunque no haya WebGL) —————
  const swatchHost = root.querySelector('[data-swatches]')
  const finHost = root.querySelector('[data-finishes]')
  const sizeHost = root.querySelector('[data-sizes]')
  const form = root.querySelector('[data-config-form]')

  function renderControls() {
    if (swatchHost) {
      swatchHost.setAttribute('role', 'radiogroup')
      swatchHost.innerHTML = materials
        .map(
          (m) => `<button type="button" role="radio" class="swatch" data-material="${m.key}" aria-checked="${String(m.key === state.material)}" aria-label="Material ${m.name}">
            <img src="${m.thumb || m.tex}" alt="" loading="lazy" width="256" height="256" />
            <span>${m.name}</span>
          </button>`
        )
        .join('')
    }
    if (finHost) {
      finHost.setAttribute('role', 'radiogroup')
      finHost.innerHTML = finishes
        .map((f) => `<button type="button" role="radio" class="pill" data-finish="${f.key}" aria-checked="${String(f.key === state.finish)}">${f.name}</button>`)
        .join('')
    }
    if (sizeHost) {
      sizeHost.setAttribute('role', 'radiogroup')
      sizeHost.innerHTML = sizes
        .map((s) => `<button type="button" role="radio" class="pill" data-size="${s.key}" aria-checked="${String(s.key === state.size)}">${s.name}</button>`)
        .join('')
    }
  }

  function setChecked(selector, active) {
    root.querySelectorAll(`.config__controls ${selector}`).forEach((b) => b.setAttribute('aria-checked', String(b === active)))
  }

  function updateSummary() {
    const v = findVariant()
    const price = root.querySelector('[data-price]')
    const sku = root.querySelector('[data-sku]')
    const lead = root.querySelector('[data-lead]')
    const idInput = root.querySelector('[data-variant-id]')
    const buy = root.querySelector('.config__buy')
    if (sku) sku.textContent = v?.sku || v?.title || '—'
    if (lead) lead.textContent = state.size === 'l' ? data.leadL || data.leadDefault || '' : data.leadDefault || ''
    if (price) {
      price.textContent = v ? v.price : '—'
      if (!REDUCED && gsap) gsap.fromTo(price, { opacity: 0.4 }, { opacity: 1, duration: 0.5 })
    }
    if (idInput && v?.id) idInput.value = v.id
    if (buy) buy.disabled = v ? v.available === false : false
    if (buy && v && v.available === false) buy.textContent = buy.dataset.soldout || 'Agotado'
  }

  const sizeByKey = (k) => sizes.findIndex((s) => s.key === k)

  function renderRuler() {
    const host = root.querySelector('[data-config-ruler]')
    if (!host) return
    const parts = []
    for (let cm = 0; cm <= 70; cm++) {
      const x = cm * 10
      const isMajor = cm % 10 === 0
      parts.push(`<line x1="${x}" y1="${isMajor ? 12 : 18}" x2="${x}" y2="22" stroke="currentColor" stroke-width="${isMajor ? 1 : 0.5}" opacity="${isMajor ? 0.7 : 0.35}"/>`)
      if (isMajor && cm > 0) parts.push(`<text x="${x - 8}" y="9" opacity="0.6">${cm}</text>`)
    }
    host.innerHTML = `<svg viewBox="0 0 700 30" preserveAspectRatio="none">
      <line x1="0" y1="22" x2="700" y2="22" stroke="currentColor" stroke-width="0.75" opacity="0.5"/>
      ${parts.join('')}
      <g class="ruler__marker" data-ruler-marker><line x1="0" y1="2" x2="0" y2="22" stroke-width="1.5"/><text x="6" y="9" data-ruler-label></text></g>
    </svg>`
  }

  function updateRuler() {
    const marker = root.querySelector('[data-ruler-marker]')
    if (!marker) return
    const size = sizes.find((s) => s.key === state.size)
    if (!size) return
    marker.style.transform = `translateX(${size.cm * 10}px)`
    const label = marker.querySelector('[data-ruler-label]')
    if (label) label.textContent = `${size.cm} cm`
  }

  const hooks = { material: () => {}, size: () => {} }

  function wireControls() {
    if (!form) return
    form.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-material], button[data-finish], button[data-size]')
      if (!btn) return
      if (btn.dataset.material) {
        state.material = btn.dataset.material
        setChecked('[data-material]', btn)
        hooks.material()
      } else if (btn.dataset.finish) {
        state.finish = btn.dataset.finish
        setChecked('[data-finish]', btn)
        hooks.material()
      } else if (btn.dataset.size) {
        state.size = btn.dataset.size
        setChecked('[data-size]', btn)
        hooks.size()
        updateRuler()
      }
      syncQuery()
      updateSummary()
    })
    if (data.demo) {
      form.addEventListener('submit', (e) => {
        e.preventDefault()
        const buy = form.querySelector('.config__buy')
        const v = findVariant()
        if (!buy) return
        const original = buy.textContent
        buy.textContent = `${buy.dataset.confirm || 'Encargo registrado'} — ${v?.sku ?? ''}`
        buy.disabled = true
        setTimeout(() => {
          buy.textContent = original
          buy.disabled = false
        }, 3200)
      })
    }
  }

  renderControls()
  renderRuler()
  updateRuler()
  updateSummary()
  wireControls()

  // oculta fieldsets sin valores (productos con menos de 3 opciones)
  ;[
    [swatchHost, materials],
    [finHost, finishes],
    [sizeHost, sizes],
  ].forEach(([host, list]) => {
    const grp = host && host.closest('.config__group')
    if (grp) grp.hidden = list.length === 0
  })

  // comprar ahora (modo producto real): añade la variante y va directo al checkout
  const buyNow = root.querySelector('[data-config-buynow]')
  if (buyNow)
    buyNow.addEventListener('click', () => {
      const v = findVariant()
      if (!v || !v.id || v.available === false) return
      buyNow.disabled = true
      fetch('/cart/add.js', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ id: v.id, quantity: 1 }] }),
      })
        .then((r) => {
          if (r.ok) location.href = '/checkout'
          else buyNow.disabled = false
        })
        .catch(() => {
          buyNow.disabled = false
        })
    })

  function showFallback() {
    canvas.hidden = true
    const fb = root.querySelector('[data-config-fallback]')
    const hint = root.querySelector('[data-config-hint]')
    if (fb) fb.hidden = false
    if (hint) hint.hidden = true
  }

  // modo spotlight: producto sin modelo GLB → ficha estática (sin 3D)
  if (data.spotlight) {
    showFallback()
    const ruler = root.querySelector('[data-config-ruler]')
    if (ruler) ruler.hidden = true
    return
  }

  // ————— 3D —————
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  } catch {
    showFallback()
    return
  }
  if (!renderer.getContext()) {
    showFallback()
    return
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30)
  function frameCamera() {
    const z = camera.aspect < 1 ? 4.5 : 3.75
    camera.position.set(0, 0.35, z)
    camera.lookAt(0, -0.02, 0)
  }

  const key = new THREE.DirectionalLight(0xffe3c0, 2.4)
  key.position.set(-2.4, 3.2, 2.2)
  scene.add(key)
  scene.add(new THREE.HemisphereLight(0xf2e5cf, 0x241c14, 0.45))
  const inner = new THREE.PointLight(0xffb46b, 2.6, 4, 1.6)
  inner.position.set(0, 0.82, 0)
  scene.add(inner)

  const group = new THREE.Group()
  group.position.y = -0.72
  scene.add(group)

  const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0 })
  const glbMode = !!data.glb

  if (glbMode) {
    // Featured Product 3D: carga el modelo GLB del producto (media 3D de Shopify
    // o URL de Archivos) y lo normaliza al encuadre de la Ánfora (alto 1.42).
    new GLTFLoader()
      .loadAsync(data.glb)
      .then((gltf) => {
        const model = gltf.scene
        const box = new THREE.Box3().setFromObject(model)
        const dims = box.getSize(new THREE.Vector3())
        const scale = 1.42 / Math.max(dims.y, 0.0001)
        model.scale.setScalar(scale)
        box.setFromObject(model)
        const center = box.getCenter(new THREE.Vector3())
        model.position.x -= center.x
        model.position.z -= center.z
        model.position.y -= box.min.y
        group.add(model)
      })
      .catch(() => showFallback())
  } else {
    const profile = new THREE.SplineCurve([
      new THREE.Vector2(0.005, 0), new THREE.Vector2(0.15, 0), new THREE.Vector2(0.18, 0.03),
      new THREE.Vector2(0.14, 0.1), new THREE.Vector2(0.17, 0.22), new THREE.Vector2(0.27, 0.42),
      new THREE.Vector2(0.325, 0.62), new THREE.Vector2(0.33, 0.78), new THREE.Vector2(0.28, 0.95),
      new THREE.Vector2(0.19, 1.08), new THREE.Vector2(0.125, 1.18), new THREE.Vector2(0.115, 1.28),
      new THREE.Vector2(0.155, 1.36), new THREE.Vector2(0.19, 1.41), new THREE.Vector2(0.005, 1.42),
    ])
    const geometry = new THREE.LatheGeometry(profile.getPoints(72), 112)
    const body = new THREE.Mesh(geometry, bodyMat)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.155, 0.012, 24, 96),
      new THREE.MeshPhysicalMaterial({ color: 0xc9a468, metalness: 1, roughness: 0.25 })
    )
    ring.rotation.x = Math.PI / 2
    ring.position.y = 1.335
    group.add(body, ring)
  }

  const loader = new THREE.TextureLoader()
  const cache = new Map()
  function textureFor(key) {
    if (!cache.has(key)) {
      const mat = materials.find((m) => m.key === key)
      cache.set(
        key,
        loader
          .loadAsync(mat?.tex || '')
          .then((tex) => {
            tex.colorSpace = THREE.SRGBColorSpace
            tex.wrapS = THREE.MirroredRepeatWrapping
            tex.repeat.set(2, 1)
            tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
            return tex
          })
          .catch((err) => {
            cache.delete(key)
            throw err
          })
      )
    }
    return cache.get(key)
  }

  async function applyMaterial() {
    if (glbMode) return // el GLB trae sus propios materiales; los swatches siguen eligiendo variante
    const requested = state.material
    let tex
    try {
      tex = await textureFor(requested)
    } catch {
      return
    }
    if (requested !== state.material) return
    const params = MATERIAL_PARAMS[requested] || MATERIAL_PARAMS.default
    bodyMat.map = tex
    bodyMat.emissiveMap = tex
    bodyMat.emissive = new THREE.Color(0xffc98a)
    bodyMat.emissiveIntensity = params.emissive
    bodyMat.roughness = params.roughness[state.finish === finishes[1]?.key ? 1 : 0]
    bodyMat.metalness = params.metalness
    bodyMat.needsUpdate = true
    tween(inner, { intensity: requested === 'alabastro' ? 3.2 : 1.1, duration: REDUCED ? 0 : 0.8 })
  }

  function applySize() {
    const s = SIZE_SCALE[sizeByKey(state.size)] ?? 1
    tween(group.scale, { x: s, y: s, z: s, duration: REDUCED ? 0 : 0.9, ease: 'expo.out' })
  }

  let targetRot = 0.4
  let dragging = false
  let lastX = 0
  let idleTimer = 0

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true
    lastX = e.clientX
    canvas.setPointerCapture(e.pointerId)
    const hint = root.querySelector('[data-config-hint]')
    if (hint) tween(hint, { opacity: 0, duration: 0.4 })
  })
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return
    targetRot += (e.clientX - lastX) * 0.011
    lastX = e.clientX
    idleTimer = 0
  })
  const stopDrag = () => (dragging = false)
  canvas.addEventListener('pointerup', stopDrag)
  canvas.addEventListener('pointercancel', stopDrag)
  canvas.tabIndex = 0
  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') targetRot -= 0.35
    else if (e.key === 'ArrowRight') targetRot += 0.35
    else return
    e.preventDefault()
    idleTimer = 0
  })

  function resize() {
    const w = stage.clientWidth
    const h = stage.clientHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    frameCamera()
  }
  new ResizeObserver(resize).observe(stage)
  resize()

  let visible = false
  let running = false
  let lastTime = performance.now()
  new IntersectionObserver(
    (entries) => {
      visible = entries[entries.length - 1].isIntersecting
      if (visible && !running) {
        running = true
        lastTime = performance.now()
        requestAnimationFrame(tick)
      }
    },
    { rootMargin: '120px' }
  ).observe(stage)

  function tick(now) {
    if (!visible) {
      running = false
      return
    }
    const dt = Math.min((now - lastTime) / 1000, 0.05)
    lastTime = now
    if (!dragging && !REDUCED) {
      idleTimer += dt
      if (idleTimer > 1.2) targetRot += dt * 0.22
    }
    group.rotation.y += (targetRot - group.rotation.y) * 0.085
    renderer.render(scene, camera)
    requestAnimationFrame(tick)
  }

  hooks.material = applyMaterial
  hooks.size = applySize
  applyMaterial()
  applySize()
}

function initAll() {
  document.querySelectorAll('[data-config-root]').forEach(initSection)
}

window.LuxorConfigurator = { init: initSection, initAll }

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll)
else initAll()

document.addEventListener('shopify:section:load', (e) => {
  const root = e.target.querySelector('[data-config-root]')
  if (root) initSection(root)
})
