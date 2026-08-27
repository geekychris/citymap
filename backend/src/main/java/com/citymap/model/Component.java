package com.citymap.model;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class Component {
    public String id;
    public String parentId;
    public String name;
    public String type;         // CITY, DISTRICT, NEIGHBORHOOD, BUILDING, ROOM, or free-form
    public int level;           // L0..Ln
    public double x;
    public double y;
    public double width = 320;
    public double height = 200;
    public String color;
    public String icon;
    public String description;
    public String notes;
    public Map<String, Object> metadata;
    public Instant createdAt;
    public Instant updatedAt;
}
