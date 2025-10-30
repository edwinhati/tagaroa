package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// Config represents the complete application configuration
type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Log      LogConfig      `yaml:"log"`
	Database DatabaseConfig `yaml:"database"`
	OIDC     OIDCConfig     `yaml:"oidc"`
	Sentry   SentryConfig   `yaml:"sentry"`
}

// ServerConfig holds server-related configuration
type ServerConfig struct {
	Env  string `yaml:"env"`
	Port string `yaml:"port"`
}

// LogConfig holds logging configuration
type LogConfig struct {
	Level     string `yaml:"level"`
	Format    string `yaml:"format"`
	AddSource bool   `yaml:"add_source"`
}

// DatabaseConfig holds database connection settings
type DatabaseConfig struct {
	Host          string        `yaml:"host"`
	Port          string        `yaml:"port"`
	User          string        `yaml:"user"`
	Password      string        `yaml:"password"`
	Name          string        `yaml:"name"`
	SlowThreshold time.Duration `yaml:"slow_threshold"`
}

// OIDCConfig holds OpenID Connect integration settings
type OIDCConfig struct {
	BaseURL      string `yaml:"base_url"`
	ClientID     string `yaml:"client_id"`
	ClientSecret string `yaml:"client_secret"`
}

func (c OIDCConfig) IssuerURL() string {
	return strings.TrimSuffix(c.BaseURL, "/")
}

// SentryConfig holds Sentry configuration for error tracking
type SentryConfig struct {
	DSN              string  `yaml:"dsn"`
	TracesSampleRate float64 `yaml:"traces_sample_rate"`
}

// LoadFromEnv loads configuration from environment variables
func (c *Config) LoadFromEnv() error {
	// Server config
	if env := os.Getenv("ENV"); env != "" {
		c.Server.Env = env
	}
	if port := os.Getenv("PORT"); port != "" {
		c.Server.Port = port
	}

	// Log config
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

	// Database config
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

	// OIDC config
	if baseURL := os.Getenv("OIDC_BASE_URL"); baseURL != "" {
		c.OIDC.BaseURL = baseURL
	}
	if clientID := os.Getenv("OIDC_CLIENT_ID"); clientID != "" {
		c.OIDC.ClientID = clientID
	}
	if clientSecret := os.Getenv("OIDC_CLIENT_SECRET"); clientSecret != "" {
		c.OIDC.ClientSecret = clientSecret
	}

	// Sentry config
	if dsn := os.Getenv("SENTRY_DSN"); dsn != "" {
		c.Sentry.DSN = dsn
	}
	if tracesSampleRate := os.Getenv("SENTRY_TRACES_SAMPLE_RATE"); tracesSampleRate != "" {
		if rate, err := strconv.ParseFloat(tracesSampleRate, 64); err == nil {
			c.Sentry.TracesSampleRate = rate
		}
	}

	return nil
}

// LoadConfig creates a new Config instance and loads values from environment variables
func LoadConfig() (*Config, error) {
	config := &Config{}
	config.LoadFromEnv() // LoadFromEnv never returns an error in current implementation
	return config, nil
}
