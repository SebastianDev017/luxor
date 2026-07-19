# LUXOR — Tema Shopify OS 2.0

Conversión 1:1 del sitio LUXOR (casa de objetos de lujo: travertino, alabastro, latón y cedro).
Paleta hueso/tinta/latón, Jost + Roboto + IBM Plex Mono autoalojadas, motion GSAP + Lenis y
**configurador 3D real** (Three.js, texturas macro generadas sobre geometría torneada).

## Secciones firma (home)
`luxor-hero` · `luxor-manifesto` (scrub por palabra) · `luxor-materials` (mapa de herencia SVG interactivo)
· `luxor-lookbook` (grid editorial 6 huecos o colección) · `luxor-configurator` (3D, demo o producto real)
· `luxor-process` · `luxor-studio` · `luxor-cta` (+ header/footer con wordmark embossed).

## Configurador
- **Sin producto:** modo demo con precios calculados (base × acabado × tamaño, redondeo a 10 €).
- **Con producto:** requiere 3 opciones en este orden — `Material`, `Acabado`, `Tamaño`.
  Los bloques de la sección mapean cada valor de Material a su textura. Añade al carrito real
  (`/cart/add`) con la variante resuelta. Estado compartible por URL (`?material=&acabado=&tamano=`).

## Desarrollo
```sh
shopify theme dev --store TU-STORE   # preview local
shopify theme check                  # lint
```
Conexión GitHub → Shopify: Admin → Temas → Añadir tema → Conectar desde GitHub → este repo, rama `main`.

Fuente del bundle 3D: `_src/configurator-entry.js` (se compila con esbuild a `assets/luxor-configurator.js`,
Three.js incluido). Las fotografías y texturas de `assets/` se generaron a medida para la marca.

---

## Build Bojola (revamp pitch)

La rama incluye el volcado 1:1 de **studiobojola.com** (Studio Bojola — Toscana) como demo del tema:
homepage completa (`templates/index.json`), imágenes de su CDN re-optimizadas en `assets/bojola-*.webp`,
mapa de herencia recartografiado a su geografía (Firenze · Val d'Elsa · Montelupo · Murano · Anatolia)
y la sección editorial **«Notes from the Atelier»** (diario 1983 → 2020 → oggi + clientes).

### Puesta en marcha de la tienda demo
1. **Idioma:** Settings → Languages → English como idioma principal (el tema trae `locales/en.json` completo; el chrome sale en inglés como el sitio original de Bojola).
2. **Productos:** Admin → Products → Import → `docs/bojola-import.csv` (32 productos reales de Bojola, 8 con variantes de color para la demo de swatches; las imágenes se descargan de su CDN al importar). Marca «Overwrite» desactivado.
3. **Colecciones automáticas** (los handles deben coincidir):
   - `crystal-vase` → condición: Type = `crystal vase`
   - `barware` → Type = `barware`
   - `ceramic-1` → Type = `ceramic`
   - `crystal-box` → Type = `crystal boxes`
   - `collezione-lampade-di-cristallo` → Type = `crystal lamps`
   - `sculture-olfattive` → Type = `objects`
   - `jewels-1` → Type = `brass and crystal jewels`
4. **Bundle:** el descuento −10% es visual; crea el descuento automático equivalente en Admin → Discounts.
5. **Featured Product 3D:** sin producto asignado corre la demo. Para vender la pieza real: sube el `.glb` como media del producto (Admin → Producto → Add media) o pega la URL del archivo en el ajuste de la sección. Sin GLB pero con producto → ficha spotlight.

### Capa ecommerce (nueva)
- **Cart drawer AJAX** (`snippets/cart-drawer.liquid` + `assets/luxor-shop.js`): qty, remove, subtotal, checkout; se abre al añadir desde cualquier form `/cart/add`.
- **Product card v2** (`snippets/product-card.liquid`): badges Sale/New/Hot/Sold out, precio tachado, hover a 2ª imagen, swatches con imagen de variante o `<select>`, Quick add, botón «+» → quick view modal, Añadir + Comprar ahora (con la variante seleccionada).
- **Secciones:** `luxor-featured-products` (grid 2–4 col), `luxor-product-carousel` (3–6 visibles, flechas/puntos opcionales), `luxor-bundle` (2–4 piezas, total vivo, añade todo junto), `luxor-editorial` (diario + cita + marquee de clientes).
