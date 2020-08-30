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

#define Min(a,b) a<b?a:b
#define Max(a,b) a>b?a:b

class AtomicEngine;

#include "AtomicVK.h"

#define TIMER_FPS   0x00
#define TIMER_INPUT 0x10

static struct {
  int keys[0x15C]        = {0}, // key => action
      mouse_coords[0x01] = {0}, // X, Y
      mouse[0x7F]        = {0}, // key => action
      scroll[0x01]       = {0}; // X, Y

} atomicengine_input_map;

class AtomicEngine
{
 public:
  AtomicVK GPU;

  bool active = false;

  struct atomicengine_input_map *input;

  long int engine_started,
           engine_stopped;

  AtomicEngine() : GPU(this)
  {
    // Activate Engine
    if (GPU.status==1)
    {
      GPU.status = 5;
      engine_started = timer.getMS();
      printf("Initialized Engine\n");

      active = true; // Todo Temp: Activate Engine here

      // Init Input Recorders
      glfwSetKeyCallback(GPU.window, AtomicEngine::input_recorder_keyboard);
      glfwSetCursorPosCallback(GPU.window, AtomicEngine::input_recorder_mouse_coords);
      glfwSetMouseButtonCallback(GPU.window, AtomicEngine::input_recorder_mouse);
      glfwSetScrollCallback(GPU.window, AtomicEngine::input_recorder_scroll);
    }

    mainLoop();
  }

  void mainLoop()
  {
    while (active)
    {
      // Esc
      if (atomicengine_input_map.keys[GLFW_KEY_ESCAPE] == GLFW_PRESS)
        GPU.status = 3;

      // Input handler
      {

      }

      // GPU Cycle / Exit
      if (GPU.status>=5) GPU.callback();
      else if (GPU.status==3) GPU.exit();

      // Exit Engine
      if (GPU.status==2)
      {
        active = false;
        break;
      }
    }

    engine_started = timer.getMS();
    printf("Exiting Engine\n");
  }

  struct
  {
    double stack[0xFFF];

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

  static void input_recorder_keyboard(GLFWwindow* window, int key, int scancode, int action, int mods);
  static void input_recorder_mouse_coords(GLFWwindow* window, double x, double y);
  static void input_recorder_mouse(GLFWwindow* window, int button, int action, int mods);
  static void input_recorder_scroll(GLFWwindow* window, double x, double y);

 protected:

 private:
};

#include "AtomicVK.cpp"

#endif //ATOMICENGINE_H
