package com.assitant.gemini.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.List;

/**
 * Represents the top-level structure of a response from the Gemini API.
 * This class is designed to handle the JSON response and map it to Java objects.
 */

@Data
@JsonIgnoreProperties(ignoreUnknown = true) //It tells the deserializer to ignore any fields in the JSON payload that do not have a corresponding field in the Java class
public class GeminiResponse {
    private List<Candidate>candidates;
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Candidate{
        private Content content;
    }
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Content{
        private List<Part> parts;
    }
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Part{
        private String text;
    }
}
