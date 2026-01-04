package kafka

import (
	"context"
	"errors"
	"testing"

	kafkago "github.com/segmentio/kafka-go"
	"github.com/stretchr/testify/require"
)

func TestProducerPublish(t *testing.T) {
	writers := map[string]*fakeWriter{}
	factory := func(topic string) writer {
		w := &fakeWriter{}
		writers[topic] = w
		return w
	}

	prod, err := NewProducer(Config{Brokers: []string{"localhost:29092"}}, WithWriterFactory(factory))
	require.NoError(t, err)

	payload := []byte(`{"id":"123"}`)
	err = prod.Publish(context.Background(), Message{
		Topic: "test-topic",
		Key:   []byte("key"),
		Value: payload,
		Headers: map[string]string{
			"env": "test",
		},
	})
	require.NoError(t, err)

	writer := writers["test-topic"]
	require.Len(t, writer.messages, 1)
	msg := writer.messages[0]
	require.Equal(t, payload, msg.Value)
	require.Equal(t, []byte("key"), msg.Key)
	require.Equal(t, []kafkago.Header{{Key: "env", Value: []byte("test")}}, msg.Headers)
}

func TestProducerPublishFailsWithoutTopic(t *testing.T) {
	prod, err := NewProducer(Config{Brokers: []string{"localhost:29092"}}, WithWriterFactory(func(string) writer {
		return &fakeWriter{}
	}))
	require.NoError(t, err)

	err = prod.Publish(context.Background(), Message{})
	require.ErrorIs(t, err, ErrMissingTopic)
}

func TestProducerReusesWriterPerTopic(t *testing.T) {
	callCount := 0
	factory := func(topic string) writer {
		callCount++
		return &fakeWriter{}
	}

	prod, err := NewProducer(Config{Brokers: []string{"localhost:29092"}}, WithWriterFactory(factory))
	require.NoError(t, err)

	for i := 0; i < 3; i++ {
		err := prod.Publish(context.Background(), Message{
			Topic: "topic-a",
			Value: []byte("value"),
		})
		require.NoError(t, err)
	}

	require.Equal(t, 1, callCount, "writer factory should be called once per topic")
}

func TestProducerCloseAggregatesErrors(t *testing.T) {
	errA := errors.New("close A")
	errB := errors.New("close B")

	factory := func(topic string) writer {
		switch topic {
		case "a":
			return &fakeWriter{closeErr: errA}
		case "b":
			return &fakeWriter{closeErr: errB}
		default:
			return &fakeWriter{}
		}
	}

	prod, err := NewProducer(Config{Brokers: []string{"localhost:29092"}}, WithWriterFactory(factory))
	require.NoError(t, err)

	require.NoError(t, prod.Publish(context.Background(), Message{Topic: "a", Value: []byte("1")}))
	require.NoError(t, prod.Publish(context.Background(), Message{Topic: "b", Value: []byte("2")}))

	err = prod.Close()
	require.Error(t, err)
	require.ErrorIs(t, err, errA)
	require.ErrorIs(t, err, errB)
}

type fakeWriter struct {
	messages []kafkago.Message
	writeErr error
	closeErr error
	closed   bool
}

func (fw *fakeWriter) WriteMessages(_ context.Context, msgs ...kafkago.Message) error {
	fw.messages = append(fw.messages, msgs...)
	return fw.writeErr
}

func (fw *fakeWriter) Close() error {
	fw.closed = true
	return fw.closeErr
}
