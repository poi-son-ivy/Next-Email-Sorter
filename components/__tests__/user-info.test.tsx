import { render, screen } from '@testing-library/react';
import { UserInfo } from '../user-info';

// Mock the auth module and SignOut component
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('../sign-out', () => ({
  SignOut: () => <div data-testid="sign-out-component">Sign Out</div>,
}));

const { auth } = require('@/lib/auth');

describe('UserInfo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when user is not authenticated', async () => {
    auth.mockResolvedValue(null);

    const result = await UserInfo();
    expect(result).toBeNull();
  });

  it('renders nothing when session exists but user is missing', async () => {
    auth.mockResolvedValue({ user: null });

    const result = await UserInfo();
    expect(result).toBeNull();
  });

  it('renders user information when authenticated', async () => {
    auth.mockResolvedValue({
      user: {
        name: 'John Doe',
        email: 'john@example.com',
      },
    });

    const result = await UserInfo();
    render(result as any);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('displays header text', async () => {
    auth.mockResolvedValue({
      user: {
        name: 'John Doe',
        email: 'john@example.com',
      },
    });

    const result = await UserInfo();
    render(result as any);

    expect(screen.getByText('Connected Account')).toBeInTheDocument();
  });

  it('shows Gmail access granted message when accessToken is present', async () => {
    auth.mockResolvedValue({
      user: {
        name: 'John Doe',
        email: 'john@example.com',
      },
      accessToken: 'mock-access-token',
    });

    const result = await UserInfo();
    render(result as any);

    expect(screen.getByText('✓ Gmail access granted')).toBeInTheDocument();
  });

  it('does not show Gmail access message when accessToken is missing', async () => {
    auth.mockResolvedValue({
      user: {
        name: 'John Doe',
        email: 'john@example.com',
      },
    });

    const result = await UserInfo();
    render(result as any);

    expect(screen.queryByText('✓ Gmail access granted')).not.toBeInTheDocument();
  });

  it('renders SignOut component when authenticated', async () => {
    auth.mockResolvedValue({
      user: {
        name: 'John Doe',
        email: 'john@example.com',
      },
    });

    const result = await UserInfo();
    render(result as any);

    expect(screen.getByTestId('sign-out-component')).toBeInTheDocument();
  });
});
