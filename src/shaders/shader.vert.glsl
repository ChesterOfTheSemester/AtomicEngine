#version 450
#extension GL_ARB_separate_shader_objects : enable

layout(binding = 0) uniform UniformBufferObject {
    mat4 model2;
    mat4 model;
    mat4 view;
    mat4 proj;
} ubo;

layout(binding = 0) uniform UniformBufferCamera {
    mat4 view;
} camera;

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inColor;
layout(location = 2) in vec2 inTexCoord;

layout(location = 0) out vec3 fragColor;
layout(location = 1) out vec2 fragTexCoord;

void main()
{
    mat4 viewmake = mat4(ubo.view);
         //viewmake[0].x = camera.view[0].x;

    gl_Position = ubo.proj * viewmake * ubo.model * vec4(inPosition, 1.0);
    fragColor = inColor;
    fragTexCoord = inTexCoord;
}