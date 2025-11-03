import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AccountCard } from '../account-card';
import { Account } from '@/lib/generated/prisma';

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

const mockAccount: Account = {
  id: 'account-1',
  userId: 'user-1',
  provider: 'google',
  providerAccountId: 'provider-123',
  refresh_token: 'refresh-token',
  access_token: 'access-token',
  expires_at: null,
  token_type: 'Bearer',
  scope: 'email profile',
  id_token: null,
  session_state: null,
  email: 'test@example.com',
  name: 'Test User',
  picture: 'https://example.com/avatar.jpg',
  historyId: null,
  watchExpiration: null,
  createdAt: new Date('2024-01-15T10:00:00Z'),
  updatedAt: new Date('2024-01-15T10:00:00Z'),
};

describe('AccountCard', () => {
  const defaultProps = {
    userEmail: 'user@example.com',
    userName: 'User Name',
    userImage: 'https://example.com/user.jpg',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    global.alert = jest.fn();
    global.confirm = jest.fn();
    // window.location mock is set up globally in jest.setup.js
  });

  it('renders account information correctly', () => {
    render(<AccountCard account={mockAccount} {...defaultProps} />);

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('falls back to user data when account data is null', () => {
    const accountWithoutData = {
      ...mockAccount,
      email: null,
      name: null,
      picture: null,
    };

    render(<AccountCard account={accountWithoutData} {...defaultProps} />);

    expect(screen.getByText('User Name')).toBeInTheDocument();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });

  it('displays active status when access_token is present', () => {
    render(<AccountCard account={mockAccount} {...defaultProps} />);

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByTitle('Connected')).toBeInTheDocument();
  });

  it('displays inactive status when access_token is null', () => {
    const inactiveAccount = { ...mockAccount, access_token: null };
    render(<AccountCard account={inactiveAccount} {...defaultProps} />);

    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByTitle('Disconnected')).toBeInTheDocument();
  });

  it('displays watching status when historyId is present', () => {
    const watchingAccount = { ...mockAccount, historyId: 'history-123' };
    render(<AccountCard account={watchingAccount} {...defaultProps} />);

    expect(screen.getByText('Watching')).toBeInTheDocument();
  });

  it('displays "Start Watching" button when not watching', () => {
    render(<AccountCard account={mockAccount} {...defaultProps} />);

    expect(screen.getByText('Start Watching')).toBeInTheDocument();
  });

  it('disables "Start Watching" button when account is inactive', () => {
    const inactiveAccount = { ...mockAccount, access_token: null };
    render(<AccountCard account={inactiveAccount} {...defaultProps} />);

    const button = screen.getByText('Start Watching').closest('button');
    expect(button).toBeDisabled();
  });

  it('starts watching when "Start Watching" button is clicked', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, historyId: 'new-history-id' }),
    });

    render(<AccountCard account={mockAccount} {...defaultProps} />);

    const button = screen.getByText('Start Watching').closest('button');
    fireEvent.click(button!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/gmail/watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: 'account-1' }),
      });
    });

    expect(global.alert).toHaveBeenCalledWith('Successfully started watching for new emails!');
  });

  it('shows loading state while starting watch', async () => {
    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ ok: true, json: async () => ({}) }), 100))
    );

    render(<AccountCard account={mockAccount} {...defaultProps} />);

    const button = screen.getByText('Start Watching').closest('button');
    fireEvent.click(button!);

    await waitFor(() => {
      expect(screen.getByText('Starting...')).toBeInTheDocument();
    });
  });

  it('handles watch start error gracefully', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Failed to watch' }),
    });

    render(<AccountCard account={mockAccount} {...defaultProps} />);

    const button = screen.getByText('Start Watching').closest('button');
    fireEvent.click(button!);

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Failed to watch');
    });
  });

  it('shows delete button', () => {
    render(<AccountCard account={mockAccount} {...defaultProps} />);

    const deleteButton = screen.getByTitle('Delete account');
    expect(deleteButton).toBeInTheDocument();
  });

  it('asks for confirmation before deleting account', async () => {
    (global.confirm as jest.Mock).mockReturnValue(false);

    render(<AccountCard account={mockAccount} {...defaultProps} />);

    const deleteButton = screen.getByTitle('Delete account');
    fireEvent.click(deleteButton);

    expect(global.confirm).toHaveBeenCalledWith(
      expect.stringContaining('Are you sure you want to delete this account')
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('deletes account when confirmed', async () => {
    (global.confirm as jest.Mock).mockReturnValue(true);
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<AccountCard account={mockAccount} {...defaultProps} />);

    const deleteButton = screen.getByTitle('Delete account');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/accounts/account-1', {
        method: 'DELETE',
      });
    });

    expect(global.alert).toHaveBeenCalledWith('Account deleted successfully!');
  });

  it('handles delete error gracefully', async () => {
    (global.confirm as jest.Mock).mockReturnValue(true);
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Delete failed' }),
    });

    render(<AccountCard account={mockAccount} {...defaultProps} />);

    const deleteButton = screen.getByTitle('Delete account');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Delete failed');
    });
  });

  it('renders avatar image when picture is provided', () => {
    render(<AccountCard account={mockAccount} {...defaultProps} />);

    const image = screen.getByAltText('Test User');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('renders initial avatar when no picture is provided', () => {
    const accountWithoutPicture = {
      ...mockAccount,
      picture: null,
      name: 'Test User',
    };

    // Override userImage to null to test initial avatar rendering
    render(<AccountCard account={accountWithoutPicture} {...defaultProps} userImage={null} />);

    expect(screen.getByText('T')).toBeInTheDocument(); // First letter of name
  });

  it('displays Google provider badge', () => {
    render(<AccountCard account={mockAccount} {...defaultProps} />);

    expect(screen.getByText('Google')).toBeInTheDocument();
  });
});
