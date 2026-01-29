package client

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/edwinhati/tagaroa/packages/shared/go/logger"
)

type OIDCClient struct {
	provider *oidc.Provider
	verifier *oidc.IDTokenVerifier
}

type OIDCConfig struct {
	IssuerURL         string
	ClientID          string
	SkipClientIDCheck bool
}

func NewOIDCClient(ctx context.Context, cfg OIDCConfig) (*OIDCClient, error) {
	if strings.TrimSpace(cfg.IssuerURL) == "" {
		return nil, errors.New("issuer URL is required")
	}

	log := logger.New()
	log.Infow("Initializing OIDC provider", "issuer", cfg.IssuerURL)

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

func (c *OIDCClient) Provider() *oidc.Provider {
	return c.provider
}
