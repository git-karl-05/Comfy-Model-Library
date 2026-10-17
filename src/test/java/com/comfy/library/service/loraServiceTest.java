package com.comfy.library.service;

import com.comfy.library.dto.lora.CreateLoraRequest;
import com.comfy.library.dto.lora.LoraResponse;
import com.comfy.library.entity.LoraCategory;
import com.comfy.library.entity.LoraEntity;
import com.comfy.library.repository.LoraImageRepository;
import com.comfy.library.repository.LoraRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.ObjectMapper;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

public class loraServiceTest {

    private LoraRepository loraRepository;
    private LoraService loraService;
    private LoraImageRepository loraImageRepository;
    private LoraImageService loraImageService;
    private ObjectMapper objectMapper;


    @BeforeEach
    void setUp() {
        loraRepository = mock(LoraRepository.class);
        loraImageRepository = mock(LoraImageRepository.class);
        loraImageService = mock(LoraImageService.class);
        objectMapper = mock(ObjectMapper.class);

        loraService = new LoraService(loraRepository, loraImageService, objectMapper);
    }



    private CreateLoraRequest createObjectToSave() {
        CreateLoraRequest request = new CreateLoraRequest();

        request.setLoraName("Test LoRA");
        request.setVersion("v1");
        request.setCreator("Test Creator");
        request.setCategory(LoraCategory.CHARACTER);
        request.setSubCategory("Anime");
        request.setBaseModel("Illustrious");
        request.setPositivePrompt("testTrigger");
        request.setNotes("Test notes");

        return request;
    }

    private LoraEntity createSavedLoraEntity() {
        LoraEntity entity = new LoraEntity();

        entity.setId(1L);
        entity.setLoraName("Test LoRA");
        entity.setVersion("1");
        entity.setCreator("Test Creator");
        entity.setCategory(LoraCategory.CHARACTER);
        entity.setSubCategory("Anime");
        entity.setBaseModel("Illustrious");
        entity.setPositivePrompt("testTrigger");
        entity.setNotes("Test notes");
        entity.setFavorite(false);

        return entity;
    }

    @Test
    void saveLora_shouldReturnLoraResponse() {
        CreateLoraRequest createLoraRequest = createObjectToSave();
        LoraEntity savedLoraEntity = createSavedLoraEntity();

        when(loraRepository.save(any(LoraEntity.class)))
                .thenReturn(savedLoraEntity);

        loraService.saveLora(createLoraRequest);

        ArgumentCaptor<LoraEntity> captor = ArgumentCaptor.forClass(LoraEntity.class);

        verify(loraRepository).save(captor.capture());

        LoraEntity entity = captor.getValue();

        assertEquals("Test LoRA", entity.getLoraName());
        assertEquals("1", entity.getVersion());
        assertEquals("Test Creator", entity.getCreator());
        assertEquals(LoraCategory.CHARACTER, entity.getCategory());
        assertEquals("Anime", entity.getSubCategory());
        assertEquals("Illustrious", entity.getBaseModel());
    }

    private LoraEntity createLoraEntityForTest() {
        LoraEntity lora = new LoraEntity();

        lora.setId(1L);
        lora.setLoraName("Test LoRA");
        lora.setVersion("1");
        lora.setCreator("Test Creator");
        lora.setCategory(LoraCategory.CHARACTER);
        lora.setSubCategory("Anime");
        lora.setBaseModel("Illustrious");
        lora.setPositivePrompt("testTrigger");
        lora.setNotes("Test notes");
        lora.setFavorite(false);

        return lora;
    }

    @Test
    void getLoraById_shouldReturnExpectedLora() {
        LoraEntity existingLora = createLoraEntityForTest();

        when(loraRepository.findById(1L))
                .thenReturn(Optional.of(existingLora));

        LoraResponse response = loraService.getLoraById(1L);

        assertEquals(1L, response.getId());
        assertEquals("Test LoRA", response.getLoraName());
        assertEquals("1", response.getVersion());
        assertEquals("Test Creator", response.getCreator());
        assertEquals(LoraCategory.CHARACTER, response.getCategory());
        assertEquals("Anime", response.getSubCategory());
        assertEquals("Illustrious", response.getBaseModel());
        assertEquals("testTrigger", response.getPositivePrompt());
        assertEquals("Test notes", response.getNotes());
        assertFalse(response.isFavorite());
    }

    @Test
    void removingDefaultPreviewDoesNotDiscardASelectedReplacement() {
        LoraEntity existing = createSavedLoraEntity();
        existing.setFilePath("/old.png");
        com.comfy.library.dto.lora.UpdateLoraRequest request = new com.comfy.library.dto.lora.UpdateLoraRequest();
        request.setLoraName("Test LoRA");
        request.setCategory(LoraCategory.CHARACTER);
        request.setRemovePreview(true);
        var replacement = new org.springframework.mock.web.MockMultipartFile("preview", "new.png", "image/png", new byte[]{1, 2});
        when(loraRepository.findById(1L)).thenReturn(Optional.of(existing));
        when(loraImageService.savePreviewImage(replacement)).thenReturn("/new.png");
        when(loraRepository.save(any(LoraEntity.class))).thenAnswer(call -> call.getArgument(0));
        loraService.updateLoraWithPreviewById(1L, request, replacement);
        assertEquals("/new.png", existing.getFilePath());
        verify(loraImageService).savePreviewImage(replacement);
    }
}
