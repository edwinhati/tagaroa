package logger

import (
	"bytes"
	"encoding/json"
	"os"
	"strings"
	"sync"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var (
	once     sync.Once
	zapSugar *zap.SugaredLogger
)

// New constructs a lazily initialised sugared logger configured through env vars.
func New() *zap.SugaredLogger {
	once.Do(func() {
		cfg := loadConfig()

		encoderCfg := zapcore.EncoderConfig{
			TimeKey:        "timestamp",
			LevelKey:       "level",
			NameKey:        "logger",
			CallerKey:      "caller",
			MessageKey:     "msg",
			StacktraceKey:  "stacktrace",
			LineEnding:     zapcore.DefaultLineEnding,
			EncodeLevel:    zapcore.LowercaseLevelEncoder,
			EncodeTime:     zapcore.TimeEncoderOfLayout(time.RFC3339Nano),
			EncodeDuration: zapcore.StringDurationEncoder,
			EncodeCaller:   zapcore.ShortCallerEncoder,
		}

		if !cfg.addSource {
			encoderCfg.CallerKey = ""
		}

		var (
			encoder zapcore.Encoder
			syncer  = zapcore.AddSync(os.Stdout)
		)

		switch cfg.format {
		case formatConsole:
			encoderCfg.EncodeLevel = zapcore.CapitalColorLevelEncoder
			encoder = zapcore.NewConsoleEncoder(encoderCfg)
		case formatJSONPretty:
			encoder = zapcore.NewJSONEncoder(encoderCfg)
			syncer = &prettySyncer{WriteSyncer: syncer}
		default:
			encoder = zapcore.NewJSONEncoder(encoderCfg)
		}

		core := zapcore.NewCore(encoder, syncer, cfg.level)
		options := []zap.Option{
			zap.AddCallerSkip(1),
			zap.AddStacktrace(zapcore.ErrorLevel),
		}
		if cfg.addSource {
			options = append(options, zap.AddCaller())
		}

		baseLogger := zap.New(core, options...)
		zapSugar = baseLogger.Sugar()
	})

	return zapSugar
}

type loggerConfig struct {
	level     zap.AtomicLevel
	format    logFormat
	addSource bool
}

type logFormat string

const (
	formatJSONCompact logFormat = "json_compact"
	formatJSONPretty  logFormat = "json_pretty"
	formatConsole     logFormat = "console"
)

func loadConfig() loggerConfig {
	level := parseLevel(os.Getenv("LOG_LEVEL"))
	format := parseFormat(os.Getenv("LOG_FORMAT"))
	addSource := parseBool(os.Getenv("LOG_ADD_SOURCE"))

	return loggerConfig{
		level:     zap.NewAtomicLevelAt(level),
		format:    format,
		addSource: addSource,
	}
}

func parseLevel(level string) zapcore.Level {
	switch strings.ToLower(strings.TrimSpace(level)) {
	case "debug":
		return zapcore.DebugLevel
	case "warn":
		return zapcore.WarnLevel
	case "error":
		return zapcore.ErrorLevel
	case "panic":
		return zapcore.PanicLevel
	default:
		return zapcore.InfoLevel
	}
}

func parseFormat(format string) logFormat {
	switch strings.ToLower(strings.TrimSpace(format)) {
	case "console", "pretty":
		return formatConsole
	case "json", "", "json_pretty", "pretty_json", "json-pretty":
		return formatJSONPretty
	case "json_compact", "json-compact", "compact", "raw":
		return formatJSONCompact
	default:
		return formatJSONPretty
	}
}

func parseBool(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "t", "true", "yes", "y", "on":
		return true
	default:
		return false
	}
}

type prettySyncer struct {
	zapcore.WriteSyncer
}

func (p *prettySyncer) Write(bs []byte) (int, error) {
	trimmed := bytes.TrimSpace(bs)
	if len(trimmed) > 0 && trimmed[0] == '{' && trimmed[len(trimmed)-1] == '}' {
		var buf bytes.Buffer
		if err := json.Indent(&buf, trimmed, "", "  "); err == nil {
			buf.WriteByte('\n')
			return p.WriteSyncer.Write(buf.Bytes())
		}
	}
	return p.WriteSyncer.Write(bs)
}

func (p *prettySyncer) Sync() error {
	return p.WriteSyncer.Sync()
}
