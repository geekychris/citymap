package com.citymap.controller;

import com.citymap.model.Component;
import com.citymap.model.Connection;
import com.citymap.repository.ComponentRepository;
import com.citymap.repository.ConnectionRepository;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ImportExportController {

    private final ComponentRepository components;
    private final ConnectionRepository connections;

    public ImportExportController(ComponentRepository components, ConnectionRepository connections) {
        this.components = components;
        this.connections = connections;
    }

    @GetMapping("/export")
    public Map<String, Object> export() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("version", 1);
        out.put("components", components.findAll());
        out.put("connections", connections.findAll());
        return out;
    }

    /**
     * Bulk import. Replaces nothing unless the caller sets ?replace=true.
     * Otherwise, inserts everything with new IDs and preserves parent relationships via id mapping.
     */
    @PostMapping("/import")
    public Map<String, Object> importCity(
            @RequestBody Payload payload,
            @RequestParam(value = "replace", defaultValue = "false") boolean replace) {
        int comps = 0, conns = 0;
        if (replace) {
            for (var c : components.findAll()) components.delete(c.id);
        }
        Map<String, String> idMap = new LinkedHashMap<>();
        if (payload.components != null) {
            for (Component c : payload.components) {
                String oldId = c.id;
                c.id = null;
                if (c.parentId != null) c.parentId = idMap.getOrDefault(c.parentId, c.parentId);
                Component saved = components.insert(c);
                if (oldId != null) idMap.put(oldId, saved.id);
                comps++;
            }
        }
        if (payload.connections != null) {
            for (Connection cn : payload.connections) {
                cn.id = null;
                cn.sourceId = idMap.getOrDefault(cn.sourceId, cn.sourceId);
                cn.targetId = idMap.getOrDefault(cn.targetId, cn.targetId);
                connections.insert(cn);
                conns++;
            }
        }
        return Map.of("componentsImported", comps, "connectionsImported", conns);
    }

    public static class Payload {
        public java.util.List<Component> components;
        public java.util.List<Connection> connections;
    }
}
