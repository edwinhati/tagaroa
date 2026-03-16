# Finance App E2E Tests

This directory contains Playwright end-to-end tests for the Finance application.

## Test Structure

```
e2e/
├── accounts.e2e.ts        # Accounts page tests
├── budgets.e2e.ts         # Budgets page tests
├── dashboard.e2e.ts       # Dashboard page tests
├── global-setup.ts        # Global test setup (authentication)
├── global-teardown.ts     # Global test teardown
├── not-found.e2e.ts       # 404 page tests
├── settings.e2e.ts        # Settings page tests
├── transactions.e2e.ts    # Transactions page tests
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
bun run test:e2e dashboard.e2e.ts

# Run tests in headed mode (see browser)
bun run test:e2e --headed

# Show test report
bun run test:e2e:report
```

## Test Coverage

### Dashboard Page
- Page rendering and title
- Sidebar navigation
- Financial summary cards
- Charts and visualizations
- API loading states
- Error handling
- Responsive design

### Accounts Page
- Empty state
- Account list display
- Add account dialog
- Form validation
- Error handling
- Accessibility

### Transactions Page
- Empty state
- Transaction list
- Search functionality
- Add transaction dialog
- Form validation
- Error handling

### Budgets Page
- Empty state
- Budget display with categories
- Progress indicators
- Create budget dialog
- Category filtering
- Error handling

### Settings Page
- Page rendering
- Settings sections
- Error handling

### 404 Page
- Not found message
- Navigation to home
- Proper status code

## Global Setup

The `global-setup.ts` file authenticates a test user before running tests:

1. Reads credentials from `.env.test`
2. Signs in via the auth app (port 3001)
3. Saves authentication state to `.auth/user.json`
4. All tests use this authenticated state

## Configuration

Tests are configured in `playwright.config.ts`:
- Multiple browsers (Chromium, Firefox, WebKit)
- Mobile devices (Pixel 5, iPhone 12)
- Screenshots and videos on failure
- Traces for debugging
- Parallel execution

## Environment Variables

Copy `.env.test.example` to `.env.test` and configure:

```bash
TEST_EMAIL=your-test-email@example.com
TEST_PASSWORD=your-test-password
TEST_AUTH_URL=http://localhost:3001
TEST_FINANCE_URL=http://localhost:3004
```

## Mock Data

Tests use Playwright's `page.route()` to mock API responses:

```typescript
await page.route("**/api/finance/accounts**", (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ accounts: [] }),
  }),
);
```

## Fixtures

Use the extended test fixture for common utilities:

```typescript
import { test, expect } from "./fixtures";

test("example", async ({ page, mockApi }) => {
  await mockApi.emptyAccounts();
  await mockApi.emptyTransactions();
  await page.goto("/dashboard");
});
```

## Best Practices

1. Mock API calls for consistent test data
2. Test both empty and populated states
3. Test error scenarios
4. Include accessibility checks
5. Test keyboard navigation and focus management
6. Use semantic selectors (getByRole, getByText, getByLabel)
7. Test responsive behavior on mobile viewports
8. Use test fixtures for common setup

## Troubleshooting

### Authentication Issues
If tests fail with authentication errors:
1. Check that `.env.test` exists and has valid credentials
2. Ensure auth app is running on port 3001
3. Run `bun run test:e2e --reporter=list` for detailed output

### Flaky Tests
- Increase timeout for slow operations
- Use `waitFor` with specific conditions
- Check for race conditions in async operations
