/*
    SecurityConfig, is a Spring Boot configuration file that sets up Spring Security for a REST API.
    It disables CSRF(Cross-Site Request Forgery) and configures CORS(Cross-Origin Resource Sharing),
    manages stateless sessions with JWT authentication,and defines access rules for various API endpoints.
    The class also sets up a BCrypt password encoder and an authentication provider to handle user credentials.
 */

package com.assitant.gemini.config;

import com.assitant.gemini.filter.JwtAuthenticationFilter;
import com.assitant.gemini.service.UserDetailsServiceImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)  // Enables method-level security annotations like @PreAuthorize
public class SecurityConfig {

    @Autowired
    private UserDetailsServiceImpl userDetailsService;  // Service for loading user-specific data

    @Autowired
    private JwtAuthenticationFilter jwtAuthenticationFilter;    // Custom filter to validate JWTs

    /**
     * Creates a BCryptPasswordEncoder bean for encoding and verifying passwords.
     * BCrypt is a strong hashing algorithm; a strength of 12 is recommended for security.
     * @return The PasswordEncoder instance.
     */

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12); // Strength 12 for better security
    }

    /**
     * Configures a DaoAuthenticationProvider, which fetches user details from
     * the UserDetailsServiceImpl and uses the PasswordEncoder for authentication.
     * @return The configured DaoAuthenticationProvider.
     */
    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    /**
     * Exposes the AuthenticationManager as a bean, which is used for
     * authenticating users (e.g., in a login controller).
     * @param authConfig The authentication configuration.
     * @return The AuthenticationManager.
     * @throws Exception if an error occurs during configuration.
     */

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }

    /**
     * Defines the security filter chain, which is the core of the security configuration.
     * It configures CORS, CSRF, session management, authorization rules, and adds the JWT filter.
     * @param http The HttpSecurity object to configure.
     * @return The configured SecurityFilterChain.
     * @throws Exception if an error occurs.
     */

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authz -> authz
                        // Public endpoints
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/api/test/health").permitAll()
                        .requestMatchers("/api/test/connections").permitAll()
                        // Protected endpoints
                        .requestMatchers("/api/summaries/**").authenticated()
                        .requestMatchers("/api/assistant/**").authenticated()
                        .anyRequest().authenticated()
                )
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
    /**
     * Configures and provides a CORS (Cross-Origin Resource Sharing) configuration source.
     * This bean defines which origins, methods, and headers are allowed for cross-origin requests.
     * @return The configured CorsConfigurationSource.
     */

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        // For production, specify exact origins instead of "*"
        configuration.setAllowedOriginPatterns(Arrays.asList("*"));

        // Defines the allowed HTTP methods for cross-origin requests.
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L); // Cache preflight requests for 1 hour

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        // Applies this CORS configuration to all paths ("/**").
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}