package config

import (
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

const (
	testAuthURL          = "https://auth.example.com"
	testAuthURLWithSlash = "https://auth.example.com/"
	testAuthURLMulti     = "https://auth.example.com///"
)

/***************
 * Test helpers
 ***************/

func saveEnv(t *testing.T, keys ...string) map[string]string {
	t.Helper()
	saved := make(map[string]string, len(keys))
	for _, k := range keys {
		saved[k] = os.Getenv(k)
	}
	// restore automatically after test
	t.Cleanup(func() {
		for k, v := range saved {
			if v == "" {
				os.Unsetenv(k)
			} else {
				_ = os.Setenv(k, v)
			}
		}
	})
	return saved
}

func withEnv(t *testing.T, kv map[string]string) {
	t.Helper()
	keys := make([]string, 0, len(kv))
	for k := range kv {
		keys = append(keys, k)
	}
	_ = saveEnv(t, keys...)
	for k, v := range kv {
		_ = os.Setenv(k, v)
	}
}

func unsetAll(t *testing.T, keys ...string) {
	t.Helper()
	_ = saveEnv(t, keys...)
	for _, k := range keys {
		_ = os.Unsetenv(k)
	}
}

func assertZeroConfig(t *testing.T, c *Config) {
	t.Helper()
	assert.Empty(t, c.Server.Env)
	assert.Empty(t, c.Server.Port)
	assert.Empty(t, c.Server.TrustedOrigins)

	assert.Empty(t, c.Log.Level)
	assert.Empty(t, c.Log.Format)
	assert.False(t, c.Log.AddSource)

	assert.Empty(t, c.Database.Host)
	assert.Empty(t, c.Database.Port)
	assert.Empty(t, c.Database.User)
	assert.Empty(t, c.Database.Password)
	assert.Empty(t, c.Database.Name)
	assert.Equal(t, time.Duration(0), c.Database.SlowThreshold)

	assert.Empty(t, c.OIDC.BaseURL)
	assert.Empty(t, c.OIDC.ClientID)
	assert.Empty(t, c.OIDC.ClientSecret)

	assert.Empty(t, c.Sentry.DSN)
	assert.Equal(t, 0.0, c.Sentry.TracesSampleRate)
}

/***************
 * Tests
 ***************/

func TestOIDCConfigIssuerURL(t *testing.T) {
	tests := []struct {
		name     string
		baseURL  string
		expected string
	}{
		{
			name:     "URL with trailing slash",
			baseURL:  testAuthURLWithSlash,
			expected: testAuthURL,
		},
		{
			name:     "URL without trailing slash",
			baseURL:  testAuthURL,
			expected: testAuthURL,
		},
		{
			name:     "URL with multiple trailing slashes",
			baseURL:  testAuthURLMulti,
			expected: "https://auth.example.com//",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := OIDCConfig{BaseURL: tt.baseURL}
			assert.Equal(t, tt.expected, config.IssuerURL())
		})
	}
}

