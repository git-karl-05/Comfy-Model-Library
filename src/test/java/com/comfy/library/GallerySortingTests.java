package com.comfy.library;

import com.comfy.library.entity.*;
import com.comfy.library.repository.*;
import com.comfy.library.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:gallery-sorting;DB_CLOSE_DELAY=-1", "spring.jpa.show-sql=false"})
@Transactional
class GallerySortingTests {
    @Autowired WebApplicationContext context;
    @Autowired jakarta.persistence.EntityManager entityManager;
    @Autowired PoseRepository poses;
    @Autowired PoseService poseService;
    @Autowired LoraRepository loras;
    @Autowired LoraService loraService;
    @Autowired LoraImageRepository loraImages;

    @Test
    void poseHttpContractMatchesThePage() throws Exception {
        var mvc = MockMvcBuilders.webAppContextSetup(context).build();
        mvc.perform(multipart("/api/poses")
                        .param("name", "HTTP pose").param("category", "Action")
                        .param("baseModel", "Flux").param("seed", "10").param("lora", "Example 0.8")
                        .param("prompt", "prompt").param("notes", "notes").param("retainedImages", "[]"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("HTTP pose"))
                .andExpect(jsonPath("$.notes").value("notes"))
                .andExpect(jsonPath("$.baseModel").value("Flux"));
        Long id = poses.findAll().stream().filter(pose -> "HTTP pose".equals(pose.getName())).findFirst().orElseThrow().getId();
        mvc.perform(patch("/api/poses/{id}/favorite", id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.favorite").value(true));
        mvc.perform(get("/api/poses").param("keyword", "HTTP").param("category", "Action")
                        .param("favorite", "true").param("sortBy", "seed").param("sortDirection", "asc"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].seed").value(10));
        mvc.perform(multipart("/api/poses/{id}", id).with(request -> { request.setMethod("PUT"); return request; })
                        .param("name", "Edited HTTP pose").param("baseModel", "SDXL").param("seed", "").param("retainedImages", "[]"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.favorite").value(true));
        mvc.perform(get("/api/poses/{id}", id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Edited HTTP pose"))
                .andExpect(jsonPath("$.baseModel").value("SDXL"));
        mvc.perform(get("/api/poses/categories")).andExpect(status().isOk());
        mvc.perform(get("/api/poses/backup/export")).andExpect(status().isOk());
        mvc.perform(post("/api/poses/backup/import").contentType("application/json")
                        .content("[{\"name\":\"Imported HTTP pose\",\"seed\":2}]"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.importedCount").value(1));
    }

    @Test
    void removalClearsOnlyTheRequestedPreviewAndSurvivesReload() throws Exception {
        var mvc = MockMvcBuilders.webAppContextSetup(context).build();
        LoraEntity lora = new LoraEntity();
        lora.setLoraName("Preview removal");
        lora.setCategory(LoraCategory.CHARACTER);
        lora.setFilePath("/uploads/lora/default.png");
        lora = loras.saveAndFlush(lora);
        loraImages.saveAndFlush(new LoraImageEntity("/uploads/lora/other.png", lora));
        mvc.perform(multipart("/api/loras/{id}", lora.getId()).with(request -> { request.setMethod("PUT"); return request; })
                        .param("loraName", "Preview removal").param("category", "CHARACTER").param("removePreview", "true"))
                .andExpect(status().isOk());
        entityManager.flush(); entityManager.clear();
        assertNull(loras.findById(lora.getId()).orElseThrow().getFilePath());
        assertEquals(1, loraImages.countByLoraId(lora.getId()));
        assertEquals("/uploads/lora/other.png", loraImages.findByLoraIdOrderByIdAsc(lora.getId()).getFirst().getFilePath());

        PoseEntity pose = new PoseEntity();
        pose.setName("Pose preview removal");
        pose.setImages(new java.util.ArrayList<>(List.of("/uploads/pose/default.png", "/uploads/pose/other.png")));
        pose.setFilePath("/uploads/pose/default.png");
        pose = poses.saveAndFlush(pose);
        mvc.perform(multipart("/api/poses/{id}", pose.getId()).with(request -> { request.setMethod("PUT"); return request; })
                        .param("name", "Pose preview removal").param("retainedImages", "[\"/uploads/pose/other.png\"]"))
                .andExpect(status().isOk());
        entityManager.flush(); entityManager.clear();
        PoseEntity reloaded = poses.findById(pose.getId()).orElseThrow();
        assertEquals(List.of("/uploads/pose/other.png"), reloaded.getImages());
        assertEquals("/uploads/pose/other.png", reloaded.getFilePath());
        mvc.perform(multipart("/api/poses/{id}", pose.getId()).with(request -> { request.setMethod("PUT"); return request; })
                        .param("name", "Pose preview removal").param("retainedImages", "[]"))
                .andExpect(status().isOk());
        entityManager.flush(); entityManager.clear();
        assertNull(poses.findById(pose.getId()).orElseThrow().getFilePath());
    }

    @Test
    void posesSortBeforePaginationAndRetainFilters() {
        poses.deleteAll();
        for (int seed : List.of(100, 2, 10)) {
            PoseEntity pose = new PoseEntity();
            pose.setName("Pose " + seed);
            pose.setCategory(seed == 100 ? "Sitting" : "Standing");
            pose.setFavorite(seed != 100);
            pose.setSeed(seed);
            poses.save(pose);
        }
        assertEquals(List.of(2, 10), poseService.find(null, null, null, 0, 2, "seed", "asc")
                .map(PoseEntity::getSeed).getContent());
        assertEquals(100, poseService.find(null, null, null, 1, 2, "seed", "asc").getContent().getFirst().getSeed());
        assertEquals(List.of(100, 10, 2), poseService.find(null, null, null, 0, 12, "seed", "desc")
                .map(PoseEntity::getSeed).getContent());
        assertEquals(List.of(10, 2), poseService.find("Pose", "Standing", true, 0, 12, "seed", "desc")
                .map(PoseEntity::getSeed).getContent());
        assertEquals(List.of("Pose 10", "Pose 100", "Pose 2"), poseService.find(null, null, null, 0, 12, "name", "asc")
                .map(PoseEntity::getName).getContent());
        assertEquals("Standing", poseService.find(null, null, null, 0, 12, "category", "desc").getContent().getFirst().getCategory());
    }

    @Test
    void lorasSortAllSupportedFieldsAndQueryModes() {
        loras.deleteAll();
        for (int i = 0; i < 3; i++) {
            LoraEntity lora = new LoraEntity();
            lora.setLoraName(List.of("Zulu", "Alpha", "Mike").get(i));
            lora.setCreator(List.of("B", "C", "A").get(i));
            lora.setCreatedDate(LocalDateTime.of(2026, 1, i + 1, 0, 0));
            lora.setCategory(LoraCategory.CHARACTER);
            lora.setBaseModel("Flux");
            lora.setFavorite(true);
            loras.save(lora);
        }
        assertEquals("Alpha", loraService.getLoras(0, 1, "loraName", "asc").getContent().getFirst().getLoraName());
        assertEquals("Zulu", loraService.getLoras(0, 1, "loraName", "desc").getContent().getFirst().getLoraName());
        assertEquals("Mike", loraService.getLoras(1, 1, "loraName", "asc").getContent().getFirst().getLoraName());
        assertEquals("Mike", loraService.getLoras(0, 12, "creator", "asc").getContent().getFirst().getLoraName());
        assertEquals("Mike", loraService.getLoras(0, 12, "createdDate", "desc").getContent().getFirst().getLoraName());
        assertEquals("Zulu", loraService.getFavoriteLoras(0, 12, "loraName", "desc").getContent().getFirst().getLoraName());
        assertEquals("Alpha", loraService.getFilteredLoras("Flux", LoraCategory.CHARACTER, null, 0, 12, "loraName", "asc").getContent().getFirst().getLoraName());
        assertEquals("Alpha", loraService.searchLoras("a", "Flux", LoraCategory.CHARACTER, null, true, 0, 12, "loraName", "asc").getContent().getFirst().getLoraName());
    }

    @Test
    void poseCreateEditFavoriteAndBackupPreserveFields() throws Exception {
        PoseEntity pose = poseService.save(null, "Standing", "Action", 10, "LoRA 0.8", "prompt", "notes", "Flux", List.of(), List.of());
        Long id = pose.getId();
        poseService.favorite(id);
        PoseEntity updated = poseService.save(id, "Updated", "Action", 20, "LoRA 0.5", "new prompt", "new notes", "SDXL", List.of(), List.of());
        assertTrue(updated.isFavorite());
        assertEquals("SDXL", updated.getBaseModel());
        entityManager.flush();
        entityManager.clear();
        assertEquals("SDXL", poseService.get(id).getBaseModel());
        poseService.save(id, "Updated", "Action", 20, "LoRA", "prompt", "new notes", null, List.of(), List.of());
        entityManager.flush();
        entityManager.clear();
        assertEquals("SDXL", poseService.get(id).getBaseModel());
        assertEquals("new notes", poseService.get(id).getNotes());
        assertTrue(poseService.categories().contains("Action"));
        assertTrue(poseService.exportBackup().stream().anyMatch(item -> item.getId().equals(id)));
        PoseEntity imported = new PoseEntity();
        imported.setName("Imported");
        assertEquals(1, poseService.importBackup(List.of(imported)).get("importedCount"));
        assertNotEquals(id, imported.getId());
        assertNull(poseService.get(imported.getId()).getBaseModel());
    }
}
