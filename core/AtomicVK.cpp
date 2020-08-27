/**
 * AtomicVK 0.1
 */

/**
 * General
 */

char window_title[0x7F];
unsigned int c_frame, fps, frame_cap=150;

void AtomicVK::callback ()
{
  if (status>=5)
  {
    // Increment FPS counter
    //if (engine->timer.test(frame_cap, TIMER_FPS+0))
    {
      draw();
      c_frame++;
    }

    // Reset FPS counter
    if (engine->timer.test(1, TIMER_FPS+1))
    {
      fps = c_frame;
      c_frame = 0;
    }

    // Update Window Title
    if(engine->timer.test(60, TIMER_FPS+2))
    {
      snprintf(window_title, sizeof(window_title), "FPS: %ld | FPS CAP: %ld | Time MS: %llu", fps, frame_cap, engine->timer.getMS());
      glfwSetWindowTitle(window, window_title);
    }
  }

  if (!glfwWindowShouldClose(window))
    glfwPollEvents();

  // Exit GPU
  else status = 3;

  if (status>2) vkDeviceWaitIdle(device);
}

/**
 * Initialisation
 */

// Validation layer callback
VKAPI_ATTR VkBool32 VKAPI_CALL AtomicVK::VkVLCallback(
        VkDebugUtilsMessageSeverityFlagBitsEXT messageSeverity,
        VkDebugUtilsMessageTypeFlagsEXT messageType,
        const VkDebugUtilsMessengerCallbackDataEXT* pCallbackData,
        void* pUserData)
{
  if (messageSeverity != VK_DEBUG_UTILS_MESSAGE_SEVERITY_WARNING_BIT_EXT &&
      messageSeverity != VK_DEBUG_UTILS_MESSAGE_SEVERITY_ERROR_BIT_EXT)
    return VK_TRUE;

  printf("Validation layer: %s\n", pCallbackData->pMessage);

  return VK_FALSE;
}

// Check if items from available_layers are supported
bool AtomicVK::VkVLValidate()
{
  uint32_t layer_count;
  vkEnumerateInstanceLayerProperties(&layer_count, nullptr);
  std::vector<VkLayerProperties> available_layers(layer_count);
  vkEnumerateInstanceLayerProperties(&layer_count, available_layers.data());

  for (const char *pt : validation_layers)
    for (const auto &layer_properties : available_layers)
      if (strcmp(pt, layer_properties.layerName) == 0)
        return true;

  return false;
}

// Check if listed extensions are supported
bool AtomicVK::checkDeviceExtensionSupport(VkPhysicalDevice device)
{
  uint32_t extension_count;
  vkEnumerateDeviceExtensionProperties(device, nullptr, &extension_count, nullptr);
  std::vector<VkExtensionProperties> availableExtensions(extension_count);
  vkEnumerateDeviceExtensionProperties(device, nullptr, &extension_count, availableExtensions.data());
  std::set<std::string> requiredExtensions(device_extensions.begin(), device_extensions.end());

  for (const auto& extension : availableExtensions)
    requiredExtensions.erase(extension.extensionName);

  return requiredExtensions.empty();
}

// Validate single Device / aka isDeviceSuitable
bool AtomicVK::VkDeviceValidate(VkPhysicalDevice device)
{
  AtomicVK::VkQueueFamilyIndices indices = AtomicVK::VkFindQueueFamilies(device);
  bool extensions_supported = checkDeviceExtensionSupport(device),
       swapchain_adequate = false;

  if (extensions_supported) {
    SwapChainSupportDetails swapChainSupport = querySwapChainSupport(device);
    swapchain_adequate = !swapChainSupport.formats.empty() && !swapChainSupport.presentModes.empty();
  }

  return indices.completed() && extensions_supported && swapchain_adequate;
}

// Find queue families
AtomicVK::VkQueueFamilyIndices AtomicVK::VkFindQueueFamilies(VkPhysicalDevice device)
{
  AtomicVK::VkQueueFamilyIndices indices;

  uint32_t queue_family_count = 0;
  vkGetPhysicalDeviceQueueFamilyProperties(device, &queue_family_count, nullptr);

  std::vector<VkQueueFamilyProperties> queue_families(queue_family_count);
  vkGetPhysicalDeviceQueueFamilyProperties(device, &queue_family_count, queue_families.data());

  int i = 0;
  for (const auto& queue_family : queue_families)
  {
    if (queue_family.queueFlags & VK_QUEUE_GRAPHICS_BIT) indices.graphicsFamily = i;

    VkBool32 present_support = false;
    vkGetPhysicalDeviceSurfaceSupportKHR(device, i, surface, &present_support);

    if (present_support) indices.presentFamily = i;
    if (indices.completed()) break;

    i++;
  }

  return indices;
}

