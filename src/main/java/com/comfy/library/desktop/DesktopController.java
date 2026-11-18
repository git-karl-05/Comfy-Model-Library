package com.comfy.library.desktop;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.net.*;
import java.nio.file.*;
import java.util.*;

@RestController
@RequestMapping("/api/desktop")
@ConditionalOnProperty(name = "comfy.desktop", havingValue = "true")
public class DesktopController {
    private void local(HttpServletRequest r) throws Exception {
        String origin = r.getHeader("Origin");
        boolean validOrigin = origin == null || origin.equals(r.getScheme() + "://" + r.getHeader("Host"));
        if (!InetAddress.getByName(r.getRemoteAddr()).isLoopbackAddress()
                || !Set.of("localhost", "127.0.0.1", "::1").contains(r.getServerName()) || !validOrigin)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Application settings are available only on this computer.");
    }
    @GetMapping
    public Properties get(HttpServletRequest r) throws Exception { local(r); return DesktopSettings.load(); }
    @PostMapping("/action/{action}")
    public Map<String, String> action(@PathVariable String action, HttpServletRequest r) throws Exception {
        local(r);
        if (action.equals("choose-output")) {
            var selected = new java.util.concurrent.atomic.AtomicReference<String>("");
            javax.swing.SwingUtilities.invokeAndWait(() -> {
                var picker = new javax.swing.JFileChooser();
                picker.setFileSelectionMode(javax.swing.JFileChooser.DIRECTORIES_ONLY);
                if (picker.showOpenDialog(null) == javax.swing.JFileChooser.APPROVE_OPTION) selected.set(picker.getSelectedFile().getAbsolutePath());
            });
            return Map.of("path", selected.get());
        }
        if (!Set.of("data", "logs").contains(action)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown action");
        Path folder = DesktopSettings.HOME.resolve(action); Files.createDirectories(folder);
        java.awt.Desktop.getDesktop().open(folder.toFile()); return Map.of("status", "opened");
    }
    @PostMapping
    public Properties save(@RequestBody Map<String, String> values, HttpServletRequest r) throws Exception {
        local(r);
        int port;
        try { port = Integer.parseInt(values.getOrDefault("port", "8080")); }
        catch (NumberFormatException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid port"); }
        if (port < 1024 || port > 65535) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Port must be 1024-65535");
        String output = values.getOrDefault("output", "").trim();
        if (!output.isBlank() && !Files.isDirectory(Path.of(output))) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Output folder does not exist");
        Properties p = DesktopSettings.load();
        for (String key : List.of("lan", "autoStart", "openBrowser")) p.setProperty(key, String.valueOf(Boolean.parseBoolean(values.get(key))));
        p.setProperty("port", String.valueOf(port)); p.setProperty("output", output);
        String executable = System.getProperty("jpackage.app-path");
        if (executable == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "Startup settings require the installed application");
        String runKey = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
        Process process;
        if (Boolean.parseBoolean(p.getProperty("autoStart")))
            process = new ProcessBuilder("reg.exe", "add", runKey, "/v", "ComfyLibrary", "/t", "REG_SZ", "/d", "\"" + executable + "\" --startup", "/f").redirectErrorStream(true).start();
        else {
            var query = new ProcessBuilder("reg.exe", "query", runKey, "/v", "ComfyLibrary").redirectErrorStream(true).start();
            query.getInputStream().readAllBytes();
            process = query.waitFor() == 0 ? new ProcessBuilder("reg.exe", "delete", runKey, "/v", "ComfyLibrary", "/f").redirectErrorStream(true).start() : null;
        }
        if (process != null) { process.getInputStream().readAllBytes(); if (process.waitFor() != 0) throw new IllegalStateException("Unable to update Windows startup"); }
        DesktopSettings.save(p); return p;
    }
}
