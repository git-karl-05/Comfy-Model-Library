package com.comfy.library;

import com.comfy.library.dto.lora.UpdateLoraRequest;
import com.comfy.library.entity.LoraEntity;
import com.comfy.library.repository.LoraImageRepository;
import com.comfy.library.repository.LoraRepository;
import com.comfy.library.service.LoraService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.ObjectMapper;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:rename-tests;DB_CLOSE_DELAY=-1", "spring.jpa.show-sql=false"})
class LoraModelRenameTests {
    @TempDir Path directory;
    @Autowired LoraRepository repository;
    @Autowired LoraImageRepository images;
    @Autowired LoraService service;
    @Autowired ObjectMapper mapper;
    @Autowired WebApplicationContext context;
    @Autowired PlatformTransactionManager transactions;

    @BeforeEach void clear() { images.deleteAll(); repository.deleteAll(); }

    private LoraEntity model() throws Exception {
        Path file = directory.resolve("original.safetensors");
        Files.write(file, new byte[]{1,2,3,4});
        LoraEntity model = new LoraEntity();
        model.setLoraName("Original title");
        model.setModelFilePath(file.toString());
        model.setSha256("unchanged-hash");
        return repository.save(model);
    }

    @Test void editingRenamesLinkedFileAndSidecarThroughBothSavePaths() throws Exception {
        var model = model();
        var metadata = mapper.createObjectNode();
        metadata.put("file_path", model.getModelFilePath());
        metadata.put("file_name", "original.safetensors");
        metadata.putObject("civitai").putArray("trainedWords").add("preserved trigger");
        Files.write(directory.resolve("original.metadata.json"), mapper.writeValueAsBytes(metadata));
        var mvc = MockMvcBuilders.webAppContextSetup(context).build();
        for (boolean manifest : new boolean[]{false,true}) {
            String title = manifest ? "Final title" : "Edited title";
            var request = multipart("/api/loras/" + model.getId()).param("loraName",title);
            if (manifest) request.param("previewManifest", "{\"entries\":[],\"defaultKey\":null}");
            request.with(http -> {http.setMethod("PUT"); return http;});
            mvc.perform(request).andExpect(status().isOk())
                    .andExpect(jsonPath("$.loraName").value(title))
                    .andExpect(jsonPath("$.modelFilePath").value(directory.resolve(title + ".safetensors").toString()));
            assertArrayEquals(new byte[]{1,2,3,4}, Files.readAllBytes(directory.resolve(title + ".safetensors")));
            var savedMetadata = mapper.readTree(Files.readAllBytes(directory.resolve(title + ".metadata.json")));
            assertEquals(title + ".safetensors", savedMetadata.path("file_name").asText());
            assertEquals("preserved trigger", savedMetadata.path("civitai").path("trainedWords").get(0).asText());
        }
        assertFalse(Files.exists(directory.resolve("original.safetensors")));
        assertFalse(Files.exists(directory.resolve("Edited title.safetensors")));
        assertEquals("unchanged-hash",repository.findById(model.getId()).orElseThrow().getSha256());
    }

    @Test void collisionsInvalidNamesAndMissingFilesLeaveTitleAndExistingFilesIntact() throws Exception {
        var model = model();
        Path occupied = directory.resolve("Occupied.safetensors");
        Files.writeString(occupied,"other model");
        var mvc = MockMvcBuilders.webAppContextSetup(context).build();
        for (String title : new String[]{"Occupied", "../escape", "CON", "bad:name"}) {
            var request = multipart("/api/loras/" + model.getId()).param("loraName",title);
            request.with(http -> {http.setMethod("PUT"); return http;});
            mvc.perform(request).andExpect(status().is4xxClientError());
            assertEquals("Original title",repository.findById(model.getId()).orElseThrow().getLoraName());
            assertTrue(Files.exists(Path.of(model.getModelFilePath())));
        }
        assertEquals("other model",Files.readString(occupied));
        Files.delete(Path.of(model.getModelFilePath()));
        var request = multipart("/api/loras/" + model.getId()).param("loraName","Missing");
        request.with(http -> {http.setMethod("PUT"); return http;});
        mvc.perform(request).andExpect(status().isConflict());
        assertEquals("Original title",repository.findById(model.getId()).orElseThrow().getLoraName());
    }

    @Test void databaseRollbackRestoresOriginalFilesAndMetadata() throws Exception {
        var model = model();
        Path metadata = directory.resolve("original.metadata.json");
        byte[] bytes = "{\"file_name\":\"original\",\"other\":42}".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        Files.write(metadata,bytes);
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            UpdateLoraRequest request = new UpdateLoraRequest();
            request.setLoraName("Rolled back");
            service.updateLoraWithPreviewById(model.getId(),request,null);
            assertTrue(Files.exists(directory.resolve("Rolled back.safetensors")));
            status.setRollbackOnly();
        });
        assertTrue(Files.exists(Path.of(model.getModelFilePath())));
        assertFalse(Files.exists(directory.resolve("Rolled back.safetensors")));
        assertArrayEquals(bytes,Files.readAllBytes(metadata));
        assertEquals("Original title",repository.findById(model.getId()).orElseThrow().getLoraName());
    }

    @Test void supportsCaseOnlyRenamesAndOptionalExtensionInTitle() throws Exception {
        var model = model();
        UpdateLoraRequest request = new UpdateLoraRequest();
        request.setLoraName("ORIGINAL.safetensors");
        service.updateLoraWithPreviewById(model.getId(),request,null);
        assertEquals("ORIGINAL.safetensors",directory.toFile().list()[0]);
        assertEquals(directory.resolve("ORIGINAL.safetensors").toString(),repository.findById(model.getId()).orElseThrow().getModelFilePath());
    }

    @Test void malformedMetadataIsPreservedAndRecordsWithoutModelFilesStillAllowTitleEdits() throws Exception {
        var model = model();
        Path metadata = directory.resolve("original.metadata.json");
        Files.writeString(metadata,"{invalid JSON");
        var mvc = MockMvcBuilders.webAppContextSetup(context).build();
        var request = multipart("/api/loras/" + model.getId()).param("loraName","New title");
        request.with(http -> {http.setMethod("PUT"); return http;});
        mvc.perform(request).andExpect(status().isBadRequest());
        assertTrue(Files.exists(Path.of(model.getModelFilePath())));
        assertEquals("{invalid JSON",Files.readString(metadata));
        LoraEntity manual = new LoraEntity();
        manual.setLoraName("Manual title");
        manual = repository.save(manual);
        UpdateLoraRequest edit = new UpdateLoraRequest();
        edit.setLoraName("Changed title");
        service.updateLoraWithPreviewById(manual.getId(),edit,null);
        assertEquals("Changed title",repository.findById(manual.getId()).orElseThrow().getLoraName());
        assertNull(repository.findById(manual.getId()).orElseThrow().getModelFilePath());
    }
}
