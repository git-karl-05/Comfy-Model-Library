package com.comfy.library;

import com.comfy.library.repository.PoseRepository;
import com.comfy.library.service.ComfyOutputService;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import tools.jackson.databind.ObjectMapper;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.nio.file.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:output-picker;DB_CLOSE_DELAY=-1", "spring.jpa.show-sql=false"})
class ComfyOutputTests {
    @TempDir static Path directory;
    @DynamicPropertySource static void paths(DynamicPropertyRegistry properties) {
        properties.add("comfyui.output.path", () -> directory.resolve("output").toString());
        properties.add("pose.upload.path", () -> directory.resolve("uploads").toString());
    }
    @Autowired WebApplicationContext context;
    @Autowired ObjectMapper mapper;
    @Autowired PoseRepository poses;
    @Autowired ComfyOutputService output;
    MockMvc mvc;
    Path root;
    @BeforeEach void setup() throws Exception {
        root=directory.resolve("output"); Files.createDirectories(root);
        try(var files=Files.walk(root)) {
            for (Path path:files.sorted(java.util.Comparator.reverseOrder()).toList()) if(!path.equals(root)) Files.delete(path);
        }
        poses.deleteAll(); mvc=MockMvcBuilders.webAppContextSetup(context).build();
    }
    void png(Path path) throws Exception { ImageIO.write(new BufferedImage(512,256,BufferedImage.TYPE_INT_RGB),"png",path.toFile()); }

