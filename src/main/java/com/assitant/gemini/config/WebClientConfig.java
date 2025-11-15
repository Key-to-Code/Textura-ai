package com.assitant.gemini.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Configuration class for setting up a WebClient.Builder bean.
 * This makes a pre-configured WebClient builder available for dependency injection
 * throughout the application.
 */

@Configuration
public class WebClientConfig {

    @Bean
    public WebClient.Builder webClientBuilder() {
        return WebClient.builder();
    }
}