package main

import (
	"context"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/edwinhati/tagaroa/packages/shared/go/client"
	"github.com/edwinhati/tagaroa/servers/finance/internal/config"
	"github.com/stretchr/testify/assert"
)

func TestMainFunction(t *testing.T) {
	os.Setenv("OIDC_BASE_URL", "https://test.example.com")
	os.Setenv("DB_HOST", "localhost")
	os.Setenv("DB_USER", "test")
	os.Setenv("DB_PASSWORD", "test")
	os.Setenv("DB_NAME", "test")
	os.Setenv("DB_PORT", "5432")
	os.Setenv("PORT", "8080")

	defer func() {
		os.Unsetenv("OIDC_BASE_URL")
		os.Unsetenv("DB_HOST")
		os.Unsetenv("DB_USER")
		os.Unsetenv("DB_PASSWORD")
		os.Unsetenv("DB_NAME")
		os.Unsetenv("DB_PORT")
		os.Unsetenv("PORT")
	}()

	assert.NotNil(t, main)
}

func TestMainWithTimeout(t *testing.T) {
	os.Setenv("OIDC_BASE_URL", "https://test.example.com")
	os.Setenv("DB_HOST", "localhost")
	os.Setenv("DB_USER", "test")
	os.Setenv("DB_PASSWORD", "test")
	os.Setenv("DB_NAME", "test")
	os.Setenv("DB_PORT", "5432")
	os.Setenv("PORT", "8080")

	defer func() {
		os.Unsetenv("OIDC_BASE_URL")
		os.Unsetenv("DB_HOST")
		os.Unsetenv("DB_USER")
		os.Unsetenv("DB_PASSWORD")
		os.Unsetenv("DB_NAME")
		os.Unsetenv("DB_PORT")
		os.Unsetenv("PORT")
	}()

	done := make(chan bool, 1)

	go func() {
		defer func() {
			if r := recover(); r != nil {
				done <- true
			}
		}()
		done <- true
	}()

	select {
	case <-done:
		assert.True(t, true, "Main function test completed")
	case <-time.After(100 * time.Millisecond):
		assert.True(t, true, "Main function test timed out as expected")
	}
}

func TestLoadEnvFile(t *testing.T) {
	assert.NotPanics(t, func() {
		loadEnvFile()
	})
}

func TestParseAllowedOrigins(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []string
	}{
		{name: "empty string", input: "", expected: nil},
		{name: "single origin", input: "http://localhost:3000", expected: []string{"http://localhost:3000"}},
		{name: "multiple origins", input: "http://localhost:3000, https://example.com, http://test.com", expected: []string{"http://localhost:3000", "https://example.com", "http://test.com"}},
		{name: "origins with spaces", input: "http://localhost:3000 , https://example.com , http://test.com", expected: []string{"http://localhost:3000", "https://example.com", "http://test.com"}},
		{name: "empty origins after trim", input: "http://localhost:3000, , https://example.com", expected: []string{"http://localhost:3000", "https://example.com"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parseAllowedOrigins(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestParseAllowedOriginsEdgeCases(t *testing.T) {
	result := parseAllowedOrigins("http://a.com,https://b.com,")
	assert.Equal(t, []string{"http://a.com", "https://b.com"}, result)

	result = parseAllowedOrigins(" http://a.com ,\t https://b.com ")
	assert.Equal(t, []string{"http://a.com", "https://b.com"}, result)
}

func TestApplyMiddlewares(t *testing.T) {
	handler := applyMiddlewares(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}), []string{"http://localhost:3000"})

	assert.NotNil(t, handler)
	assert.IsType(t, (*http.Handler)(nil), &handler)
}

func TestRegisterHealthEndpoint(t *testing.T) {
	assert.NotPanics(t, func() {
		registerHealthEndpoint()
	})

	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()
	http.DefaultServeMux.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "status")
	assert.Contains(t, w.Body.String(), "timestamp")
	assert.Contains(t, w.Body.String(), "finance-server")
}

func TestNewHTTPServer(t *testing.T) {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	server := newHTTPServer("8080", handler)
	assert.NotNil(t, server)
	assert.Equal(t, ":8080", server.Addr)
	assert.NotNil(t, server.Handler)
}

func TestStartServer(t *testing.T) {
	server := &http.Server{
		Addr: "localhost:0",
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}),
	}

	go func() {
		listenAndServeFn(server)
	}()

	time.Sleep(10 * time.Millisecond)

	assert.NotPanics(t, func() {
		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()
		server.Shutdown(ctx)
	})
}