// Get SwapChain descriptor set
AtomicVK::SwapChainSupportDetails AtomicVK::querySwapChainSupport(VkPhysicalDevice device)
{
  SwapChainSupportDetails details;

  vkGetPhysicalDeviceSurfaceCapabilitiesKHR(device, surface, &details.capabilities);

  uint32_t formatCount;
  vkGetPhysicalDeviceSurfaceFormatsKHR(device, surface, &formatCount, nullptr);

  if (formatCount) {
    details.formats.resize(formatCount);
    vkGetPhysicalDeviceSurfaceFormatsKHR(device, surface, &formatCount, details.formats.data());
  }

  uint32_t presentModeCount;
  vkGetPhysicalDeviceSurfacePresentModesKHR(device, surface, &presentModeCount, nullptr);

  if (presentModeCount) {
    details.presentModes.resize(presentModeCount);
    vkGetPhysicalDeviceSurfacePresentModesKHR(device, surface, &presentModeCount, details.presentModes.data());
  }

  return details;
}

// Choose SwapChain Surface Format
VkSurfaceFormatKHR AtomicVK::chooseSwapSurfaceFormat(const std::vector<VkSurfaceFormatKHR>& available_formats)
{
  for (const auto& availableFormat : available_formats)
    if (availableFormat.format == VK_FORMAT_B8G8R8A8_SRGB && availableFormat.colorSpace == VK_COLOR_SPACE_SRGB_NONLINEAR_KHR)
      return availableFormat;
  return available_formats[0];
}

// Choose SwapChain Presentation Mode
VkPresentModeKHR AtomicVK::chooseSwapPresentationMode(const std::vector<VkPresentModeKHR>& available_presentation_modes)
{
  for (const auto& available_present_mode : available_presentation_modes)
    if (available_present_mode == VK_PRESENT_MODE_MAILBOX_KHR)
      return available_present_mode;

  return VK_PRESENT_MODE_IMMEDIATE_KHR;
  //return VK_PRESENT_MODE_MAILBOX_KHR;
}

// Choose Swap Extent / Resolution
VkExtent2D AtomicVK::chooseSwapExtent(const VkSurfaceCapabilitiesKHR& capabilities)
{
  if (capabilities.currentExtent.width != UINT32_MAX)
    return capabilities.currentExtent;

  VkExtent2D actual_extent = { w_width, w_height };
  actual_extent.width = std::max(capabilities.minImageExtent.width, std::min(capabilities.maxImageExtent.width, actual_extent.width));
  actual_extent.height = std::max(capabilities.minImageExtent.height, std::min(capabilities.maxImageExtent.height, actual_extent.height));

  return actual_extent;
}

// Recreate SwapChain
void AtomicVK::recreateSwapChain()
{
  int width=0, height=0;

  glfwGetFramebufferSize(window, &width, &height);

  while (!width || !height) {
    glfwGetFramebufferSize(window, &width, &height);
    glfwWaitEvents();
  }

  vkDeviceWaitIdle(device);
  initVulkan(1);
}

// Destroy SwapChain
void AtomicVK::cleanupSwapChain()
{
  vkDestroyImageView(device, depthImageView, nullptr);
  vkDestroyImage(device, depthImage, nullptr);
  vkFreeMemory(device, depthImageMemory, nullptr);

  for (auto framebuffer : swapChainFramebuffers) {
    vkDestroyFramebuffer(device, framebuffer, nullptr);
  }

  vkFreeCommandBuffers(device, commandPool, static_cast<uint32_t>(commandBuffers.size()), commandBuffers.data());

  vkDestroyPipeline(device, graphicsPipeline, nullptr);
  vkDestroyPipelineLayout(device, pipelineLayout, nullptr);
  vkDestroyRenderPass(device, renderPass, nullptr);

  for (auto imageView : swapChainImageViews) {
    vkDestroyImageView(device, imageView, nullptr);
  }

  vkDestroySwapchainKHR(device, swapchain, nullptr);

  for (size_t i = 0; i < swapchain_images.size(); i++) {
    vkDestroyBuffer(device, uniformBuffers[i], nullptr);
    vkFreeMemory(device, uniformBuffersMemory[i], nullptr);
  }

  vkDestroyDescriptorPool(device, descriptorPool, nullptr);
}

// Read file
std::vector<char> AtomicVK::readFile(const std::string& filename)
{
  std::ifstream file(filename, std::ios::ate | std::ios::binary);
  if (!file.is_open()) throw std::runtime_error("Unable to open file");

  size_t fileSize = (size_t) file.tellg();
  std::vector<char> buffer(fileSize);

  file.seekg(0);
  file.read(buffer.data(), fileSize);
  file.close();

  return buffer;
}

// Create a ShaderModule
VkShaderModule AtomicVK::createShaderModule (const std::vector<char> &code)
{
  VkShaderModuleCreateInfo createInfo{};
  createInfo.sType = VK_STRUCTURE_TYPE_SHADER_MODULE_CREATE_INFO;
  createInfo.codeSize = code.size();
  createInfo.pCode = reinterpret_cast<const uint32_t*>(code.data());

  VkShaderModule shaderModule;
  if (vkCreateShaderModule(device, &createInfo, nullptr, &shaderModule) != VK_SUCCESS)
    throw std::runtime_error("failed to create shader module!");

  return shaderModule;
}

