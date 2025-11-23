FROM eclipse-temurin:21-jdk-alpine

# Path to your JAR file
ARG JAR_FILE=target/*.jar

# Copy your actual built JAR into the container
COPY ./target/textura-ai-0.0.1-SNAPSHOT.jar app.jar

# Run the application
ENTRYPOINT ["java", "-jar", "/app.jar"]