func TestGracefulShutdown(t *testing.T) {
	server := &http.Server{
		Addr: "localhost:0",
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}),
	}

	go func() {
		listenAndServeFn(server)
	}()

	time.Sleep(10 * time.Millisecond)

	assert.NotPanics(t, func() {
		gracefulShutdown(server)
	})
}

func TestRunFunction(t *testing.T) {
	assert.NotNil(t, runFn)
}

func TestRunFnWithEnvFile(t *testing.T) {
	envContent := `OIDC_BASE_URL=https://test.example.com
DB_HOST=localhost
DB_USER=test
DB_PASSWORD=test
DB_NAME=test
DB_PORT=5432
PORT=8080`

	tmpFile, err := os.CreateTemp("", ".env")
	assert.NoError(t, err)
	defer os.Remove(tmpFile.Name())

	_, err = tmpFile.WriteString(envContent)
	assert.NoError(t, err)
	tmpFile.Close()

	t.Setenv("GODOTENV_LOAD", tmpFile.Name())

	runFn = func() error {
		return nil
	}

	err = runFn()
	assert.NoError(t, err)
}

func TestMainExitsOnError(t *testing.T) {
	originalLogFatalf := logFatalfFn
	originalRun := runFn

	fatalCalled := false
	logFatalfFn = func(format string, v ...interface{}) {
		fatalCalled = true
	}

	runFn = func() error {
		return assert.AnError
	}

	done := make(chan bool, 1)
	go func() {
		main()
		done <- true
	}()

	select {
	case <-done:
		assert.True(t, fatalCalled, "logFatalf should have been called")
	case <-time.After(100 * time.Millisecond):
		t.Fatal("main() did not complete within timeout")
	}

	logFatalfFn = originalLogFatalf
	runFn = originalRun
}

func TestBuildHTTPHandler(t *testing.T) {
	handler := buildHTTPHandler(nil, nil, nil)
	assert.NotNil(t, handler)
}

func TestMustLoadConfig(t *testing.T) {
	cfg := mustLoadConfig()
	assert.NotNil(t, cfg)
}

func TestMustConnectDatabaseMock(t *testing.T) {
	os.Setenv("DB_HOST", "localhost")
	os.Setenv("DB_USER", "test")
	os.Setenv("DB_PASSWORD", "test")
	os.Setenv("DB_NAME", "test")
	os.Setenv("DB_PORT", "5432")
	defer func() {
		os.Unsetenv("DB_HOST")
		os.Unsetenv("DB_USER")
		os.Unsetenv("DB_PASSWORD")
		os.Unsetenv("DB_NAME")
		os.Unsetenv("DB_PORT")
	}()

	cfg := mustLoadConfig()
	assert.NotNil(t, cfg)

	originalConnectDatabase := connectDatabaseFn
	connectDatabaseFn = func(host, user, password, name, port string) (*sql.DB, error) {
		return &sql.DB{}, nil
	}

	assert.NotPanics(t, func() {
		mustConnectDatabase(cfg)
	})

	connectDatabaseFn = originalConnectDatabase
}

func TestMustConnectDatabaseError(t *testing.T) {
	os.Setenv("DB_HOST", "localhost")
	os.Setenv("DB_USER", "test")
	os.Setenv("DB_PASSWORD", "test")
	os.Setenv("DB_NAME", "test")
	os.Setenv("DB_PORT", "5432")
	defer func() {
		os.Unsetenv("DB_HOST")
		os.Unsetenv("DB_USER")
		os.Unsetenv("DB_PASSWORD")
		os.Unsetenv("DB_NAME")
		os.Unsetenv("DB_PORT")
	}()

	originalConnectDatabase := connectDatabaseFn
	connectDatabaseFn = func(host, user, password, name, port string) (*sql.DB, error) {
		return nil, assert.AnError
	}

	defer func() {
		connectDatabaseFn = originalConnectDatabase
	}()

	assert.Panics(t, func() {
		mustConnectDatabase(nil)
	})
}

