package com.assitant.gemini.controller;

import com.assitant.gemini.dto.*;
import com.assitant.gemini.service.AuthService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST Controller for handling authentication-related requests.
 * This includes user login and registration.
 * All endpoints under this controller are publicly accessible.
 */

@RestController  // Marks this class as a REST controller.
@RequestMapping("/api/auth")
@Slf4j // Provides a logger instance named 'log'.
public class AuthController {

    @Autowired
    private AuthService authService;
    /**
     * Handles user login requests.
     * This method takes a LoginRequest object from the request body,
     * authenticates the user using the AuthService, and returns a JWT token.
     *
     * @param loginRequest The request body containing the user's username and password.
     * @return A ResponseEntity with a JwtResponse on success or an error message on failure.
     */
    @PostMapping("/login")
    public ResponseEntity<?> authenticateUser(@RequestBody LoginRequest loginRequest) {
        try {
            JwtResponse jwtResponse = authService.authenticateUser(loginRequest);
            return ResponseEntity.ok(jwtResponse);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Error: " + e.getMessage()));
        }
    }
    /**
     * Handles new user registration requests.
     * This method takes a RegisterRequest object and attempts to create a new user account.
     *
     * @param registerRequest The request body containing user registration details.
     * @return A ResponseEntity with a success message or an error message if registration fails.
     */
    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody RegisterRequest registerRequest) {
        try {
            MessageResponse response = authService.registerUser(registerRequest);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Error: " + e.getMessage()));
        }
    }
}