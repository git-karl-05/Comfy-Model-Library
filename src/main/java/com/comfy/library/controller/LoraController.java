package com.comfy.library.controller;

import com.comfy.library.dto.*;
import com.comfy.library.entity.LoraCategory;
import com.comfy.library.repository.LoraRepository;
import com.comfy.library.service.LoraService;
import org.apache.coyote.Response;
import org.springframework.data.domain.Page;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/loras")
public class LoraController {

    private final LoraService loraService;

    public LoraController(LoraService loraService) {
        this.loraService = loraService;
    }

    @PostMapping
    public ResponseEntity<LoraResponse> saveLora(@RequestBody CreateLoraRequest loraRequest) {
        return ResponseEntity.ok(loraService.saveLora(loraRequest));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public LoraResponse saveLoraWithPreviewImage(
            @ModelAttribute CreateLoraRequest request,
            @RequestParam(required = false)MultipartFile previewImage) {
        return loraService.saveLoraWithPreviewImage(request, previewImage);
    }

    @PutMapping(value = "/{loraId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<LoraResponse> updateLoraWithPreview(
            @PathVariable Long loraId,
            @ModelAttribute UpdateLoraRequest request,
            @RequestParam(required = false) MultipartFile preview

    ) {
        return ResponseEntity.ok(loraService.updateLoraWithPreviewById(loraId, request, preview));
    }

    @DeleteMapping("/{loraId}")
    public ResponseEntity<String> deleteLora(@PathVariable Long loraId) {
        return ResponseEntity.ok(loraService.deleteLoraById(loraId));
    }

    @GetMapping("/search")
    public ResponseEntity<Page<LoraResponse>> searchLoras(
            @RequestParam String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size) {
        return ResponseEntity.ok(loraService.searchLoras(keyword, page, size));
    }

    @GetMapping("/{loraId}")
    public ResponseEntity<LoraResponse> getLoraById(@PathVariable long loraId) {
        return ResponseEntity.ok(loraService.getLoraById(loraId));
    }

    @GetMapping
    public ResponseEntity<Page<LoraResponse>> getLoras(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size
    ) {
        Page<LoraResponse> response = loraService.getLoras(page,size);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/category/{category}")
    public ResponseEntity<Page<LoraResponse>> getLorasByCategory(
            @PathVariable LoraCategory category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size
    ){

        Page<LoraResponse> response = loraService.getLorasByCategory(category, page,size);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/group/{groupName}")
    public ResponseEntity<Page<LoraResponse>> getLorasByGroup(
            @PathVariable String groupName,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size
    ) {
        Page<LoraResponse> response = loraService.getLorasByGroup(groupName, page, size);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/favorites")
    public ResponseEntity<Page<LoraResponse>> getFavoriteLoras(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size
    ) {
        return ResponseEntity.ok(loraService.getFavoriteLoras(page, size));
    }

    @PutMapping("/{loraId}/favorite")
    public LoraResponse toggleFavorite(@PathVariable Long loraId) {
        return loraService.toggleFavorite(loraId);
    }



    @GetMapping("/categories")
    public List<LoraCategory> getCategories() {
        return loraService.getCategories();
    }

    @PostMapping("/import-folder")
    public ImportSummaryResponse importFolder(@RequestBody ImportFolderRequest request) {
        return loraService.importLorasFromFolder(request.getFolderPath());
    }

    @GetMapping("/filter")
    public ResponseEntity<Page<LoraResponse>> getFilteredLoras(
            @RequestParam(required = false) String baseModel,
            @RequestParam(required = false) LoraCategory category,
            @RequestParam(name = "subcategory", required = false) String subcategory,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size
    ) {
        Page<LoraResponse> response =
                loraService.getFilteredLoras(
                        baseModel,
                        category,
                        subcategory,
                        page,
                        size
                );

        return ResponseEntity.ok(response);
    }
}
