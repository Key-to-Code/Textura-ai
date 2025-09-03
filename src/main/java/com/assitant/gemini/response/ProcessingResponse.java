package com.assitant.gemini.response;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProcessingResponse {
    private boolean success;
    private String message;
    private Map<String, Object> data;

    public static ProcessingResponse success(String message, Map<String, Object> data) {
        return new ProcessingResponse(true, message, data);
    }

    public static ProcessingResponse error(String message) {
        return new ProcessingResponse(false, message, null);
    }
}