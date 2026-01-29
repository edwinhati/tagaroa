package event

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/edwinhati/tagaroa/packages/shared/go/kafka"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockProducer is a mock implementation of kafka.Producer
type MockProducer struct {
	mock.Mock
}

func (m *MockProducer) Publish(ctx context.Context, msg kafka.Message) error {
	args := m.Called(ctx, msg)
	return args.Error(0)
}

func (m *MockProducer) Close() error {
	args := m.Called()
	return args.Error(0)
}

func TestNewEvent(t *testing.T) {
	eventType := EventTransactionCreated
	userID := "user-123"

	// NewEvent returns an EventBuilder, we need to call Build() to get the DomainEvent
	event := NewEvent(eventType, userID).Build()

	assert.NotEmpty(t, event.ID)
	assert.Equal(t, eventType, event.Type)
	assert.Equal(t, userID, event.UserID)
	assert.False(t, event.Timestamp.IsZero())
	assert.NotNil(t, event.Payload)
	assert.Empty(t, event.CorrelationID)
}

func TestEventBuilder_WithCorrelationID(t *testing.T) {
	event := NewEvent(EventTransactionCreated, "user-123").
		WithCorrelationID("corr-123").
		Build()

	assert.Equal(t, "corr-123", event.CorrelationID)
}

func TestEventBuilder_WithPayload(t *testing.T) {
	event := NewEvent(EventTransactionCreated, "user-123").
		WithPayload("amount", 100.50).
		WithPayload("type", "income").
		Build()

	assert.Equal(t, 100.50, event.Payload["amount"])
	assert.Equal(t, "income", event.Payload["type"])
}

func TestEventBuilder_Build(t *testing.T) {
	event := NewEvent(EventBudgetCreated, "user-456").
		WithPayload("budget_id", "budget-789").
		Build()

	assert.IsType(t, &DomainEvent{}, event)
	assert.Equal(t, EventBudgetCreated, event.Type)
	assert.Equal(t, "user-456", event.UserID)
	assert.Contains(t, event.Payload, "budget_id")
}

func TestKafkaEventPublisher_Publish_Success(t *testing.T) {
	mockProducer := new(MockProducer)
	mockProducer.On("Publish", mock.Anything, mock.AnythingOfType("kafka.Message")).Return(nil)

	publisher := NewKafkaEventPublisher(mockProducer, "test-topic")

	event := NewEvent(EventTransactionCreated, "user-123").
		WithPayload("transaction_id", "tx-456").
		Build()

	err := publisher.Publish(context.Background(), event)

	assert.NoError(t, err)
	mockProducer.AssertExpectations(t)

	// Verify the message was published with correct topic and headers
	calls := mockProducer.Calls
	assert.Len(t, calls, 1)
	publishedMsg := calls[0].Arguments.Get(1).(kafka.Message)
	assert.Equal(t, "test-topic", publishedMsg.Topic)
	assert.Equal(t, []byte("user-123"), publishedMsg.Key)
	assert.Contains(t, publishedMsg.Headers, "event_type")
	assert.Equal(t, string(EventTransactionCreated), publishedMsg.Headers["event_type"])
}

func TestKafkaEventPublisher_Publish_GeneratesIDIfEmpty(t *testing.T) {
	mockProducer := new(MockProducer)
	mockProducer.On("Publish", mock.Anything, mock.AnythingOfType("kafka.Message")).Return(nil)

	publisher := NewKafkaEventPublisher(mockProducer, "test-topic")

	event := &DomainEvent{
		Type:      EventTransactionUpdated,
		UserID:    "user-123",
		Timestamp: time.Now(),
		Payload:   map[string]interface{}{"old_amount": 50.0},
	}

	err := publisher.Publish(context.Background(), event)

	assert.NoError(t, err)
	assert.NotEmpty(t, event.ID)
}

func TestKafkaEventPublisher_Publish_SetsTimestampIfZero(t *testing.T) {
	mockProducer := new(MockProducer)
	mockProducer.On("Publish", mock.Anything, mock.AnythingOfType("kafka.Message")).Return(nil)

	publisher := NewKafkaEventPublisher(mockProducer, "test-topic")

	before := time.Now().Add(-time.Minute)
	event := &DomainEvent{
		ID:        "existing-id",
		Type:      EventTransactionDeleted,
		UserID:    "user-123",
		Timestamp: time.Time{}, // Zero time
		Payload:   map[string]interface{}{},
	}

	err := publisher.Publish(context.Background(), event)

	assert.NoError(t, err)
	assert.True(t, event.Timestamp.After(before))
}

func TestKafkaEventPublisher_Publish_UsesCorrelationIDAsKey(t *testing.T) {
	mockProducer := new(MockProducer)
	mockProducer.On("Publish", mock.Anything, mock.AnythingOfType("kafka.Message")).Return(nil)

	publisher := NewKafkaEventPublisher(mockProducer, "test-topic")

	event := NewEvent(EventTransactionUpdated, "user-123").
		WithCorrelationID("correlation-xyz").
		Build()

	_ = publisher.Publish(context.Background(), event)

	calls := mockProducer.Calls
	publishedMsg := calls[0].Arguments.Get(1).(kafka.Message)
	assert.Equal(t, []byte("correlation-xyz"), publishedMsg.Key)
}

func TestKafkaEventPublisher_Publish_MarshalsEvent(t *testing.T) {
	mockProducer := new(MockProducer)
	mockProducer.On("Publish", mock.Anything, mock.AnythingOfType("kafka.Message")).Return(nil)

	publisher := NewKafkaEventPublisher(mockProducer, "test-topic")

	event := NewEvent(EventAccountBalanceUpdated, "user-123").
		WithPayload("account_id", "acc-456").
		WithPayload("new_balance", 1500.75).
		Build()

	_ = publisher.Publish(context.Background(), event)

	calls := mockProducer.Calls
	publishedMsg := calls[0].Arguments.Get(1).(kafka.Message)

	// Verify the value is valid JSON
	var publishedEvent DomainEvent
	err := json.Unmarshal(publishedMsg.Value, &publishedEvent)
	assert.NoError(t, err)
	assert.Equal(t, EventAccountBalanceUpdated, publishedEvent.Type)
	assert.Equal(t, "user-123", publishedEvent.UserID)
	assert.Equal(t, "acc-456", publishedEvent.Payload["account_id"])
	assert.Equal(t, 1500.75, publishedEvent.Payload["new_balance"])
}

func TestKafkaEventPublisher_Publish_PropagatesError(t *testing.T) {
	mockProducer := new(MockProducer)
	mockProducer.On("Publish", mock.Anything, mock.AnythingOfType("kafka.Message")).Return(assert.AnError)

	publisher := NewKafkaEventPublisher(mockProducer, "test-topic")

	event := NewEvent(EventBudgetUpdated, "user-123").Build()

	err := publisher.Publish(context.Background(), event)

	assert.Error(t, err)
	assert.Equal(t, assert.AnError, err)
}
