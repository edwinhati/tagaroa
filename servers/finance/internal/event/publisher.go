package event

import (
	"context"
	"encoding/json"
	"time"

	"github.com/edwinhati/tagaroa/packages/shared/go/kafka"
	"github.com/edwinhati/tagaroa/packages/shared/go/logger"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type DomainEventType string

const (
	EventTransactionCreated    DomainEventType = "transaction.created"
	EventTransactionUpdated    DomainEventType = "transaction.updated"
	EventTransactionDeleted    DomainEventType = "transaction.deleted"
	EventAccountBalanceUpdated DomainEventType = "account.balance_updated"
	EventBudgetCreated         DomainEventType = "budget.created"
	EventBudgetUpdated         DomainEventType = "budget.updated"
)

type DomainEvent struct {
	ID            string                 `json:"id"`
	Type          DomainEventType        `json:"type"`
	Timestamp     time.Time              `json:"timestamp"`
	UserID        string                 `json:"user_id"`
	CorrelationID string                 `json:"correlation_id,omitempty"`
	Payload       map[string]interface{} `json:"payload"`
}

type EventPublisher interface {
	Publish(ctx context.Context, event *DomainEvent) error
}

type KafkaEventPublisher struct {
	producer kafka.Producer
	topic    string
	logger   *zap.SugaredLogger
}

func NewKafkaEventPublisher(producer kafka.Producer, topic string) *KafkaEventPublisher {
	return &KafkaEventPublisher{
		producer: producer,
		topic:    topic,
		logger:   logger.New().With("component", "event_publisher"),
	}
}

func (p *KafkaEventPublisher) Publish(ctx context.Context, event *DomainEvent) error {
	if event.ID == "" {
		event.ID = uuid.New().String()
	}
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}

	data, err := json.Marshal(event)
	if err != nil {
		p.logger.Errorw("Failed to marshal event", "error", err, "event_type", event.Type)
		return err
	}

	key := event.UserID
	if event.CorrelationID != "" {
		key = event.CorrelationID
	}

	msg := kafka.Message{
		Topic:   p.topic,
		Key:     []byte(key),
		Value:   data,
		Headers: map[string]string{"event_type": string(event.Type)},
	}

	if err := p.producer.Publish(ctx, msg); err != nil {
		p.logger.Errorw("Failed to publish event", "error", err, "event_type", event.Type, "topic", p.topic)
		return err
	}

	p.logger.Infow("Event published", "event_type", event.Type, "event_id", event.ID, "topic", p.topic)
	return nil
}

type EventBuilder struct {
	event *DomainEvent
}

func NewEvent(eventType DomainEventType, userID string) *EventBuilder {
	return &EventBuilder{
		event: &DomainEvent{
			ID:        uuid.New().String(),
			Type:      eventType,
			Timestamp: time.Now(),
			UserID:    userID,
			Payload:   make(map[string]interface{}),
		},
	}
}

func (b *EventBuilder) WithCorrelationID(id string) *EventBuilder {
	b.event.CorrelationID = id
	return b
}

func (b *EventBuilder) WithPayload(key string, value interface{}) *EventBuilder {
	b.event.Payload[key] = value
	return b
}

func (b *EventBuilder) Build() *DomainEvent {
	return b.event
}
