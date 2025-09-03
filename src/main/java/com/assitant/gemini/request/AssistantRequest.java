package com.assitant.gemini.request;

import lombok.Data;

@Data
public class AssistantRequest {
    private String content;
    private String operation;
    private String targetLanguage;
    private String rephraseTone;

    // Session tracking
    private String sessionId; // Optional session tracking

    // Metadata for better tracking
    private String sourceUrl; // URL where content was processed
    private String userAgent; // Browser info (optional)

    // Validation methods
    public boolean isValidOperation() {
        if (operation == null) return false;
        String op = operation.trim().toLowerCase();
        return op.equals("summarize-short") ||
                op.equals("summarize-detailed") ||
                op.equals("extract-takeaways") ||
                op.equals("rephrase") ||
                op.equals("translate") ||
                op.equals("to-json");
    }

    public boolean isValidForTranslation() {
        return "translate".equals(operation.trim().toLowerCase()) &&
                targetLanguage != null && !targetLanguage.trim().isEmpty();
    }

    public boolean isValidForRephrase() {
        return "rephrase".equals(operation.trim().toLowerCase()) &&
                rephraseTone != null && !rephraseTone.trim().isEmpty();
    }
}