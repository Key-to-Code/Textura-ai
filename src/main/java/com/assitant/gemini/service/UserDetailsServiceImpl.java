package com.assitant.gemini.service;

import com.assitant.gemini.entity.User;
import com.assitant.gemini.repository.UserRepository;
import com.assitant.gemini.security.UserDetailsImpl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
/**
 * Custom implementation of Spring Security's UserDetailsService interface.
 * This class is responsible for loading user-specific data during the authentication process.
 */

@Service   // Marks this class as a Spring service component.
@Slf4j     // Provides a logger instance for this class.
public class UserDetailsServiceImpl implements UserDetailsService {

    @Autowired
    private UserRepository userRepository;

    /**
     * Locates the user based on the username.
     * This method is a core part of Spring Security's authentication flow.
     * It is automatically called by the AuthenticationManager during the login process.
     *
     * @param username The username to search for.
     * @return A fully populated UserDetails object.
     * @throws UsernameNotFoundException if the user is not found in the database.
     */

    @Override
    @Transactional
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> {
                    log.error("User not found with username: {}", username);
                    return new UsernameNotFoundException("User Not Found: " + username);
                });
        // Build and return a custom UserDetails object containing user information.
        log.debug("User found: {}", username);
        return UserDetailsImpl.build(user);
    }
}