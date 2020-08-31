/**
 * AtomicVK 0.1
 * Author: Chester Abrahams
 *
 * Vulkan is the best graphics API!
 */

#ifndef ATOMICVK_H
#define ATOMICVK_H

/** Vulkan - Graphics API */
#include <vulkan/vulkan.h>

/** GLFW - Surface API (Windows, Linux, OSX, WASM) */
#define GLFW_INCLUDE_VULKAN
#include <GLFW/glfw3.h>
#include <GLFW/glfw3native.h>

/** GLM - Maths API */
#define GLM_FORCE_RADIANS
#define GLM_FORCE_DEPTH_ZERO_TO_ONE
#define GLM_ENABLE_EXPERIMENTAL
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/vec4.hpp>
#include <glm/mat4x4.hpp>
#include <glm/gtx/hash.hpp>

#define STB_IMAGE_IMPLEMENTATION
#include "../vendor/stb_image.h"

/** TEMP: .obj loader */
#define TINYOBJLOADER_IMPLEMENTATION
#include "../vendor/tiny_obj_loader.h"

class AtomicVK
{
 public:
  float test_mip = 0.0,
        test_scale = 0.001;

  AtomicEngine *engine;
  GLFWwindow *window;
  unsigned status = 0; // { 0:Uninitialized, 1:Idle, 2:Disabled, 3:Disabling, 4:Paused, 5:Active }

  AtomicVK (AtomicEngine *e) : engine(e)
  {
    initScreen();
    initVulkan();

    status = 1;
    printf("Initialized GPU (Vulkan)\n");
  }

  void reload();
  void exit();
  void callback();

  struct Vertex {
    glm::vec3 pos;
    glm::vec3 color;
    glm::vec2 texCoord;

    static VkVertexInputBindingDescription getBindingDescription() {
      VkVertexInputBindingDescription bindingDescription{};
      bindingDescription.binding = 0;
      bindingDescription.stride = sizeof(Vertex);
      bindingDescription.inputRate = VK_VERTEX_INPUT_RATE_VERTEX;

      return bindingDescription;
    }

    static std::array<VkVertexInputAttributeDescription, 3> getAttributeDescriptions() {
      std::array<VkVertexInputAttributeDescription, 3> attributeDescriptions{};

      attributeDescriptions[0].binding = 0;
      attributeDescriptions[0].location = 0;
      attributeDescriptions[0].format = VK_FORMAT_R32G32B32_SFLOAT;
      attributeDescriptions[0].offset = offsetof(Vertex, pos);

      attributeDescriptions[1].binding = 0;
      attributeDescriptions[1].location = 1;
      attributeDescriptions[1].format = VK_FORMAT_R32G32B32_SFLOAT;
      attributeDescriptions[1].offset = offsetof(Vertex, color);

      attributeDescriptions[2].binding = 0;
      attributeDescriptions[2].location = 2;
      attributeDescriptions[2].format = VK_FORMAT_R32G32_SFLOAT;
      attributeDescriptions[2].offset = offsetof(Vertex, texCoord);

      return attributeDescriptions;
    }

    bool operator==(const Vertex& other) const {
      return pos == other.pos && color == other.color && texCoord == other.texCoord;
    }
  };

  // Misc
  static std::vector<char> readFile(const std::string& filename);

 protected:

  void draw();

  // Initialize Vulkan
  void initVulkan(bool recreate=0);
  void destroyVulkan();
  // Screen
  void initScreen();
  void destroyScreen();
  // Test
  void loadModel();

  bool VkVLValidate();

  bool VkDeviceValidate(VkPhysicalDevice device);

  static VKAPI_ATTR VkBool32 VKAPI_CALL VkVLCallback(VkDebugUtilsMessageSeverityFlagBitsEXT messageSeverity, VkDebugUtilsMessageTypeFlagsEXT messageType, const VkDebugUtilsMessengerCallbackDataEXT* pCallbackData, void* pUserData);

  struct VkQueueFamilyIndices; VkQueueFamilyIndices VkFindQueueFamilies(VkPhysicalDevice device);

  bool checkDeviceExtensionSupport(VkPhysicalDevice device);

  void createBuffer(VkDeviceSize size, VkBufferUsageFlags usage, VkMemoryPropertyFlags properties, VkBuffer& buffer, VkDeviceMemory& bufferMemory);

  void copyBuffer(VkBuffer srcBuffer, VkBuffer dstBuffer, VkDeviceSize size);

  void updateUniformBuffer(uint32_t currentImage);

  void createImage(uint32_t width, uint32_t height, uint32_t mipLevels, VkSampleCountFlagBits numSamples, VkFormat format, VkImageTiling tiling, VkImageUsageFlags usage, VkMemoryPropertyFlags properties, VkImage& image, VkDeviceMemory& imageMemory);

  void transitionImageLayout(VkImage image, VkFormat format, VkImageLayout oldLayout, VkImageLayout newLayout, uint32_t mipLevels);

  void copyBufferToImage(VkBuffer buffer, VkImage image, uint32_t width, uint32_t height);

  VkCommandBuffer beginSingleTimeCommands();

  void endSingleTimeCommands(VkCommandBuffer commandBuffer);

