package com.comfy.library.desktop;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;
import java.nio.file.*;
import java.sql.DriverManager;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class DesktopTests {
    @TempDir Path temp;
    MockHttpServletRequest request(String remote, String host) {
        var r = new MockHttpServletRequest(); r.setRemoteAddr(remote); r.setServerName(host);
        r.addHeader("Host", host); return r;
    }
    @Test void desktopSettingsRejectRemoteAndForeignOrigins() {
        var controller = new DesktopController();
        assertThrows(ResponseStatusException.class, () -> controller.get(request("192.168.1.5", "localhost")));
        assertThrows(ResponseStatusException.class, () -> controller.get(request("127.0.0.1", "attacker.example")));
        var r = request("127.0.0.1", "localhost"); r.addHeader("Origin", "https://attacker.example");
        assertThrows(ResponseStatusException.class, () -> controller.get(r));
    }
    @Test void validatesPortAndFolderBeforeChangingStartup() {
        var c = new DesktopController(); var r = request("127.0.0.1", "localhost");
        assertThrows(ResponseStatusException.class, () -> c.save(Map.of("port", "abc"), r));
        assertThrows(ResponseStatusException.class, () -> c.save(Map.of("port", "80"), r));
        assertThrows(ResponseStatusException.class, () -> c.save(Map.of("output", temp.resolve("missing").toString()), r));
    }
    @Test void importBacksUpAndPreservesDatabaseAndRejectsOverwrite() throws Exception {
        Path source = temp.resolve("project"); Files.createDirectories(source.resolve("data"));
        Path home = temp.resolve("home"); Files.createDirectories(home.resolve("data"));
        String original = "jdbc:h2:file:" + source.resolve("data/comfydb").toString().replace('\\', '/');
        try (var c = DriverManager.getConnection(original, "sa", ""); var s = c.createStatement()) {
            s.execute("CREATE TABLE sample (name VARCHAR)"); s.execute("INSERT INTO sample VALUES ('preserved')");
        }
        DesktopLauncher.importDatabase(source, home);
        try (var c = DriverManager.getConnection("jdbc:h2:file:" + home.resolve("data/comfydb").toString().replace('\\', '/'), "sa", ""); var s = c.createStatement(); var rows = s.executeQuery("SELECT name FROM sample")) {
            assertTrue(rows.next()); assertEquals("preserved", rows.getString(1));
        }
        try (var files = Files.list(home.resolve("data"))) { assertTrue(files.anyMatch(f -> f.toString().endsWith(".zip"))); }
        assertTrue(Files.exists(source.resolve("data/comfydb.mv.db")));
        assertThrows(IllegalStateException.class, () -> DesktopLauncher.importDatabase(source, home));
    }
}