    @Test void foldersAreSeparateAndCountBrowsableImmediateContents() throws Exception {
        Path parent = Files.createDirectory(root.resolve("Parent"));
        Files.createDirectory(parent.resolve("Child"));
        png(parent.resolve("one.png")); Files.writeString(parent.resolve("two.mp4"), "video");
        Files.writeString(parent.resolve("private.txt"), "excluded");
        Files.createDirectory(root.resolve("Empty"));
        mvc.perform(get("/api/poses/output-images").param("sort", "name"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.entries.length()").value(0))
                .andExpect(jsonPath("$.folders.length()").value(2))
                .andExpect(jsonPath("$.folders[0].name").value("Empty"))
                .andExpect(jsonPath("$.folders[0].contentCount").value(0))
                .andExpect(jsonPath("$.folders[1].contentCount").value(3));
        mvc.perform(get("/api/poses/output-images").param("folder", "Parent"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.folders[0].name").value("Child"))
                .andExpect(jsonPath("$.folders[0].contentCount").value(0))
                .andExpect(jsonPath("$.entries.length()").value(2));
    }

    @Test void sortsAndFiltersBeforePagination() throws Exception {
        Files.createDirectory(root.resolve("nested"));
        for (int i = 0; i < 40; i++) Files.writeString(root.resolve(String.format("clip-%02d.mp4", i)), "video");
        png(root.resolve("a.png")); png(root.resolve("z.png"));
        mvc.perform(get("/api/poses/output-images").param("sort", "name-desc").param("media", "image"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.entries.length()").value(2))
                .andExpect(jsonPath("$.folders[0].directory").value(true))
                .andExpect(jsonPath("$.entries[0].name").value("z.png"))
                .andExpect(jsonPath("$.totalMedia").value(2)).andExpect(jsonPath("$.mediaOffset").value(0))
                .andExpect(jsonPath("$.hasMore").value(false));
        mvc.perform(get("/api/poses/output-images").param("sort", "name").param("media", "video").param("page", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.entries.length()").value(4))
                .andExpect(jsonPath("$.entries[0].name").value("clip-36.mp4"))
                .andExpect(jsonPath("$.totalMedia").value(40)).andExpect(jsonPath("$.mediaOffset").value(36));
        var countResponse = mvc.perform(get("/api/poses/output-images").param("media", "video")
                .param("timeZone", "America/Chicago")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long count = 0;
        for (var dayCount : mapper.readTree(countResponse).path("dayCounts")) count += dayCount.asLong();
        assertEquals(40, count);
        mvc.perform(get("/api/poses/output-images").param("timeZone", "invalid")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/poses/output-images").param("media", "invalid")).andExpect(status().isBadRequest());
    }

    @Test void supportsBothDateSortDirections() throws Exception {
        png(root.resolve("a.png")); png(root.resolve("z.png"));
        Files.setLastModifiedTime(root.resolve("a.png"), java.nio.file.attribute.FileTime.fromMillis(1000));
        Files.setLastModifiedTime(root.resolve("z.png"), java.nio.file.attribute.FileTime.fromMillis(2000));
        mvc.perform(get("/api/poses/output-images").param("sort", "modified"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.entries[0].name").value("z.png"));
        mvc.perform(get("/api/poses/output-images").param("sort", "modified-asc"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.entries[0].name").value("a.png"));
        for (String sort : java.util.List.of("created", "created-asc")) {
            var response = mvc.perform(get("/api/poses/output-images").param("sort", sort))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
            var entries = mapper.readTree(response).path("entries");
            long first = entries.get(0).path("created").asLong(), second = entries.get(1).path("created").asLong();
            assertTrue(sort.equals("created") ? first >= second : first <= second);
        }
    }

    @Test void listsOutputFoldersWithPaginationAndServesMobileThumbnails() throws Exception {
        Files.createDirectory(root.resolve("nested"));
        png(root.resolve("nested/image.png"));
        for(int i=0;i<40;i++) Files.writeString(root.resolve("image-"+i+".png"),"fixture");
        Files.writeString(root.resolve("private.txt"),"not an image");
        mvc.perform(get("/api/poses/output-images"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.entries.length()").value(36))
                .andExpect(jsonPath("$.hasMore").value(true)).andExpect(jsonPath("$.folders[0].directory").value(true));
        mvc.perform(get("/api/poses/output-images").param("page","1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.entries.length()").value(4));
        mvc.perform(get("/api/poses/output-images").param("folder","nested"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.entries[0].path").value("nested/image.png"));
        var response=mvc.perform(get("/api/poses/output-image").param("path","nested/image.png").param("thumbnail","true"))
                .andExpect(status().isOk()).andExpect(content().contentType("image/jpeg")).andReturn().getResponse();
        var thumbnail=ImageIO.read(new java.io.ByteArrayInputStream(response.getContentAsByteArray()));
        assertEquals(256,thumbnail.getWidth()); assertEquals(128,thumbnail.getHeight());
    }

    @Test void selectionIsCopiedAsDefaultOnAddAndEditWithoutLosingExistingPreviews() throws Exception {
        png(root.resolve("one.png")); png(root.resolve("two.png"));
        String json=mvc.perform(multipart("/api/poses").param("name","Pose").param("outputImage","one.png"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        var initial=mapper.readTree(json); long id=initial.get("id").asLong();
        String first=initial.get("filePath").asText();
        assertTrue(first.startsWith("/uploads/pose/"));
        var request=multipart("/api/poses/"+id).param("name","Edited")
                .param("retainedImages",mapper.writeValueAsString(java.util.List.of(first))).param("outputImage","two.png");
        request.with(value->{value.setMethod("PUT");return value;});
        mvc.perform(request).andExpect(status().isOk()).andExpect(jsonPath("$.images.length()").value(2));
        var saved=poses.findById(id).orElseThrow();
        assertEquals(first,saved.getImages().get(1)); assertNotEquals(first,saved.getFilePath());
        assertEquals(saved.getImages().getFirst(),saved.getFilePath());
        Files.delete(root.resolve("two.png"));
        Path copy=directory.resolve("uploads").resolve(saved.getFilePath().substring("/uploads/pose/".length()));
        assertNotNull(ImageIO.read(copy.toFile()),"Saved preview survives removal of the ComfyUI output image");
    }

    @Test void largePickerThumbnailsPreserveProportionsAndNeverUpscale() throws Exception {
        ImageIO.write(new BufferedImage(2400, 1200, BufferedImage.TYPE_INT_RGB), "png", root.resolve("large.png").toFile());
        var response = mvc.perform(get("/api/poses/output-image").param("path", "large.png")
                        .param("thumbnail", "true").param("size", "1280"))
                .andExpect(status().isOk()).andReturn().getResponse();
        var image = ImageIO.read(new java.io.ByteArrayInputStream(response.getContentAsByteArray()));
        assertEquals(1280, image.getWidth());
        assertEquals(640, image.getHeight());
        png(root.resolve("small.png"));
        response = mvc.perform(get("/api/poses/output-image").param("path", "small.png")
                        .param("thumbnail", "true").param("size", "1280"))
                .andExpect(status().isOk()).andReturn().getResponse();
        image = ImageIO.read(new java.io.ByteArrayInputStream(response.getContentAsByteArray()));
        assertEquals(512, image.getWidth());
        assertEquals(256, image.getHeight());
    }

    @Test void videoFoldersHideImagesAndVideoSelectionSupportsSeekingAndSaving() throws Exception {
        Path videoFolder=Files.createDirectories(root.resolve("Video/nested"));
        Files.writeString(root.resolve("Video/clip.MP4"), "0123456789");
        png(root.resolve("Video/poster.png"));
        png(videoFolder.resolve("poster.png"));
        Files.writeString(videoFolder.resolve("clip.webm"), "webm");
        Path images=Files.createDirectories(root.resolve("Images"));
        png(images.resolve("image.png")); Files.writeString(images.resolve("hidden.mp4"), "video");
        mvc.perform(get("/api/poses/output-images").param("folder","Video"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.entries.length()").value(1))
                .andExpect(jsonPath("$.folders[0].directory").value(true))
                .andExpect(jsonPath("$.entries[0].video").value(true));
        mvc.perform(get("/api/poses/output-images").param("folder","Video/nested"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.entries.length()").value(1))
                .andExpect(jsonPath("$.entries[0].path").value("Video/nested/clip.webm"));
        mvc.perform(get("/api/poses/output-images").param("folder","Images"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.entries.length()").value(1))
                .andExpect(jsonPath("$.entries[0].video").value(false));
        mvc.perform(get("/api/poses/output-image").param("path","Video/clip.MP4").header("Range","bytes=2-5"))
                .andExpect(status().isPartialContent()).andExpect(content().contentType("video/mp4"))
                .andExpect(content().string("2345"));
        var response=mvc.perform(multipart("/api/poses").param("name","Video pose").param("outputImage","Video/clip.MP4"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.type").value("VIDEO"))
                .andReturn().getResponse().getContentAsString();
        String path=mapper.readTree(response).get("filePath").asText();
        assertTrue(path.endsWith(".mp4"));
        Path copy=directory.resolve("uploads").resolve(path.substring("/uploads/pose/".length()));
        Files.delete(root.resolve("Video/clip.MP4"));
        assertEquals("0123456789",Files.readString(copy));
        String snapshot=mvc.perform(get("/api/poses/backup/export")).andReturn().getResponse().getContentAsString();
        poses.deleteAll();
        mvc.perform(post("/api/poses/backup/import").contentType("application/json").content(snapshot))
                .andExpect(status().isOk());
        assertEquals(com.comfy.library.entity.PoseType.VIDEO,poses.findAll().getFirst().getType());
        assertEquals(path,poses.findAll().getFirst().getFilePath());
    }

    @Test void traversalUnsupportedMissingAndOversizedFilesCannotBeImported() throws Exception {
        Files.writeString(root.resolve("private.txt"),"private");
        for(String path:java.util.List.of("../private.txt","missing.png","private.txt")) {
            mvc.perform(multipart("/api/poses").param("name","Bad").param("outputImage",path))
                    .andExpect(status().is4xxClientError());
            mvc.perform(get("/api/poses/output-image").param("path",path)).andExpect(status().is4xxClientError());
        }
        mvc.perform(get("/api/poses/output-images").param("folder","..")).andExpect(status().isBadRequest());
        Path large=root.resolve("large.png");
        try(var file=java.nio.channels.FileChannel.open(large,StandardOpenOption.CREATE,StandardOpenOption.WRITE)) {
            file.position(26L*1024*1024); file.write(java.nio.ByteBuffer.wrap(new byte[]{0}));
        }
        mvc.perform(multipart("/api/poses").param("name","Bad").param("outputImage","large.png"))
                .andExpect(status().isBadRequest());
        assertEquals(0,poses.count());
    }
}
