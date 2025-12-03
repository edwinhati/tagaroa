package kafka

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	kafkago "github.com/segmentio/kafka-go"
)

// Handler processes a consumed Kafka message.
type Handler func(context.Context, Message) error

// Consumer defines the interface for consuming messages from Kafka topics.
type Consumer interface {
	Consume(ctx context.Context, handler Handler) error
	Close() error
}

// ConsumerConfig captures the parameters required for establishing a Kafka consumer.
type ConsumerConfig struct {
	Brokers     []string
	GroupID     string
	Topics      []string
	ClientID    string
	MinBytes    int
	MaxBytes    int
	MaxWait     time.Duration
	StartOffset int64
}

// ConsumerOption customises the consumer during construction. Mainly intended for testing.
type ConsumerOption func(*consumer)

type consumerReader interface {
	FetchMessage(ctx context.Context) (kafkago.Message, error)
	CommitMessages(ctx context.Context, msgs ...kafkago.Message) error
	Close() error
}

type readerFactory func(cfg ConsumerConfig) (consumerReader, error)

type consumer struct {
	cfg       ConsumerConfig
	reader    consumerReader
	newReader readerFactory
}

// NewConsumer builds a Kafka consumer using the provided configuration.
func NewConsumer(cfg ConsumerConfig, opts ...ConsumerOption) (Consumer, error) {
	cfg = cfg.withDefaults()
	if err := cfg.validate(); err != nil {
		return nil, err
	}

	c := &consumer{
		cfg:       cfg,
		newReader: defaultReaderFactory,
	}

	for _, opt := range opts {
		opt(c)
	}

	reader, err := c.newReader(cfg)
	if err != nil {
		return nil, fmt.Errorf("kafka: create reader: %w", err)
	}
	if reader == nil {
		return nil, fmt.Errorf("kafka: reader factory returned nil")
	}

	c.reader = reader
	return c, nil
}

// WithReaderFactory overrides the reader factory for testing.
func WithReaderFactory(factory readerFactory) ConsumerOption {
	return func(c *consumer) {
		if factory != nil {
			c.newReader = factory
		}
	}
}

func (c *consumer) Consume(ctx context.Context, handler Handler) error {
	if handler == nil {
		return ErrNilHandler
	}

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		msg, err := c.reader.FetchMessage(ctx)
		if err != nil {
			switch {
			case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
				return err
			case errors.Is(err, kafkago.ErrGenerationEnded):
				// Rebalance occurred; try fetching again.
				continue
			default:
				return fmt.Errorf("kafka: fetch message: %w", err)
			}
		}

		if err := handler(ctx, convertMessage(msg)); err != nil {
			return fmt.Errorf("kafka: handle message: %w", err)
		}

		if err := c.reader.CommitMessages(ctx, msg); err != nil {
			if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
				return err
			}
			return fmt.Errorf("kafka: commit message: %w", err)
		}
	}
}

func (c *consumer) Close() error {
	if c.reader == nil {
		return nil
	}
	return c.reader.Close()
}

func (cfg ConsumerConfig) withDefaults() ConsumerConfig {
	if cfg.MinBytes <= 0 {
		cfg.MinBytes = 1
	}
	if cfg.MaxBytes <= 0 {
		cfg.MaxBytes = 1 << 20 // 1 MiB
	}
	if cfg.MaxBytes < cfg.MinBytes {
		cfg.MaxBytes = cfg.MinBytes
	}
	if cfg.MaxWait <= 0 {
		cfg.MaxWait = 10 * time.Second
	}
	if cfg.StartOffset == 0 {
		cfg.StartOffset = kafkago.FirstOffset
	}

	cfg.GroupID = strings.TrimSpace(cfg.GroupID)
	cfg.ClientID = strings.TrimSpace(cfg.ClientID)

	topics := make([]string, 0, len(cfg.Topics))
	for _, topic := range cfg.Topics {
		if t := strings.TrimSpace(topic); t != "" {
			topics = append(topics, t)
		}
	}
	cfg.Topics = topics
	return cfg
}

func (cfg ConsumerConfig) validate() error {
	if len(cfg.Brokers) == 0 {
		return ErrNoBrokers
	}
	if cfg.GroupID == "" {
		return ErrMissingGroupID
	}
	if len(cfg.Topics) == 0 {
		return ErrNoTopics
	}
	return nil
}

func defaultReaderFactory(cfg ConsumerConfig) (consumerReader, error) {
	var dialer *kafkago.Dialer
	if cfg.ClientID != "" {
		dialer = &kafkago.Dialer{ClientID: cfg.ClientID}
	}

	return kafkago.NewReader(kafkago.ReaderConfig{
		Brokers:        cfg.Brokers,
		GroupID:        cfg.GroupID,
		GroupTopics:    cfg.Topics,
		Dialer:         dialer,
		MinBytes:       cfg.MinBytes,
		MaxBytes:       cfg.MaxBytes,
		MaxWait:        cfg.MaxWait,
		StartOffset:    cfg.StartOffset,
		CommitInterval: 0, // Commit explicitly after handler succeeds.
	}), nil
}

func convertMessage(msg kafkago.Message) Message {
	return Message{
		Topic:   msg.Topic,
		Key:     msg.Key,
		Value:   msg.Value,
		Headers: headersToMap(msg.Headers),
	}
}

func headersToMap(headers []kafkago.Header) map[string]string {
	if len(headers) == 0 {
		return nil
	}

	result := make(map[string]string, len(headers))
	for _, header := range headers {
		result[header.Key] = string(header.Value)
	}
	return result
}
