package com.citymap.repository;

import com.citymap.model.Component;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.*;

@Repository
public class ComponentRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public ComponentRepository(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    private Component mapRow(java.sql.ResultSet rs, int i) throws java.sql.SQLException {
        Component c = new Component();
        c.id = rs.getString("id");
        c.parentId = rs.getString("parent_id");
        c.name = rs.getString("name");
        c.type = rs.getString("type");
        c.level = rs.getInt("level");
        c.x = rs.getDouble("x");
        c.y = rs.getDouble("y");
        c.width = rs.getDouble("width");
        c.height = rs.getDouble("height");
        c.color = rs.getString("color");
        c.icon = rs.getString("icon");
        c.description = rs.getString("description");
        c.notes = rs.getString("notes");
        c.metadata = readJson(rs.getString("metadata"));
        String createdAt = rs.getString("created_at");
        String updatedAt = rs.getString("updated_at");
        c.createdAt = createdAt == null ? null : Instant.parse(createdAt);
        c.updatedAt = updatedAt == null ? null : Instant.parse(updatedAt);
        return c;
    }

    private final RowMapper<Component> ROW_MAPPER = this::mapRow;

    private Map<String, Object> readJson(String s) {
        if (s == null || s.isBlank()) return new LinkedHashMap<>();
        try { return mapper.readValue(s, new TypeReference<Map<String, Object>>() {}); }
        catch (Exception e) { return new LinkedHashMap<>(); }
    }

    private String writeJson(Map<String, Object> m) {
        try { return mapper.writeValueAsString(m == null ? Map.of() : m); }
        catch (Exception e) { return "{}"; }
    }

    public List<Component> findAll() {
        return jdbc.query("SELECT * FROM component ORDER BY level, name", ROW_MAPPER);
    }

    public Optional<Component> findById(String id) {
        var list = jdbc.query("SELECT * FROM component WHERE id = ?", ROW_MAPPER, id);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public List<Component> findChildren(String parentId) {
        if (parentId == null) {
            return jdbc.query("SELECT * FROM component WHERE parent_id IS NULL ORDER BY name", ROW_MAPPER);
        }
        return jdbc.query("SELECT * FROM component WHERE parent_id = ? ORDER BY name", ROW_MAPPER, parentId);
    }

    /** Full subtree rooted at (and including) rootId, BFS order. If rootId is null, returns all. */
    public List<Component> findSubtree(String rootId) {
        List<Component> all = findAll();
        if (rootId == null) return all;
        Map<String, List<Component>> byParent = new HashMap<>();
        Map<String, Component> byId = new HashMap<>();
        for (var c : all) {
            byId.put(c.id, c);
            byParent.computeIfAbsent(c.parentId, k -> new ArrayList<>()).add(c);
        }
        List<Component> out = new ArrayList<>();
        Deque<String> q = new ArrayDeque<>();
        q.add(rootId);
        while (!q.isEmpty()) {
            String id = q.poll();
            Component c = byId.get(id);
            if (c == null) continue;
            out.add(c);
            for (var child : byParent.getOrDefault(id, List.of())) q.add(child.id);
        }
        return out;
    }

    public List<Component> search(String q, String type, Integer level, int limit) {
        StringBuilder sql = new StringBuilder("SELECT * FROM component WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (q != null && !q.isBlank()) {
            sql.append(" AND (LOWER(name) LIKE ? OR LOWER(COALESCE(description,'')) LIKE ? " +
                    "OR LOWER(COALESCE(notes,'')) LIKE ? OR LOWER(COALESCE(metadata,'')) LIKE ?)");
            String needle = "%" + q.toLowerCase() + "%";
            args.add(needle); args.add(needle); args.add(needle); args.add(needle);
        }
        if (type != null && !type.isBlank()) { sql.append(" AND type = ?"); args.add(type); }
        if (level != null) { sql.append(" AND level = ?"); args.add(level); }
        sql.append(" ORDER BY level, name LIMIT ?");
        args.add(Math.max(1, Math.min(500, limit)));
        return jdbc.query(sql.toString(), ROW_MAPPER, args.toArray());
    }

    public Component insert(Component c) {
        if (c.id == null || c.id.isBlank()) c.id = UUID.randomUUID().toString();
        Instant now = Instant.now();
        c.createdAt = now; c.updatedAt = now;
        jdbc.update(
                "INSERT INTO component (id, parent_id, name, type, level, x, y, width, height, color, icon, description, notes, metadata, created_at, updated_at) " +
                        "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                c.id, c.parentId, c.name, c.type, c.level, c.x, c.y, c.width, c.height,
                c.color, c.icon, c.description, c.notes, writeJson(c.metadata),
                c.createdAt.toString(), c.updatedAt.toString());
        return c;
    }

    public Component update(Component c) {
        c.updatedAt = Instant.now();
        jdbc.update(
                "UPDATE component SET parent_id=?, name=?, type=?, level=?, x=?, y=?, width=?, height=?, " +
                        "color=?, icon=?, description=?, notes=?, metadata=?, updated_at=? WHERE id=?",
                c.parentId, c.name, c.type, c.level, c.x, c.y, c.width, c.height,
                c.color, c.icon, c.description, c.notes, writeJson(c.metadata),
                c.updatedAt.toString(), c.id);
        return c;
    }

    public int delete(String id) {
        return jdbc.update("DELETE FROM component WHERE id = ?", id);
    }

    public int updatePosition(String id, double x, double y, Double width, Double height) {
        if (width != null && height != null) {
            return jdbc.update("UPDATE component SET x=?, y=?, width=?, height=?, updated_at=? WHERE id=?",
                    x, y, width, height, Instant.now().toString(), id);
        }
        return jdbc.update("UPDATE component SET x=?, y=?, updated_at=? WHERE id=?",
                x, y, Instant.now().toString(), id);
    }

    public int reparent(String id, String newParentId) {
        return jdbc.update("UPDATE component SET parent_id=?, updated_at=? WHERE id=?",
                newParentId, Instant.now().toString(), id);
    }
}