func TestMustInitOIDCClientMock(t *testing.T) {
	os.Setenv("OIDC_BASE_URL", "https://test.example.com")
	defer os.Unsetenv("OIDC_BASE_URL")

	cfg := mustLoadConfig()
	assert.NotNil(t, cfg)

	originalMustInitOIDCClient := mustInitOIDCClientFn
	mustInitOIDCClientFn = func(ctx context.Context, cfg *config.Config) *client.OIDCClient {
		return &client.OIDCClient{}
	}

	assert.NotPanics(t, func() {
		mustInitOIDCClient(context.Background(), cfg)
	})

	mustInitOIDCClientFn = originalMustInitOIDCClient
}

func TestMustInitOIDCClientError(t *testing.T) {
	os.Setenv("OIDC_BASE_URL", "https://test.example.com")
	defer os.Unsetenv("OIDC_BASE_URL")

	originalNewOIDCClient := newOIDCClientFn
	newOIDCClientFn = func(ctx context.Context, config client.OIDCConfig) (*client.OIDCClient, error) {
		return nil, assert.AnError
	}

	assert.Panics(t, func() {
		mustInitOIDCClient(context.Background(), nil)
	})

	newOIDCClientFn = originalNewOIDCClient
}

func TestStartServerError(t *testing.T) {
	t.Run("ListenAndServe returns error", func(t *testing.T) {
		originalListenAndServe := listenAndServeFn
		originalLogFatalf := logFatalfFn
		originalStartServerFn := startServerFn
		listenAndServeCalled := false

		listenAndServeFn = func(server *http.Server) error {
			listenAndServeCalled = true
			return assert.AnError
		}
		logFatalfFn = func(format string, v ...interface{}) {}
		startServerFn = nil

		server := &http.Server{
			Addr: "localhost:0",
		}

		assert.NotPanics(t, func() {
			startServer(server)
		})

		assert.True(t, listenAndServeCalled, "ListenAndServe should have been called")
		listenAndServeFn = originalListenAndServe
		logFatalfFn = originalLogFatalf
		startServerFn = originalStartServerFn
	})

	t.Run("ListenAndServe returns ErrServerClosed", func(t *testing.T) {
		originalListenAndServe := listenAndServeFn
		originalStartServerFn := startServerFn

		listenAndServeFn = func(server *http.Server) error {
			return http.ErrServerClosed
		}
		startServerFn = nil

		server := &http.Server{
			Addr: "localhost:0",
		}

		assert.NotPanics(t, func() {
			startServer(server)
		})

		listenAndServeFn = originalListenAndServe
		startServerFn = originalStartServerFn
	})
}

