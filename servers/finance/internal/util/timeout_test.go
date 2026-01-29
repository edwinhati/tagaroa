package util

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestDefaultTimeoutConfig(t *testing.T) {
	assert.Equal(t, 10*time.Second, DefaultTimeoutConfig.Query)
	assert.Equal(t, 30*time.Second, DefaultTimeoutConfig.DB)
}

func TestWithTimeout(t *testing.T) {
	ctx, cancel := WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	assert.NotNil(t, ctx)
	assert.NotNil(t, cancel)
}

func TestWithTimeout_ContextDone(t *testing.T) {
	ctx, cancel := WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	<-ctx.Done()
	assert.Equal(t, context.DeadlineExceeded, ctx.Err())
}

func TestQueryContext(t *testing.T) {
	ctx, cancel := QueryContext(context.Background(), TimeoutConfig{Query: 100 * time.Millisecond})
	defer cancel()

	assert.NotNil(t, ctx)
	assert.NotNil(t, cancel)
}

func TestDBContext(t *testing.T) {
	ctx, cancel := DBContext(context.Background(), TimeoutConfig{DB: 200 * time.Millisecond})
	defer cancel()

	assert.NotNil(t, ctx)
	assert.NotNil(t, cancel)
}

func TestIsTimeoutError(t *testing.T) {
	tests := []struct {
		name     string
		err      error
		expected bool
	}{
		{"DeadlineExceeded is timeout", context.DeadlineExceeded, true},
		{"nil is not timeout", nil, false},
		{"Other error is not timeout", context.Canceled, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsTimeoutError(tt.err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestTimeoutConfig_CustomValues(t *testing.T) {
	config := TimeoutConfig{
		Query: 5 * time.Second,
		DB:    15 * time.Second,
	}

	assert.Equal(t, 5*time.Second, config.Query)
	assert.Equal(t, 15*time.Second, config.DB)
}

func TestDefaultQueryTimeout_Constant(t *testing.T) {
	assert.Equal(t, 10*time.Second, DefaultQueryTimeout)
}

func TestDefaultDBTimeout_Constant(t *testing.T) {
	assert.Equal(t, 30*time.Second, DefaultDBTimeout)
}
