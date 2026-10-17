package com.comfy.library;

import com.comfy.library.dto.lora.LoraFilterMetadata;
import com.comfy.library.entity.*;
import com.comfy.library.repository.*;
import com.comfy.library.service.LoraService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.ObjectMapper;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:metadata-filters;DB_CLOSE_DELAY=-1", "spring.jpa.show-sql=false"})
class MetadataFilterTests {
    @Autowired LoraService service;
    @Autowired LoraRepository loras;
    @Autowired LoraImageRepository images;
    @Autowired ObjectMapper mapper;
    @Autowired WebApplicationContext context;
    @TempDir Path directory;
    MockMvc mvc;

    @BeforeEach
    void setup() {
        images.deleteAll();
        loras.deleteAll();
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    @Test
    void folderImportUsesPortableModelParentAndFallsBackToTheJsonFolder() throws Exception {
        String[] paths = {"C:\\models\\character\\Anime\\model.safetensors",
                "/models/character/Portraits/model.safetensors", null, "model.safetensors"};
        String[] expected = {"Anime", "Portraits", "Folder 2", "Folder 3"};
        for (int i = 0; i < paths.length; i++) {
            Path folder = Files.createDirectory(directory.resolve("Folder " + i));
            var metadata = mapper.createObjectNode();
            metadata.put("file_name", "Model " + i);
            metadata.put("base_model", "Illustrious");
            if (paths[i] != null) metadata.put("file_path", paths[i]);
            Files.writeString(folder.resolve("model.metadata.json"), mapper.writeValueAsString(metadata));
            var result = service.importLorasFromFolder(folder.toString());
            assertEquals(1, result.getImportedCount());
            assertEquals(0, result.getFailedCount());
            var saved = loras.findAll().getLast();
            assertEquals(expected[i], saved.getSubCategory());
            assertEquals("Illustrious", saved.getBaseModel());
        }
    }

    private LoraEntity save(String name, String model, LoraCategory category, String subcategory, boolean favorite) {
        var entity = new LoraEntity();
        entity.setLoraName(name);
        entity.setBaseModel(model);
        entity.setCategory(category);
        entity.setSubCategory(subcategory);
        entity.setFavorite(favorite);
        return loras.saveAndFlush(entity);
    }

    @Test
    void optionsUseExactPersistedModalMetadataAcrossTheWholeLibrary() throws Exception {
        mvc.perform(get("/api/loras/filter-options")).andExpect(status().isOk()).andExpect(content().json("[]"));
        save("Illu", "Illustrious", LoraCategory.CHARACTER, "Angel Blade", false);
        save("Duplicate metadata", "Illustrious", LoraCategory.CHARACTER, "Angel Blade", true);
        save("Style", "Illustrious", LoraCategory.STYLE, "Watercolor", false);
        save("WAN", "Wan Video 2.2 I2V-A14B", LoraCategory.CONCEPT, "Motion", true);
        save("Missing fields", null, null, null, false);
        String json = mvc.perform(get("/api/loras/filter-options")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        var metadata = Arrays.asList(mapper.readValue(json, LoraFilterMetadata[].class));
        assertEquals(4, metadata.size());
        assertTrue(metadata.contains(new LoraFilterMetadata("Illustrious", LoraCategory.CHARACTER, "Angel Blade")));
        assertTrue(metadata.contains(new LoraFilterMetadata("Wan Video 2.2 I2V-A14B", LoraCategory.CONCEPT, "Motion")));
        assertTrue(metadata.contains(new LoraFilterMetadata(null, null, null)));
        // Changes are visible without an application restart or any hardcoded option list.
        save("New", "New Base Model", LoraCategory.POSES, "Custom folder", false);
        mvc.perform(get("/api/loras/filter-options")).andExpect(jsonPath("$.length()").value(5));
    }

    @Test
    void metadataFiltersAndFavoritesRespectModelAndSubcategoryTogether() throws Exception {
        save("Illu", "Illustrious", LoraCategory.CONCEPT, "Motion", true);
        save("WAN", "Wan Video 2.2 I2V-A14B", LoraCategory.CONCEPT, "Motion", true);
        save("Other folder", "Wan Video 2.2 I2V-A14B", LoraCategory.CONCEPT, "Transition", true);
        for (String endpoint : new String[]{"/api/loras/filter", "/api/loras/favorites"}) {
            mvc.perform(get(endpoint).param("baseModel", "Wan Video 2.2 I2V-A14B").param("subcategory", "Motion"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                    .andExpect(jsonPath("$.content[0].loraName").value("WAN"));
        }
    }
}
