package com.citymap.model;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class Connection {
    public String id;
    public String sourceId;
    public String targetId;
    public String kind = "uses";
    public String label;
    public Map<String, Object> metadata;
    public Instant createdAt;
}
