package com.assitant.gemini.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;
/**
 * Represents a stored summary or content manipulation record.
 * This entity maps to the 'summaries' table in the database.
 * It's used to persist information about operations like summarization, rephrasing, or translation
 * performed on user-provided content.
 */

@Entity
@Table(name = "summaries", indexes = {
        @Index(name = "idx_user_id", columnList = "user_id"),
        @Index(name = "idx_created_at", columnList = "created_at"),
        @Index(name = "idx_operation", columnList = "operation"),
        @Index(name = "idx_user_created", columnList = "user_id, created_at")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Summary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // PostgreSQL handles TEXT type well
    @Column(columnDefinition = "TEXT", nullable = false)
    private String originalContent;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String processedContent;

    @Column(nullable = false, length = 50)
    private String operation;

    @Column(name = "target_language", length = 50)
    private String targetLanguage;

    @Column(name = "rephrase_tone", length = 50)
    private String rephraseTone;

    @Column(name = "source_url", length = 500)
    private String sourceUrl;

    @Column(name = "user_agent", length = 500)
    private String userAgent;

    @Column(name = "session_id", length = 100)
    private String sessionId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
