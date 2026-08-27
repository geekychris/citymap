package com.citymap.service;

import com.citymap.dto.ComponentPatch;
import com.citymap.model.Component;
import com.citymap.repository.ComponentRepository;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class ComponentService {

    private final ComponentRepository repo;

    private static final Map<Integer, String> DEFAULT_TYPES = Map.of(
            0, "CITY", 1, "DISTRICT", 2, "NEIGHBORHOOD", 3, "BUILDING", 4, "ROOM"
    );

    private static final Map<Integer, String> DEFAULT_COLORS = Map.of(
            0, "#0f172a", 1, "#1e40af", 2, "#0369a1", 3, "#0891b2", 4, "#0d9488"
    );

    public ComponentService(ComponentRepository repo) { this.repo = repo; }

    public List<Component> findAll() { return repo.findAll(); }
    public Optional<Component> findById(String id) { return repo.findById(id); }
    public List<Component> findChildren(String parentId) { return repo.findChildren(parentId); }
    public List<Component> findSubtree(String rootId) { return repo.findSubtree(rootId); }
    public List<Component> search(String q, String type, Integer level, int limit) {
        return repo.search(q, type, level, limit);
    }

    public Component create(Component c) {
        if (c.parentId != null) {
            Component parent = repo.findById(c.parentId).orElseThrow(
                    () -> new IllegalArgumentException("parent not found: " + c.parentId));
            if (c.level <= 0) c.level = parent.level + 1;
        }
        if (c.type == null || c.type.isBlank()) {
            c.type = DEFAULT_TYPES.getOrDefault(c.level, "ROOM");
        }
        if (c.color == null || c.color.isBlank()) {
            c.color = DEFAULT_COLORS.getOrDefault(c.level, "#64748b");
        }
        if (c.name == null || c.name.isBlank()) c.name = "Untitled";
        return repo.insert(c);
    }

    public Component update(String id, ComponentPatch patch) {
        Component existing = repo.findById(id).orElseThrow(
                () -> new NoSuchElementException("component not found: " + id));
        if (patch.name != null) existing.name = patch.name;
        if (patch.type != null) existing.type = patch.type;
        if (patch.level != null) existing.level = patch.level;
        if (patch.parentId != null) existing.parentId = patch.parentId.isEmpty() ? null : patch.parentId;
        if (patch.color != null) existing.color = patch.color;
        if (patch.icon != null) existing.icon = patch.icon;
        if (patch.description != null) existing.description = patch.description;
        if (patch.notes != null) existing.notes = patch.notes;
        if (patch.metadata != null) existing.metadata = patch.metadata;
        if (patch.x != null) existing.x = patch.x;
        if (patch.y != null) existing.y = patch.y;
        if (patch.width != null) existing.width = patch.width;
        if (patch.height != null) existing.height = patch.height;
        return repo.update(existing);
    }

    public void delete(String id) { repo.delete(id); }

    public void updatePosition(String id, double x, double y, Double w, Double h) {
        repo.updatePosition(id, x, y, w, h);
    }

    public void reparent(String id, String newParentId) {
        if (Objects.equals(id, newParentId))
            throw new IllegalArgumentException("cannot reparent to self");
        if (newParentId != null && isDescendant(id, newParentId))
            throw new IllegalArgumentException("cannot reparent into own subtree");
        repo.reparent(id, newParentId);
    }

    private boolean isDescendant(String ancestorId, String candidateId) {
        var subtreeIds = repo.findSubtree(ancestorId).stream().map(c -> c.id).toList();
        return subtreeIds.contains(candidateId);
    }
}
