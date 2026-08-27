package com.citymap.dto;

import java.util.Map;

/** Partial-update DTO — only non-null fields are applied. Uses boxed types so 0 stays meaningful. */
public class ComponentPatch {
    public String name;
    public String type;
    public Integer level;
    public String parentId;
    public Double x;
    public Double y;
    public Double width;
    public Double height;
    public String color;
    public String icon;
    public String description;
    public String notes;
    public Map<String, Object> metadata;
}
