package com.comfy.library;

import com.comfy.library.entity.LoraCategory;
import com.comfy.library.entity.LoraEntity;
import com.comfy.library.repository.LoraRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:archive-tests;DB_CLOSE_DELAY=-1", "spring.jpa.show-sql=false"})
class LoraArchiveTests {
    @Autowired WebApplicationContext context;
    @Autowired LoraRepository repository;

    @Test
    void archiveHidesFromAllGalleriesAndBackupPreservesStateUntilRestored() throws Exception {
        var mvc = MockMvcBuilders.webAppContextSetup(context).build();
        LoraEntity model = new LoraEntity();
        model.setLoraName("Archived hero");
        model.setCategory(LoraCategory.CHARACTER);
        model.setGroupName("Archive group");
        model.setBaseModel("Archive base");
        model.setPositivePrompt("Keep this prompt");
        model.setFavorite(true);
        model = repository.save(model);
        Long id = model.getId();
        mvc.perform(get("/api/loras")).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(put("/api/loras/" + id + "/archive").contentType("application/json").content("{\"archived\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.archived").value(true));
        for (String url : new String[]{"/api/loras", "/api/loras/search?keyword=hero", "/api/loras/filter",
                "/api/loras/favorites", "/api/loras/category/CHARACTER", "/api/loras/group/Archive%20group"}) {
            mvc.perform(get(url)).andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        }
        mvc.perform(get("/api/loras/filter-options")).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/loras/archived")).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.content[0].positivePrompt").value("Keep this prompt"));
        String exported = mvc.perform(get("/api/backup/export")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertTrue(exported.contains("\"archived\" : true"));
        repository.deleteAll();
        mvc.perform(post("/api/backup/import").contentType("application/json").content(exported)).andExpect(status().isOk());
        var restored = repository.findAll().getFirst();
        assertTrue(restored.isArchived());
        mvc.perform(put("/api/loras/" + restored.getId() + "/archive").contentType("application/json").content("{\"archived\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.archived").value(false));
        mvc.perform(get("/api/loras")).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/loras/archived")).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(put("/api/loras/" + restored.getId() + "/archive").contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/loras/0/archive").contentType("application/json").content("{\"archived\":true}"))
                .andExpect(status().isNotFound());
    }
}
