/**
 * AtomicGLTF 0.1
 * Author: Chester Abrahams
 *
 * GLTF 2.0 is the best model format!
 */

#ifndef ATOMICGLTF_H
#define ATOMICGLTF_H

class AtomicGLTF
{
 public:
  AtomicEngine *engine;
  unsigned status = 0; // { 0:Uninitialized, 1:Idle, 2:Disabled, 3:Disabling, 4:Paused, 5:Active }

  AtomicGLTF (AtomicEngine *e) : engine(e)
  {
    status = 1;
    printf("Initialized GLTF\n");
  }

  void callback();
  void exit();

 protected:
 private:
};

#endif //ATOMICGLTF_H
