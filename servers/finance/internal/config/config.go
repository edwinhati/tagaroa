package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// Config represents the complete application configuration
type Config struct {
	Server   ServerConfig
	Log      LogConfig
	Database DatabaseConfig
	OIDC     OIDCConfig
	Sentry   SentryConfig
}

// ServerConfig holds server-related configuration
type ServerConfig struct {
	Env            string
	Port           string
	TrustedOrigins string
}

// LogConfig holds logging configuration
type LogConfig struct {
	Level     string
	Format    string
	AddSource bool
}

// DatabaseConfig holds database connection settings
type DatabaseConfig struct {
	Host          string
	Port          string
	User          string
	Password      string
	Name          string
	SlowThreshold time.Duration
}

// OIDCConfig holds OpenID Connect integration settings
type OIDCConfig struct {
	BaseURL      string
	ClientID     string
	ClientSecret string
}

func (c OIDCConfig) IssuerURL() string {
	return strings.TrimSuffix(c.BaseURL, "/")
}

// SentryConfig holds Sentry configuration for error tracking
type SentryConfig struct {
	DSN              string
	TracesSampleRate float64
}

// LoadFromEnv loads configuration from environment variables
func (c *Config) LoadFromEnv() error {
	c.loadServerConfig()
	c.loadLogConfig()
	c.loadDatabaseConfig()
	c.loadOIDCConfig()
	c.loadSentryConfig()
	return nil
}

func (c *Config) loadServerConfig() {
	if env := os.Getenv("ENV"); env != "" {
		c.Server.Env = env
	}
	if port := os.Getenv("PORT"); port != "" {
		c.Server.Port = port
	}
	if trustedOrigins := os.Getenv("TRUSTED_ORIGINS"); trustedOrigins != "" {
		c.Server.TrustedOrigins = trustedOrigins
	}
}

func (c *Config) loadLogConfig() {
	if level := os.Getenv("LOG_LEVEL"); level != "" {
		c.Log.Level = level
	}
	if format := os.Getenv("LOG_FORMAT"); format != "" {
		c.Log.Format = format
	}
	if addSource := os.Getenv("LOG_ADD_SOURCE"); addSource != "" {
		if val, err := strconv.ParseBool(addSource); err == nil {
			c.Log.AddSource = val
		}
	}
}

func (c *Config) loadDatabaseConfig() {
	if host := os.Getenv("DB_HOST"); host != "" {
		c.Database.Host = host
	}
	if port := os.Getenv("DB_PORT"); port != "" {
		c.Database.Port = port
	}
	if user := os.Getenv("DB_USER"); user != "" {
		c.Database.User = user
	}
	if password := os.Getenv("DB_PASSWORD"); password != "" {
		c.Database.Password = password
	}
	if name := os.Getenv("DB_NAME"); name != "" {
		c.Database.Name = name
	}
	if slowThreshold := os.Getenv("DB_SLOW_THRESHOLD"); slowThreshold != "" {
		if duration, err := time.ParseDuration(slowThreshold); err == nil {
			c.Database.SlowThreshold = duration
		}
	}
}

func (c *Config) loadOIDCConfig() {
	if baseURL := os.Getenv("OIDC_BASE_URL"); baseURL != "" {
		c.OIDC.BaseURL = baseURL
	}
	if clientID := os.Getenv("OIDC_CLIENT_ID"); clientID != "" {
		c.OIDC.ClientID = clientID
	}
	if clientSecret := os.Getenv("OIDC_CLIENT_SECRET"); clientSecret != "" {
		c.OIDC.ClientSecret = clientSecret
	}
}

func (c *Config) loadSentryConfig() {
	if dsn := os.Getenv("SENTRY_DSN"); dsn != "" {
		c.Sentry.DSN = dsn
	}
	if tracesSampleRate := os.Getenv("SENTRY_TRACES_SAMPLE_RATE"); tracesSampleRate != "" {
		if rate, err := strconv.ParseFloat(tracesSampleRate, 64); err == nil {
			c.Sentry.TracesSampleRate = rate
		}
	}
}

// LoadConfig creates a new Config instance and loads values from environment variables
func LoadConfig() (*Config, error) {
	config := &Config{}
	config.LoadFromEnv() // LoadFromEnv never returns an error in current implementation
	return config, nil
}
