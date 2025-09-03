package com.assitant.gemini.repository;

import com.assitant.gemini.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * A repository interface for managing User entities.
 * Spring Data JPA automatically provides method implementations for this interface
 * based on the method names, simplifying database access.
 */

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    /**
     * Finds a user by their username.
     * The method returns an Optional<User> to handle cases where a user with the given username might not exist.
     * @param username The username to search for.
     * @return An Optional containing the found User, or an empty Optional if no user is found.
     * Best practice -> use Optional to Avoid Null pointer Exception while running the code
     */

    Optional<User> findByUsername(String username);

    /**
     * Finds a user by their email.
     * Returns an Optional<User> to gracefully handle scenarios where the email does not exist in the database.
     * @param email The email to search for.
     * @return An Optional containing the found User, or an empty Optional if no user is found.
     * Best practice -> use Optional to Avoid Null pointer Exception while running the code
     */

    Optional<User> findByEmail(String email);

    /**
     * Checks if a user with the given username exists in the database.
     * This method is more efficient than findByUsername(username).isPresent()
     * because it only checks for existence and does not retrieve the entire entity.
     * @param username The username to check for existence.
     * @return true if a user with the username exists, false otherwise.
     * Best practice -> use Optional to Avoid Null pointer Exception while running the code
     */

    boolean existsByUsername(String username);

    /**
     * Checks if a user with the given email exists in the database.
     * This is a simple and performant way to verify the existence of a record.
     * @param email The email to check for existence.
     * @return true if a user with the email exists, false otherwise.
     */

    boolean existsByEmail(String email);
}