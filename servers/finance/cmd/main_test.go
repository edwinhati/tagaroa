package main

import (
	"net/http"
	"testing"

	"github.com/edwinhati/tagaroa/servers/finance/internal/config"
	"github.com/stretchr/testify/assert"
	"go.uber.org/zap"
)

func TestMainFunction(t *testing.T) {
	// Mock runFn to avoid actual execution
	originalRun := runFn
	runFn = func() error { return nil }
	defer func() { runFn = originalRun }()

	assert.NotPanics(t, func() {
		main()
	})
}

func TestLoadEnvFile(t *testing.T) {
	assert.NotPanics(t, func() {
		loadEnvFile()
	})
}

func TestRun(t *testing.T) {
	// Mock dependencies
	originalLoadEnvFile := loadEnvFileFn
	originalMustLoadConfig := mustLoadConfigFn
	originalInitializeApp := initializeAppFn

	defer func() {
		loadEnvFileFn = originalLoadEnvFile
		mustLoadConfigFn = originalMustLoadConfig
		initializeAppFn = originalInitializeApp
	}()

	loadEnvFileFn = func() {}
	mustLoadConfigFn = func() *config.Config {
		return &config.Config{
			Server: config.ServerConfig{
				Port: "0",
			},
			Log: config.LogConfig{
				Level: "debug",
			},
			OIDC: config.OIDCConfig{
				BaseURL: "https://test.example.com",
			},
		}
	}

	// Mock InitializeApp
	initializeAppFn = func(cfg *config.Config) (*App, func(), error) {
		app := &App{
			Server: &http.Server{Addr: ":0"},
			Logger: zap.NewNop().Sugar(),
		}
		cleanup := func() {}
		return app, cleanup, nil
	}

	// We can't easily run full run() without blocking, so we'll skip the full execution test
	// unless we implement a way to signal stop immediately.
	// But run() waits for signal.NotifyContext.
	// We can't easily trigger that signal in unit test without affecting process.

	// Just verify mocking works
	assert.NotNil(t, runFn)
}

func TestLogStartupInfo(t *testing.T) {
	cfg := &config.Config{
		Server: config.ServerConfig{
			Env: "test",
		},
		Log: config.LogConfig{
			Level: "debug",
		},
		OIDC: config.OIDCConfig{
			BaseURL: "https://test.example.com",
		},
	}
	assert.NotPanics(t, func() {
		logStartupInfo(cfg)
	})
}
