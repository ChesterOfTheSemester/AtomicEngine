cmake_minimum_required(VERSION 3.16)
project(AtomicEngine)

set(CMAKE_CXX_FLAGS "-pipe -lm -std=c++2a")
set(CMAKE_CXX_STANDARD 20)

add_executable(AtomicEngine src/main.cpp)

#Vulkan
find_package(Vulkan REQUIRED)
target_include_directories(${PROJECT_NAME} PUBLIC ${Vulkan_INCLUDE_DIRS})
target_link_libraries(${PROJECT_NAME} Vulkan::Vulkan)

# GLFW
find_package(glfw3 CONFIG REQUIRED)
target_link_libraries(${PROJECT_NAME} glfw)

