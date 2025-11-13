#!/bin/bash

# ============================================================================
# Pre-Deployment Verification Script
# ============================================================================
# This script verifies that the Pricing Tool application is ready for
# deployment to staging or production environments.
#
# Usage:
#   chmod +x verify-build.sh
#   ./verify-build.sh
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed
# ============================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_check() {
    echo -e "${YELLOW}[CHECK]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED++))
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED++))
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARNINGS++))
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# ============================================================================
# Check 1: Verify Required Files Exist
# ============================================================================
print_header "Check 1: Required Files"

required_files=(
    "package.json"
    "tsconfig.json"
    "next.config.ts"
    ".env.local.example"
    "supabase-schema.sql"
    "DEPLOYMENT.md"
    "SUPABASE_SETUP.md"
    "STAGING_DEPLOYMENT.md"
)

print_check "Checking required files..."

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        print_pass "Found: $file"
    else
        print_fail "Missing: $file"
    fi
done

# Check for app directory structure
if [ -d "app" ]; then
    print_pass "Found: app/ directory (Next.js 13+ App Router)"
else
    print_fail "Missing: app/ directory"
fi

# Check for lib directory
if [ -d "lib" ]; then
    print_pass "Found: lib/ directory"
else
    print_warning "Missing: lib/ directory (optional)"
fi

# ============================================================================
# Check 2: Verify Environment Variables Documentation
# ============================================================================
print_header "Check 2: Environment Variables"

print_check "Checking .env.local.example..."

if [ -f ".env.local.example" ]; then
    # Check for required environment variables
    required_vars=(
        "NEXT_PUBLIC_SUPABASE_URL"
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    )

    for var in "${required_vars[@]}"; do
        if grep -q "$var" .env.local.example; then
            print_pass "Documented: $var"
        else
            print_fail "Not documented: $var"
        fi
    done

    # Check that .env.local is gitignored
    if [ -f ".gitignore" ]; then
        if grep -q ".env.local" .gitignore; then
            print_pass ".env.local is in .gitignore"
        else
            print_fail ".env.local is NOT in .gitignore (security risk!)"
        fi
    else
        print_warning ".gitignore file not found"
    fi
else
    print_fail ".env.local.example not found"
fi

# ============================================================================
# Check 3: Verify Database Schema
# ============================================================================
print_header "Check 3: Database Schema"

print_check "Checking supabase-schema.sql..."

if [ -f "supabase-schema.sql" ]; then
    # Check for Phase 1 tables
    phase1_tables=(
        "users"
        "products"
        "quotes"
        "quote_lines"
        "uploads"
        "events"
    )

    for table in "${phase1_tables[@]}"; do
        if grep -q "CREATE TABLE.*$table" supabase-schema.sql; then
            print_pass "Phase 1 table: $table"
        else
            print_fail "Phase 1 table missing: $table"
        fi
    done

    # Check for Phase 2 tables
    phase2_tables=(
        "item_options"
        "option_values"
    )

    for table in "${phase2_tables[@]}"; do
        if grep -q "CREATE TABLE.*$table" supabase-schema.sql; then
            print_pass "Phase 2 table: $table"
        else
            print_fail "Phase 2 table missing: $table"
        fi
    done

    # Check for RLS policies
    if grep -q "ALTER TABLE.*ENABLE ROW LEVEL SECURITY" supabase-schema.sql; then
        print_pass "RLS policies found"
    else
        print_fail "RLS policies not found"
    fi

    # Check for triggers
    if grep -q "CREATE TRIGGER" supabase-schema.sql; then
        print_pass "Triggers found"
    else
        print_warning "No triggers found (may be intentional)"
    fi

    # Check for validation function
    if grep -q "validate_product_options" supabase-schema.sql; then
        print_pass "Option validation function found"
    else
        print_fail "Option validation function missing"
    fi

    # Verify schema is idempotent
    if grep -q "IF NOT EXISTS" supabase-schema.sql; then
        print_pass "Schema is idempotent (CREATE IF NOT EXISTS)"
    else
        print_warning "Schema may not be idempotent"
    fi
else
    print_fail "supabase-schema.sql not found"
fi

# ============================================================================
# Check 4: Verify Dependencies
# ============================================================================
print_header "Check 4: Dependencies"

print_check "Checking package.json dependencies..."

if [ -f "package.json" ]; then
    # Check for critical dependencies
    critical_deps=(
        "next"
        "react"
        "react-dom"
        "@supabase/supabase-js"
        "@supabase/ssr"
        "typescript"
    )

    for dep in "${critical_deps[@]}"; do
        if grep -q "\"$dep\"" package.json; then
            print_pass "Dependency: $dep"
        else
            print_fail "Missing dependency: $dep"
        fi
    done

    # Check for test dependencies
    if grep -q "jest" package.json; then
        print_pass "Testing framework: jest"
    else
        print_warning "Jest not found (testing recommended)"
    fi

    # Check for build scripts
    if grep -q "\"build\":" package.json; then
        print_pass "Build script found"
    else
        print_fail "Build script missing in package.json"
    fi

    if grep -q "\"test\":" package.json; then
        print_pass "Test script found"
    else
        print_warning "Test script missing in package.json"
    fi
else
    print_fail "package.json not found"
fi

# ============================================================================
# Check 5: Install Dependencies
# ============================================================================
print_header "Check 5: Node Modules"

print_check "Checking node_modules..."

if [ -d "node_modules" ]; then
    print_pass "node_modules directory exists"
