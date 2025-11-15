package com.assitant.gemini.service;

import com.assitant.gemini.dto.*;
import com.assitant.gemini.entity.User;
import com.assitant.gemini.repository.UserRepository;
import com.assitant.gemini.security.UserDetailsImpl;
import com.assitant.gemini.util.JwtUtils;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Service class for all authentication-related business logic.
 * Handles user registration, login, and security features like account lockout.
 */

@Service  // Marks this class as a Spring service.
@Slf4j    // Provides a logger instance named 'log'.
public class AuthService {

    // Dependency injection of repository, password encoder, JWT utility, and authentication manager.
    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private AuthenticationManager authenticationManager;

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int LOCKOUT_DURATION_MINUTES = 30;


    // Password validation pattern: at least 8 characters, with at least one lowercase,
    // one uppercase, one number, and one special character.
    private static final Pattern PASSWORD_PATTERN = Pattern.compile(
            "^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?]).{8,}$"
    );

    /**
     * Authenticates a user and generates a JWT token upon successful login.
     * This method also handles account lockout for multiple failed attempts.
     *
     * @param loginRequest The login request containing username and password.
     * @return A JwtResponse with the generated token and user details.
     * @throws RuntimeException if authentication fails or the account is locked.
     */

    @Transactional
    public JwtResponse authenticateUser(LoginRequest loginRequest) {
        try {
            // Check if user exists and handle account locking
            Optional<User> userOptional = userRepository.findByUsername(loginRequest.getUsername());
            if (userOptional.isPresent()) {
                User user = userOptional.get();

                // Check if account is locked
                if (user.isAccountLocked()) {
                    log.warn("Login attempt on locked account: {}", loginRequest.getUsername());
                    throw new RuntimeException("Account is temporarily locked due to multiple failed login attempts. Please try again later.");
                }
            }

            // Authenticate user with Spring Security
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            loginRequest.getUsername(),
                            loginRequest.getPassword())
            );

            SecurityContextHolder.getContext().setAuthentication(authentication);
            UserDetailsImpl userPrincipal = (UserDetailsImpl) authentication.getPrincipal();

            // Reset failed login attempts on successful login
            if (userOptional.isPresent()) {
                User user = userOptional.get();
                user.resetFailedLoginAttempts();
                userRepository.save(user);
            }

            String jwt = jwtUtils.generateJwtToken(userPrincipal.getUsername(), userPrincipal.getId());

            log.info("User authenticated successfully: {}", loginRequest.getUsername());

            return new JwtResponse(jwt, userPrincipal.getId(), userPrincipal.getUsername(), userPrincipal.getEmail());

        } catch (AuthenticationException e) {
            // Handle failed login attempt
            handleFailedLogin(loginRequest.getUsername());
            log.error("Authentication failed for user: {}", loginRequest.getUsername());
            throw new RuntimeException("Invalid username or password");
        }
    }

    /**
     * Registers a new user account.
     * Performs input validation and checks for existing users before saving.
     *
     * @param registerRequest The registration request containing user details.
     * @return A MessageResponse indicating successful registration.
     * @throws RuntimeException if validation fails or the user/email already exists.
     */

    @Transactional
    public MessageResponse registerUser(RegisterRequest registerRequest) {
        // Validate input
        validateRegistrationInput(registerRequest);

        if (userRepository.existsByUsername(registerRequest.getUsername().trim())) {
            throw new RuntimeException("Username is already taken!");
        }

        if (userRepository.existsByEmail(registerRequest.getEmail().trim().toLowerCase())) {
            throw new RuntimeException("Email is already in use!");
        }

        // Create user with hashed password
        User user = new User();
        user.setUsername(registerRequest.getUsername().trim());
        user.setEmail(registerRequest.getEmail().trim().toLowerCase());
        user.setPassword(passwordEncoder.encode(registerRequest.getPassword()));

        userRepository.save(user);

        log.info("User registered successfully: {}", registerRequest.getUsername());
        return new MessageResponse("User registered successfully!");
    }

    /**
     * Retrieves a User entity by its ID.
     *
     * @param userId The ID of the user.
     * @return The User entity.
     * @throws RuntimeException if the user is not found.
     */

    public User getUserById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found with id: " + userId));
    }

    /**
     * Retrieves a User entity by its username.
     *
     * @param username The username of the user.
     * @return The User entity.
     * @throws RuntimeException if the user is not found.
     */

    public User getUserByUsername(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found with username: " + username));
    }

    /**
     * Private helper method to handle a failed login attempt.
     * It increments the failed attempt counter and locks the account if the
     * threshold is reached.
     *
     * @param username The username of the user who failed to log in.
     */

    @Transactional
    private void handleFailedLogin(String username) {
        Optional<User> userOptional = userRepository.findByUsername(username);
        if (userOptional.isPresent()) {
            User user = userOptional.get();
            user.incrementFailedLoginAttempts();

            if (user.getFailedLoginAttempts() >= MAX_FAILED_ATTEMPTS) {
                user.lockAccount(LOCKOUT_DURATION_MINUTES);
                log.warn("Account locked due to {} failed login attempts: {}",
                        MAX_FAILED_ATTEMPTS, username);
            }

            userRepository.save(user);
        }
    }

    /**
     * Private helper method to validate the fields of a registration request.
     * Throws a RuntimeException if any validation rule is not met.
     */

    private void validateRegistrationInput(RegisterRequest request) {
        if (request.getUsername() == null || request.getUsername().trim().length() < 3) {
            throw new RuntimeException("Username must be at least 3 characters long");
        }

        if (request.getUsername().trim().length() > 50) {
            throw new RuntimeException("Username must not exceed 50 characters");
        }

        if (!request.getUsername().matches("^[a-zA-Z0-9_.-]+$")) {
            throw new RuntimeException("Username can only contain letters, numbers, dots, dashes, and underscores");
        }

        if (request.getEmail() == null || !isValidEmail(request.getEmail())) {
            throw new RuntimeException("Invalid email format");
        }

        if (request.getPassword() == null || request.getPassword().length() < 8) {
            throw new RuntimeException("Password must be at least 8 characters long");
        }

        if (!PASSWORD_PATTERN.matcher(request.getPassword()).matches()) {
            throw new RuntimeException("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character");
        }
    }

    /**
     * Private helper method to validate email format.
     */

    private boolean isValidEmail(String email) {
        return email != null &&
                email.length() <= 100 &&
                email.matches("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");
    }
}