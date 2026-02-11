package shared

import (
	"errors"
	"fmt"
)

// Currency represents ISO 4217 currency codes
type Currency string

const (
	USD Currency = "USD"
	IDR Currency = "IDR"
	EUR Currency = "EUR"
	GBP Currency = "GBP"
	JPY Currency = "JPY"
	SGD Currency = "SGD"
)

var validCurrencies = map[Currency]bool{
	USD: true,
	IDR: true,
	EUR: true,
	GBP: true,
	JPY: true,
	SGD: true,
}

// IsValid checks if the currency code is valid
func (c Currency) IsValid() bool {
	return validCurrencies[c]
}

// Money is a value object representing a monetary amount with currency
type Money struct {
	amount   float64
	currency Currency
}

// NewMoney creates a new Money value object
func NewMoney(amount float64, currency Currency) (Money, error) {
	if !currency.IsValid() {
		return Money{}, fmt.Errorf("invalid currency: %s", currency)
	}
	if amount < 0 {
		return Money{}, errors.New("amount cannot be negative")
	}
	return Money{amount: amount, currency: currency}, nil
}

// MustNewMoney creates a new Money value object or panics
func MustNewMoney(amount float64, currency Currency) Money {
	money, err := NewMoney(amount, currency)
	if err != nil {
		panic(err)
	}
	return money
}

// Amount returns the monetary amount
func (m Money) Amount() float64 {
	return m.amount
}

// Currency returns the currency
func (m Money) Currency() Currency {
	return m.currency
}

// Add adds two Money values together (must be same currency)
func (m Money) Add(other Money) (Money, error) {
	if m.currency != other.currency {
		return Money{}, fmt.Errorf("cannot add %s to %s", other.currency, m.currency)
	}
	return NewMoney(m.amount+other.amount, m.currency)
}

// Subtract subtracts other Money from this one (must be same currency)
func (m Money) Subtract(other Money) (Money, error) {
	if m.currency != other.currency {
		return Money{}, fmt.Errorf("cannot subtract %s from %s", other.currency, m.currency)
	}
	result := m.amount - other.amount
	if result < 0 {
		return Money{}, errors.New("result would be negative")
	}
	return NewMoney(result, m.currency)
}

// IsZero returns true if the amount is zero
func (m Money) IsZero() bool {
	return m.amount == 0
}

// Equals returns true if two Money values are equal
func (m Money) Equals(other Money) bool {
	return m.amount == other.amount && m.currency == other.currency
}

// GreaterThan returns true if this Money is greater than other
func (m Money) GreaterThan(other Money) (bool, error) {
	if m.currency != other.currency {
		return false, fmt.Errorf("cannot compare %s with %s", other.currency, m.currency)
	}
	return m.amount > other.amount, nil
}

// LessThan returns true if this Money is less than other
func (m Money) LessThan(other Money) (bool, error) {
	if m.currency != other.currency {
		return false, fmt.Errorf("cannot compare %s with %s", other.currency, m.currency)
	}
	return m.amount < other.amount, nil
}

// Negate returns the negative of this Money value
func (m Money) Negate() Money {
	return Money{amount: -m.amount, currency: m.currency}
}

// Abs returns the absolute value of this Money
func (m Money) Abs() Money {
	if m.amount < 0 {
		return Money{amount: -m.amount, currency: m.currency}
	}
	return m
}
