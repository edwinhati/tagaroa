package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/edwinhati/tagaroa/packages/shared/go/client"
	"github.com/edwinhati/tagaroa/packages/shared/go/util"
	"golang.org/x/time/rate"
)

func AuthMiddleware(oidcClient *client.OIDCClient) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if oidcClient == nil {
				writeErrorResponse(w, http.StatusInternalServerError, "Authentication not configured", "OIDC client is not initialised")
				return
			}

			tokenStr, tokenErr := extractBearerToken(r.Header.Get("Authorization"))
			if tokenErr != nil {
				tokenErr.write(w)
				return
			}

			subject, subjectErr := subjectFromToken(r.Context(), oidcClient, tokenStr)
			if subjectErr != nil {
				subjectErr.write(w)
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

			ctx := context.WithValue(r.Context(), util.UserIDKey, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RateLimiter represents a rate limiter for HTTP requests
type RateLimiter struct {
	limiters map[string]*rate.Limiter
	mu       sync.RWMutex
	rate     rate.Limit
	burst    int
	cleanup  time.Duration
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(rps rate.Limit, burst int) *RateLimiter {
	rl := &RateLimiter{
		limiters: make(map[string]*rate.Limiter),
		rate:     rps,
		burst:    burst,
		cleanup:  time.Minute * 5, // Clean up old limiters every 5 minutes
	}

	// Start cleanup goroutine
	go rl.cleanupRoutine()

	return rl
}

// getLimiter returns the rate limiter for the given IP
func (rl *RateLimiter) getLimiter(ip string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	limiter, exists := rl.limiters[ip]
	if !exists {
		limiter = rate.NewLimiter(rl.rate, rl.burst)
		rl.limiters[ip] = limiter
	}

	return limiter
}

// cleanupRoutine periodically removes unused limiters
func (rl *RateLimiter) cleanupRoutine() {
	ticker := time.NewTicker(rl.cleanup)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		for ip, limiter := range rl.limiters {
			// Remove limiters that haven't been used recently
			if limiter.TokensAt(time.Now()) == float64(rl.burst) {
				delete(rl.limiters, ip)
			}
		}
		rl.mu.Unlock()
	}
}

// getIP extracts the real IP address from the request
func getIP(r *http.Request) string {
	// Check X-Forwarded-For header first (for load balancers/proxies)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// X-Forwarded-For can contain multiple IPs, take the first one
		if ip := net.ParseIP(xff); ip != nil {
			return ip.String()
		}
	}

	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		if ip := net.ParseIP(xri); ip != nil {
			return ip.String()
		}
	}

	// Fall back to RemoteAddr
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}

	return ip
}

// RateLimit middleware function
func (rl *RateLimiter) RateLimit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip rate limiting for health checks
		if r.URL.Path == "/health" {
			next.ServeHTTP(w, r)
			return
		}

		ip := getIP(r)
		limiter := rl.getLimiter(ip)

		if !limiter.Allow() {
			http.Error(w, fmt.Sprintf(`{
				"error": "Rate limit exceeded",
				"message": "Too many requests from IP: %s",
				"retry_after": "60s"
			}`, ip), http.StatusTooManyRequests)
			return
		}

		next.ServeHTTP(w, r)
	})
}

type authErr struct {
	status int
	title  string
	detail string
}

func (e *authErr) write(w http.ResponseWriter) {
	writeErrorResponse(w, e.status, e.title, e.detail)
}

func newAuthErr(status int, title, detail string) *authErr {
	return &authErr{status: status, title: title, detail: detail}
}

func writeErrorResponse(w http.ResponseWriter, statusCode int, error, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)

	response := util.ApiResponse[string]{
		Timestamp: time.Now(),
		Error:     error,
		Message:   message,
	}

	json.NewEncoder(w).Encode(response)
}

func extractBearerToken(authHeader string) (string, *authErr) {
	if authHeader == "" {
		return "", newAuthErr(
			http.StatusUnauthorized,
			"Missing authorization header",
			"Authorization header is required to access this resource.",
		)
	}

	if !strings.HasPrefix(authHeader, "Bearer ") {
		return "", newAuthErr(
			http.StatusUnauthorized,
			"Invalid authorization header format",
			"Authorization header must be in the format: Bearer <token>.",
		)
	}

	tokenStr := strings.TrimSpace(authHeader[len("Bearer "):])
	if tokenStr == "" {
		return "", newAuthErr(
			http.StatusUnauthorized,
			"Invalid authorization header format",
			"Authorization header must be in the format: Bearer <token>.",
		)
	}

	return tokenStr, nil
}

func subjectFromToken(ctx context.Context, oidcClient *client.OIDCClient, token string) (string, *authErr) {
	subject, err := oidcClient.Subject(ctx, token)
	if err == nil {
		return subject, nil
	}

	status := http.StatusUnauthorized
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		status = http.StatusRequestTimeout
	}

	return "", newAuthErr(status, "Invalid or expired token", err.Error())
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
