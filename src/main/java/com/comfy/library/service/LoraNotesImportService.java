package com.comfy.library.service;

import com.comfy.library.entity.LoraEntity;
import com.comfy.library.repository.LoraRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Pattern;

@Service
public class LoraNotesImportService {
    private static final Pattern SEPARATOR = Pattern.compile("^\\s*\\\\?[-_]{3,}\\\\?\\s*$");
    private static final Pattern TRIGGER = Pattern.compile("^\\s*trigger\\s+word(?:s|\\(s\\))?(?=\\s|[:：]|$)\\s*[:：]?\\s*(.*)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern TAGS = Pattern.compile("^\\s*tags\\b.*$", Pattern.CASE_INSENSITIVE);
    private final LoraRepository repository;
    private final EntityManager entityManager;
    private final TransactionTemplate transaction;

    public LoraNotesImportService(LoraRepository repository, EntityManager entityManager,
                                  PlatformTransactionManager manager) {
        this.repository = repository;
        this.entityManager = entityManager;
        this.transaction = new TransactionTemplate(manager);
    }

    public record Entry(String title, String positivePrompt, String url, String reason, String rawNotes) {
        Entry withReason(String reason) {
            return new Entry(title, positivePrompt, url, reason, rawNotes);
        }
    }
    public record Summary(int imported, int failed, int skipped, List<Entry> failures, List<Entry> existingPrompts) {}

    public Summary importNotes(String text) {
        List<LoraEntity> models = repository.findAll();
        List<Entry> failures = new ArrayList<>();
        List<Entry> skipped = new ArrayList<>();
        int imported = 0;
        for (Entry entry : parse(text)) {
            List<LoraEntity> matches = models.stream().filter(model -> matches(entry.title(), model)).toList();
            if (matches.isEmpty()) {
                Set<String> words = nameWords(entry.title());
                int bestScore = 0;
                List<LoraEntity> candidates = new ArrayList<>();
                for (LoraEntity model : models) {
                    int score = matchingWordCount(words, model);
                    if (score > bestScore) {
                        candidates.clear();
                        bestScore = score;
                    }
                    if (score > 0 && score == bestScore) candidates.add(model);
                }
                matches = candidates;
            }
            if (matches.size() != 1) {
                failures.add(entry.withReason(matches.isEmpty() ? "No matching library entry" : "Multiple matching library entries"));
                continue;
            }
            try {
                Long modelId = matches.getFirst().getId();
                String outcome = transaction.execute(status -> {
                    LoraEntity model = entityManager.find(LoraEntity.class, modelId, LockModeType.PESSIMISTIC_WRITE);
                    if (model == null) return "Library entry no longer exists";
                    entityManager.refresh(model, LockModeType.PESSIMISTIC_WRITE);
                    if (model.getPositivePrompt() != null && !model.getPositivePrompt().isBlank()) return "existing";
                    if (entry.positivePrompt().isBlank()) return "Missing trigger heading or empty prompt";
                    String notes = Objects.toString(model.getNotes(), "");
                    if (!entry.url().isBlank() && !notes.contains(entry.url())) {
                        notes = notes.isBlank() ? "URL: " + entry.url() : notes + "\nURL: " + entry.url();
                    }
                    if (notes.length() > 5000) return "Adding URL would exceed Notes capacity";
                    model.setPositivePrompt(entry.positivePrompt());
                    model.setNotes(notes);
                    model.setLastUpdated(LocalDateTime.now());
                    entityManager.flush();
                    return "imported";
                });
                if ("imported".equals(outcome)) imported++;
                else if ("existing".equals(outcome)) skipped.add(entry);
                else failures.add(entry.withReason(outcome));
            } catch (RuntimeException exception) {
                failures.add(entry.withReason("Could not save entry"));
            }
        }
        return new Summary(imported, failures.size(), skipped.size(), failures, skipped);
    }

    static List<Entry> parse(String text) {
        List<Entry> entries = new ArrayList<>();
        List<String> block = new ArrayList<>();
        for (String line : text.replace("\uFEFF", "").split("\\R", -1)) {
            if (SEPARATOR.matcher(line).matches()) {
                addBlock(entries, block);
                block.clear();
            } else block.add(line);
        }
        addBlock(entries, block);
        return entries;
    }

    private static void addBlock(List<Entry> entries, List<String> block) {
        int first = 0;
        while (first < block.size() && block.get(first).isBlank()) first++;
        if (first == block.size()) return;
        String title = block.get(first).strip();
        String url = "";
        StringBuilder prompt = new StringBuilder();
        boolean collecting = false;
        for (int i = first + 1; i < block.size(); i++) {
            String line = block.get(i);
            if (collecting) {
                prompt.append(line).append('\n');
                continue;
            }
            if (line.strip().toLowerCase(Locale.ROOT).startsWith("url:")) {
                url = line.strip().substring(4).strip();
            }
            var trigger = TRIGGER.matcher(line);
            if (trigger.matches()) {
                collecting = true;
                prompt.append(trigger.group(1)).append('\n');
            } else if (TAGS.matcher(line).matches()) collecting = true;
        }
        entries.add(new Entry(title, prompt.toString().strip(), url, "", String.join("\n", block).strip()));
    }

    private static boolean matches(String title, LoraEntity model) {
        String name = normalize(title);
        String modelName = normalize(Objects.toString(model.getLoraName(), ""));
        String path = Objects.toString(model.getModelFilePath(), "").replace('\\', '/');
        String filename = normalize(path.substring(path.lastIndexOf('/') + 1));
        if (name.equals(modelName) || (!filename.isBlank() && name.equals(filename))) return true;
        String withoutCreator = name.replaceFirst("\\s+by\\s+.+$", "");
        String version = normalize(Objects.toString(model.getVersion(), ""));
        if (!version.isBlank() && (withoutCreator.equals(modelName + " " + version)
                || withoutCreator.equals(modelName + " v" + version.replaceFirst("^v", "")))) return true;
        return withoutCreator.equals(modelName) || (!filename.isBlank() && withoutCreator.equals(filename));
    }

    private static String normalize(String value) {
        return value.strip().toLowerCase(Locale.ROOT).replaceFirst("\\.(safetensors|ckpt|pt|pth|bin)$", "").replaceAll("\\s+", " ");
    }

    private static int matchingWordCount(Set<String> words, LoraEntity model) {
        String path = Objects.toString(model.getModelFilePath(), "").replace('\\', '/');
        Set<String> modelWords = nameWords(Objects.toString(model.getLoraName(), ""));
        Set<String> fileWords = nameWords(path.substring(path.lastIndexOf('/') + 1));
        modelWords.retainAll(words);
        fileWords.retainAll(words);
        return Math.max(modelWords.size(), fileWords.size());
    }

    private static Set<String> nameWords(String name) {
        String normalized = normalize(name).replaceFirst("\\s+by\\s+.+$", "");
        Set<String> words = new HashSet<>();
        for (String word : normalized.split("[^\\p{L}\\p{N}]+")) {
            if (!word.isBlank() && !word.matches("v\\d+")) words.add(word);
        }
        return words;
    }
}
