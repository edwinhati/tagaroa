package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/edwinhati/tagaroa/packages/shared/go/client"
	httputil "github.com/edwinhati/tagaroa/packages/shared/go/transport/http"
)

type contextKey string

const UserIDKey contextKey = "userID"

func AuthMiddleware(oidcClient *client.OIDCClient) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if oidcClient == nil {
				writeErrorResponse(w, http.StatusInternalServerError, "Authentication not configured", "OIDC client is not initialised")
				return
			}

			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				writeErrorResponse(w, http.StatusUnauthorized, "Missing authorization header", "Authorization header is required to access this resource.")
				return
			}

			tokenStr := ""
			if strings.HasPrefix(authHeader, "Bearer ") {
				tokenStr = strings.TrimSpace(authHeader[7:])
			}

			if tokenStr == "" {
				writeErrorResponse(w, http.StatusUnauthorized, "Invalid authorization header format", "Authorization header must be in the format: Bearer <token>.")
				return
			}

			subject, err := oidcClient.Subject(r.Context(), tokenStr)
			if err != nil {
				status := http.StatusUnauthorized
				if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
					status = http.StatusRequestTimeout
				}

				writeErrorResponse(w, status, "Invalid or expired token", err.Error())
				return
			}

			// Convert Better Auth string user ID to UUID
			// We'll use the subject as-is if it's already a UUID, otherwise create a deterministic UUID
			var userID string
			if isValidUUID(subject) {
				userID = subject
			} else {
				// Create a deterministic UUID from the Better Auth user ID
				// This ensures the same Better Auth user ID always maps to the same UUID
				userID = generateDeterministicUUID(subject)
			}

			ctx := context.WithValue(r.Context(), UserIDKey, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func writeErrorResponse(w http.ResponseWriter, statusCode int, error, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	response := httputil.ApiResponse[string]{
		Timestamp: time.Now(),
		Error:     error,
		Message:   message,
	}

	json.NewEncoder(w).Encode(response)
}

// isValidUUID checks if a string is a valid UUID format
func isValidUUID(s string) bool {
	uuidRegex := regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
	return uuidRegex.MatchString(strings.ToLower(s))
}

// generateDeterministicUUID creates a deterministic UUID from a string
// This ensures the same input always produces the same UUID
func generateDeterministicUUID(input string) string {
	// Create a SHA256 hash of the input
	hash := sha256.Sum256([]byte(input))

	// Use the first 16 bytes of the hash to create a UUID
	// Set version (4) and variant bits according to RFC 4122
	hash[6] = (hash[6] & 0x0f) | 0x40 // Version 4
	hash[8] = (hash[8] & 0x3f) | 0x80 // Variant bits

	// Format as UUID string
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		hash[0:4],
		hash[4:6],
		hash[6:8],
		hash[8:10],
		hash[10:16])
}
