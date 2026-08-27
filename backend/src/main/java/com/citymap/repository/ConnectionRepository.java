package com.citymap.repository;

import com.citymap.model.Connection;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.*;

@Repository
public class ConnectionRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public ConnectionRepository(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    private Connection mapRow(java.sql.ResultSet rs, int i) throws java.sql.SQLException {
        Connection c = new Connection();
        c.id = rs.getString("id");
        c.sourceId = rs.getString("source_id");
        c.targetId = rs.getString("target_id");
        c.kind = rs.getString("kind");
        c.label = rs.getString("label");
        String meta = rs.getString("metadata");
        if (meta != null && !meta.isBlank()) {
            try { c.metadata = mapper.readValue(meta, new TypeReference<Map<String, Object>>() {}); }
            catch (Exception ignored) { c.metadata = new LinkedHashMap<>(); }
        }
        String createdAt = rs.getString("created_at");
        c.createdAt = createdAt == null ? null : Instant.parse(createdAt);
        return c;
    }

    private final RowMapper<Connection> ROW_MAPPER = this::mapRow;

    private String writeJson(Map<String, Object> m) {
        try { return mapper.writeValueAsString(m == null ? Map.of() : m); }
        catch (Exception e) { return "{}"; }
    }

    public List<Connection> findAll() {
        return jdbc.query("SELECT * FROM connection", ROW_MAPPER);
    }

    public List<Connection> findForComponent(String componentId) {
        return jdbc.query("SELECT * FROM connection WHERE source_id = ? OR target_id = ?",
                ROW_MAPPER, componentId, componentId);
    }

    public Optional<Connection> findById(String id) {
        var list = jdbc.query("SELECT * FROM connection WHERE id = ?", ROW_MAPPER, id);
        return list.isEmpty() ? Optional.empty() : Optional.of(list.get(0));
    }

    public Connection insert(Connection c) {
        if (c.sourceId == null || c.sourceId.isBlank())
            throw new IllegalArgumentException("sourceId is required");
        if (c.targetId == null || c.targetId.isBlank())
            throw new IllegalArgumentException("targetId is required");
        if (c.id == null || c.id.isBlank()) c.id = UUID.randomUUID().toString();
        if (c.kind == null || c.kind.isBlank()) c.kind = "uses";
        c.createdAt = Instant.now();
        jdbc.update("INSERT INTO connection (id, source_id, target_id, kind, label, metadata, created_at) " +
                        "VALUES (?,?,?,?,?,?,?)",
                c.id, c.sourceId, c.targetId, c.kind, c.label, writeJson(c.metadata), c.createdAt.toString());
        return c;
    }

    public Connection update(Connection c) {
        jdbc.update("UPDATE connection SET source_id=?, target_id=?, kind=?, label=?, metadata=? WHERE id=?",
                c.sourceId, c.targetId, c.kind, c.label, writeJson(c.metadata), c.id);
        return c;
    }

    public int delete(String id) {
        return jdbc.update("DELETE FROM connection WHERE id = ?", id);
    }
}
