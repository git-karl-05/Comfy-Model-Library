package com.comfy.library;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.test.web.servlet.MockMvc;
import com.comfy.library.repository.*;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.JsonNode;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"spring.datasource.url=jdbc:h2:mem:backup-tests;DB_CLOSE_DELAY=-1", "spring.jpa.show-sql=false"})
class BackupImportTests {
    @Autowired WebApplicationContext context;
    @Autowired LoraRepository loras;
    @Autowired LoraImageRepository images;
    @Autowired PoseRepository poses;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired org.springframework.core.env.Environment environment;
    MockMvc mvc;

    @BeforeEach
    void setup() {
        images.deleteAll();
        loras.deleteAll();
        poses.deleteAll();
        mvc = MockMvcBuilders.webAppContextSetup(context).build();
    }

    private byte[] fixture() throws Exception {
        String suppliedPath = System.getProperty("backup.fixture.path");
        if (suppliedPath != null) {
            byte[] supplied = java.nio.file.Files.readAllBytes(java.nio.file.Path.of(suppliedPath));
            try (var input = getClass().getResourceAsStream("/comfy-model-library-backup.json")) {
                assertArrayEquals(input.readAllBytes(), supplied, "Regression fixture must match the supplied backup exactly");
            }
            return supplied;
        }
        try (var input = getClass().getResourceAsStream("/comfy-model-library-backup.json")) {
            return input.readAllBytes();
        }
    }

