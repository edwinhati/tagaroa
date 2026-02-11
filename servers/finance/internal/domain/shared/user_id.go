package shared

import (
	"errors"
	"fmt"

	"github.com/google/uuid"
)

// UserID is a value object representing a user identifier
type UserID struct {
	value uuid.UUID
}

// NewUserID creates a new UserID with a random UUID
func NewUserID() UserID {
	return UserID{value: uuid.New()}
}

// UserIDFromString creates a UserID from a string representation
func UserIDFromString(s string) (UserID, error) {
	id, err := uuid.Parse(s)
	if err != nil {
		return UserID{}, fmt.Errorf("invalid user ID: %w", err)
	}
	return UserID{value: id}, nil
}

// String returns the string representation of the UserID
func (u UserID) String() string {
	return u.value.String()
}

// UUID returns the underlying uuid.UUID value
func (u UserID) UUID() uuid.UUID {
	return u.value
}

// IsZero returns true if the UserID is the zero value
func (u UserID) IsZero() bool {
	return u.value == uuid.Nil
}

// Equals returns true if two UserIDs are equal
func (u UserID) Equals(other UserID) bool {
	return u.value == other.value
}

// MustUserIDFromString creates a UserID from a string or panics
func MustUserIDFromString(s string) UserID {
	id, err := UserIDFromString(s)
	if err != nil {
		panic(err)
	}
	return id
}

// RequireValidUserID returns the UserID or an error if invalid
func RequireValidUserID(s string) (UserID, error) {
	if s == "" {
		return UserID{}, errors.New("user ID cannot be empty")
	}
	return UserIDFromString(s)
}

// UserIDFromUUID creates a UserID from a uuid.UUID
func UserIDFromUUID(id uuid.UUID) UserID {
	return UserID{value: id}
}
