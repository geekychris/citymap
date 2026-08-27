package com.citymap.controller;

import com.citymap.dto.ComponentPatch;
import com.citymap.dto.PositionUpdate;
import com.citymap.dto.ReparentRequest;
import com.citymap.model.Component;
import com.citymap.service.ComponentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/components")
public class ComponentController {

    private final ComponentService svc;

    public ComponentController(ComponentService svc) { this.svc = svc; }

    @GetMapping
    public List<Component> list(
            @RequestParam(value = "parentId", required = false) String parentId,
            @RequestParam(value = "root", required = false) Boolean root) {
        if (Boolean.TRUE.equals(root)) return svc.findChildren(null);
        if (parentId != null) return svc.findChildren(parentId.isEmpty() ? null : parentId);
        return svc.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Component> get(@PathVariable String id) {
        return svc.findById(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/subtree")
    public List<Component> subtree(@PathVariable String id) {
        return svc.findSubtree(id);
    }

    @GetMapping("/{id}/children")
    public List<Component> children(@PathVariable String id) {
        return svc.findChildren(id);
    }

    @PostMapping
    public Component create(@RequestBody Component c) { return svc.create(c); }

    @PutMapping("/{id}")
    public Component put(@PathVariable String id, @RequestBody ComponentPatch patch) {
        return svc.update(id, patch);
    }

    @PatchMapping("/{id}")
    public Component patch(@PathVariable String id, @RequestBody ComponentPatch patch) {
        return svc.update(id, patch);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        svc.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/position")
    public ResponseEntity<Void> position(@PathVariable String id, @RequestBody PositionUpdate p) {
        svc.updatePosition(id, p.x, p.y, p.width, p.height);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/move")
    public Component move(@PathVariable String id, @RequestBody ReparentRequest r) {
        String newParent = r.parentId == null || r.parentId.isEmpty() ? null : r.parentId;
        svc.reparent(id, newParent);
        return svc.findById(id).orElseThrow();
    }
}
