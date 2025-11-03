import { render, screen, fireEvent } from '@testing-library/react';
import { AddAccountButton } from '../add-account-button';

describe('AddAccountButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete (window as any).location;
    (window as any).location = { href: '' };
  });

  it('renders button with correct text', () => {
    render(<AddAccountButton />);

    expect(screen.getByText('Connect Another Gmail Account')).toBeInTheDocument();
    expect(screen.getByText('Add more accounts to manage multiple inboxes')).toBeInTheDocument();
  });

  it('renders plus icon', () => {
    const { container } = render(<AddAccountButton />);

    const plusIcon = container.querySelector('svg path[d="M12 4v16m8-8H4"]');
    expect(plusIcon).toBeInTheDocument();
  });

  it('navigates to add-account endpoint when clicked', () => {
    render(<AddAccountButton />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(window.location.href).toBe('/api/auth/add-account');
  });

  it('has correct styling classes', () => {
    const { container } = render(<AddAccountButton />);

    const button = container.firstChild as HTMLElement;
    expect(button.className).toContain('border-dashed');
    expect(button.className).toContain('rounded-lg');
    expect(button.className).toContain('cursor-pointer');
  });

  it('is accessible as a button', () => {
    render(<AddAccountButton />);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });
});
