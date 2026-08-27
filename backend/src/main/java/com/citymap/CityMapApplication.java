package com.citymap;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ScriptUtils;

import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;

@SpringBootApplication(exclude = { FlywayAutoConfiguration.class })
public class CityMapApplication {

    public static void main(String[] args) {
        SpringApplication.run(CityMapApplication.class, args);
    }

    @Bean
    SchemaInitializer schemaInitializer(DataSource ds, JdbcTemplate jdbc) {
        return new SchemaInitializer(ds, jdbc);
    }

    /** Applies db/migration/V1__schema.sql once. Simple, idempotent (CREATE IF NOT EXISTS). */
    public static class SchemaInitializer {
        private final DataSource ds;
        private final JdbcTemplate jdbc;
        public SchemaInitializer(DataSource ds, JdbcTemplate jdbc) { this.ds = ds; this.jdbc = jdbc; }
        @PostConstruct
        public void init() throws Exception {
            try (var conn = ds.getConnection()) {
                ScriptUtils.executeSqlScript(conn, new org.springframework.core.io.support.EncodedResource(
                        new ClassPathResource("db/migration/V1__schema.sql"), StandardCharsets.UTF_8));
            }
        }
    }
}
