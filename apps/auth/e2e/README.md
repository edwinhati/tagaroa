# Auth App E2E Tests

This directory contains Playwright end-to-end tests for the Auth application.

## Test Structure

```
e2e/
├── sign-in.e2e.ts         # Sign-in page tests
├── sign-up.e2e.ts         # Sign-up page tests
├── forgot-password.e2e.ts # Forgot password page tests
├── navigation.e2e.ts      # Navigation flow tests
├── fixtures.ts            # Shared test fixtures and utilities
└── README.md              # This file
```

## Running Tests

```bash
# Run all tests
bun run test:e2e

# Run tests with UI mode
bun run test:e2e:ui

# Run specific test file
bun run test:e2e sign-in.e2e.ts

# Show test report
bun run test:e2e:report
```

## Test Coverage

### Sign-in Page
- Form rendering and accessibility
- Email/password validation
- Invalid credentials handling
- Server errors handling
- Loading states
- Navigation to forgot-password and sign-up
- Keyboard navigation

### Sign-up Page
- Form rendering and accessibility
- Field validation (name, email, password)
- Duplicate email handling
- Successful registration flow
- Navigation to sign-in

### Forgot Password Page
- Form rendering
- Email validation
- Success and error states
- Navigation back to sign-in

### Navigation
- Page-to-page navigation
- Protected route redirects
- 404 handling

## Configuration

Tests are configured in `playwright.config.ts`:
- Multiple browsers (Chromium, Firefox, WebKit)
- Mobile devices (Pixel 5, iPhone 12)
- Screenshots and videos on failure
- HTML and list reporters

## Environment Variables

Copy `.env.test.example` to `.env.test` and configure:

```bash
TEST_EMAIL=your-test-email@example.com
TEST_PASSWORD=your-test-password
```

## Best Practices

1. Use `test.beforeEach` for common setup
2. Mock API calls for consistent test data
3. Test both success and error scenarios
4. Include accessibility checks
5. Test keyboard navigation
6. Use semantic selectors (getByRole, getByText)
