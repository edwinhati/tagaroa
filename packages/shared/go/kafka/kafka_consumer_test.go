package kafka

import (
	"context"
	"errors"
	"testing"

	kafkago "github.com/segmentio/kafka-go"
	"github.com/stretchr/testify/require"
)

func TestConsumerConsumesAndCommits(t *testing.T) {
	msg := kafkago.Message{
		Topic: "topic-a",
		Key:   []byte("key-a"),
		Value: []byte("value-a"),
		Headers: []kafkago.Header{
			{Key: "foo", Value: []byte("bar")},
		},
	}

	reader := &fakeReader{
		fetchResults: []fetchResult{
			{msg: msg},
			{err: context.Canceled},
		},
	}

	consumer, err := NewConsumer(
		ConsumerConfig{
			Brokers: []string{"localhost:29092"},
			GroupID: "group-a",
			Topics:  []string{"topic-a"},
		},
		WithReaderFactory(func(ConsumerConfig) (consumerReader, error) {
			return reader, nil
		}),
	)
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	var handled Message
	err = consumer.Consume(ctx, func(ctx context.Context, m Message) error {
		handled = m
		cancel()
		return nil
	})
	require.ErrorIs(t, err, context.Canceled)
	require.Equal(t, "topic-a", handled.Topic)
	require.Equal(t, []byte("key-a"), handled.Key)
	require.Equal(t, "bar", handled.Headers["foo"])
	require.Equal(t, 1, reader.commitCalls)
	require.NoError(t, consumer.Close())
	require.True(t, reader.closed)
}

func TestConsumerStopsOnHandlerError(t *testing.T) {
	reader := &fakeReader{
		fetchResults: []fetchResult{
			{msg: kafkago.Message{Topic: "topic-a"}},
		},
	}

	consumer, err := NewConsumer(
		ConsumerConfig{
			Brokers: []string{"localhost:29092"},
			GroupID: "group-a",
			Topics:  []string{"topic-a"},
		},
		WithReaderFactory(func(ConsumerConfig) (consumerReader, error) {
			return reader, nil
		}),
	)
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	wantErr := errors.New("handler failed")
	err = consumer.Consume(ctx, func(context.Context, Message) error {
		return wantErr
	})

	require.ErrorContains(t, err, "handler failed")
	require.Zero(t, reader.commitCalls)
	require.NoError(t, consumer.Close())
}

func TestConsumerRetriesOnRebalance(t *testing.T) {
	msg := kafkago.Message{Topic: "topic-a"}
	reader := &fakeReader{
		fetchResults: []fetchResult{
			{err: kafkago.ErrGenerationEnded}, // rebalance
			{msg: msg},
		},
	}

	consumer, err := NewConsumer(
		ConsumerConfig{
			Brokers: []string{"localhost:29092"},
			GroupID: "group-a",
			Topics:  []string{"topic-a"},
		},
		WithReaderFactory(func(ConsumerConfig) (consumerReader, error) {
			return reader, nil
		}),
	)
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err = consumer.Consume(ctx, func(context.Context, Message) error {
		cancel()
		return nil
	})
	require.ErrorIs(t, err, context.Canceled)
	require.Equal(t, 1, reader.commitCalls)
	require.NoError(t, consumer.Close())
}

func TestConsumerPropagatesCommitError(t *testing.T) {
	reader := &fakeReader{
		fetchResults: []fetchResult{
			{msg: kafkago.Message{Topic: "topic-a"}},
		},
		commitErr: errors.New("commit failed"),
	}

	consumer, err := NewConsumer(
		ConsumerConfig{
			Brokers: []string{"localhost:29092"},
			GroupID: "group-a",
			Topics:  []string{"topic-a"},
		},
		WithReaderFactory(func(ConsumerConfig) (consumerReader, error) {
			return reader, nil
		}),
	)
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	err = consumer.Consume(ctx, func(context.Context, Message) error {
		return nil
	})

	require.ErrorContains(t, err, "commit failed")
	require.Equal(t, 1, reader.commitCalls)
	require.NoError(t, consumer.Close())
}

type fetchResult struct {
	msg kafkago.Message
	err error
}

type fakeReader struct {
	fetchResults []fetchResult
	commitCalls  int
	committed    []kafkago.Message
	commitErr    error
	closed       bool
}

func (fr *fakeReader) FetchMessage(ctx context.Context) (kafkago.Message, error) {
	if len(fr.fetchResults) == 0 {
		<-ctx.Done()
		return kafkago.Message{}, ctx.Err()
	}

	result := fr.fetchResults[0]
	fr.fetchResults = fr.fetchResults[1:]

	return result.msg, result.err
}

func (fr *fakeReader) CommitMessages(_ context.Context, msgs ...kafkago.Message) error {
	fr.commitCalls++
	fr.committed = append(fr.committed, msgs...)
	return fr.commitErr
}

func (fr *fakeReader) Close() error {
	fr.closed = true
	return nil
}
