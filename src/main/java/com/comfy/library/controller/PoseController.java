package com.comfy.library.controller;

import com.comfy.library.entity.PoseEntity;
import com.comfy.library.service.PoseService;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.*;

@RestController
@RequestMapping("/api/poses")
public class PoseController {
    private final PoseService service;
    private final ObjectMapper mapper;

    public PoseController(PoseService service, ObjectMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    @GetMapping
    public Page<PoseEntity> list(@RequestParam(required = false) String keyword,
                                 @RequestParam(required = false) String category,
                                 @RequestParam(required = false) Boolean favorite,
                                 @RequestParam(defaultValue = "0") int page,
                                 @RequestParam(defaultValue = "12") int size,
                                 @RequestParam(defaultValue = "id") String sortBy,
                                 @RequestParam(defaultValue = "desc") String sortDirection) {
        return service.find(keyword, category, favorite, page, size, sortBy, sortDirection);
    }

    @GetMapping("/{id}")
    public PoseEntity get(@PathVariable Long id) { return service.get(id); }

    @GetMapping("/categories")
    public List<String> categories() { return service.categories(); }

    @PatchMapping("/{id}/favorite")
    public PoseEntity favorite(@PathVariable Long id) { return service.favorite(id); }

    @RequestMapping(value = {"", "/{id}"}, method = {RequestMethod.POST, RequestMethod.PUT}, consumes = "multipart/form-data")
    public PoseEntity save(@PathVariable(required = false) Long id,
                           @RequestParam String name,
                           @RequestParam(defaultValue = "") String category,
                           @RequestParam(required = false) Long seed,
                           @RequestParam(defaultValue = "") String lora,
                           @RequestParam(defaultValue = "") String prompt,
                           @RequestParam(defaultValue = "") String notes,
                           @RequestParam(required = false) String baseModel,
                           @RequestParam(defaultValue = "[]") String retainedImages,
                           @RequestParam(required = false) List<MultipartFile> images) throws IOException {
        List<String> retained = Arrays.asList(mapper.readValue(retainedImages, String[].class));
        return service.save(id, name, category, seed, lora, prompt, notes, baseModel, retained, images == null ? List.of() : images);
    }

    @GetMapping("/backup/export")
    public List<PoseEntity> exportBackup() { return service.exportBackup(); }

    @PostMapping("/backup/import")
    public Map<String, Integer> importBackup(jakarta.servlet.http.HttpServletRequest request) throws IOException {
        List<PoseEntity> poses = mapper.readerForListOf(PoseEntity.class)
                .with(tools.jackson.databind.DeserializationFeature.FAIL_ON_TRAILING_TOKENS,
                        tools.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
                .without(tools.jackson.databind.DeserializationFeature.ACCEPT_FLOAT_AS_INT)
                .readValue(request.getInputStream());
        return service.importBackup(poses);
    }
}
