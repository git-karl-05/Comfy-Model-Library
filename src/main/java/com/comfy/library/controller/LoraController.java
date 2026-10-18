package com.comfy.library.controller;

import com.comfy.library.dto.lora.*;
import com.comfy.library.entity.LoraCategory;
import com.comfy.library.service.LoraImageService;
import com.comfy.library.service.LoraService;
import org.springframework.data.domain.Page;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/loras")
public class LoraController {

    private final LoraService loraService;
    private final LoraImageService loraImageService;

    public LoraController(
            LoraService loraService,
            LoraImageService loraImageService
    ) {
        this.loraService = loraService;
        this.loraImageService = loraImageService;
    }


    // =========================================================
    // CREATE
    // =========================================================

    @PostMapping
    public ResponseEntity<LoraResponse> saveLora(
            @RequestBody CreateLoraRequest loraRequest
    ) {
        return ResponseEntity.ok(
                loraService.saveLora(
                        loraRequest
                )
        );
    }


    @PostMapping(
            consumes =
                    MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public LoraResponse saveLoraWithPreviewImage(
            @ModelAttribute CreateLoraRequest request,
            @RequestParam(required = false)
            MultipartFile previewImage
    ) {
        return loraService
                .saveLoraWithPreviewImage(
                        request,
                        previewImage
                );
    }


    // =========================================================
    // UPDATE
    // =========================================================

    @PutMapping(
            value = "/{loraId}",
            consumes =
                    MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<LoraResponse> updateLoraWithPreview(
            @PathVariable Long loraId,
            @ModelAttribute UpdateLoraRequest request,
            @RequestParam(required = false)
            MultipartFile preview
    ) {
        return ResponseEntity.ok(
                loraService
                        .updateLoraWithPreviewById(
                                loraId,
                                request,
                                preview
                        )
        );
    }


    // =========================================================
    // DELETE
    // =========================================================

    @DeleteMapping("/{loraId}")
    public ResponseEntity<String> deleteLora(
            @PathVariable Long loraId
    ) {
        return ResponseEntity.ok(
                loraService.deleteLoraById(
                        loraId
                )
        );
    }


    // =========================================================
    // SEARCH
    // =========================================================

    @GetMapping("/search")
    public ResponseEntity<Page<LoraResponse>> searchLoras(
            @RequestParam String keyword,
            @RequestParam(required = false)
            String baseModel,
            @RequestParam(required = false)
            LoraCategory category,
            @RequestParam(required = false)
            String subcategory,
            @RequestParam(required = false)
            Boolean favorite,
            @RequestParam(defaultValue = "0")
            int page,
            @RequestParam(defaultValue = "12")
            int size,
            @RequestParam(defaultValue = "createdDate")
            String sortBy,
            @RequestParam(defaultValue = "desc")
            String sortDirection
    ) {
        return ResponseEntity.ok(
                loraService.searchLoras(
                        keyword,
                        baseModel,
                        category,
                        subcategory,
                        favorite,
                        page,
                        size,
                        sortBy,
                        sortDirection
                )
        );
    }


    // =========================================================
    // GET BY ID
    // =========================================================

    @GetMapping("/{loraId}")
    public ResponseEntity<LoraResponse> getLoraById(
            @PathVariable long loraId
    ) {
        return ResponseEntity.ok(
                loraService.getLoraById(
                        loraId
                )
        );
    }


    // =========================================================
    // STANDARD GALLERY
    // =========================================================

    @GetMapping
    public ResponseEntity<Page<LoraResponse>> getLoras(
            @RequestParam(defaultValue = "0")
            int page,
            @RequestParam(defaultValue = "12")
            int size,
            @RequestParam(defaultValue = "createdDate")
            String sortBy,
            @RequestParam(defaultValue = "desc")
            String sortDirection
    ) {
        Page<LoraResponse> response =
                loraService.getLoras(
                        page,
                        size,
                        sortBy,
                        sortDirection
                );

        return ResponseEntity.ok(
                response
        );
    }


    // =========================================================
    // CATEGORY
    // =========================================================

    @GetMapping("/category/{category}")
    public ResponseEntity<Page<LoraResponse>> getLorasByCategory(
            @PathVariable LoraCategory category,
            @RequestParam(defaultValue = "0")
            int page,
            @RequestParam(defaultValue = "12")
            int size
    ) {
        Page<LoraResponse> response =
                loraService.getLorasByCategory(
                        category,
                        page,
                        size
                );

        return ResponseEntity.ok(
                response
        );
    }


    // =========================================================
    // GROUP
    // =========================================================

    @GetMapping("/group/{groupName}")
    public ResponseEntity<Page<LoraResponse>> getLorasByGroup(
            @PathVariable String groupName,
            @RequestParam(defaultValue = "0")
            int page,
            @RequestParam(defaultValue = "12")
            int size
    ) {
        Page<LoraResponse> response =
                loraService.getLorasByGroup(
                        groupName,
                        page,
                        size
                );

        return ResponseEntity.ok(
                response
        );
    }


    // =========================================================
    // FAVORITES
    // =========================================================

    @GetMapping("/favorites")
    public ResponseEntity<Page<LoraResponse>> getFavoriteLoras(
            @RequestParam(required = false) LoraCategory category,
            @RequestParam(required = false) String baseModel,
            @RequestParam(required = false) String subcategory,
            @RequestParam(defaultValue = "0")
            int page,
            @RequestParam(defaultValue = "12")
            int size,
            @RequestParam(defaultValue = "createdDate")
            String sortBy,
            @RequestParam(defaultValue = "desc")
            String sortDirection
    ) {
        return ResponseEntity.ok(
                loraService.searchLoras(
                        null, baseModel, category, subcategory, true,
                        page,
                        size,
                        sortBy,
                        sortDirection
                )
        );
    }


    @PutMapping("/{loraId}/favorite")
    public LoraResponse toggleFavorite(
            @PathVariable Long loraId
    ) {
        return loraService.toggleFavorite(
                loraId
        );
    }


    // =========================================================
    // CATEGORIES
    // =========================================================

    @GetMapping("/categories")
    public List<LoraCategory> getCategories() {
        return loraService.getCategories();
    }

    @GetMapping("/filter-options")
    public List<LoraFilterMetadata> getFilterOptions() {
        return loraService.getFilterMetadata();
    }


    // =========================================================
    // IMPORT
    // =========================================================

    @PostMapping("/import-folder")
    public ImportSummaryResponse importFolder(
            @RequestBody ImportFolderRequest request
    ) {
        return loraService
                .importLorasFromFolder(
                        request.getFolderPath()
                );
    }


    // =========================================================
    // FILTER
    // =========================================================

    @GetMapping("/filter")
    public ResponseEntity<Page<LoraResponse>> getFilteredLoras(
            @RequestParam(required = false)
            String baseModel,
            @RequestParam(required = false)
            LoraCategory category,
            @RequestParam(
                    name = "subcategory",
                    required = false
            )
            String subcategory,
            @RequestParam(defaultValue = "0")
            int page,
            @RequestParam(defaultValue = "12")
            int size,
            @RequestParam(defaultValue = "createdDate")
            String sortBy,
            @RequestParam(defaultValue = "desc")
            String sortDirection
    ) {
        Page<LoraResponse> response =
                loraService.getFilteredLoras(
                        baseModel,
                        category,
                        subcategory,
                        page,
                        size,
                        sortBy,
                        sortDirection
                );

        return ResponseEntity.ok(
                response
        );
    }


    // =========================================================
    // LORA IMAGES
    // =========================================================

    @GetMapping("/{loraId}/images")
    public ResponseEntity<List<LoraImageResponse>> getLoraImages(
            @PathVariable Long loraId
    ) {
        List<LoraImageResponse> images =
                loraImageService
                        .getImagesByLoraId(
                                loraId
                        );

        return ResponseEntity.ok(
                images
        );
    }


    @PostMapping(
            value = "/{loraId}/images",
            consumes =
                    MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<LoraImageResponse> addLoraImage(
            @PathVariable Long loraId,
            @RequestParam("image")
            MultipartFile image
    ) {
        LoraImageResponse savedImage =
                loraImageService
                        .addImageToLora(
                                loraId,
                                image
                        );

        return ResponseEntity.ok(
                savedImage
        );
    }
}