func TestConfigLoadFromEnv(t *testing.T) {
	withEnv(t, map[string]string{
		"ENV":                       "test",
		"PORT":                      "8080",
		"TRUSTED_ORIGINS":           "http://localhost:3000,https://app.example.com",
		"LOG_LEVEL":                 "debug",
		"LOG_FORMAT":                "json",
		"LOG_ADD_SOURCE":            "true",
		"DB_HOST":                   "localhost",
		"DB_PORT":                   "5432",
		"DB_USER":                   "testuser",
		"DB_PASSWORD":               "testpass",
		"DB_NAME":                   "testdb",
		"DB_SLOW_THRESHOLD":         "1s",
		"OIDC_BASE_URL":             "https://auth.test.com",
		"OIDC_CLIENT_ID":            "test-client-id",
		"OIDC_CLIENT_SECRET":        "test-client-secret",
		"SENTRY_DSN":                "https://test@sentry.io/123",
		"SENTRY_TRACES_SAMPLE_RATE": "0.5",
	})

	c := &Config{}
	err := c.LoadFromEnv()
	assert.NoError(t, err)

	assert.Equal(t, "test", c.Server.Env)
	assert.Equal(t, "8080", c.Server.Port)
	assert.Equal(t, "http://localhost:3000,https://app.example.com", c.Server.TrustedOrigins)

	assert.Equal(t, "debug", c.Log.Level)
	assert.Equal(t, "json", c.Log.Format)
	assert.True(t, c.Log.AddSource)

	assert.Equal(t, "localhost", c.Database.Host)
	assert.Equal(t, "5432", c.Database.Port)
	assert.Equal(t, "testuser", c.Database.User)
	assert.Equal(t, "testpass", c.Database.Password)
	assert.Equal(t, "testdb", c.Database.Name)
	assert.Equal(t, time.Second, c.Database.SlowThreshold)

	assert.Equal(t, "https://auth.test.com", c.OIDC.BaseURL)
	assert.Equal(t, "test-client-id", c.OIDC.ClientID)
	assert.Equal(t, "test-client-secret", c.OIDC.ClientSecret)

	assert.Equal(t, "https://test@sentry.io/123", c.Sentry.DSN)
	assert.Equal(t, 0.5, c.Sentry.TracesSampleRate)
}

func TestConfigLoadFromEnvInvalidValues(t *testing.T) {
	withEnv(t, map[string]string{
		"LOG_ADD_SOURCE":            "invalid-bool",
		"DB_SLOW_THRESHOLD":         "invalid-duration",
		"SENTRY_TRACES_SAMPLE_RATE": "invalid-float",
	})

	c := &Config{}
	err := c.LoadFromEnv()
	assert.NoError(t, err)

	assert.False(t, c.Log.AddSource)                            // default false
	assert.Equal(t, time.Duration(0), c.Database.SlowThreshold) // default 0
	assert.Equal(t, 0.0, c.Sentry.TracesSampleRate)             // default 0.0
}

func TestConfigLoadFromEnvEmptyValues(t *testing.T) {
	keys := []string{
		"ENV", "PORT", "TRUSTED_ORIGINS", "LOG_LEVEL", "LOG_FORMAT", "LOG_ADD_SOURCE",
		"DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME", "DB_SLOW_THRESHOLD",
		"OIDC_BASE_URL", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET",
		"SENTRY_DSN", "SENTRY_TRACES_SAMPLE_RATE", "KAFKA_BROKERS", "KAFKA_CLIENT_ID",
	}
	unsetAll(t, keys...)

	c := &Config{}
	err := c.LoadFromEnv()
	assert.NoError(t, err)
	assertZeroConfig(t, c)
	assert.Nil(t, c.Kafka.Brokers)
	assert.Empty(t, c.Kafka.ClientID)
}

func TestLoadConfigInitializes(t *testing.T) {
	cfg, err := LoadConfig()
	assert.NoError(t, err)
	if assert.NotNil(t, cfg) {
		// Ensure all nested structs are present
		assert.NotNil(t, &cfg.Server)
		assert.NotNil(t, &cfg.Log)
		assert.NotNil(t, &cfg.Database)
		assert.NotNil(t, &cfg.OIDC)
		assert.NotNil(t, &cfg.Sentry)
		assert.NotNil(t, &cfg.Kafka)
	}
}

func TestConfigLoadFromEnvKafka(t *testing.T) {
	withEnv(t, map[string]string{
		"KAFKA_BROKERS":   "broker-a:29092, broker-b:9093 , ,broker-c:9094",
		"KAFKA_CLIENT_ID": "finance-api",
	})

	c := &Config{}
	err := c.LoadFromEnv()
	assert.NoError(t, err)

	assert.Equal(t, []string{"broker-a:29092", "broker-b:9093", "broker-c:9094"}, c.Kafka.Brokers)
	assert.Equal(t, "finance-api", c.Kafka.ClientID)
}

func TestParseCSV(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []string
	}{
		{"empty string", "", []string{}},
		{"single value", "broker:29092", []string{"broker:29092"}},
		{"spaces and blanks", " a , , b ,c ", []string{"a", "b", "c"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, parseCSV(tt.input))
		})
	}
}
