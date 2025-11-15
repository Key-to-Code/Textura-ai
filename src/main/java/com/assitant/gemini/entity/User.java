package com.assitant.gemini.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Represents a user entity in the application.
 * This class is mapped to the 'users' table in the database and contains
 * user-related information, including authentication and security details.
 */

@Entity
@Table(name = "users", indexes = {
        @Index(name = "idx_username", columnList = "username"),
        @Index(name = "idx_email", columnList = "email")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 50)
    private String username;

    @Column(unique = true, nullable = false, length = 100)
    private String email;

    @Column(nullable = false, length = 255)
    private String password;

    @Column(name = "is_enabled", nullable = false)
    private Boolean enabled = true;

    @Column(name = "is_account_non_expired", nullable = false)
    private Boolean accountNonExpired = true;

    @Column(name = "is_account_non_locked", nullable = false)
    private Boolean accountNonLocked = true;

    @Column(name = "is_credentials_non_expired", nullable = false)
    private Boolean credentialsNonExpired = true;

    @Column(name = "last_login")
    private LocalDateTime lastLogin;

    @Column(name = "failed_login_attempts")
    private Integer failedLoginAttempts = 0;

    @Column(name = "account_locked_until")
    private LocalDateTime accountLockedUntil;

    // PostgreSQL handles TIMESTAMP better than DATETIME
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Summary> summaries;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (enabled == null) enabled = true;
        if (accountNonExpired == null) accountNonExpired = true;
        if (accountNonLocked == null) accountNonLocked = true;
        if (credentialsNonExpired == null) credentialsNonExpired = true;
        if (failedLoginAttempts == null) failedLoginAttempts = 0;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    // Helper methods remain the same
    public boolean isAccountLocked() {
        return accountLockedUntil != null &&
                accountLockedUntil.isAfter(LocalDateTime.now());
    }

    public void lockAccount(int minutes) {
        this.accountLockedUntil = LocalDateTime.now().plusMinutes(minutes);
        this.accountNonLocked = false;
    }

    public void unlockAccount() {
        this.accountLockedUntil = null;
        this.accountNonLocked = true;
        this.failedLoginAttempts = 0;
    }

    public void incrementFailedLoginAttempts() {
        this.failedLoginAttempts = (this.failedLoginAttempts == null ? 0 :
                this.failedLoginAttempts) + 1;
    }

    public void resetFailedLoginAttempts() {
        this.failedLoginAttempts = 0;
        this.lastLogin = LocalDateTime.now();
    }
}