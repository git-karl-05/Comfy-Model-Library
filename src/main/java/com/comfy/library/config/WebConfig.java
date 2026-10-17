package com.comfy.library.config;


import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

@Configuration
public class WebConfig implements WebMvcConfigurer{

    @Value("${lora.upload.path}")
    private String uploadPath;

    @Value("${pose.upload.path:${user.home}/ComfyLibrary/uploads/pose}")
    private String poseUploadPath;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/uploads/pose/**")
                .addResourceLocations(Paths.get(poseUploadPath).toUri().toString() + "/");
        String uploadLocation = Paths.get(uploadPath).toUri().toString();

        registry.addResourceHandler("/uploads/lora/**")
                .addResourceLocations(uploadLocation);
    }
}