  VkImageView createImageView(VkImage image, VkFormat format, VkImageAspectFlags aspectFlags, uint32_t mipLevels);

  VkFormat findSupportedFormat(const std::vector<VkFormat>& candidates, VkImageTiling tiling, VkFormatFeatureFlags features);

  VkFormat findDepthFormat();

  void generateMipmaps(VkImage image, VkFormat imageFormat, int32_t texWidth, int32_t texHeight, uint32_t mipLevels);

  VkSampleCountFlagBits getMaxUsableSampleCount();

 private:

  uint32_t w_width=800, w_height=600;
  VkInstance instance;                                      const VkAllocationCallbacks *pAllocator;
  const char **glfwExtensions;                              uint32_t glfwExtensionCount=0; std::vector<const char*> extensions;
  bool validation_layers_enabled = true;                    const std::vector<const char*> validation_layers = {"VK_LAYER_KHRONOS_validation"};
  VkDebugUtilsMessengerEXT debug_messenger;
  std::vector<VkPhysicalDevice> physical_device_list;       VkPhysicalDevice physical_device = VK_NULL_HANDLE;
  VkPhysicalDeviceProperties physical_device_properties;    VkPhysicalDeviceFeatures physical_device_features;
  std::vector<VkQueueFamilyProperties> queue_families;
  VkPhysicalDeviceFeatures deviceFeatures {};               float queuePriority = 1.0f;
  VkDevice device;                                          VkQueue graphics_queue;
  VkSurfaceKHR surface;                                     VkQueue present_queue;

  VkSurfaceFormatKHR chooseSwapSurfaceFormat(const std::vector<VkSurfaceFormatKHR>& available_formats);
  VkPresentModeKHR chooseSwapPresentationMode(const std::vector<VkPresentModeKHR>& available_presentation_modes);
  VkExtent2D chooseSwapExtent(const VkSurfaceCapabilitiesKHR& capabilities);

  uint32_t findMemoryType(uint32_t typeFilter, VkMemoryPropertyFlags properties);

  const std::vector<const char*> device_extensions = { VK_KHR_SWAPCHAIN_EXTENSION_NAME };
  struct SwapChainSupportDetails { VkSurfaceCapabilitiesKHR capabilities; std::vector<VkSurfaceFormatKHR> formats; std::vector<VkPresentModeKHR> presentModes; };
  SwapChainSupportDetails querySwapChainSupport(VkPhysicalDevice device); SwapChainSupportDetails swapchain_support;

  VkSwapchainKHR swapchain;                                 std::vector<VkImage> swapchain_images;
  VkFormat swapchain_image_format;                          VkExtent2D swapchain_extent;
  std::vector<VkImageView> swapChainImageViews;
  void recreateSwapChain(); void cleanSwapChain();

  VkShaderModule createShaderModule(const std::vector<char>& code);

  std::vector<VkFramebuffer> swapChainFramebuffers;
  VkCommandPool commandPool;                                std::vector<VkCommandBuffer> commandBuffers;

  VkRenderPass renderPass;                                  VkPipeline graphicsPipeline;
  VkDescriptorSetLayout descriptorSetLayout;                VkPipelineLayout pipelineLayout;

  const int MAX_FRAMES_IN_FLIGHT = 2;
  std::vector<VkSemaphore> imageAvailableSemaphores;        std::vector<VkSemaphore> renderFinishedSemaphores;
  std::vector<VkFence> inFlightFences;                      std::vector<VkFence> imagesInFlight;
  size_t currentFrame = 0;                                  bool framebufferResized = false;

  VkBuffer vertexBuffer;                                    VkDeviceMemory vertexBufferMemory;
  VkBuffer indexBuffer;                                     VkDeviceMemory indexBufferMemory;

  std::vector<uint32_t> indices;                            std::vector<VkBuffer> uniformBuffers;
  std::vector<Vertex> vertices;                             std::vector<VkDeviceMemory> uniformBuffersMemory;

  VkDescriptorPool descriptorPool;                          VkDeviceMemory textureImageMemory;
  std::vector<VkDescriptorSet> descriptorSets;              VkImageView textureImageView;
  VkImage textureImage;                                     VkImage depthImage;
  VkSampler textureSampler;                                 VkFormat depthFormat;

  VkDeviceMemory depthImageMemory;                          VkImage colorImage;
  VkImageView depthImageView;                               VkDeviceMemory colorImageMemory;
  VkImageView colorImageView;                               uint32_t mipLevels;
  VkSampleCountFlagBits msaaSamples = VK_SAMPLE_COUNT_1_BIT;

  struct UniformBufferObject {
    alignas(16) glm::mat4 model2;
    alignas(16) glm::mat4 model;
    alignas(16) glm::mat4 view;
    alignas(16) glm::mat4 proj;
  };
};

template<> struct std::hash<AtomicVK::Vertex> {
  size_t operator()(AtomicVK::Vertex const& vertex) const {
    return ((hash<glm::vec3>()(vertex.pos) ^ (hash<glm::vec3>()(vertex.color) << 1)) >> 1) ^ (hash<glm::vec2>()(vertex.texCoord) << 1);
  }
};

#endif //ATOMICVK_H
