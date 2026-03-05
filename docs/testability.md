# Testability Guide

This document describes how AI verifies each feature through shell-based execution.

## Verification Methods

### Quick Reference
| Feature | Verification Command | Type |
| :--- | :--- | :--- |
| Domain models compile | `npm run typecheck` | Standard |
| OpenF1 API client | `npm test` | Standard |
| Session data fetcher | `npm test` | Standard |
| Stint classifier | `npm test` | Standard |
| Best lap per compound | `npm test` | Standard |
| Long-run average pace | `npm test` | Standard |
| Sector performance | `npm test` | Standard |
| Tyre degradation rate | `npm test` | Standard |
| Fuel-corrected long-run pace | `npm test` | Standard |
| Consistency metric | `npm test` | Standard |
| Speed trap & intermediate speeds | `npm test` | Standard |
| Speed comparison across stint types | `npm test` | Standard |
| Weather summary computation | `npm test` | Standard |
| Feature assembler orchestration | `npm test` | Standard |
| Session-level driver rankings | `npm test` | Standard |
| All unit tests pass | `npm test` | Standard |
| Build succeeds | `npm run build` | Standard |

## Standard Verifications

### Type Check
```bash
npm run typecheck
```
**Expected Output**: No errors, exit code 0.

### Unit Tests
```bash
npm test
```
**Expected Output**: All tests pass, exit code 0.

### Build
```bash
npm run build
```
**Expected Output**: `dist/` directory created with compiled JS and declarations, exit code 0.

## Environment Setup

### Prerequisites
- Node.js 20+
- npm

### Before Testing
```bash
npm install
```

### Cleanup
```bash
rm -rf dist
```
