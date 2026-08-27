package com.citymap.controller;

import com.citymap.model.Component;
import com.citymap.service.ComponentService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/search")
public class SearchController {

    private final ComponentService svc;

    public SearchController(ComponentService svc) { this.svc = svc; }

    @GetMapping
    public List<Component> search(
            @RequestParam(value = "q", required = false) String q,
            @RequestParam(value = "type", required = false) String type,
            @RequestParam(value = "level", required = false) Integer level,
            @RequestParam(value = "limit", defaultValue = "50") int limit) {
        return svc.search(q, type, level, limit);
    }
}
