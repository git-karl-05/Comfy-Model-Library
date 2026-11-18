package com.comfy.library;

import com.comfy.library.entity.LoraEntity;
import com.comfy.library.repository.LoraRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"spring.datasource.url=jdbc:h2:mem:notes-tests;DB_CLOSE_DELAY=-1", "spring.jpa.show-sql=false"})
class NotesImportTests {
    @Autowired WebApplicationContext context;
    @Autowired LoraRepository repository;
    @Autowired com.comfy.library.service.LoraNotesImportService notesImporter;

    @BeforeEach
    void clearModels() {
        repository.deleteAll();
    }

    @Test
    void matchesDistinctWholeWordsAndPrefersMoreSharedWords() {
        for (String name : new String[]{"Elaine illustrious", "General Knight illustrious", "General Elaine pony",
                "Shared Scarlet", "Shared Silver", "Elainette variant"}) {
            LoraEntity model = new LoraEntity();
            model.setLoraName(name);
            repository.save(model);
        }
        LoraEntity fileModel = new LoraEntity();
        fileModel.setLoraName("Other display");
        fileModel.setModelFilePath("C:/models/unique_token.safetensors");
        repository.save(fileModel);
        String notes = "Knight alternate\nTags\none word\n-----\nElaine General sketch\nTags\ntwo words\n"
                + "-----\nShared Shared alternate\nTags\ntied\n-----\nElain\nTags\nsubstring\n"
                + "-----\nToken alternate\nTags\nfilename word\n-----\nv1 by Elaine\nTags\ncreator ignored";
        var result = notesImporter.importNotes(notes);
        assertEquals(3, result.imported());
        assertEquals(3, result.failed());
        assertEquals("Multiple matching library entries", result.failures().getFirst().reason());
        assertEquals("No matching library entry", result.failures().get(1).reason());
        assertEquals("No matching library entry", result.failures().get(2).reason());
        assertEquals("two words", repository.findAll().stream().filter(model -> "General Elaine pony".equals(model.getLoraName())).findFirst().orElseThrow().getPositivePrompt());
    }

    @Test
    void failedNotesPreserveOriginalContentForCorrectionAndRetry() {
        String first = "Retry unmatched hero\nURL: https://example.com/retry\nTags for hero\n"
                + "large prompt, ".repeat(700) + "\nAdditional prompts ：\nkeep all content";
        String second = "Retry missing heading\nURL: https://example.com/missing\nwords without a heading";
        var summary = notesImporter.importNotes(first + "\n-----\n" + second);
        assertEquals(2, summary.failed());
        assertEquals(first, summary.failures().getFirst().rawNotes());
        assertEquals(second, summary.failures().get(1).rawNotes());
        LoraEntity model = new LoraEntity();
        model.setLoraName("Retry corrected hero illustrious");
        model = repository.save(model);
        String corrected = summary.failures().getFirst().rawNotes().replace("Retry unmatched hero", "Retry corrected hero");
        assertEquals(1, notesImporter.importNotes(corrected).imported());
        assertEquals(summary.failures().getFirst().positivePrompt(), repository.findById(model.getId()).orElseThrow().getPositivePrompt());
    }

