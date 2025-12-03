package client

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"
)

// OIDCClient is a thin wrapper around go-oidc verifier that we reuse across services.
type OIDCClient struct {
	provider *oidc.Provider
	verifier *oidc.IDTokenVerifier
}

// OIDCConfig contains the minimal settings required to initialise the verifier.
type OIDCConfig struct {
	// IssuerURL should point to the realm issuer, e.g. https://idp.example.com/realms/demo.
	IssuerURL string
	// ClientID is used for audience validation. Leave empty to skip the check.
	ClientID string
	// SkipClientIDCheck skips audience validation. Useful for machine-to-machine tokens.
	SkipClientIDCheck bool
}

// NewOIDCClient builds a provider and verifier using the supplied configuration.
func NewOIDCClient(ctx context.Context, cfg OIDCConfig) (*OIDCClient, error) {
	if strings.TrimSpace(cfg.IssuerURL) == "" {
		return nil, errors.New("issuer URL is required")
	}

	slog.InfoContext(ctx, "initialising OIDC provider", "issuer", cfg.IssuerURL)

	provider, err := oidc.NewProvider(ctx, cfg.IssuerURL)
	if err != nil {
		return nil, fmt.Errorf("failed to create OIDC provider: %w", err)
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

// Verify validates the raw bearer token and returns the decoded ID token claims.
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

// Subject extracts the subject claim from the token after verification.
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

// Provider exposes the underlying provider for advanced use-cases (eg. userinfo endpoint).
func (c *OIDCClient) Provider() *oidc.Provider {
	return c.provider
}
