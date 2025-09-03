package com.assitant.gemini.service;

import com.assitant.gemini.entity.Summary;
import com.assitant.gemini.entity.User;
import com.assitant.gemini.request.AssistantRequest;
import com.assitant.gemini.response.GeminiResponse;
import com.assitant.gemini.response.ProcessingResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import java.util.Map;

/**
 * Service class for handling all assistant-related business logic.
 * This service communicates with the Gemini API to process content,
 * validates requests, and saves the results to the database.
 */

@Service // Marks this class as a Spring service component.
@Slf4j
public class AssistantService {

    private final String geminiApiKey;
    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    @Autowired
    private SummaryService summaryService;

    @Autowired
    private AuthService authService;

    /**
     * Constructor for AssistantService, using constructor-based dependency injection.
     * WebClient.Builder and ObjectMapper are injected as beans.
     * API URL and key are injected from application properties.
     */

    public AssistantService(WebClient.Builder webClientBuilder,
                            ObjectMapper objectMapper,
                            @Value("${gemini.api.url}") String geminiApiUrl,
                            @Value("${gemini.api.key}") String geminiApiKey) {
        this.webClient = webClientBuilder.baseUrl(geminiApiUrl).build();
        this.objectMapper = objectMapper;
        this.geminiApiKey = geminiApiKey;
    }

    /**
     * Processes a user's request by calling the Gemini API and saving the result.
     *
     * @param request The user's request containing content and operation details.
     * @param userId The ID of the authenticated user.
     * @return A ProcessingResponse object with the result of the operation.
     */

    public ProcessingResponse processAndSave(AssistantRequest request, Long userId) {
        try {
            // Step 1: Validate the incoming request data.
            validateRequest(request);

            // Step 2: Retrieve the User entity from the database.
            User user = authService.getUserById(userId);

            // Step 3: Call the private method to send the request to the Gemini API.
            String processedContent = processContent(request);

            // Step 4: Save the processed content as a new Summary record.

            Summary savedSummary = summaryService.saveSummary(user, request, processedContent);

            log.info("Content processed and saved for user: {}", user.getUsername());
            // Step 5: Prepare the success response payload.
            Map<String, Object> responseData = Map.of(
                    "summaryId", savedSummary.getId(),
                    "processedContent", processedContent,
                    "operation", request.getOperation(),
                    "userId", userId,
                    "createdAt", savedSummary.getCreatedAt()
            );

            return ProcessingResponse.success(
                    "Content processed and saved successfully!",
                    responseData
            );

        } catch (Exception e) {
            log.error("Error processing content for user {}: {}", userId, e.getMessage(), e);
            throw e;
        }
    }

    /**
     * A utility method to test the connectivity to the Gemini API.
     * Sends a simple test request to ensure the API is reachable and responding.
     * @return true if the API responds, false otherwise.
     */

    public boolean testConnections() {
        try {
            // Test Gemini API
            AssistantRequest testRequest = new AssistantRequest();
            testRequest.setContent("Test content");
            testRequest.setOperation("summarize-short");

            String testResult = processContent(testRequest);

            log.info("Gemini API connection test successful");
            return testResult != null;

        } catch (Exception e) {
            log.error("Connection test failed", e);
            return false;
        }
    }

    /**
     * Private helper method to validate the fields of an AssistantRequest.
     * Throws an IllegalArgumentException if validation fails.
     */

    private void validateRequest(AssistantRequest request) {
        if (request.getContent() == null || request.getContent().trim().isEmpty()) {
            throw new IllegalArgumentException("Content cannot be empty");
        }

        if (request.getOperation() == null || !request.isValidOperation()) {
            throw new IllegalArgumentException("Invalid operation: " + request.getOperation());
        }

        if ("translate".equals(request.getOperation().toLowerCase()) &&
                (request.getTargetLanguage() == null || request.getTargetLanguage().trim().isEmpty())) {
            throw new IllegalArgumentException("Target language is required for translation");
        }

        if ("rephrase".equals(request.getOperation().toLowerCase()) &&
                (request.getRephraseTone() == null || request.getRephraseTone().trim().isEmpty())) {
            throw new IllegalArgumentException("Rephrase tone is required for rephrasing");
        }
    }

