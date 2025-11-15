package com.assitant.gemini.repository;

import com.assitant.gemini.entity.Summary;
import com.assitant.gemini.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SummaryRepository extends JpaRepository<Summary, Long> {

    List<Summary> findByUserOrderByCreatedAtDesc(User user);

    List<Summary> findByUserAndOperationOrderByCreatedAtDesc(User user, String operation);

    @Query("SELECT s FROM Summary s WHERE s.user = :user AND s.createdAt >= :since ORDER BY s.createdAt DESC")
    List<Summary> findByUserAndCreatedAtAfter(@Param("user") User user, @Param("since") LocalDateTime since);

    long countByUser(User user);

    // PostgreSQL full-text search (optional enhancement)
    @Query(value = "SELECT * FROM summaries WHERE user_id = :userId AND " +
            "(to_tsvector('english', original_content) @@ plainto_tsquery('english', :keyword) OR " +
            "to_tsvector('english', processed_content) @@ plainto_tsquery('english', :keyword)) " +
            "ORDER BY created_at DESC", nativeQuery = true)
    List<Summary> fullTextSearch(@Param("userId") Long userId, @Param("keyword") String keyword);

    // Simple LIKE search (your existing approach)
    @Query("SELECT s FROM Summary s WHERE s.user = :user AND " +
            "(LOWER(s.originalContent) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
            "LOWER(s.processedContent) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
            "ORDER BY s.createdAt DESC")
    List<Summary> searchByUserAndKeyword(@Param("user") User user, @Param("keyword") String keyword);
}