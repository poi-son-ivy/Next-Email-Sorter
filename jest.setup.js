// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Silence expected errors in tests
const originalError = console.error
const originalWarn = console.warn

beforeAll(() => {
  // Silence console.error
  console.error = (...args) => {
    const firstArg = args[0]
    const errorString = String(firstArg)

    // Silence jsdom navigation errors (string format)
    if (errorString.includes('Not implemented: navigation')) {
      return
    }

    // Silence Error objects with navigation message
    if (firstArg instanceof Error && firstArg.message?.includes('Not implemented: navigation')) {
      return
    }

    // Silence expected test errors (component error handling)
    if (errorString.includes('Error starting watch:') ||
        errorString.includes('Error deleting account:')) {
      return
    }

    originalError.call(console, ...args)
  }

  // Silence console.warn
  console.warn = (...args) => {
    const firstArg = args[0]
    const warnString = String(firstArg)

    // Add any warnings to suppress here
    if (warnString.includes('Not implemented: navigation')) {
      return
    }

    originalWarn.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
  console.warn = originalWarn
})

// Mock window.location to make it testable
let currentHref = 'http://localhost/'
delete window.location
window.location = {
  get href() {
    return currentHref
  },
  set href(v) {
    currentHref = v
  },
  reload: jest.fn(),
  assign: jest.fn(),
  replace: jest.fn(),
  toString: () => currentHref,
}
