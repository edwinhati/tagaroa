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
	"github.com/edwinhati/tagaroa/packages/shared/go/logger"
	"github.com/edwinhati/tagaroa/packages/shared/go/util"
	"go.uber.org/zap"
	"golang.org/x/time/rate"
)

var (
	authLog      *zap.SugaredLogger
	rateLimitLog *zap.SugaredLogger
)

func init() {
	authLog = logger.New()
	rateLimitLog = logger.New().With("component", "rate_limiter")
}

func AuthMiddleware(oidcClient *client.OIDCClient) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if oidcClient == nil {
				authLog.Errorw("Authentication failed: OIDC client not initialized")
				writeErrorResponse(w, http.StatusInternalServerError, "Authentication not configured", "OIDC client is not initialised")
				return
			}

			tokenStr, tokenErr := extractBearerToken(r.Header.Get("Authorization"))
			if tokenErr != nil {
				authLog.Infow("Authentication failed: missing or invalid token", "ip", getIP(r), "path", r.URL.Path)
				tokenErr.write(w)
				return
			}

			subject, subjectErr := subjectFromToken(r.Context(), oidcClient, tokenStr)
			if subjectErr != nil {
				authLog.Infow("Authentication failed: invalid token", "ip", getIP(r), "path", r.URL.Path, "error", subjectErr.detail)
				subjectErr.write(w)
				return
			}

			var userID string
			if isValidUUID(subject) {
				userID = subject
			} else {
				userID = generateDeterministicUUID(subject)
			}

			authLog.Infow("Authentication successful", "user_id", userID, "ip", getIP(r), "path", r.URL.Path)
			ctx := context.WithValue(r.Context(), util.UserIDKey, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

type RateLimiter struct {
	limiters map[string]*rate.Limiter
	mu       sync.RWMutex
	rate     rate.Limit
	burst    int
	cleanup  time.Duration
	stopCh   chan struct{}
}

func NewRateLimiter(rps rate.Limit, burst int) *RateLimiter {
	rl := &RateLimiter{
		limiters: make(map[string]*rate.Limiter),
		rate:     rps,
		burst:    burst,
		cleanup:  time.Minute * 5,
		stopCh:   make(chan struct{}),
	}

	go rl.cleanupRoutine()
	rateLimitLog.Infow("Rate limiter initialized", "rps", rps, "burst", burst)

	return rl
}

func (rl *RateLimiter) Stop() {
	close(rl.stopCh)
	rateLimitLog.Infow("Rate limiter stopped")
}

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

func (rl *RateLimiter) cleanupRoutine() {
	ticker := time.NewTicker(rl.cleanup)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			rl.mu.Lock()
			count := 0
			for ip, limiter := range rl.limiters {
				if limiter.TokensAt(time.Now()) == float64(rl.burst) {
					delete(rl.limiters, ip)
					count++
				}
			}
			rl.mu.Unlock()
			if count > 0 {
				rateLimitLog.Debugw("Cleaned up inactive limiters", "count", count)
			}
		case <-rl.stopCh:
			return
		}
	}
}

func getIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if ip := net.ParseIP(xff); ip != nil {
			return ip.String()
		}
	}

	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		if ip := net.ParseIP(xri); ip != nil {
			return ip.String()
		}
	}

	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}

	return ip
}

func (rl *RateLimiter) RateLimit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" {
			next.ServeHTTP(w, r)
			return
		}

		ip := getIP(r)
		limiter := rl.getLimiter(ip)

		if !limiter.Allow() {
			rateLimitLog.Warnw("Rate limit exceeded", "ip", ip, "path", r.URL.Path)
			http.Error(w, `{
				"error": "Rate limit exceeded",
				"message": "Too many requests, please try again later",
				"retry_after": "60s"
			}`, http.StatusTooManyRequests)
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

func isValidUUID(s string) bool {
	uuidRegex := regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
	return uuidRegex.MatchString(strings.ToLower(s))
}

func generateDeterministicUUID(input string) string {
	hash := sha256.Sum256([]byte(input))

	hash[6] = (hash[6] & 0x0f) | 0x40
	hash[8] = (hash[8] & 0x3f) | 0x80

	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		uint32(hash[0])<<24|uint32(hash[1])<<16|uint32(hash[2])<<8|uint32(hash[3]),
		uint16(hash[4])<<8|uint16(hash[5]),
		uint16(hash[6])<<8|uint16(hash[7]),
		uint16(hash[8])<<8|uint16(hash[9]),
		uint64(hash[10])<<56|uint64(hash[11])<<48|uint64(hash[12])<<40|uint64(hash[13])<<32|uint64(hash[14])<<24|uint64(hash[15])<<16,
	)
}
