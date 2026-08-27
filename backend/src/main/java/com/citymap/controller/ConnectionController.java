package com.citymap.controller;

import com.citymap.model.Connection;
import com.citymap.repository.ConnectionRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/connections")
public class ConnectionController {

    private final ConnectionRepository repo;

    public ConnectionController(ConnectionRepository repo) { this.repo = repo; }

    @GetMapping
    public List<Connection> list(@RequestParam(value = "componentId", required = false) String componentId) {
        return componentId == null ? repo.findAll() : repo.findForComponent(componentId);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Connection> get(@PathVariable String id) {
        return repo.findById(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public Connection create(@RequestBody Connection c) { return repo.insert(c); }

    @PutMapping("/{id}")
    public Connection put(@PathVariable String id, @RequestBody Connection c) {
        c.id = id;
        return repo.update(c);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        repo.delete(id);
        return ResponseEntity.noContent().build();
    }
}
