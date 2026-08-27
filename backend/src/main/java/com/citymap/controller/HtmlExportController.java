package com.citymap.controller;

import com.citymap.model.Component;
import com.citymap.repository.ComponentRepository;
import com.citymap.repository.ConnectionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/export")
public class HtmlExportController {

    private final ComponentRepository components;
    private final ConnectionRepository connections;
    private final ObjectMapper mapper;

    public HtmlExportController(ComponentRepository components, ConnectionRepository connections, ObjectMapper mapper) {
        this.components = components;
        this.connections = connections;
        this.mapper = mapper;
    }

    @GetMapping(value = "/html", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> exportHtml(
            @RequestParam(value = "download", defaultValue = "false") boolean download,
            @RequestParam(value = "title", required = false) String titleOverride
    ) throws Exception {
        List<Component> comps = components.findAll();
        Component root = comps.stream().filter(c -> c.parentId == null).findFirst().orElse(null);
        String title = titleOverride != null && !titleOverride.isBlank()
                ? titleOverride
                : (root != null ? root.name : "CityMap");

        Map<String, Object> payload = Map.of(
                "components", comps,
                "connections", connections.findAll()
        );
        String json = mapper.writeValueAsString(payload)
                .replace("</", "<\\/");  // safety inside <script>

        String template = readTemplate();
        String generatedAt = Instant.now().toString().replace("T", " ").substring(0, 19) + " UTC";
        String html = template
                .replace("__CITYMAP_TITLE__", escapeHtml(title))
                .replace("__CITYMAP_COMPONENT_COUNT__", String.valueOf(comps.size()))
                .replace("__CITYMAP_CONNECTION_COUNT__", String.valueOf(connections.findAll().size()))
                .replace("__CITYMAP_GENERATED_AT__", generatedAt)
                .replace("__CITYMAP_DATA__", json);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_HTML);
        if (download) {
            String stamp = Instant.now().toString().replace(":", "-").substring(0, 19);
            headers.setContentDispositionFormData("attachment", "citymap-" + stamp + ".html");
        }
        return new ResponseEntity<>(html, headers, 200);
    }

    private String readTemplate() throws Exception {
        try (InputStream is = new ClassPathResource("export/city-template.html").getInputStream()) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private static String escapeHtml(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
