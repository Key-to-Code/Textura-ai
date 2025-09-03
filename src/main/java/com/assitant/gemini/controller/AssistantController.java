package com.assitant.gemini.controller;

import com.assitant.gemini.response.ProcessingResponse;
import com.assitant.gemini.service.AssistantService;
import com.assitant.gemini.request.AssistantRequest;
import jakarta.servlet.http.HttpServletRequest;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
/*
    SLF4J is a logging facade, meaning it provides a standardized API for logging that is independent of any specific logging framework implementation.
    This allows you to write logging code that doesn't need to be changed if you decide to switch logging frameworks later (e.g., from Logback to Log4j2).
    It decouples your application from the logging library.
 */

/**
 * REST controller for handling assistant-related API requests.
 * This class exposes endpoints for content processing and health checks.
 * All endpoints under this controller are secured and require authentication.
 */

@RestController
@RequestMapping("api/assistant")
@CrossOrigin(origins = "*")
@AllArgsConstructor
@Slf4j
public class AssistantController {
    private final AssistantService assistantService;

    /**
     * Endpoint to process content submitted by a user.
     * This method expects a POST request with a JSON body containing the content to be processed.
     * It extracts user information from the JWT token and logs the operation.
     *
     * @param request The request body containing the content and operation.
     * @param httpRequest The incoming HTTP request, used to retrieve user details from the JWT filter.
     * @return A ResponseEntity with a ProcessingResponse indicating success or failure.
     */

    @PostMapping("/process")
    public ResponseEntity<ProcessingResponse> processContent(@RequestBody AssistantRequest request,
                                                             HttpServletRequest httpRequest) {
        try {
            // Get userId from JWT token (set by JwtAuthenticationFilter).
            // The JwtAuthenticationFilter populates these attributes after successful token validation.
            Long userId = (Long) httpRequest.getAttribute("userId");
            String username = (String) httpRequest.getAttribute("username");

            log.info("Processing request for operation: {} from user: {} (ID: {})",
                    request.getOperation(), username, userId);

            ProcessingResponse result = assistantService.processAndSave(request, userId);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            log.warn("Invalid request: {}", e.getMessage());
            return ResponseEntity.badRequest().body(
                    ProcessingResponse.error("Invalid request: " + e.getMessage())
            );
        } catch (Exception e) {
            log.error("Processing failed", e);
            return ResponseEntity.status(500).body(
                    ProcessingResponse.error("Processing failed. Please try again.")
            );
        }
    }
    /**
     * Endpoint to check the health and connectivity of the service.
     * @return A ResponseEntity with a ProcessingResponse indicating the health status.
     */
    @GetMapping("/test-connection")
    public ResponseEntity<ProcessingResponse> testConnection() {
        try {
            boolean isHealthy = assistantService.testConnections();
            if (isHealthy) {
                // If all connections are successful, return a 200 OK.
                return ResponseEntity.ok(
                        ProcessingResponse.success("All services connected successfully", null)
                );
            } else {
                // If a connection fails, return a 500 Internal Server Error.
                return ResponseEntity.status(500).body(
                        ProcessingResponse.error("Service connections failed")
                );
            }
        } catch (Exception e) {
            // Catches any exceptions during the health check.
            return ResponseEntity.status(500).body(
                    ProcessingResponse.error("Health check failed: " + e.getMessage())
            );
        }
    }
}