    @Test
    void prefersExactMatchesThenAcceptsUniqueWholePhraseMatches() throws Exception {
        String[] names = {"General Elaine illustrious", "Exact Hero", "Exact Hero illustrious",
                "Shared Hero illustrious", "Shared Hero pony", "Lady Elainette", "File display name"};
        for (String name : names) {
            LoraEntity model = new LoraEntity();
            model.setLoraName(name);
            if (name.equals("File display name")) model.setModelFilePath("C:/models/File Hero illustrious.safetensors");
            repository.save(model);
        }
        String text = "General Elaine\nTags\nelaine prompt\n-----\nExact Hero\nTags\nexact prompt\n"
                + "-----\nShared Hero\nTags\nambiguous prompt\n-----\nElain\nTags\nwrong partial word\n"
                + "-----\nFile Hero by Creator\nTags\nfile prompt";
        var mvc = MockMvcBuilders.webAppContextSetup(context).build();
        mvc.perform(multipart("/api/loras/notes-import").file(new MockMultipartFile("file", text.getBytes(StandardCharsets.UTF_8))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.imported").value(3))
                .andExpect(jsonPath("$.failed").value(2))
                .andExpect(jsonPath("$.failures[0].reason").value("Multiple matching library entries"))
                .andExpect(jsonPath("$.failures[1].reason").value("No matching library entry"));
        assertEquals("elaine prompt", repository.findAll().stream().filter(model -> names[0].equals(model.getLoraName())).findFirst().orElseThrow().getPositivePrompt());
        assertNull(repository.findAll().stream().filter(model -> names[2].equals(model.getLoraName())).findFirst().orElseThrow().getPositivePrompt());
    }

    @Test
    void importsFullPromptsReportsFailuresAndSkipsOnRetry() throws Exception {
        LoraEntity model = new LoraEntity();
        model.setLoraName("News Live (Under Table) Straddling");
        model.setVersion("1");
        model.setNotes("Existing notes");
        model = repository.save(model);
        String prompt = "under table straddling\n\nAdditional prompts ：\n" + "long_prompt, ".repeat(700);
        String text = "-----\nNews Live (Under Table) Straddling v1 by zoca\nURL: https://example.com/model\n\nTrigger Words\n\n"
                + prompt + "\n_____\nMissing Model\nTags for xyz\nmissing prompt\n";
        var mvc = MockMvcBuilders.webAppContextSetup(context).build();
        mvc.perform(multipart("/api/loras/notes-import").file(new MockMultipartFile("file", "notes.txt", "text/plain", text.getBytes(StandardCharsets.UTF_8))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.imported").value(1))
                .andExpect(jsonPath("$.failed").value(1)).andExpect(jsonPath("$.failures[0].title").value("Missing Model"))
                .andExpect(jsonPath("$.failures[0].positivePrompt").value("missing prompt"));
        var saved = repository.findById(model.getId()).orElseThrow();
        assertEquals(prompt.strip(), saved.getPositivePrompt());
        assertEquals("Existing notes\nURL: https://example.com/model", saved.getNotes());
        mvc.perform(multipart("/api/loras/notes-import").file(new MockMultipartFile("file", text.getBytes(StandardCharsets.UTF_8))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.imported").value(0))
                .andExpect(jsonPath("$.skipped").value(1));
        assertEquals(saved.getNotes(), repository.findById(model.getId()).orElseThrow().getNotes());
    }

    @Test
    void handlesUtf16FilenamesAmbiguityAndMissingHeadings() throws Exception {
        LoraEntity model = new LoraEntity();
        model.setLoraName("A display title");
        model.setModelFilePath("C:\\models\\sample_file.safetensors");
        model = repository.save(model);
        for (int i = 0; i < 2; i++) {
            LoraEntity duplicate = new LoraEntity();
            duplicate.setLoraName("Duplicate title");
            repository.save(duplicate);
        }
        String text = "\\-----\\\nsample_file\nTaGs for example\nweighted_tag:1.2\nkeep-this_underscore\n\\_____\\\nDuplicate title\nTrigger Word(s): ambiguous\n-----\nA display title\nno heading";
        var mvc = MockMvcBuilders.webAppContextSetup(context).build();
        mvc.perform(multipart("/api/loras/notes-import").file(new MockMultipartFile("file", text.getBytes(StandardCharsets.UTF_16))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.imported").value(1))
                .andExpect(jsonPath("$.failed").value(1)).andExpect(jsonPath("$.skipped").value(1))
                .andExpect(jsonPath("$.failures[0].reason").value("Multiple matching library entries"));
        assertEquals("weighted_tag:1.2\nkeep-this_underscore", repository.findById(model.getId()).orElseThrow().getPositivePrompt());
    }
}
