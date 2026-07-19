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
