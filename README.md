# Color Walter

Un rompecabezas de orden de colores al estilo de las **Torres de Hanói**, hecho
con **Phaser 3** + **TypeScript**. Inspirado en juegos tipo *Water / Magic Sort*.

## Cómo se juega

- Cada botella guarda capas de líquidos de colores mezclados.
- Tocas una **botella pequeña** (origen) y luego una botella de **destino**.
- Sólo se vierte el **color de arriba**, y sólo si el destino está vacío o tiene
  ese mismo color en la parte superior (se vierte toda la racha del color).
- Las **2 botellas grandes** del nivel 1 **no se pueden mover**: sólo reciben
  líquido (actúan como recolectoras).
- Cuando una botella se llena de un solo color, se le pone un **tapón** y queda
  sellada (no se puede volver a usar).
- Ganas cuando todas las botellas quedan ordenadas. El puntaje es la **menor
  cantidad de movimientos** (se guarda tu mejor marca por nivel).

El sitio comienza con una **pantalla de inicio** (botón *Empezar* + descripción),
luego pide tu **nombre** y finalmente arranca en el **nivel 1**. La dificultad
aumenta nivel a nivel (más colores, menos espacio de trabajo, más mezcla).

## Arquitectura

Diseño en capas, desacoplado mediante un **bus de eventos tipado**. El núcleo del
juego (`core/`) es lógica pura sin ninguna dependencia de Phaser ni del DOM, lo
que lo hace 100% testeable de forma unitaria.

```
src/
  core/                # Dominio puro (sin Phaser / sin DOM)
    models/            #   Bottle, GameState, Move, Color
    rules/             #   GameRules  -> validez de vertidos, condición de victoria
    engine/            #   GameEngine -> aplica jugadas, puntaje, undo, victoria
    level/             #   LevelGenerator (scramble inverso), LevelService
  events/              # EventBus tipado + catálogo de eventos (GameEvents)
  controllers/         # GameController -> media input <-> engine (selección/jugada)
  objects/             # BottleView (objeto de render de Phaser)
  scenes/              # GameScene (Phaser) -> dibuja el tablero, escucha el bus
  services/            # ScoreService (récords), PlayerService (nombre)
  config/              # Niveles, paleta de colores, config de Phaser
  ui/                  # styles.css del "shell" (inicio / nombre / HUD / victoria)
  App.ts               # Orquestador: DOM shell + Phaser + flujo de niveles
  main.ts              # Punto de entrada
```

### Por qué los niveles siempre tienen solución

`LevelGenerator` **no** baraja al azar y luego intenta resolver. En cambio parte
del estado **resuelto** y aplica *vertidos inversos*: toma parte de la racha
superior de una botella `D` y la coloca sobre una botella no-grande `S`. Cada
vertido inverso corresponde exactamente a una jugada legal `S -> D`, de modo que
**reproducir esas jugadas en orden inverso resuelve el tablero**. Como el origen
de cada jugada nunca es una botella grande, se respeta la regla de que las
botellas grandes son inamovibles. La solución generada se valida en tiempo de
ejecución (`verifySolution`) antes de entregar el nivel.

## Scripts

Este proyecto usa **pnpm** como gestor de paquetes.

```bash
pnpm install           # instalar dependencias

pnpm dev               # servidor de desarrollo (Vite) en http://localhost:5173
pnpm build             # type-check + build de producción a dist/
pnpm preview           # sirve el build en http://localhost:4173

pnpm test              # pruebas unitarias (Vitest) sobre el núcleo puro
pnpm test:e2e          # pruebas funcionales de navegador (Playwright)
pnpm typecheck         # sólo verificación de tipos
```

## Pruebas

- **Unitarias (Vitest):** `Bottle`, `GameRules`, `GameEngine`, `GameController`
  y `LevelGenerator` — incluyendo una prueba que verifica que **todos** los
  niveles definidos son resolubles para decenas de semillas.
- **Funcionales / navegador (Playwright):** flujo de inicio → nombre → nivel 1,
  validación del nombre, conteo de movimientos, deshacer, reiniciar, avance de
  nivel y resolución completa con la pantalla de victoria. La app expone una
  pequeña API de pruebas en `window.__COLORWATER`.

## Licencia

MIT
