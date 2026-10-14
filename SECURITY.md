# Security policy

The extension runs inside the user's logged-in carrier session and handles customer addresses.
Treat every bug in that path as a security bug.

## Reporting

Report vulnerabilities privately through GitHub Security Advisories:
https://github.com/DuckDiveLab/parcelhaste-extension/security/advisories/new

Do not open a public issue. We acknowledge within 7 days and keep you informed.

## Scope

- The extension code, its build and release pipeline, and the supply chain (ADR-0007).
- Leaks of customer or order data, sessions or tokens; actions on the carrier portal the user did
  not request; code execution in the extension context.

Out of scope: vulnerabilities in carrier portals themselves (report them to the carrier), and
issues that require a compromised browser profile.

## Supported versions

Pre-alpha: only the `main` branch. There are no store releases yet.
