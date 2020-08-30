/**
 * AtomicEngine 0.1
 */

#ifndef ATOMICENGINE_H
#define ATOMICENGINE_H

#include <iostream>
#include <unistd.h>
#include <chrono>
#include <stdio.h>
#include <cstdlib>
#include <stdexcept>
#include <algorithm>
#include <optional>
#include <string>
#include <cstring>
#include <cstdint>
#include <vector>
#include <fstream>
#include <set>
#include <array>
#include <optional>
#include <sys/time.h>

#define ATOMICENGINE_DEBUG          0

#define TIMER_FPS                   0x00
#define INPUT_KEYS_REPEAT_INTERVAL  16
#define TIMER_INPUT_KEYS            0x1000 + 1 + 0x200
#define TIMER_GLTF                  0x2000

#define Min(a,b) a<b?a:b
#define Max(a,b) a>b?a:b

class AtomicEngine;

#include "AtomicVK.h"
#include "AtomicGLTF.h"

static struct {
  int    keys[0x15C]        = {0}, // key => action
         keys_prev[0x15C]   = {0}, // key => action
         mouse[0xFF]        = {0}, // key => action
         mouse_prev[0x15C]  = {0}; // key => action
  double mouse_coords[0x01] = {0}, // X, Y
         scroll[0x01]       = {0}; // X, Y
} atomicengine_input_map;

class AtomicEngine
{
 public:
  AtomicVK GPU;
  AtomicGLTF GLTF;
  bool active = false;

  long int engine_started,
           engine_stopped;

  AtomicEngine() : GPU(this), GLTF(this)
  {
    // Activate Engine
    if (GPU.status==1)
    {
      GPU.status = 5;
      engine_started = timer.getMS();
      printf("Initialized Engine\n");

      // Init Input Recorders
      glfwSetKeyCallback(GPU.window, AtomicEngine::input_recorder_keyboard);
      glfwSetCursorPosCallback(GPU.window, AtomicEngine::input_recorder_mouse_coords);
      glfwSetMouseButtonCallback(GPU.window, AtomicEngine::input_recorder_mouse);
      glfwSetScrollCallback(GPU.window, AtomicEngine::input_recorder_scroll);

      // Init GLTF
      if (GLTF.status == 1)
      {
        GLTF.status = 5;
      }

      active = true;
    }

    mainLoop();
  }

  void mainLoop();
  void exit();

  // Timer Struct
  struct
  {
    double stack[0xFFFFF];

    struct timeval tp;
    long unsigned getS () { return getMS() / 1000; }
    long unsigned getMS()
    {
      gettimeofday(&tp,NULL);
      return tp.tv_sec * 1000 + tp.tv_usec / 1000;
    }

    bool test (long unsigned occur, long unsigned index=0, double timelen=1000, bool rtn=0)
    {
      unsigned long ms = getMS();
      if (rtn = (ms-stack[index]) >= (double) (timelen/occur))
        stack[index] = ms;
      return rtn;
    }
  } timer;

  // Input recorders
  static void input_recorder_keyboard(GLFWwindow* window, int key, int scancode, int action, int mods);
  static void input_recorder_mouse_coords(GLFWwindow* window, double x, double y);
  static void input_recorder_mouse(GLFWwindow* window, int button, int action, int mods);
  static void input_recorder_scroll(GLFWwindow* window, double x, double y);
  bool keyPressed(int key); bool mousePressed(int key);

 protected:

 private:
};

#include "AtomicEngine.cpp"
#include "AtomicVK.cpp"
#include "AtomicGLTF.cpp"

#endif //ATOMICENGINE_H
