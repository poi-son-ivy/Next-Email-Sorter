import { render, screen, fireEvent } from '@testing-library/react';
import { EmailCard } from '../email-card';
import { Email } from '@/lib/generated/prisma';

// Mock email data
const mockEmail: Email = {
  id: '1',
  userId: 'user-1',
  gmailId: 'gmail-1',
  threadId: 'thread-1',
  subject: 'Test Email Subject',
  from: 'John Doe <john@example.com>',
  to: ['recipient@example.com'],
  snippet: 'This is a test email snippet',
  summary: 'AI generated summary of the email',
  labelIds: ['INBOX'],
  receivedAt: new Date('2024-01-15T10:00:00Z'),
  categoryId: null,
  unsubscribeUrl: null,
  unsubscribeStatus: null,
  createdAt: new Date('2024-01-15T10:00:00Z'),
  updatedAt: new Date('2024-01-15T10:00:00Z'),
};

describe('EmailCard', () => {
  const mockOnClick = jest.fn();
  const mockOnToggleSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders email information correctly', () => {
    render(<EmailCard email={mockEmail} onClick={mockOnClick} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Test Email Subject')).toBeInTheDocument();
    expect(screen.getByText('AI generated summary of the email')).toBeInTheDocument();
    expect(screen.getByText('recipient@example.com')).toBeInTheDocument();
  });

  it('displays avatar with first letter of sender', () => {
    render(<EmailCard email={mockEmail} onClick={mockOnClick} />);

    const avatar = screen.getByText('J');
    expect(avatar).toBeInTheDocument();
  });

  it('calls onClick when card is clicked', () => {
    render(<EmailCard email={mockEmail} onClick={mockOnClick} />);

    const card = screen.getByText('Test Email Subject').closest('div');
    fireEvent.click(card!);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('renders checkbox when onToggleSelect is provided', () => {
    render(
      <EmailCard
        email={mockEmail}
        onClick={mockOnClick}
        onToggleSelect={mockOnToggleSelect}
        isSelected={false}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it('shows checked checkbox when isSelected is true', () => {
    render(
      <EmailCard
        email={mockEmail}
        onClick={mockOnClick}
        onToggleSelect={mockOnToggleSelect}
        isSelected={true}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('calls onToggleSelect when checkbox is clicked', () => {
    render(
      <EmailCard
        email={mockEmail}
        onClick={mockOnClick}
        onToggleSelect={mockOnToggleSelect}
        isSelected={false}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox.parentElement!);

    expect(mockOnToggleSelect).toHaveBeenCalledTimes(1);
    expect(mockOnClick).not.toHaveBeenCalled(); // Should not trigger card click
  });

  it('decodes HTML entities in subject', () => {
    const emailWithEncodedSubject = {
      ...mockEmail,
      subject: 'Test &amp; Subject &#39;with&#39; entities',
    };

    render(<EmailCard email={emailWithEncodedSubject} onClick={mockOnClick} />);

    expect(screen.getByText("Test & Subject 'with' entities")).toBeInTheDocument();
  });

  it('displays "(No subject)" when subject is empty', () => {
    const emailWithoutSubject = {
      ...mockEmail,
      subject: '',
    };

    render(<EmailCard email={emailWithoutSubject} onClick={mockOnClick} />);

    expect(screen.getByText('(No subject)')).toBeInTheDocument();
  });

  it('falls back to snippet when summary is not available', () => {
    const emailWithoutSummary = {
      ...mockEmail,
      summary: null,
    };

    render(<EmailCard email={emailWithoutSummary} onClick={mockOnClick} />);

    expect(screen.getByText('This is a test email snippet')).toBeInTheDocument();
  });

  it('formats recent dates as "Just now"', () => {
    const recentEmail = {
      ...mockEmail,
      receivedAt: new Date(), // Current time
    };

    render(<EmailCard email={recentEmail} onClick={mockOnClick} />);

    expect(screen.getByText('Just now')).toBeInTheDocument();
  });

  it('formats dates within 24 hours as hours ago', () => {
    const hoursAgo = new Date();
    hoursAgo.setHours(hoursAgo.getHours() - 5);

    const emailHoursAgo = {
      ...mockEmail,
      receivedAt: hoursAgo,
    };

    render(<EmailCard email={emailHoursAgo} onClick={mockOnClick} />);

    expect(screen.getByText('5h ago')).toBeInTheDocument();
  });

  it('applies border style for ATTEMPTED unsubscribe status', () => {
    const emailWithAttemptedUnsubscribe = {
      ...mockEmail,
      unsubscribeStatus: 'ATTEMPTED' as const,
    };

    const { container } = render(
      <EmailCard email={emailWithAttemptedUnsubscribe} onClick={mockOnClick} />
    );

    const card = container.firstChild as HTMLElement;
    expect(card.style.borderLeft).toBe('4px solid rgb(234, 179, 8)'); // yellow-500
  });

  it('applies border style for SUCCEEDED unsubscribe status', () => {
    const emailWithSucceededUnsubscribe = {
      ...mockEmail,
      unsubscribeStatus: 'SUCCEEDED' as const,
    };

    const { container } = render(
      <EmailCard email={emailWithSucceededUnsubscribe} onClick={mockOnClick} />
    );

    const card = container.firstChild as HTMLElement;
    expect(card.style.borderLeft).toBe('4px solid rgb(34, 197, 94)'); // green-500
  });

  it('applies border style for FAILED unsubscribe status', () => {
    const emailWithFailedUnsubscribe = {
      ...mockEmail,
      unsubscribeStatus: 'FAILED' as const,
    };

    const { container } = render(
      <EmailCard email={emailWithFailedUnsubscribe} onClick={mockOnClick} />
    );

    const card = container.firstChild as HTMLElement;
    expect(card.style.borderLeft).toBe('4px solid rgb(239, 68, 68)'); // red-500
  });

  it('has no border when unsubscribe status is null', () => {
    const { container } = render(
      <EmailCard email={mockEmail} onClick={mockOnClick} />
    );

    const card = container.firstChild as HTMLElement;
    expect(card.style.borderLeft).toBe('');
  });

  it('applies selected background class when isSelected is true', () => {
    const { container } = render(
      <EmailCard
        email={mockEmail}
        onClick={mockOnClick}
        onToggleSelect={mockOnToggleSelect}
        isSelected={true}
      />
    );

    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('bg-blue-50');
  });
});
