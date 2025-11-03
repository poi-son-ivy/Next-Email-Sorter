import { render, screen } from '@testing-library/react';
import { SignOut } from '../sign-out';

// Mock the auth actions
jest.mock('@/app/actions/auth', () => ({
  signOutAction: jest.fn(),
}));

describe('SignOut', () => {
  it('renders sign out button', () => {
    render(<SignOut />);

    const button = screen.getByRole('button', { name: /sign out/i });
    expect(button).toBeInTheDocument();
  });

  it('renders as a form', () => {
    const { container } = render(<SignOut />);

    const form = container.querySelector('form');
    expect(form).toBeInTheDocument();
  });

  it('button has correct styling', () => {
    render(<SignOut />);

    const button = screen.getByRole('button', { name: /sign out/i });
    expect(button.className).toContain('bg-red-600');
    expect(button.className).toContain('text-white');
    expect(button.className).toContain('rounded-lg');
  });

  it('button type is submit', () => {
    render(<SignOut />);

    const button = screen.getByRole('button', { name: /sign out/i });
    expect(button).toHaveAttribute('type', 'submit');
  });
});