// Find available memory type
uint32_t AtomicVK::findMemoryType(uint32_t typeFilter, VkMemoryPropertyFlags properties)
{
  VkPhysicalDeviceMemoryProperties memProperties;
  vkGetPhysicalDeviceMemoryProperties(physical_device, &memProperties);

  for (uint32_t i = 0; i < memProperties.memoryTypeCount; i++) {
    if ((typeFilter & (1 << i)) && (memProperties.memoryTypes[i].propertyFlags & properties) == properties) {
      return i;
    }
  }

  throw std::runtime_error("failed to find suitable memory type!");
}

void AtomicVK::createBuffer(VkDeviceSize size, VkBufferUsageFlags usage, VkMemoryPropertyFlags properties, VkBuffer& buffer, VkDeviceMemory& bufferMemory)
{
  VkBufferCreateInfo bufferInfo{};
  bufferInfo.sType = VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO;
  bufferInfo.size = size;
  bufferInfo.usage = usage;
  bufferInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;

  if (vkCreateBuffer(device, &bufferInfo, nullptr, &buffer) != VK_SUCCESS) {
    throw std::runtime_error("failed to create buffer!");
  }

  VkMemoryRequirements memRequirements;
  vkGetBufferMemoryRequirements(device, buffer, &memRequirements);

  VkMemoryAllocateInfo allocInfo{};
  allocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;
  allocInfo.allocationSize = memRequirements.size;
  allocInfo.memoryTypeIndex = findMemoryType(memRequirements.memoryTypeBits, properties);

  if (vkAllocateMemory(device, &allocInfo, nullptr, &bufferMemory) != VK_SUCCESS) {
    throw std::runtime_error("failed to allocate buffer memory!");
  }

  vkBindBufferMemory(device, buffer, bufferMemory, 0);
}

void AtomicVK::copyBuffer(VkBuffer srcBuffer, VkBuffer dstBuffer, VkDeviceSize size)
{
  VkCommandBufferAllocateInfo allocInfo{};
  allocInfo.sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO;
  allocInfo.level = VK_COMMAND_BUFFER_LEVEL_PRIMARY;
  allocInfo.commandPool = commandPool;
  allocInfo.commandBufferCount = 1;

  VkCommandBuffer commandBuffer;
  vkAllocateCommandBuffers(device, &allocInfo, &commandBuffer);

  VkCommandBufferBeginInfo beginInfo{};
  beginInfo.sType = VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO;
  beginInfo.flags = VK_COMMAND_BUFFER_USAGE_ONE_TIME_SUBMIT_BIT;

  vkBeginCommandBuffer(commandBuffer, &beginInfo);

  VkBufferCopy copyRegion{};
  copyRegion.size = size;
  vkCmdCopyBuffer(commandBuffer, srcBuffer, dstBuffer, 1, &copyRegion);

  vkEndCommandBuffer(commandBuffer);

  VkSubmitInfo submitInfo{};
  submitInfo.sType = VK_STRUCTURE_TYPE_SUBMIT_INFO;
  submitInfo.commandBufferCount = 1;
  submitInfo.pCommandBuffers = &commandBuffer;

  vkQueueSubmit(graphics_queue, 1, &submitInfo, VK_NULL_HANDLE);
  vkQueueWaitIdle(graphics_queue);

  vkFreeCommandBuffers(device, commandPool, 1, &commandBuffer);
}

void AtomicVK::updateUniformBuffer(uint32_t currentImage)
{
  static auto startTime = std::chrono::high_resolution_clock::now();
  auto currentTime = std::chrono::high_resolution_clock::now();
  float time = std::chrono::duration<float, std::chrono::seconds::period>(currentTime - startTime).count();

  UniformBufferObject ubo{};
  ubo.model = glm::rotate(glm::mat4(1.0f), time * glm::radians(-90.0f), glm::vec3(0.0f, 0.0f, 1.0f));
  ubo.model2 = glm::rotate(glm::mat4(1.0f), time * glm::radians(90.0f), glm::vec3(0.0f, 0.0f, 1.0f));
  ubo.view = glm::lookAt(glm::vec3(2.0f, 2.0f, 2.0f), glm::vec3(0.0f, 0.0f, 0.0f), glm::vec3(0.0f, 0.0f, 1.0f));
  ubo.proj = glm::perspective(glm::radians(45.0f), swapchain_extent.width / (float) swapchain_extent.height, 0.1f, 10.0f);
  ubo.proj[1][1] *= -1;

  void* data;
  vkMapMemory(device, uniformBuffersMemory[currentImage], 0, sizeof(ubo), 0, &data);
  memcpy(data, &ubo, sizeof(ubo));
  vkUnmapMemory(device, uniformBuffersMemory[currentImage]);
}