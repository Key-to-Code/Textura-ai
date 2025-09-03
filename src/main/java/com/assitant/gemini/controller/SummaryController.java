package com.assitant.gemini.controller;

import com.assitant.gemini.entity.Summary;
import com.assitant.gemini.entity.User;
import com.assitant.gemini.request.AssistantRequest;
import com.assitant.gemini.response.ProcessingResponse;
import com.assitant.gemini.service.AssistantService;
import com.assitant.gemini.service.AuthService;
import com.assitant.gemini.service.SummaryService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST Controller for managing user summaries.
 * This class handles all API operations related to creating, retrieving, and deleting summaries.
 * All endpoints are secured and require a valid JWT token.
 */

@RestController
@RequestMapping("/api/summaries")
@Slf4j
public class SummaryController {

    @Autowired
    private AssistantService assistantService;

    @Autowired
    private SummaryService summaryService;

    @Autowired
    private AuthService authService;

    /**
     * Endpoint to process and save a new summary for the authenticated user.
     * Extracts the user ID from the request and delegates the processing to the assistant service.
     *
     * @param request The request body containing the content and operation.
     * @param httpRequest The incoming HTTP request.
     * @return A ResponseEntity with the processing result.
     */

    @PostMapping
    public ResponseEntity<ProcessingResponse> processSummary(@RequestBody AssistantRequest request,
                                                             HttpServletRequest httpRequest) {
        try {
            Long userId = (Long) httpRequest.getAttribute("userId");
            ProcessingResponse response = assistantService.processAndSave(request, userId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error processing summary: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(ProcessingResponse.error("Processing failed: " + e.getMessage()));
        }
    }

    /**
     * Retrieves a list of summaries for the authenticated user based on optional filters.
     * Supports filtering by operation, recency (number of days), or a search term.
     *
     * @param httpRequest The incoming HTTP request.
     * @param operation Optional query parameter to filter by operation type.
     * @param days Optional query parameter to get recent summaries.
     * @param search Optional query parameter for text-based search.
     * @return A ResponseEntity containing a list of Summary objects.
     */

    @GetMapping
    public ResponseEntity<List<Summary>> getUserSummaries(HttpServletRequest httpRequest,
                                                          @RequestParam(required = false) String operation,
                                                          @RequestParam(required = false) Integer days,
                                                          @RequestParam(required = false) String search) {
        try {
            Long userId = (Long) httpRequest.getAttribute("userId");
            User user = authService.getUserById(userId);

            List<Summary> summaries;

            if (search != null && !search.trim().isEmpty()) {
                summaries = summaryService.searchSummaries(user, search);
            } else if (operation != null && !operation.trim().isEmpty()) {
                summaries = summaryService.getUserSummariesByOperation(user, operation);
            } else if (days != null && days > 0) {
                summaries = summaryService.getRecentSummaries(user, days);
            } else {
                summaries = summaryService.getUserSummaries(user);
            }

            return ResponseEntity.ok(summaries);
        } catch (Exception e) {
            log.error("Error retrieving summaries: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Retrieves a single summary by its ID.
     *
     * @param summaryId The ID of the summary to retrieve.
     * @param httpRequest The incoming HTTP request.
     * @return A ResponseEntity with the requested Summary object or a 404 Not Found status.
     */

    @GetMapping("/{summaryId}")
    public ResponseEntity<Summary> getSummary(@PathVariable Long summaryId,
                                              HttpServletRequest httpRequest) {
        try {
            Long userId = (Long) httpRequest.getAttribute("userId");
            User user = authService.getUserById(userId);
            Summary summary = summaryService.getSummaryById(summaryId, user);
            return ResponseEntity.ok(summary);
        } catch (Exception e) {
            log.error("Error retrieving summary: {}", e.getMessage());
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Deletes a summary by its ID.
     * Ensures that only the owner of the summary can delete it.
     *
     * @param summaryId The ID of the summary to delete.
     * @param httpRequest The incoming HTTP request.
     * @return A ResponseEntity with a success message or an error message.
     */

    @DeleteMapping("/{summaryId}")
    public ResponseEntity<?> deleteSummary(@PathVariable Long summaryId,
                                           HttpServletRequest httpRequest) {
        try {
            Long userId = (Long) httpRequest.getAttribute("userId");
            User user = authService.getUserById(userId);
            summaryService.deleteSummary(summaryId, user);
            return ResponseEntity.ok(Map.of("message", "Summary deleted successfully"));
        } catch (Exception e) {
            log.error("Error deleting summary: {}", e.getMessage());
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Failed to delete summary: " + e.getMessage()));
        }
    }

    /**
     * Retrieves summary statistics for the authenticated user.
     * Includes the total number of summaries, recent summaries, username, and member since date.
     *
     * @param httpRequest The incoming HTTP request.
     * @return A ResponseEntity with a map of user statistics.
     */

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getUserStats(HttpServletRequest httpRequest) {
        try {
            Long userId = (Long) httpRequest.getAttribute("userId");
            User user = authService.getUserById(userId);

            long totalSummaries = summaryService.getUserSummaryCount(user);
            List<Summary> recentSummaries = summaryService.getRecentSummaries(user, 7);

            Map<String, Object> stats = Map.of(
                    "totalSummaries", totalSummaries,
                    "recentSummaries", recentSummaries.size(),
                    "username", user.getUsername(),
                    "memberSince", user.getCreatedAt()
            );

            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            log.error("Error retrieving user stats: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }
}