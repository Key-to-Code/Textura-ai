package com.assitant.gemini.exceptionhandling;

import com.assitant.gemini.response.ProcessingResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

@ControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ProcessingResponse> handleIllegalArgumentException(IllegalArgumentException ex) {
        log.warn("Invalid request: {}", ex.getMessage());
        ProcessingResponse response = ProcessingResponse.error("Invalid request: " + ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ProcessingResponse> handleRuntimeException(RuntimeException ex) {
        log.error("Runtime error: {}", ex.getMessage(), ex);
        ProcessingResponse response = ProcessingResponse.error("Processing failed: " + ex.getMessage());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProcessingResponse> handleGenericException(Exception ex) {
        log.error("Unexpected error: {}", ex.getMessage(), ex);
        ProcessingResponse response = ProcessingResponse.error("An unexpected error occurred. Please try again.");
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
}