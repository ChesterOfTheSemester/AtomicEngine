/**
 * AtomicEngine 0.1
 */

void AtomicEngine::mainLoop()
{
  while (active)
  {
    // Input Handler Todo: handle down-events
    if (timer.test(120, TIMER_INPUT_KEYS-1))
    {
      // Test mip
      if (keyPressed(GLFW_KEY_1))
      {
        GPU.test_mip = fmod(GPU.test_mip + 0.10, 0.60);
        GPU.reload();
        printf("Mip target: %.2f\n", GPU.test_mip);
      }

      // Esc / Close application
      if (keyPressed(GLFW_KEY_ESCAPE))
        GPU.status = 3;
    }

    // GLTF: Cycle / Exit
    if (GLTF.status>=5) GLTF.callback();
    else if (GLTF.status==3) GLTF.exit();

    // GPU: Cycle / Exit
    if (GPU.status>=5) GPU.callback();
    else if (GPU.status==3) GPU.exit();

    // Exit Engine
    if (GPU.status==2)
    {
      exit();
      break;
    }
  }

  engine_stopped = timer.getMS();
  printf("Exiting Engine\n");
}

void AtomicEngine::exit() { active = false; }

// Input recorders

void AtomicEngine::input_recorder_keyboard(GLFWwindow* window, int key, int scancode, int action, int mods)
{
  atomicengine_input_map.keys_prev[key] = atomicengine_input_map.keys[key];
  atomicengine_input_map.keys[key] = action;
  //printf("Key Input Read: %d, %d, %d, %d\n", key, scancode, action, mods);
}

void AtomicEngine::input_recorder_mouse_coords(GLFWwindow* window, double x, double y)
{
  atomicengine_input_map.mouse_coords[0] = x;
  atomicengine_input_map.mouse_coords[1] = y;
  //printf("Mouse Coord Read: %f, %f\n", x, y);
}

void AtomicEngine::input_recorder_mouse(GLFWwindow* window, int button, int action, int mods)
{
  atomicengine_input_map.mouse_prev[button] = atomicengine_input_map.mouse[button];
  atomicengine_input_map.mouse[button] = action;
  //printf("Mouse Input Read: %d, %d\n", button, action);
}

void AtomicEngine::input_recorder_scroll(GLFWwindow* window, double x, double y)
{
  atomicengine_input_map.scroll[0] = x;
  atomicengine_input_map.scroll[1] = y;
  //printf("Scroll Input Read: %f, %f\n", x, y);
}

bool AtomicEngine::keyPressed(int key)
{
  // Repeat
  if (atomicengine_input_map.keys[key] == GLFW_REPEAT
      && timer.test(INPUT_KEYS_REPEAT_INTERVAL, TIMER_INPUT_KEYS+key))
    return 1;

  // Pressed
  if (atomicengine_input_map.keys_prev[key] == GLFW_PRESS
      && atomicengine_input_map.keys[key] == GLFW_RELEASE)
  { atomicengine_input_map.keys_prev[key] = 0; return 1; } else return 0;
}

bool AtomicEngine::mousePressed(int button)
{
  if (atomicengine_input_map.mouse_prev[button] == GLFW_PRESS
      && atomicengine_input_map.mouse[button] == GLFW_RELEASE)
  { atomicengine_input_map.mouse_prev[button] = 0; return 1; } else return 0;
}