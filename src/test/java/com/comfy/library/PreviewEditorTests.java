package com.comfy.library;

import com.comfy.library.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.mock.web.MockMultipartFile;
import tools.jackson.databind.*;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:preview-editor;DB_CLOSE_DELAY=-1","spring.jpa.show-sql=false"})
class PreviewEditorTests {
    @TempDir static Path directory;
    @DynamicPropertySource static void paths(DynamicPropertyRegistry properties) {
        properties.add("comfyui.output.path", () -> directory.resolve("output").toString());
        properties.add("lora.upload.path", () -> directory.resolve("lora").toString());
        properties.add("pose.upload.path", () -> directory.resolve("pose").toString());
    }
    @Autowired WebApplicationContext context;
    @Autowired ObjectMapper mapper;
    @Autowired LoraRepository loras;
    @Autowired LoraImageRepository images;
    @Autowired PoseRepository poses;
    MockMvc mvc;
    @BeforeEach void setup() throws Exception {
        images.deleteAll(); loras.deleteAll(); poses.deleteAll();
        for (String name : List.of("output","lora","pose")) {
            Path folder=directory.resolve(name); Files.createDirectories(folder);
            try (var stream=Files.list(folder)) { for (Path file:stream.toList()) Files.delete(file); }
        }
        for (String name:List.of("a.png","b.png","c.png","replacement.png"))
            ImageIO.write(new BufferedImage(8,8,BufferedImage.TYPE_INT_RGB),"png",directory.resolve("output").resolve(name).toFile());
        Files.writeString(directory.resolve("output/clip.mp4"),"test video");
        mvc=MockMvcBuilders.webAppContextSetup(context).build();
    }
    String root(boolean pose) { return pose ? "/api/poses" : "/api/loras"; }
    Map<String,Object> output(String key,String path) { return Map.of("key",key,"source","output","path",path); }
    String manifest(List<Map<String,Object>> entries,String primary) { return mapper.writeValueAsString(Map.of("entries",entries,"defaultKey",primary)); }
    MockMultipartHttpServletRequestBuilder request(boolean pose,Long id,String manifest) {
        var request=multipart(root(pose)+(id==null?"":"/"+id));
        request.param(pose?"name":"loraName","Test previews").param("category","CHARACTER").param("prompt","Keep prompt").param("previewManifest",manifest);
        if(id!=null) request.with(value->{value.setMethod("PUT");return value;});
        return request;
    }
    long create(boolean pose) throws Exception {
        return mapper.readTree(mvc.perform(request(pose,null,manifest(List.of(output("a","a.png"),output("b","b.png"),output("c","c.png")),"a")))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("id").asLong();
    }
    List<Map<String,Object>> retained(boolean pose,long id) throws Exception {
        var response=mapper.readTree(mvc.perform(get(root(pose)+"/"+id+(pose?"":"/images"))).andReturn().getResponse().getContentAsString());
        var array=pose?response.path("images"):response;
        List<Map<String,Object>> entries=new ArrayList<>();
        for(int i=0;i<array.size();i++) {
            String ref=pose?String.valueOf(i):(i==0?"primary":array.get(i).path("id").asText());
            String path=pose?array.get(i).asText():array.get(i).path("filePath").asText();
            entries.add(Map.of("key","slot-"+i,"source","existing","ref",ref,"path",path));
        }
        return entries;
    }
    List<String> stored(boolean pose,long id) throws Exception {
        return retained(pose,id).stream().map(entry->entry.get("path").toString()).toList();
    }
    long fileCount(boolean pose) throws Exception { try(var stream=Files.list(directory.resolve(pose?"pose":"lora"))) {return stream.count();} }
    @ParameterizedTest @ValueSource(booleans={false,true})
    void replacesOnlySelectedSlotAppendsAndChangesDefaultWithRoundTrip(boolean pose) throws Exception {
        long id=create(pose);
        var original=stored(pose,id);
        var list=retained(pose,id);
        list.set(1,output("slot-1","replacement.png"));
        list.add(output("new","clip.mp4"));
        mvc.perform(request(pose,id,manifest(list,"slot-0"))).andExpect(status().isOk());
        var replaced=stored(pose,id);
        assertEquals(4,replaced.size()); assertEquals(original.get(0),replaced.get(0)); assertEquals(original.get(2),replaced.get(2));
        assertNotEquals(original.get(1),replaced.get(1)); assertTrue(replaced.get(3).endsWith(".mp4"));
        assertEquals("Keep prompt",pose?poses.findById(id).orElseThrow().getPrompt():loras.findById(id).orElseThrow().getPrompt());
        list=retained(pose,id);
        mvc.perform(request(pose,id,manifest(list,"slot-3"))).andExpect(status().isOk());
        var defaults=stored(pose,id);
        assertEquals(List.of(replaced.get(3),replaced.get(0),replaced.get(1),replaced.get(2)),defaults);
        assertEquals(defaults.getFirst(),pose?poses.findById(id).orElseThrow().getFilePath():loras.findById(id).orElseThrow().getFilePath());
        if(pose) assertEquals(com.comfy.library.entity.PoseType.VIDEO,poses.findById(id).orElseThrow().getType());
        String backup=mvc.perform(get(pose?"/api/poses/backup/export":"/api/backup/export")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        if(pose) poses.deleteAll(); else {images.deleteAll();loras.deleteAll();}
        mvc.perform(post(pose?"/api/poses/backup/import":"/api/backup/import").contentType("application/json").content(backup)).andExpect(status().isOk());
        long restored=pose?poses.findAll().getFirst().getId():loras.findAll().getFirst().getId();
        assertEquals(defaults,stored(pose,restored));
        // Output sources may disappear after Save; the selected previews remain local.
        Files.delete(directory.resolve("output/clip.mp4"));
        assertTrue(Files.exists(directory.resolve(pose?"pose":"lora").resolve(Path.of(defaults.getFirst()).getFileName())));
    }
    @ParameterizedTest @ValueSource(booleans={false,true})
    void rejectsForeignReferencesMalformedManifestsAndUnsafeOutputBeforeWriting(boolean pose) throws Exception {
        long id=create(pose); var before=stored(pose,id); long count=fileCount(pose);
        var list=retained(pose,id); list.set(1,Map.of("key","slot-1","source","existing","ref","999999","path",before.get(1)));
        mvc.perform(request(pose,id,manifest(list,"slot-0"))).andExpect(status().isBadRequest());
        mvc.perform(request(pose,id,"{bad")).andExpect(status().isBadRequest());
        mvc.perform(request(pose,id,manifest(retained(pose,id),"missing"))).andExpect(status().isBadRequest());
        mvc.perform(request(pose,id,manifest(List.of(output("bad","../outside.png")),"bad"))).andExpect(status().isBadRequest());
        mvc.perform(request(pose,id,manifest(List.of(output("bad","missing.png")),"bad"))).andExpect(status().isNotFound());
        mvc.perform(request(pose,id,manifest(List.of(Map.of("key","bad","source","url","path","https://other.test/a.png")),"bad"))).andExpect(status().isBadRequest());
        assertEquals(before,stored(pose,id)); assertEquals(count,fileCount(pose));
    }
    @ParameterizedTest @ValueSource(booleans={false,true})
    void removalEmptyAndLegacySinglePreviewAreSupported(boolean pose) throws Exception {
        long id=create(pose); var list=retained(pose,id); String last=list.get(2).get("path").toString();
        mvc.perform(request(pose,id,manifest(List.of(list.get(2)),"slot-2"))).andExpect(status().isOk());
        assertEquals(List.of(last),stored(pose,id));
        mvc.perform(request(pose,id,"{\"entries\":[],\"defaultKey\":null}")).andExpect(status().isOk());
        assertTrue(stored(pose,id).isEmpty());
        assertNull(pose?poses.findById(id).orElseThrow().getFilePath():loras.findById(id).orElseThrow().getFilePath());
        assertEquals(3,fileCount(pose),"Do not physically delete files that an existing backup may reference");
    }
    @ParameterizedTest @ValueSource(booleans={false,true})
    void filePathOnlyLegacyRecordsRetainTheirPreviewWhenAnotherIsAdded(boolean pose) throws Exception {
        String path="/uploads/"+(pose?"pose":"lora")+"/legacy.png";
        long id;
        if(pose) {
            var entity=new com.comfy.library.entity.PoseEntity(); entity.setName("Legacy"); entity.setFilePath(path);
            id=poses.saveAndFlush(entity).getId();
        } else {
            var entity=new com.comfy.library.entity.LoraEntity(); entity.setLoraName("Legacy"); entity.setFilePath(path);
            id=loras.saveAndFlush(entity).getId();
        }
        var old=Map.<String,Object>of("key","legacy","source","existing","ref",pose?"0":"primary","path",path);
        mvc.perform(request(pose,id,manifest(List.of(old,output("new","a.png")),"legacy"))).andExpect(status().isOk());
        var paths=stored(pose,id); assertEquals(2,paths.size()); assertEquals(path,paths.getFirst());
    }

    @Test void mixedNativeUploadsAndOutputReferencesPreserveOrderAndRejectUnreferencedUploads() throws Exception {
        long id=create(false); var original=stored(false,id);
        var list=retained(false,id);
        list.set(1,Map.of("key","upload","source","upload","uploadIndex",0));
        list.add(output("output","clip.mp4"));
        var file=new MockMultipartFile("previewFiles","new.png","image/png",Files.readAllBytes(directory.resolve("output/a.png")));
        mvc.perform(request(false,id,manifest(list,"slot-0")).file(file)).andExpect(status().isOk());
        var result=stored(false,id);
        assertEquals(4,result.size()); assertEquals(original.get(0),result.get(0)); assertEquals(original.get(2),result.get(2));
        assertTrue(result.get(1).endsWith(".png")); assertTrue(result.get(3).endsWith(".mp4"));
        long count=fileCount(false);
        mvc.perform(request(false,id,manifest(retained(false,id),"slot-0")).file(file)).andExpect(status().isBadRequest());
        assertEquals(count,fileCount(false)); assertEquals(result,stored(false,id));
    }

    @ParameterizedTest @ValueSource(booleans={false,true})
    void fivePreviewLimitRejectsAdditionsButAllowsReplacement(boolean pose) throws Exception {
        var entries=new ArrayList<Map<String,Object>>();
        for(int i=0;i<5;i++) entries.add(output("slot-"+i,"a.png"));
        long id=mapper.readTree(mvc.perform(request(pose,null,manifest(entries,"slot-0")))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("id").asLong();
        var before=stored(pose,id); long count=fileCount(pose);
        var retained=retained(pose,id);retained.add(output("sixth","b.png"));
        mvc.perform(request(pose,id,manifest(retained,"slot-0"))).andExpect(status().isBadRequest());
        assertEquals(before,stored(pose,id));assertEquals(count,fileCount(pose));
        retained=retained(pose,id);retained.set(2,output("slot-2","replacement.png"));
        mvc.perform(request(pose,id,manifest(retained,"slot-0"))).andExpect(status().isOk());
        assertEquals(5,stored(pose,id).size());
    }

    @ParameterizedTest @ValueSource(booleans={false,true})
    void oversizedLegacyListsCanBeKeptAndReplacedWithoutAllowingFurtherGrowth(boolean pose) throws Exception {
        long id=create(pose);
        if(pose) {
            var entity=poses.findById(id).orElseThrow();
            var paths=new ArrayList<>(entity.getImages());
            paths.addAll(List.of("/uploads/pose/legacy-a.png","/uploads/pose/legacy-b.png","/uploads/pose/legacy-c.png"));
            entity.setImages(paths);poses.saveAndFlush(entity);
        } else {
            var entity=loras.findById(id).orElseThrow();
            for(String suffix:List.of("a","b","c")) images.save(new com.comfy.library.entity.LoraImageEntity("/uploads/lora/legacy-"+suffix+".png",entity));
            images.flush();
        }
        var entries=retained(pose,id);assertEquals(6,entries.size());
        entries.set(1,output("slot-1","replacement.png"));
        mvc.perform(request(pose,id,manifest(entries,"slot-0"))).andExpect(status().isOk());
        assertEquals(6,stored(pose,id).size());
        entries=retained(pose,id);entries.add(output("seventh","a.png"));
        mvc.perform(request(pose,id,manifest(entries,"slot-0"))).andExpect(status().isBadRequest());
        assertEquals(6,stored(pose,id).size());
    }

    @Test void copyFailureAndDatabaseFailureRollbackNewFilesAndPreserveRecord() throws Exception {
        long id=create(false); var before=stored(false,id); long count=fileCount(false);
        var upload1=new MockMultipartFile("previewFiles","a.png","image/png",new byte[]{1});
        var upload2=new MockMultipartFile("previewFiles","b.png","image/png",new byte[]{2}) {
            @Override public InputStream getInputStream() throws IOException { throw new IOException("Simulated copy failure"); }
        };
        String uploads=manifest(List.of(Map.of("key","u1","source","upload","uploadIndex",0),Map.of("key","u2","source","upload","uploadIndex",1)),"u1");
        assertThrows(Exception.class,()->mvc.perform(request(false,id,uploads).file(upload1).file(upload2)));
        assertEquals(before,stored(false,id)); assertEquals(count,fileCount(false));
        var bad=request(false,id,manifest(List.of(output("new","replacement.png")),"new"));
        bad.param("loraName","x".repeat(256));
        assertThrows(Exception.class,()->mvc.perform(bad));
        assertEquals(before,stored(false,id)); assertEquals(count,fileCount(false));
        assertEquals("Test previews",loras.findById(id).orElseThrow().getLoraName());
    }
}
