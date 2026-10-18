package com.comfy.library.controller;

import com.comfy.library.service.ComfyOutputService;
import org.springframework.web.bind.annotation.*;
import org.springframework.core.io.*;
import org.springframework.http.*;
import java.io.*;
import java.nio.file.*;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;

@RestController
@RequestMapping("/api/poses")
public class ComfyOutputController {
    private final ComfyOutputService output;
    public ComfyOutputController(ComfyOutputService output) { this.output = output; }

    @GetMapping("/output-images")
    public ComfyOutputService.Listing list(@RequestParam(defaultValue="") String folder,
                                          @RequestParam(defaultValue="0") int page,
                                          @RequestParam(defaultValue="recent") String sort,
                                          @RequestParam(defaultValue="all") String media,
                                          @RequestParam(defaultValue="UTC") String timeZone) throws IOException {
        return output.list(folder, page, sort, media, timeZone);
    }
    @GetMapping("/output-image")
    public ResponseEntity<Resource> image(@RequestParam String path, @RequestParam(defaultValue="false") boolean thumbnail,
                                           @RequestParam(defaultValue="256") int size) throws IOException {
        int previewSize = Math.max(64, Math.min(size, 1536));
        Path file = output.image(path);
        if (thumbnail && !output.isVideo(file)) {
            // Inspect dimensions before decoding so an oversized image cannot exhaust memory.
            try (var input = ImageIO.createImageInputStream(file.toFile())) {
                var readers = ImageIO.getImageReaders(input);
                if (readers.hasNext()) {
                    var reader = readers.next();
                    try {
                        reader.setInput(input);
                        int width = reader.getWidth(0), height = reader.getHeight(0);
                        if ((long) width * height > 64_000_000) {
                            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.BAD_REQUEST,
                                    "Image dimensions exceed the thumbnail limit");
                        }
                        int sample = Math.max(1, Math.max(width, height) / previewSize);
                        var parameters = reader.getDefaultReadParam();
                        parameters.setSourceSubsampling(sample, sample, 0, 0);
                        BufferedImage original = reader.read(0, parameters);
                        int w = Math.max(1, (int)Math.round(width * Math.min(1.0, (double) previewSize / Math.max(width, height))));
                        int h = Math.max(1, (int)Math.round(height * Math.min(1.0, (double) previewSize / Math.max(width, height))));
                        BufferedImage preview = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
                        var graphics = preview.createGraphics();
                        try { graphics.setRenderingHint(java.awt.RenderingHints.KEY_INTERPOLATION, java.awt.RenderingHints.VALUE_INTERPOLATION_BICUBIC);
                            graphics.setColor(java.awt.Color.DARK_GRAY); graphics.fillRect(0, 0, w, h);
                            graphics.drawImage(original, 0, 0, w, h, null); }
                        finally { graphics.dispose(); }
                        var bytes = new ByteArrayOutputStream();
                        ImageIO.write(preview, "jpg", bytes);
                        return ResponseEntity.ok().contentType(MediaType.IMAGE_JPEG)
                                .body(new ByteArrayResource(bytes.toByteArray()));
                    } finally { reader.dispose(); }
                }
            }
        }
        String type = output.contentType(file);
        return ResponseEntity.ok().header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.parseMediaType(type == null ? "application/octet-stream" : type))
                .body(new FileSystemResource(file));
    }
}
