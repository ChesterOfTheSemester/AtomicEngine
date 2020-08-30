/**
 * AtomicGLTF 0.1
 */

void AtomicGLTF::callback()
{
  if (status>=5)
  {
    if (engine->timer.test(120, TIMER_GLTF+1))
    {
      //printf("GLTF CALLBACK\n");
    }
  }

  else status = 3;
}