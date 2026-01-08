# Contributing to Secure AI Chat

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/Secure-Ai-Chat.git
   cd Secure-Ai-Chat
   ```
3. **Install dependencies**:
   ```bash
   npm install
   # or use the setup script
   ./scripts/setup.sh  # Unix/Linux/macOS
   # or
   .\scripts\setup.ps1  # Windows
   ```
4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

## Development Workflow

### Running Locally

1. **Start the development server**:
   ```bash
   npm run dev
   ```
2. **Open** [http://localhost:3000](http://localhost:3000) in your browser

### Code Quality

Before submitting a pull request, ensure:

1. **Type checking passes**:
   ```bash
   npm run type-check
   ```

2. **Linting passes**:
   ```bash
   npm run lint
   ```

3. **Code is formatted**:
   ```bash
   npm run format
   ```

4. **Build succeeds**:
   ```bash
   npm run build
   ```

## Branch Naming

Use descriptive branch names:

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions/updates

## Pull Request Process

1. **Update documentation** if you've changed functionality
2. **Update CHANGELOG.md** with your changes
3. **Ensure all checks pass** (CI will run automatically)
4. **Write a clear PR description** explaining:
   - What changes were made
   - Why the changes were necessary
   - How to test the changes
5. **Link any related issues** in the PR description

### PR Checklist

- [ ] Code follows the existing style and conventions
- [ ] TypeScript types are properly defined (no `any` types)
- [ ] ESLint passes without errors
- [ ] Type checking passes
- [ ] Build succeeds
- [ ] Documentation is updated (if needed)
- [ ] CHANGELOG.md is updated

## Code Style

- **TypeScript**: Use proper types, avoid `any`
- **React**: Use functional components with hooks
- **Formatting**: Run `npm run format` before committing
- **Naming**: Use descriptive, camelCase variable names
- **Comments**: Add comments for complex logic

## Commit Messages

Write clear, descriptive commit messages:

```
feat: Add file upload security scanning
fix: Resolve TypeScript error in scan route
docs: Update installation instructions
refactor: Improve error handling in API routes
```

Use conventional commit format:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `test:` - Tests
- `chore:` - Maintenance tasks

## Questions?

If you have questions or need help, please:
- Open a GitHub issue with the `question` label
- Check existing issues and discussions

Thank you for contributing! 🎉
