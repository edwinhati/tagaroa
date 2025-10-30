package util

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/edwinhati/tagaroa/packages/shared/go/middleware"
	httputil "github.com/edwinhati/tagaroa/packages/shared/go/transport/http"
	"github.com/google/uuid"
)

type FindManyParams struct {
	Offset  int
	Limit   int
	Where   map[string]any
	OrderBy string
}

type FindUniqueParams struct {
	Where map[string]any
}

type AggregationResult struct {
	Count int     `json:"count"`
	Min   float64 `json:"min"`
	Max   float64 `json:"max"`
	Avg   float64 `json:"avg"`
	Sum   float64 `json:"sum"`
}

func userIDFromContext(ctx context.Context) (uuid.UUID, error) {
	raw, ok := ctx.Value(middleware.UserIDKey).(string)

	if !ok || raw == "" {
		return uuid.Nil, errors.New("user id missing from context")
	}

	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid user id: %w", err)
	}

	return id, nil
}

func RequireUserID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	userID, err := userIDFromContext(r.Context())
	if err != nil {
		httputil.WriteErrorResponse(w, http.StatusUnauthorized, "Unauthorized", "Unable to determine user identity")
		return uuid.Nil, false
	}

	return userID, true
}
