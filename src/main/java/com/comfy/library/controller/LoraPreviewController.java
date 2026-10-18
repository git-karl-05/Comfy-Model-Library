package com.comfy.library.controller;

import com.comfy.library.service.LoraPreviewCacheService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.io.IOException;
import java.time.Duration;

@RestController
public class LoraPreviewController {
    private final LoraPreviewCacheService cache;

    public LoraPreviewController(LoraPreviewCacheService cache) { this.cache = cache; }

    @GetMapping("/api/loras/preview")
    public ResponseEntity<Resource> preview(@RequestParam String url) {
        try {
            var preview = cache.getPreview(url);
            return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofDays(30)))
                    .header("X-Content-Type-Options", "nosniff")
                    .contentType(MediaType.parseMediaType(preview.contentType()))
                    .body(new FileSystemResource(preview.path()));
        } catch (IllegalArgumentException error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, error.getMessage());
        } catch (IOException error) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Unable to cache this preview.");
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Preview download interrupted.");
        }
    }
}
