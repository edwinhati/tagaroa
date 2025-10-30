package http

import (
	"net/http"
)

// Router wraps http.ServeMux with additional functionality
type Router struct {
	mux *http.ServeMux
}

// NewRouter creates a new router
func NewRouter() *Router {
	return &Router{
		mux: http.NewServeMux(),
	}
}

// ServeHTTP implements http.Handler
func (r *Router) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	r.mux.ServeHTTP(w, req)
}

// Group creates a new router group with a prefix and middleware
func (r *Router) Group(prefix string, middleware ...func(http.Handler) http.Handler) *RouterGroup {
	return &RouterGroup{
		router:     r,
		prefix:     prefix,
		middleware: middleware,
	}
}

// Handle registers a handler for the given pattern
func (r *Router) Handle(pattern string, handler http.Handler) {
	r.mux.Handle(pattern, handler)
}

// HandleFunc registers a handler function for the given pattern
func (r *Router) HandleFunc(pattern string, handler http.HandlerFunc) {
	r.mux.HandleFunc(pattern, handler)
}

// RouterGroup represents a group of routes with common prefix and middleware
type RouterGroup struct {
	router     *Router
	prefix     string
	middleware []func(http.Handler) http.Handler
}

// Handle registers a handler for the given pattern within the group
func (g *RouterGroup) Handle(pattern string, handler http.Handler) {
	var fullPattern string

	// Check if pattern starts with HTTP method
	if len(pattern) > 0 && (pattern[0:3] == "GET" || pattern[0:4] == "POST" || pattern[0:3] == "PUT" || pattern[0:5] == "PATCH" || pattern[0:6] == "DELETE") {
		// Pattern already has method, just add prefix to path part
		parts := splitMethodAndPath(pattern)
		if len(parts) == 2 {
			fullPattern = parts[0] + " " + g.prefix + parts[1]
		} else {
			fullPattern = pattern
		}
	} else {
		// No method in pattern, just concatenate
		fullPattern = g.prefix + pattern
	}

	// Apply middleware in reverse order
	for i := len(g.middleware) - 1; i >= 0; i-- {
		handler = g.middleware[i](handler)
	}

	g.router.Handle(fullPattern, handler)
}

// splitMethodAndPath splits a pattern like "GET /path" into ["GET", "/path"]
func splitMethodAndPath(pattern string) []string {
	for i, char := range pattern {
		if char == ' ' {
			return []string{pattern[:i], pattern[i+1:]}
		}
	}
	return []string{pattern}
}

// HandleFunc registers a handler function for the given pattern within the group
func (g *RouterGroup) HandleFunc(pattern string, handler http.HandlerFunc) {
	g.Handle(pattern, handler)
}

// POST registers a POST handler
func (g *RouterGroup) POST(pattern string, handler http.HandlerFunc) {
	fullPattern := g.prefix + pattern
	wrappedHandler := applyMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		handler(w, r)
	}, g.middleware)
	g.router.HandleFunc(fullPattern, wrappedHandler)
}

// GET registers a GET handler
func (g *RouterGroup) GET(pattern string, handler http.HandlerFunc) {
	fullPattern := g.prefix + pattern
	wrappedHandler := applyMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		handler(w, r)
	}, g.middleware)
	g.router.HandleFunc(fullPattern, wrappedHandler)
}

// PUT registers a PUT handler
func (g *RouterGroup) PUT(pattern string, handler http.HandlerFunc) {
	fullPattern := g.prefix + pattern
	wrappedHandler := applyMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		handler(w, r)
	}, g.middleware)
	g.router.HandleFunc(fullPattern, wrappedHandler)
}

// PATCH registers a PATCH handler
func (g *RouterGroup) PATCH(pattern string, handler http.HandlerFunc) {
	fullPattern := g.prefix + pattern
	wrappedHandler := applyMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPatch {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		handler(w, r)
	}, g.middleware)
	g.router.HandleFunc(fullPattern, wrappedHandler)
}

// DELETE registers a DELETE handler
func (g *RouterGroup) DELETE(pattern string, handler http.HandlerFunc) {
	fullPattern := g.prefix + pattern
	wrappedHandler := applyMiddleware(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		handler(w, r)
	}, g.middleware)
	g.router.HandleFunc(fullPattern, wrappedHandler)
}

// applyMiddleware applies middleware to a handler function
func applyMiddleware(handler http.HandlerFunc, middleware []func(http.Handler) http.Handler) http.HandlerFunc {
	h := http.Handler(handler)
	// Apply middleware in reverse order
	for i := len(middleware) - 1; i >= 0; i-- {
		h = middleware[i](h)
	}
	return h.ServeHTTP
}