else
    print_warning "node_modules not found, installing dependencies..."
    npm install
    if [ $? -eq 0 ]; then
        print_pass "Dependencies installed successfully"
    else
        print_fail "Failed to install dependencies"
    fi
fi

# ============================================================================
# Check 6: TypeScript Compilation
# ============================================================================
print_header "Check 6: TypeScript Compilation"

print_check "Running TypeScript type check..."

if command -v npx &> /dev/null; then
    # Use tsc if available, otherwise use next build --dry-run
    if npx tsc --noEmit --skipLibCheck 2>&1; then
        print_pass "TypeScript compilation successful"
    else
        print_fail "TypeScript compilation failed (see errors above)"
    fi
else
    print_warning "npx not found, skipping TypeScript check"
fi

# ============================================================================
# Check 7: Linting
# ============================================================================
print_header "Check 7: Code Linting"

print_check "Running ESLint..."

if grep -q "\"lint\":" package.json; then
    if npm run lint 2>&1; then
        print_pass "Linting passed"
    else
        print_warning "Linting issues found (non-blocking)"
    fi
else
    print_warning "Lint script not found in package.json"
fi

# ============================================================================
# Check 8: Run Tests
# ============================================================================
print_header "Check 8: Tests"

print_check "Running test suite..."

if grep -q "\"test\":" package.json; then
    # Set CI environment to avoid watch mode
    export CI=true

    if npm test -- --passWithNoTests 2>&1; then
        print_pass "All tests passed"
    else
        print_fail "Tests failed (see errors above)"
    fi
else
    print_warning "Test script not found, skipping tests"
fi

# ============================================================================
# Check 9: Build Verification
# ============================================================================
print_header "Check 9: Production Build"

print_check "Attempting production build..."

if npm run build 2>&1; then
    print_pass "Production build successful"

    # Check that .next directory was created
    if [ -d ".next" ]; then
        print_pass "Build output directory created"

        # Check build size
        build_size=$(du -sh .next 2>/dev/null | cut -f1)
        print_info "Build size: $build_size"
    else
        print_fail "Build output directory not found"
    fi
else
    print_fail "Production build failed (see errors above)"
fi

# ============================================================================
# Check 10: Documentation
# ============================================================================
print_header "Check 10: Documentation"

print_check "Checking deployment documentation..."

docs=(
    "README.md"
    "DEPLOYMENT.md"
    "SUPABASE_SETUP.md"
    "STAGING_DEPLOYMENT.md"
)

for doc in "${docs[@]}"; do
    if [ -f "$doc" ]; then
        print_pass "Found: $doc"
    else
        print_warning "Missing: $doc (recommended)"
    fi
done

# ============================================================================
# Check 11: Security Checks
# ============================================================================
print_header "Check 11: Security"

print_check "Running security checks..."

# Check for hardcoded secrets in code
if grep -r -i "supabase\.co" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" app/ lib/ 2>/dev/null | grep -v "process.env" | grep -v "example"; then
    print_fail "Found hardcoded Supabase URLs in code (use environment variables)"
else
    print_pass "No hardcoded Supabase URLs found"
fi

# Check for API keys in code
if grep -r "eyJhbG" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" app/ lib/ 2>/dev/null; then
    print_fail "Found potential API keys in code (security risk!)"
else
    print_pass "No API keys found in code"
fi

# Check for .env files in git
if git ls-files | grep -E "^\.env\.local$|^\.env$" 2>/dev/null; then
    print_fail ".env files are tracked by git (remove them!)"
else
    print_pass ".env files are not tracked by git"
fi

# ============================================================================
# Check 12: Git Status
# ============================================================================
print_header "Check 12: Git Repository"

print_check "Checking git status..."

if command -v git &> /dev/null; then
    if git rev-parse --git-dir > /dev/null 2>&1; then
        print_pass "Git repository detected"

        # Check for uncommitted changes
        if [ -n "$(git status --porcelain)" ]; then
            print_warning "Uncommitted changes detected:"
            git status --short
            print_info "Consider committing changes before deployment"
        else
            print_pass "No uncommitted changes"
        fi

        # Check current branch
        current_branch=$(git branch --show-current)
        print_info "Current branch: $current_branch"

        # Check if branch is pushed to remote
        if git ls-remote --exit-code --heads origin "$current_branch" &>/dev/null; then
            print_pass "Branch is pushed to remote"
        else
            print_warning "Branch is not pushed to remote"
        fi
    else
        print_warning "Not a git repository"
    fi
else
    print_warning "Git not installed"
fi

# ============================================================================
# Summary
# ============================================================================
print_header "Verification Summary"

echo ""
echo -e "${GREEN}Passed:${NC}   $PASSED"
echo -e "${YELLOW}Warnings:${NC} $WARNINGS"
echo -e "${RED}Failed:${NC}   $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ ALL CHECKS PASSED${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${GREEN}Your application is ready for deployment!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review STAGING_DEPLOYMENT.md for deployment instructions"
    echo "  2. Set up Supabase staging environment"
    echo "  3. Deploy to Vercel staging"
    echo "  4. Run full testing suite in staging"
    echo ""
    exit 0
else
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}✗ CHECKS FAILED${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
    echo -e "${RED}Please fix the issues above before deploying.${NC}"
    echo ""
    echo "Common fixes:"
    echo "  - Install missing dependencies: npm install"
    echo "  - Fix TypeScript errors: npm run build"
    echo "  - Run tests: npm test"
    echo "  - Review failed checks above"
    echo ""
    exit 1
fi
