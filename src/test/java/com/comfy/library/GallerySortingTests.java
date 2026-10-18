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
    void configuredPageSizesReturnTheRequestedNumberOfRecords() throws Exception {
        var mvc = MockMvcBuilders.webAppContextSetup(context).build();
        for (int i = 0; i < 40; i++) {
            var lora = new LoraEntity();
            lora.setLoraName("Pagination fixture " + i);
            lora.setBaseModel("Pagination fixture"); lora.setCategory(LoraCategory.STYLE); lora.setFavorite(true);
            loras.save(lora);
            var pose = new PoseEntity(); pose.setName("Pagination fixture " + i); pose.setFavorite(true);
            poses.save(pose);
        }
        for (int size : new int[]{12, 24, 32}) {
            for (String endpoint : new String[]{"/api/loras", "/api/loras/search", "/api/loras/filter", "/api/loras/favorites", "/api/poses"}) {
                mvc.perform(get(endpoint).param("size", String.valueOf(size)).param("keyword", "Pagination fixture")
                        .param("baseModel", "Pagination fixture"))
                        .andExpect(status().isOk()).andExpect(jsonPath("$.size").value(size))
                        .andExpect(jsonPath("$.content.length()").value(size))
                        .andExpect(jsonPath("$.totalPages").value((40 + size - 1) / size));
                mvc.perform(get(endpoint).param("size", String.valueOf(size)).param("page", "1")
                        .param("keyword", "Pagination fixture").param("baseModel", "Pagination fixture"))
                        .andExpect(status().isOk()).andExpect(jsonPath("$.content.length()").value(Math.min(size, 40 - size)));
            }
        }
    }

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
            pose.setSeed((long) seed);
            poses.save(pose);
        }
        assertEquals(List.of(2L, 10L), poseService.find(null, null, null, 0, 2, "seed", "asc")
                .map(PoseEntity::getSeed).getContent());
        assertEquals(100L, poseService.find(null, null, null, 1, 2, "seed", "asc").getContent().getFirst().getSeed());
        assertEquals(List.of(100L, 10L, 2L), poseService.find(null, null, null, 0, 12, "seed", "desc")
                .map(PoseEntity::getSeed).getContent());
        assertEquals(List.of(10L, 2L), poseService.find("Pose", "Standing", true, 0, 12, "seed", "desc")
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
    void metadataSortFieldsOrderBeforePaginationAcrossGallerySearchAndFavorites() throws Exception {
        var mvc = MockMvcBuilders.webAppContextSetup(context).build();
        loras.deleteAll();
        for (int i=0;i<3;i++) {
            var lora=new LoraEntity();
            lora.setLoraName("Model " + (char)('A'+i));
            lora.setCategory(List.of(LoraCategory.STYLE,LoraCategory.CHARACTER,LoraCategory.CONCEPT).get(i));
            lora.setSubCategory(List.of("Zulu","Mike","Alpha").get(i));
            lora.setBaseModel(List.of("Flux","SDXL","Illustrious").get(i));
            lora.setFavorite(true);
            loras.saveAndFlush(lora);
        }
        var expected=java.util.Map.of("category",List.of("Model B","Model C","Model A"),
                "subCategory",List.of("Model C","Model B","Model A"),
                "baseModel",List.of("Model A","Model C","Model B"));
        for(var entry:expected.entrySet()) {
            String field=entry.getKey(); var names=entry.getValue();
            assertEquals(names.subList(0,2),loraService.getLoras(0,2,field,"asc").map(lora -> lora.getLoraName()).getContent());
            assertEquals(names.getLast(),loraService.getLoras(1,2,field,"asc").getContent().getFirst().getLoraName());
            assertEquals(names.reversed(),loraService.getLoras(0,12,field,"desc").map(lora -> lora.getLoraName()).getContent());
            assertEquals(names,loraService.getFavoriteLoras(0,12,field,"asc").map(lora -> lora.getLoraName()).getContent());
            assertEquals(names,loraService.searchLoras("Model",null,null,null,true,0,12,field,"asc").map(lora -> lora.getLoraName()).getContent());
            mvc.perform(get("/api/loras").param("sortBy",field).param("sortDirection","asc"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.content[0].loraName").value(names.getFirst()));
        }
    }

    @Test
    void poseCreateEditFavoriteAndBackupPreserveFields() throws Exception {
        PoseEntity pose = poseService.save(null, "Standing", "Action", 10L, "LoRA 0.8", "prompt", "notes", "Flux", List.of(), List.of());
        Long id = pose.getId();
        poseService.favorite(id);
        PoseEntity updated = poseService.save(id, "Updated", "Action", 20L, "LoRA 0.5", "new prompt", "new notes", "SDXL", List.of(), List.of());
        assertTrue(updated.isFavorite());
        assertEquals("SDXL", updated.getBaseModel());
        entityManager.flush();
        entityManager.clear();
        assertEquals("SDXL", poseService.get(id).getBaseModel());
        poseService.save(id, "Updated", "Action", 20L, "LoRA", "prompt", "new notes", null, List.of(), List.of());
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
