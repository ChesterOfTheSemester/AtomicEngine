/**
 * AtomicEngine 0.1
 */

#ifndef ATOMICENGINE_H
#define ATOMICENGINE_H

#include <iostream>
#include <unistd.h>
#include <stdio.h>
#include <cstdlib>
#include <stdexcept>
#include <algorithm>
#include <optional>
#include <string>
#include <vector>
#include <fstream>
#include <set>
#include <array>
#include <sys/time.h>

#define Min(a,b) a<b?a:b
#define Max(a,b) a>b?a:b

using namespace std::chrono;
class AtomicEngine;

#include "AtomicVK.h"

#define TIMER_FPS 0x00

class AtomicEngine
{
 public:
  AtomicVK GPU;

  bool active = false;

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
    }

    mainLoop();
  }

  void mainLoop()
  {
    while (active)
    {
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

 protected:

 private:
};

#include "AtomicVK.cpp"

#endif //ATOMICENGINE_H
