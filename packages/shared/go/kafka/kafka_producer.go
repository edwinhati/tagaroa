package kafka

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	kafkago "github.com/segmentio/kafka-go"
)

// Producer defines the interface for sending messages to Kafka topics.
type Producer interface {
	Publish(ctx context.Context, msg Message) error
	Close() error
}

// Message represents a Kafka message payload.
type Message struct {
	Topic   string
	Key     []byte
	Value   []byte
	Headers map[string]string
}

// Config captures the parameters required for establishing a Kafka producer.
type Config struct {
	Brokers                []string
	ClientID               string
	BatchSize              int
	BatchBytes             int
	BatchTimeout           time.Duration
	ReadTimeout            time.Duration
	WriteTimeout           time.Duration
	AllowAutoTopicCreation bool
}

// Option customises the producer during construction. Mainly intended for testing.
type Option func(*producer)

var (
	// ErrNoBrokers indicates that no bootstrap servers were provided.
	ErrNoBrokers = errors.New("kafka: no brokers configured")
	// ErrMissingTopic indicates that the message topic was empty.
	ErrMissingTopic = errors.New("kafka: message topic is required")
	// ErrMissingGroupID indicates that the consumer group id was empty.
	ErrMissingGroupID = errors.New("kafka: group id is required")
	// ErrNoTopics indicates that no topics were supplied for consumption.
	ErrNoTopics = errors.New("kafka: at least one topic is required")
	// ErrNilHandler indicates that a nil handler was supplied to the consumer.
	ErrNilHandler = errors.New("kafka: handler is required")
)

type writer interface {
	WriteMessages(ctx context.Context, msgs ...kafkago.Message) error
	Close() error
}

type writerFactory func(topic string) writer

type producer struct {
	cfg       Config
	mu        sync.RWMutex
	writers   map[string]writer
	newWriter writerFactory
}

// NewProducer builds a Kafka producer using the provided configuration.
func NewProducer(cfg Config, opts ...Option) (Producer, error) {
	cfg = cfg.withDefaults()
	if err := cfg.validate(); err != nil {
		return nil, err
	}

	p := &producer{
		cfg:       cfg,
		writers:   make(map[string]writer),
		newWriter: defaultWriterFactory(cfg),
	}

	for _, opt := range opts {
		opt(p)
	}

	return p, nil
}

// WithWriterFactory overrides the writer factory for testing.
func WithWriterFactory(factory writerFactory) Option {
	return func(p *producer) {
		if factory != nil {
			p.newWriter = factory
		}
	}
}

func (p *producer) Publish(ctx context.Context, msg Message) error {
	topic := strings.TrimSpace(msg.Topic)
	if topic == "" {
		return ErrMissingTopic
	}

	writer, err := p.writerForTopic(topic)
	if err != nil {
		return err
	}

	kmsg := kafkago.Message{
		Key:     msg.Key,
		Value:   msg.Value,
		Headers: convertHeaders(msg.Headers),
		Time:    time.Now().UTC(),
	}

	return writer.WriteMessages(ctx, kmsg)
}

func (p *producer) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	var errs []error
	for topic, w := range p.writers {
		if err := w.Close(); err != nil {
			errs = append(errs, fmt.Errorf("kafka: close writer for topic %s: %w", topic, err))
		}
		delete(p.writers, topic)
	}

	return errors.Join(errs...)
}

func (p *producer) writerForTopic(topic string) (writer, error) {
	p.mu.RLock()
	w, ok := p.writers[topic]
	p.mu.RUnlock()
	if ok {
		return w, nil
	}

	p.mu.Lock()
	defer p.mu.Unlock()

	if w, ok := p.writers[topic]; ok {
		return w, nil
	}

	writer := p.newWriter(topic)
	if writer == nil {
		return nil, fmt.Errorf("kafka: writer factory returned nil for topic %s", topic)
	}

	p.writers[topic] = writer
	return writer, nil
}

func (cfg Config) withDefaults() Config {
	if cfg.BatchSize <= 0 {
		cfg.BatchSize = 100
	}
	if cfg.BatchBytes <= 0 {
		cfg.BatchBytes = 1 << 20 // 1 MiB
	}
	if cfg.BatchTimeout <= 0 {
		cfg.BatchTimeout = 50 * time.Millisecond
	}
	if cfg.ReadTimeout <= 0 {
		cfg.ReadTimeout = 10 * time.Second
	}
	if cfg.WriteTimeout <= 0 {
		cfg.WriteTimeout = 10 * time.Second
	}
	return cfg
}

func (cfg Config) validate() error {
	if len(cfg.Brokers) == 0 {
		return ErrNoBrokers
	}
	return nil
}

func defaultWriterFactory(cfg Config) writerFactory {
	var transport *kafkago.Transport
	if trimmed := strings.TrimSpace(cfg.ClientID); trimmed != "" {
		transport = &kafkago.Transport{ClientID: trimmed}
	}

	return func(topic string) writer {
		return &kafkago.Writer{
			Addr:                   kafkago.TCP(cfg.Brokers...),
			Topic:                  topic,
			Balancer:               &kafkago.Hash{},
			BatchSize:              cfg.BatchSize,
			BatchBytes:             int64(cfg.BatchBytes),
			BatchTimeout:           cfg.BatchTimeout,
			ReadTimeout:            cfg.ReadTimeout,
			WriteTimeout:           cfg.WriteTimeout,
			AllowAutoTopicCreation: cfg.AllowAutoTopicCreation,
			Transport:              transport,
		}
	}
}

func convertHeaders(headers map[string]string) []kafkago.Header {
	if len(headers) == 0 {
		return nil
	}

	keys := make([]string, 0, len(headers))
	for key := range headers {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	kHeaders := make([]kafkago.Header, 0, len(headers))
	for _, key := range keys {
		kHeaders = append(kHeaders, kafkago.Header{
			Key:   key,
			Value: []byte(headers[key]),
		})
	}
	return kHeaders
}
