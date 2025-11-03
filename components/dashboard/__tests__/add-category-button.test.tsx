import { render, screen, fireEvent } from '@testing-library/react';
import { AddCategoryButton } from '../add-category-button';

describe('AddCategoryButton', () => {
  const mockOnClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders button with correct text', () => {
    render(<AddCategoryButton onClick={mockOnClick} />);

    expect(screen.getByText('Add Category')).toBeInTheDocument();
  });

  it('renders plus icon', () => {
    const { container } = render(<AddCategoryButton onClick={mockOnClick} />);

    const plusIcon = container.querySelector('svg path[d="M12 4v16m8-8H4"]');
    expect(plusIcon).toBeInTheDocument();
  });

  it('calls onClick when button is clicked', () => {
    render(<AddCategoryButton onClick={mockOnClick} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('has correct styling classes', () => {
    const { container } = render(<AddCategoryButton onClick={mockOnClick} />);

    const button = container.firstChild as HTMLElement;
    expect(button.className).toContain('border-dashed');
    expect(button.className).toContain('rounded-lg');
    expect(button.className).toContain('cursor-pointer');
  });

  it('is accessible as a button', () => {
    render(<AddCategoryButton onClick={mockOnClick} />);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });
});
