package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/cenkalti/backoff/v4"
	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/edwinhati/tagaroa/servers/finance/pkg/logger"
)

// OIDCClient wraps OIDC provider and verifier
type OIDCClient struct {
	provider *oidc.Provider
	verifier *oidc.IDTokenVerifier
}

// OIDCConfig holds OIDC configuration
type OIDCConfig struct {
	IssuerURL         string
	ClientID          string
	SkipClientIDCheck bool
}

// NewOIDCClient creates a new OIDC client with retry logic
func NewOIDCClient(ctx context.Context, cfg OIDCConfig) (*OIDCClient, error) {
	if strings.TrimSpace(cfg.IssuerURL) == "" {
		return nil, errors.New("issuer URL is required")
	}

	log := logger.New()
	log.Infow("Initializing OIDC provider with retry", "issuer", cfg.IssuerURL)

	var provider *oidc.Provider

	// Create an exponential backoff strategy for retrying OIDC connection
	backoffStrategy := backoff.WithContext(backoff.NewExponentialBackOff(), ctx)

	// Retry logic with exponential backoff
	retryErr := backoff.Retry(func() error {
		var err error
		provider, err = oidc.NewProvider(ctx, cfg.IssuerURL)
		if err != nil {
			log.Warnw("Failed to connect to OIDC provider, retrying...", "error", err, "issuer", cfg.IssuerURL)
			return err
		}
		log.Infow("Successfully connected to OIDC provider", "issuer", cfg.IssuerURL)
		return nil
	}, backoffStrategy)

	if retryErr != nil {
		return nil, fmt.Errorf("failed to create OIDC provider after retries: %w", retryErr)
	}

	verifierConfig := &oidc.Config{
		ClientID: cfg.ClientID,
	}

	if cfg.SkipClientIDCheck {
		verifierConfig.SkipClientIDCheck = true
	}

	verifier := provider.Verifier(verifierConfig)

	return &OIDCClient{
		provider: provider,
		verifier: verifier,
	}, nil
}

// Verify verifies a raw token string
func (c *OIDCClient) Verify(ctx context.Context, rawToken string) (*oidc.IDToken, error) {
	if c == nil {
		return nil, errors.New("oidc client is not initialised")
	}

	if strings.TrimSpace(rawToken) == "" {
		return nil, errors.New("token is empty")
	}

	idToken, err := c.verifier.Verify(ctx, rawToken)
	if err != nil {
		return nil, fmt.Errorf("failed to verify token: %w", err)
	}

	return idToken, nil
}

// Subject extracts the subject from a verified token
func (c *OIDCClient) Subject(ctx context.Context, rawToken string) (string, error) {
	idToken, err := c.Verify(ctx, rawToken)
	if err != nil {
		return "", err
	}

	if strings.TrimSpace(idToken.Subject) == "" {
		return "", errors.New("token subject claim is empty")
	}

	return idToken.Subject, nil
}

// Provider returns the underlying OIDC provider
func (c *OIDCClient) Provider() *oidc.Provider {
	return c.provider
}
