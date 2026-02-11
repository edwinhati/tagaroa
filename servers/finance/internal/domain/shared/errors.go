package shared

// DomainError represents a domain-level error
type DomainError struct {
	Code    string
	Message string
}

func (e *DomainError) Error() string {
	return e.Code + ": " + e.Message
}
