# Contributing to QuickIPTV Player

Thank you for contributing to QuickIPTV Player. This document explains how to propose changes, prepare development environments, and submit high-quality pull requests.

## Scope

Contributions are welcome for:

- Bug fixes
- UI improvements
- Playback reliability improvements
- Performance improvements
- Documentation updates
- Build and release workflow improvements

## Before You Start

Please follow these guidelines before opening a pull request:

1. Check existing issues and pull requests to avoid duplicate work.
2. Keep changes focused on a single topic when possible.
3. Prefer small, reviewable pull requests over large mixed changes.
4. Update documentation when behavior or setup changes.

## Development Setup

### Prerequisites

- Node.js 22 or later
- npm 10 or later
- Git

### Clone and install

```bash
git clone https://github.com/PAPPURAJ/Quick-IPTV-Player-Windows.git
cd Quick-IPTV-Player-Windows
npm install
```

## Local Workflow

### Start the renderer

```bash
npm run dev
```

### Start the desktop app

```bash
npm run dev:desktop
```

### Run linting

```bash
npm run lint
```

### Build for production

```bash
npm run build
```

### Build the Windows installer

```bash
npm run dist:win
```

## Branching

Create branches from `master` and use descriptive names.

Examples:

- `fix/player-hls-reconnect`
- `feat/default-playlist-bootstrap`
- `docs/rewrite-readme`

## Pull Request Guidelines

Each pull request should include:

- A clear title
- A summary of what changed
- The reason for the change
- Notes about testing performed
- Screenshots if the UI changed

Try to keep each pull request limited to one logical change.

## Code Style

Please follow the existing project conventions:

- Use clear names
- Keep components and helpers readable
- Avoid unnecessary complexity
- Preserve the existing project structure unless refactoring is part of the change
- Keep comments short and useful

## Testing Expectations

Before submitting a pull request, run the relevant checks locally:

```bash
npm run lint
npm run build
```

If your change affects packaging or desktop behavior, also test:

```bash
npm run dist:win
```

## Documentation Expectations

Update documentation when you change:

- Setup instructions
- Build commands
- Release behavior
- User-facing features
- Configuration expectations

At minimum, update `README.md` when the main project workflow changes.

## Releases

This repository supports two release paths:

### Automatic prereleases

Pushes to `master` or `main` create automatic prerelease builds through GitHub Actions.

### Versioned releases

To publish a versioned release:

1. Update `package.json`
2. Update `package-lock.json`
3. Commit the version bump
4. Push the branch
5. Create a matching `vX.Y.Z` tag
6. Push the tag

Example:

```bash
git add package.json package-lock.json
git commit -m "Release 1.1.0"
git push origin master
git tag v1.1.0
git push origin v1.1.0
```

## Reporting Issues

When reporting a bug, include:

- Operating system and version
- App version
- Steps to reproduce
- Expected behavior
- Actual behavior
- Playlist type or stream type if relevant
- Logs or screenshots if available

## Security and Sensitive Data

Please do not commit:

- Private playlist URLs that should remain confidential
- Authentication tokens
- Secrets in workflow files
- Generated release artifacts

## Questions and Discussion

If a change is large or architectural, open an issue first so the approach can be discussed before implementation.
