single_thread ?= no

ifeq ($(single_thread),yes)
EXE = stockfish-single.js
else
EXE = stockfish.js
endif
COMP = em++
CXX = em++
comp = clang
arch = wasm
bits = 64

# Build options
wasm_simd = yes
embedded_nnue = yes
minify_js = yes
assertion = no

VPATH := $(VPATH):emscripten
ifeq ($(single_thread),yes)
PRE_JS = emscripten/preamble-single.js
else
PRE_JS = emscripten/preamble.js
endif

EM_CXXFLAGS +=
EM_LDFLAGS += \
	--pre-js $(PRE_JS) \
	-s MODULARIZE=1 -s EXPORT_NAME="Stockfish" -s ENVIRONMENT=web,worker,node \
	-s STRICT=1 \
	-s ASYNCIFY=1 -s 'ASYNCIFY_IMPORTS=["emscripten_utils_getline_impl"]' \
	-s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=$$((1 << 27)) -s MAXIMUM_MEMORY=$$((1 << 31)) \
	-s FILESYSTEM=1 -s EXPORTED_RUNTIME_METHODS=["FS"] \
	-s ALLOW_UNIMPLEMENTED_SYSCALLS

ifeq ($(single_thread),yes)
	EM_CXXFLAGS += -DWASM_SINGLE_THREAD
	EM_LDFLAGS += -s STACK_SIZE=$$((8 << 20))
else
	EM_CXXFLAGS += -pthread
	EM_LDFLAGS += \
		-pthread \
		-s PROXY_TO_PTHREAD=1
endif

ifeq ($(minify_js),yes)
	EM_LDFLAGS += --closure 1
else
	EM_LDFLAGS += --closure 0 --minify 0
endif

ifeq ($(assertion),yes)
	EM_LDFLAGS += -s ASSERTIONS=1
else
	EM_LDFLAGS += -s ASSERTIONS=0
endif

ifeq ($(wasm_simd),yes)
	EM_CXXFLAGS += -DUSE_WASM_SIMD -msimd128
	SRCS += emscripten/wasm_simd.cpp
endif

ifeq ($(embedded_nnue),yes)
	SRCS += emscripten/embedded_nnue.cpp
else
	EM_CXXFLAGS += -DNNUE_EMBEDDING_OFF
endif

EM_COMMIT = $(shell git rev-parse --short HEAD)
EM_UPSTREAM = $(shell if git rev-parse --verify upstream/master >/dev/null 2>&1; then git rev-parse --short $$(git merge-base HEAD upstream/master); else printf unknown; fi)
EM_EMSCRIPTEN = $(shell emsdk list | grep INSTALLED | head -n 1 | awk '{ print $$1 }')

EXTRACXXFLAGS += \
	-DUSE_POPCNT $(EM_CXXFLAGS) \
	-DEM_COMMIT=$(EM_COMMIT) \
	-DEM_UPSTREAM=$(EM_UPSTREAM) \
	-DEM_EMSCRIPTEN=$(EM_EMSCRIPTEN)
EXTRALDFLAGS += $(EM_LDFLAGS)

EM_ARTIFACTS += \
	$(EXE) $(basename $(EXE)).wasm \
	emscripten/embedded_nnue.cpp \
	emscripten/public/$(EXE) emscripten/public/$(basename $(EXE)).wasm \
	emscripten/public/AUTHORS emscripten/public/Copying.txt

ifeq ($(single_thread),yes)
else
EM_ARTIFACTS += \
	stockfish.worker.js \
	emscripten/public/stockfish.worker.js
endif

ifeq ($(embedded_nnue),yes)
emscripten/embedded_nnue.cpp: net
	@echo "-- Generate embedded_nnue.cpp --"
	node emscripten/misc/embedded_nnue.js < $(nnuenet) > emscripten/embedded_nnue.cpp
endif

emscripten_copy_files:
	cp -f ../AUTHORS ../Copying.txt $(EXE) $(basename $(EXE)).wasm emscripten/public
ifeq ($(single_thread),yes)
else
	cat stockfish.worker.js emscripten/worker-postamble.js > emscripten/public/stockfish.worker.js
endif

emscripten_build: build emscripten_copy_files

emscripten_clean: clean
	@rm -f $(EM_ARTIFACTS)
