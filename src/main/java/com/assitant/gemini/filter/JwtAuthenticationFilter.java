package com.assitant.gemini.filter;

import com.assitant.gemini.util.JwtUtils;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;

/**
 * A Spring Security filter that intercepts incoming requests to validate and process JSON Web Tokens (JWTs).
 * This filter is responsible for authenticating a user based on a JWT found in the request's Authorization header.
 * By extending OncePerRequestFilter, it ensures that its logic is executed only once per request.
 */

@Component
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    /**
     * Injects the JwtUtils dependency, a utility class for handling JWT-related operations
     * like parsing, validating, and extracting information from tokens.
     */

    @Autowired
    private JwtUtils jwtUtils;

    /**
     * The main method of the filter that contains the authentication logic.
     * It is called for every incoming HTTP request.
     * @param request The HttpServletRequest object.
     * @param response The HttpServletResponse object.
     * @param filterChain The FilterChain object to pass the request to the next filter.
     * @throws ServletException If a servlet-specific error occurs.
     * @throws IOException If an I/O error occurs.
     */

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        try {
            // 1. Attempt to parse the JWT from the Authorization header of the request.
            String jwt = parseJwt(request);
            // 2. If a JWT is found, and it's valid, proceed with authentication.
            if (jwt != null && jwtUtils.validateJwtToken(jwt)) {
                // 3. Extract the username and userId from the validated JWT.
                String username = jwtUtils.getUsernameFromJwtToken(jwt);
                Long userId = jwtUtils.getUserIdFromJwtToken(jwt);
                // 4. Create an authentication token. Since this is JWT-based authentication,
                // the password is not needed, and authorities (roles) are initially empty.
                UsernamePasswordAuthenticationToken authentication =
                        new UsernamePasswordAuthenticationToken(username, null, new ArrayList<>());
                // 5. Build and set additional authentication details, such as remote address and session ID.
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                // 6. Store user details in the request attributes for easy access by controllers or services.
                request.setAttribute("userId", userId);
                request.setAttribute("username", username);
                // 7. Set the authentication object in the SecurityContextHolder.
                // This is the key step that tells Spring Security the user is authenticated for the current request.
                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        } catch (Exception e) {
            log.error("Cannot set user authentication: {}", e.getMessage());
        }
        // 8. Continue the filter chain. The request will proceed to the next filter or the target controller.
        filterChain.doFilter(request, response);
    }

    private String parseJwt(HttpServletRequest request) {
        String headerAuth = request.getHeader("Authorization");

        if (StringUtils.hasText(headerAuth) && headerAuth.startsWith("Bearer ")) {
            return headerAuth.substring(7);
        }

        return null;
    }
}