    @Test
    void suppliedBackupImportsOverRealHttpWithMultipartParsing() throws Exception {
        byte[] bytes = fixture();
        String boundary = "BackupRegressionBoundary";
        var body = new java.io.ByteArrayOutputStream();
        body.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; "
                + "filename=\"comfy-model-library-backup.json\"\r\nContent-Type: application/json\r\n\r\n")
                .getBytes(java.nio.charset.StandardCharsets.UTF_8));
        body.write(bytes);
        body.write(("\r\n--" + boundary + "--\r\n").getBytes(java.nio.charset.StandardCharsets.UTF_8));
        String base = "http://localhost:" + environment.getProperty("local.server.port");
        try (var client = java.net.http.HttpClient.newHttpClient()) {
            var request = java.net.http.HttpRequest.newBuilder(java.net.URI.create(base + "/api/backup/import"))
                    .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                    .POST(java.net.http.HttpRequest.BodyPublishers.ofByteArray(body.toByteArray())).build();
            var response = client.send(request, java.net.http.HttpResponse.BodyHandlers.ofString());
            assertEquals(200, response.statusCode(), response.body());
            assertEquals(1156, mapper.readTree(response.body()).get("importedCount").asInt());
            assertEquals(0, mapper.readTree(response.body()).get("skippedCount").asInt());
            assertEquals(1156, loras.count());
            var exported = client.send(java.net.http.HttpRequest.newBuilder(
                    java.net.URI.create(base + "/api/backup/export")).GET().build(),
                    java.net.http.HttpResponse.BodyHandlers.ofByteArray());
            assertEquals(200, exported.statusCode());
            JsonNode expected = mapper.readTree(bytes).get("loras");
            JsonNode actual = mapper.readTree(exported.body()).get("loras");
            assertEquals(expected.size(), actual.size());
            for (int i = 0; i < expected.size(); i++) {
                for (String field : expected.get(i).propertyNames()) {
                    assertEquals(expected.get(i).get(field), actual.get(i).get(field), "loras[" + i + "]." + field);
                }
            }
        }
    }

    private String exportLoras() throws Exception {
        return mvc.perform(get("/api/backup/export")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
    }

    private void importJson(String json) throws Exception {
        mvc.perform(post("/api/backup/import").contentType("application/json").content(json))
                .andExpect(status().isOk());
    }

    @Test
    void suppliedBackupImportsThroughTheBrowserContract() throws Exception {
        byte[] bytes = fixture();
        mvc
                .perform(multipart("/api/backup/import").file(new MockMultipartFile(
                        "file", "comfy-model-library-backup.json", "application/json", bytes)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.importedCount").value(1156))
                .andExpect(jsonPath("$.skippedCount").value(0));
        assertEquals(1156, loras.count());
        // Compare every historical field of every record, including nulls and numeric seeds.
        JsonNode original = mapper.readTree(bytes).get("loras");
        JsonNode exported = mapper.readTree(exportLoras()).get("loras");
        assertEquals(original.size(), exported.size());
        for (int i = 0; i < original.size(); i++) {
            JsonNode expected = original.get(i);
            for (String field : expected.propertyNames()) {
                assertEquals(expected.get(field), exported.get(i).get(field), "loras[" + i + "]." + field);
            }
        }
        mvc.perform(post("/api/backup/import").contentType("application/json").content(bytes))
                .andExpect(status().isOk()).andExpect(jsonPath("$.importedCount").value(0))
                .andExpect(jsonPath("$.skippedCount").value(1156));
        assertEquals(exported, mapper.readTree(exportLoras()).get("loras"));

        String snapshot = exportLoras();
        loras.deleteAll();
        importJson(snapshot);
        assertEquals(exported, mapper.readTree(exportLoras()).get("loras"));
    }

    @Test
    void optionalFieldsNullsAndCurrentMetadataRoundTrip() throws Exception {
        importJson("""
                {"backupVersion":1,"loras":[{"loraName":"Minimal","favorite":null},
                {"loraName":"Full","version":"1","creator":"creator","seedNumber":9223372036854775807,
                 "modelFilePath":"C:/models/test.safetensors","sha256":"hash",
                 "createdDate":"2020-01-02T03:04:05","lastUpdated":"2021-02-03T04:05:06",
                 "filePath":"/uploads/preview.mp4","images":["/uploads/one.png","/uploads/two.mp4"]}]}
                """);
        assertNull(loras.findAll().getFirst().getSeedNumber());
        assertFalse(loras.findAll().getFirst().isFavorite());
        assertEquals(Long.MAX_VALUE, loras.findAll().getLast().getSeedNumber());
        assertEquals(2, images.count());
        String snapshot = exportLoras();
        images.deleteAll();
        loras.deleteAll();
        importJson(snapshot);
        assertEquals(mapper.readTree(snapshot).get("loras"), mapper.readTree(exportLoras()).get("loras"));
    }

    @Test
    void invalidFilesAreRejectedBeforeAnyRecordsAreWritten() throws Exception {
        var invalid = List.of("", "null", "[]", "{", "{}", "{\"backupVersion\":2,\"loras\":[]}",
                "{\"backupVersion\":1}", "{\"backupVersion\":1,\"loras\":null}",
                "{\"backupVersion\":1,\"loras\":[null]}",
                "{\"backupVersion\":1,\"loras\":[{\"loraName\":\"Valid\"},{}]}",
                "{\"backupVersion\":1,\"loras\":[{\"loraName\":\"Overflow\",\"seedNumber\":9223372036854775808}]}",
                "{\"backupVersion\":1,\"loras\":[{\"loraName\":\"Decimal\",\"seedNumber\":1.5}]}",
                "{\"backupVersion\":1,\"loras\":[]} {}",
                "{\"backupVersion\":1,\"loras\":[{\"loraName\":\"X\",\"category\":\"INVALID\"}]}",
                "{\"backupVersion\":1,\"loras\":[{\"loraName\":\"X\",\"unknownField\":true}]}",
                "{\"backupVersion\":1,\"loras\":[{\"loraName\":\"" + "x".repeat(256) + "\"}]}");
        for (String json : invalid) {
            mvc.perform(post("/api/backup/import").contentType("application/json").content(json))
                    .andExpect(status().isBadRequest());
            mvc.perform(multipart("/api/backup/import").file(new MockMultipartFile(
                    "file", "bad.json", "application/json", json.getBytes(java.nio.charset.StandardCharsets.UTF_8))))
                    .andExpect(status().isBadRequest());
            assertEquals(0, loras.count(), json);
        }
        mvc.perform(post("/api/backup/import").contentType("application/json")
                        .content("{\"backupVersion\":1,\"loras\":[{\"loraName\":\"A\"},null]}"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("loras[1]")));
    }

    @Test
    void databaseFailureRollsBackEarlierRecordsAndPreservesExistingData() throws Exception {
        importJson("{\"backupVersion\":1,\"loras\":[{\"loraName\":\"Existing\",\"notes\":\"keep\"}]}");
        jdbc.execute("ALTER TABLE lora_entity ADD CONSTRAINT backup_test CHECK (lora_name <> 'Rejected')");
        try {
            mvc.perform(post("/api/backup/import").contentType("application/json").content("""
                    {"backupVersion":1,"loras":[{"loraName":"Would be inserted"},{"loraName":"Rejected"}]}
                    """))
                    .andExpect(status().isBadRequest())
                    .andExpect(content().string(org.hamcrest.Matchers.containsString("No records were imported")));
            assertEquals(1, loras.count());
            assertEquals("keep", loras.findAll().getFirst().getNotes());
        } finally {
            jdbc.execute("ALTER TABLE lora_entity DROP CONSTRAINT backup_test");
        }
    }

    @Test
    void poseBackupsPreserveLegacyPathsImagesAndLargeSeedsWithoutOverwritingIds() throws Exception {
        String json = """
                [{"id":123,"name":"Pose","seed":9223372036854775807,"category":"Action","baseModel":"Flux",
                "favorite":true,"prompt":"prompt","notes":"notes","lora":"model","type":"IMAGE",
                "filePath":"/uploads/pose/old.png","images":["/uploads/pose/one.png","/uploads/pose/two.png"]},
                {"name":"Legacy","seed":null,"images":null,"filePath":"/uploads/pose/legacy.png"}]
                """;
        mvc.perform(post("/api/poses/backup/import").contentType("application/json").content(json))
                .andExpect(status().isOk()).andExpect(jsonPath("$.importedCount").value(2));
        String snapshot = mvc.perform(get("/api/poses/backup/export")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertEquals(Long.MAX_VALUE, poses.findAll().getFirst().getSeed());
        mvc.perform(post("/api/poses/backup/import").contentType("application/json").content(snapshot))
                .andExpect(status().isOk());
        assertEquals(4, poses.count());
        var all = poses.findAll();
        for (int i = 0; i < 2; i++) {
            JsonNode first = mapper.valueToTree(all.get(i));
            JsonNode second = mapper.valueToTree(all.get(i + 2));
            for (String field : first.propertyNames()) {
                if (!field.equals("id")) assertEquals(first.get(field), second.get(field), field);
            }
        }
        for (String invalid : List.of("null", "[null]", "[{}]", "[] {}",
                "[{\"name\":\"P\",\"seed\":9223372036854775808}]")) {
            mvc.perform(post("/api/poses/backup/import").contentType("application/json").content(invalid))
                    .andExpect(status().isBadRequest());
            assertEquals(4, poses.count());
        }
    }
}
