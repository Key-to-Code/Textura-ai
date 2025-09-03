package com.assitant.gemini.dto;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class JwtResponse {
    private String token;
    private String type = "Bearer";
    private Long userId;
    private String username;
    private String email;

    public JwtResponse(String accessToken, Long userId, String username, String email) {
        this.token = accessToken;
        this.userId = userId;
        this.username = username;
        this.email = email;
    }
}