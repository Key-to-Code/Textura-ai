package com.assitant.gemini.controller;

import com.assitant.gemini.service.AssistantService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

/**
 * A simple REST controller for testing the health and connectivity of the application.
 * This class provides endpoints that are typically used by monitoring tools.
 */

@RestController
@RequestMapping("/api/test")
@Slf4j
public class TestController {

    @Autowired
    private AssistantService assistantService;

    /**
     * Endpoint to test external service connections.
     * This method checks the connectivity to the Gemini API and assumes the database is
     * connected if the application has started successfully.
     *
     * @return A ResponseEntity with a map of connection statuses.
     */


    @GetMapping("/connections")
    public ResponseEntity<Map<String, Object>> testConnections() {
        try {
            boolean geminiWorking = assistantService.testConnections();

            Map<String, Object> status = Map.of(
                    "gemini", geminiWorking,
                    "database", "Connected", // If this endpoint works, DB is connected
                    "overall", geminiWorking
            );

            return ResponseEntity.ok(status);
        } catch (Exception e) {
            // Return a 200 OK status, but with a map indicating the failure.
            // Returning 200 is a common practice for health checks to prevent false alarms
            // from monitoring systems, which might consider a 500 status as a critical
            // application crash. The actual status is in the response body.
            log.error("Connection test failed", e);
            return ResponseEntity.ok(Map.of(
                    "gemini", false,
                    "database", "Error: " + e.getMessage(),
                    "overall", false
            ));
        }
    }

    /**
     * Simple health check endpoint.
     * This method quickly responds with a status to indicate if the service is up and running.
     * It's a fundamental endpoint for load balancers and container orchestration systems.
     *
     * @return A ResponseEntity with a simple "UP" status.
     */

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "UP",
                "service", "Chrome Extension Assistant"
        ));
    }
}