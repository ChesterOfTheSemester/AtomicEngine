/**
 * AtomicEngine 0.1
 * Website: https://atomicengine.org/
 *
 * Author: Chester Abrahams
 * LinkedIn: https://www.linkedin.com/in/atomiccoder/
 *
 * // Todo: TIPS
 * Recommended audio library: FMOD
 * Learn Spir-V: https://www.duskborn.com/wp-content/uploads/2015/03/AnIntroductionToSPIR-V.pdf , https://www.khronos.org/registry/spir-v/specs/1.0/SPIRV.pdf
 *
 * Compile to SPIR-V: glslangValidator -e main -o shaders/spirv/shader.frag.spv -V shaders/shader.frag.glsl  &&
 *                    glslangValidator -e main -o shaders/spirv/shader.vert.spv -V shaders/shader.vert.glsl
 *
 * Build EMC: emcc -o build/main.html main.cpp -O3 -s WASM=1 --shell-file build/shell.html
 */

#include <iostream>
#include <unistd.h>
#include <stdio.h>
#include <cstdlib>
#include <stdexcept>
#include <optional>
#include <vector>
#include <fstream>
#include <set>
#include <array>
#include <sys/time.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

#include "core/AtomicEngine.h"

AtomicEngine engine;

int main(int argc, char **argv)
{
  printf("Exiting Application\n");
  return 0;
}

#ifdef __EMSCRIPTEN__
#ifdef __cplusplus
extern "C" {
#endif
void EMSCRIPTEN_KEEPALIVE myFunction(int argc, char ** argv) {
  printf("MyFunction Called");
}
#ifdef __cplusplus
}
#endif
#endif