    /**
     * Private method to handle the actual call to the Gemini API.
     * Builds the request body and sends it using WebClient.
     * @param request The AssistantRequest containing the data to be processed.
     * @return The text content extracted from the Gemini API response.
     */

    private String processContent(AssistantRequest request) {
        String prompt = buildPrompt(request);

        Map<String, Object> requestBody = Map.of(
                "contents", new Object[]{
                        Map.of("parts", new Object[]{
                                Map.of("text", prompt)
                        })
                }
        );

        try {
            // Use WebClient to make an asynchronous HTTP POST request.
            String response = webClient.post()
                    .uri(uriBuilder -> uriBuilder.queryParam("key", geminiApiKey).build())
                    .header("Content-Type", "application/json")
                    .bodyValue(requestBody)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            return extractTextFromResponse(response);
        } catch (Exception e) {
            log.error("Gemini API call failed", e);
            throw new RuntimeException("Content processing failed: " + e.getMessage(), e);
        }
    }

    /**
     * Private helper method to parse the JSON response from the Gemini API and extract the text.
     * @param response The raw JSON response string.
     * @return The extracted text content.
     */

    private String extractTextFromResponse(String response) {
        try {
            GeminiResponse geminiResponse = objectMapper.readValue(response, GeminiResponse.class);
            if (geminiResponse.getCandidates() != null && !geminiResponse.getCandidates().isEmpty()) {
                GeminiResponse.Candidate firstCandidate = geminiResponse.getCandidates().get(0);
                if (firstCandidate.getContent() != null &&
                        firstCandidate.getContent().getParts() != null &&
                        !firstCandidate.getContent().getParts().isEmpty()) {
                    return firstCandidate.getContent().getParts().get(0).getText();
                }
            }
            return "Content not found.";
        } catch (Exception e) {
            throw new RuntimeException("Error parsing Gemini API response: " + e.getMessage(), e);
        }
    }

    /**
     * Private helper method to build the AI prompt string based on the user's requested operation.
     * @param request The AssistantRequest object.
     * @return The formatted prompt string.
     */

    public String buildPrompt(AssistantRequest request) {
        StringBuilder prompt = new StringBuilder();
        switch (request.getOperation().trim().toLowerCase()) {
            case "summarize-short":
                prompt.append("Provide a clear and concise summary of the following text in one to three sentences:\n\n");
                break;
            case "summarize-detailed":
                prompt.append("Provide a detailed and comprehensive summary of the following text, including key points and supporting details:\n\n");
                break;
            case "extract-takeaways":
                prompt.append("Read the following text and extract the key takeaways. Format your response as a bulleted list:\n\n");
                break;
            case "rephrase":
                String tone = request.getRephraseTone() != null ? request.getRephraseTone().trim().toLowerCase() : "";
                if ("easy".equals(tone)) {
                    prompt.append("Simplify and rephrase the following text using easy, straightforward English:\n\n");
                } else if ("professional".equals(tone)) {
                    prompt.append("Rephrase the following text using a professional and formal tone:\n\n");
                } else if ("student-notes".equals(tone)) {
                    prompt.append("Convert the following text into concise and clear student notes, focusing on the most important information:\n\n");
                } else {
                    prompt.append("Rephrase the following text:\n\n");
                }
                break;
            case "translate":
                prompt.append("Translate the following content  word by word into ");
                prompt.append(request.getTargetLanguage());
                prompt.append(":\n\n");
                break;
            case "to-json":
                prompt.append("Convert the following content into valid JSON. Infer a suitable JSON schema based on the content and format your response as a single, valid JSON object or array of objects. Do not include any text outside the JSON block.\n\n");
                break;
            default:
                throw new IllegalArgumentException("Unknown Operation: " + request.getOperation());
        }
        prompt.append(request.getContent());
        return prompt.toString();
    }
}