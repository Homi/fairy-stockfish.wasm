# Build `fairy-stockfish.wasm` in Single-Thread Mode

This document describes the non-pthread WebAssembly build that runs the engine synchronously inside one plain JavaScript Web Worker.

## Why this build exists

The default wasm build in this repository uses Emscripten pthread support, which requires `SharedArrayBuffer` and browser cross-origin isolation headers (`COOP` and `COEP`).

The single-thread build:

- does not use `-s USE_PTHREADS=1`
- does not use `-s PROXY_TO_PTHREAD=1`
- does not emit `stockfish.worker.js`
- can run inside one regular Web Worker with `postMessage()`

## Prerequisites

1. Install toolchain dependencies.
2. Install and activate `emsdk`.
3. Run builds from `src/emscripten` or call the parent make targets from there.

Example:

```bash
sudo apt update
sudo apt install -y git build-essential cmake python3 nodejs npm curl unzip

git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
```

## Baseline pthread build

```bash
cd src/emscripten
npm install
make -C .. emscripten_clean ARCH=wasm
make -C .. emscripten_build ARCH=wasm
```

Artifacts:

- `src/emscripten/public/stockfish.js`
- `src/emscripten/public/stockfish.wasm`
- `src/emscripten/public/stockfish.worker.js`

## Single-thread build

```bash
cd src/emscripten
make -C .. emscripten_clean ARCH=wasm
make -C .. emscripten_build ARCH=wasm single_thread=yes
```

Artifacts:

- `src/emscripten/public/stockfish-single.js`
- `src/emscripten/public/stockfish-single.wasm`
- `src/emscripten/public/engine-worker.js`
- `src/emscripten/public/test-single.html`

There should be no pthread worker artifact for this build.

## Verify artifacts

```bash
cd src/emscripten
ls -lh public/
grep -R "SharedArrayBuffer\\|PThread\\|pthread\\|PROXY_TO_PTHREAD\\|USE_PTHREADS" public/ -n
```

The grep command should not find pthread runtime references in the single-thread artifacts.

## Node test

`public/uci.js` auto-detects `stockfish-single.js` when present.

Interactive:

```bash
cd src/emscripten
node public/uci.js
```

Suggested commands:

```txt
uci
isready
position startpos
go movetime 500
quit
```

Non-interactive:

```bash
node public/uci.js "uci++isready++position startpos++go movetime 500++quit"
```

## Browser test

Serve `src/emscripten/public` with any local static server and open `test-single.html`.

Example:

```bash
cd src/emscripten
npm run serve
```

Then open the local URL for `test-single.html` and use the buttons to:

- initialize the worker
- send `uci`
- send `isready`
- search with `go movetime 500`

## Worker integration

`engine-worker.js` is the intended integration layer:

- main thread talks to one plain `Worker`
- worker loads `stockfish-single.js`
- commands are forwarded with `postMessage`
- engine output is posted back to the main thread

## Benchmark baseline

The numbers below were measured locally on April 29, 2026 from the browser path used during development:

- threaded wasm: `test-puppeteer.html` plus `public/uci-puppeteer.js`
- single-thread wasm: `test-single.html` plus `public/engine-worker.js`
- emsdk: `5.0.6`

Measured commands:

```txt
threaded:
bench 16 1 5 default depth NNUE

single-thread:
bench 16 1 5 default depth NNUE
bench
```

Benchmark summary:

| Build | Browser requirements | Command | Total time (ms) | Nodes searched | Nodes/second |
| --- | --- | --- | ---: | ---: | ---: |
| threaded wasm | `COOP/COEP`, `SharedArrayBuffer` | `bench 16 1 5 default depth NNUE` | 314 | 12341 | 39302 |
| single-thread wasm | plain worker only | `bench 16 1 5 default depth NNUE` | 326 | 31655 | 97101 |
| single-thread wasm | plain worker only | `bench` | 20053 | 4579058 | 228347 |

Additional quick smoke comparisons gathered during debugging:

| Build | Command | Total time (ms) | Nodes searched | Nodes/second |
| --- | --- | ---: | ---: | ---: |
| threaded wasm | `bench 16 1 8 current depth NNUE` | 25 | 506 | 20240 |
| single-thread wasm | `bench 16 1 8 current depth NNUE` | 31 | 5172 | 166838 |
| single-thread wasm | `node public/uci.js bench` | 12861 | 4579058 | 356042 |

Notes:

- These numbers are a baseline for this branch, not a cross-machine performance target.
- The threaded browser path became functional again on Emscripten 5, but it is still slower than the single-thread worker path in these measurements.
- If you re-run benchmarks later, record the exact command, browser path, and emsdk version next to the updated table.

## Stop strategy and limitations

The single-thread build does not have helper pthreads listening for commands during a synchronous search. Because of that:

- prefer `go movetime ...`
- prefer `go depth ...`
- avoid relying on `go infinite` plus `stop`

If you need immediate cancellation, terminate and recreate the JS worker:

```js
worker.terminate();
worker = new Worker("engine-worker.js");
```

Then resend the current position and options to the fresh worker.