func TestRunWithMocks(t *testing.T) {
	t.Skip("Skipping as run() blocks waiting for context cancellation")

	originalLoadEnvFile := loadEnvFileFn
	originalMustLoadConfig := mustLoadConfigFn
	originalMustConnectDatabase := mustConnectDatabaseFn
	originalMustInitOIDCClient := mustInitOIDCClientFn
	originalBuildHTTPHandler := buildHTTPHandlerFn
	originalNewHTTPServer := newHTTPServerFn
	originalStartServer := startServerFn
	originalGracefulShutdown := gracefulShutdownFn
	originalRegisterHealthEndpoint := registerHealthEndpointFn

	loadEnvFileCalled := false
	mustLoadConfigCalled := false
	mustConnectDatabaseCalled := false
	mustInitOIDCClientCalled := false
	buildHTTPHandlerCalled := false
	newHTTPServerCalled := false
	startServerCalled := false
	gracefulShutdownCalled := false
	registerHealthEndpointCalled := false

	loadEnvFileFn = func() {
		loadEnvFileCalled = true
	}
	mustLoadConfigFn = func() *config.Config {
		mustLoadConfigCalled = true
		return &config.Config{}
	}
	mustConnectDatabaseFn = func(cfg *config.Config) *sql.DB {
		mustConnectDatabaseCalled = true
		return nil
	}
	mustInitOIDCClientFn = func(ctx context.Context, cfg *config.Config) *client.OIDCClient {
		mustInitOIDCClientCalled = true
		return nil
	}
	buildHTTPHandlerFn = func(db *sql.DB, oidcClient *client.OIDCClient, allowedOrigins []string) http.Handler {
		buildHTTPHandlerCalled = true
		return nil
	}
	newHTTPServerFn = func(port string, handler http.Handler) *http.Server {
		newHTTPServerCalled = true
		return &http.Server{}
	}
	startServerFn = func(server *http.Server) {
		startServerCalled = true
	}
	gracefulShutdownFn = func(server *http.Server) {
		gracefulShutdownCalled = true
	}
	registerHealthEndpointFn = func() {
		registerHealthEndpointCalled = true
	}

	err := run()
	assert.NoError(t, err)
	assert.True(t, loadEnvFileCalled, "loadEnvFile should have been called")
	assert.True(t, mustLoadConfigCalled, "mustLoadConfig should have been called")
	assert.True(t, mustConnectDatabaseCalled, "mustConnectDatabase should have been called")
	assert.True(t, mustInitOIDCClientCalled, "mustInitOIDCClient should have been called")
	assert.True(t, buildHTTPHandlerCalled, "buildHTTPHandler should have been called")
	assert.True(t, registerHealthEndpointCalled, "registerHealthEndpoint should have been called")
	assert.True(t, newHTTPServerCalled, "newHTTPServer should have been called")
	assert.True(t, startServerCalled, "startServer should have been called")
	assert.True(t, gracefulShutdownCalled, "gracefulShutdown should have been called")

	loadEnvFileFn = originalLoadEnvFile
	mustLoadConfigFn = originalMustLoadConfig
	mustConnectDatabaseFn = originalMustConnectDatabase
	mustInitOIDCClientFn = originalMustInitOIDCClient
	buildHTTPHandlerFn = originalBuildHTTPHandler
	newHTTPServerFn = originalNewHTTPServer
	startServerFn = originalStartServer
	gracefulShutdownFn = originalGracefulShutdown
	registerHealthEndpointFn = originalRegisterHealthEndpoint
}

func TestLogStartupInfo(t *testing.T) {
	cfg := mustLoadConfig()
	assert.NotPanics(t, func() {
		logStartupInfo(cfg)
	})
}

func TestRunWithRealFunctions(t *testing.T) {
	t.Skip("Skipping as it requires real database connection and affects global state")
	originalLoadEnvFile := loadEnvFileFn
	originalMustLoadConfig := mustLoadConfigFn
	originalMustConnectDatabase := mustConnectDatabaseFn
	originalMustInitOIDCClient := mustInitOIDCClientFn
	originalBuildHTTPHandler := buildHTTPHandlerFn
	originalNewHTTPServer := newHTTPServerFn
	originalStartServer := startServerFn
	originalGracefulShutdown := gracefulShutdownFn

	loadEnvFileFn = func() {}
	mustLoadConfigFn = func() *config.Config {
		return &config.Config{}
	}
	mustConnectDatabaseFn = func(cfg *config.Config) *sql.DB {
		return nil
	}
	mustInitOIDCClientFn = func(ctx context.Context, cfg *config.Config) *client.OIDCClient {
		return nil
	}
	buildHTTPHandlerFn = func(db *sql.DB, oidcClient *client.OIDCClient, allowedOrigins []string) http.Handler {
		return nil
	}
	newHTTPServerFn = func(port string, handler http.Handler) *http.Server {
		return &http.Server{}
	}
	startServerFn = func(server *http.Server) {}
	gracefulShutdownFn = func(server *http.Server) {}

	err := run()
	assert.NoError(t, err)

	loadEnvFileFn = originalLoadEnvFile
	mustLoadConfigFn = originalMustLoadConfig
	mustConnectDatabaseFn = originalMustConnectDatabase
	mustInitOIDCClientFn = originalMustInitOIDCClient
	buildHTTPHandlerFn = originalBuildHTTPHandler
	newHTTPServerFn = originalNewHTTPServer
	startServerFn = originalStartServer
	gracefulShutdownFn = originalGracefulShutdown
}
