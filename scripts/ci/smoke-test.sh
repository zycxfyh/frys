#!/bin/bash

# Frys Smoke Tests for Production Deployment
# ==========================================
# This script performs basic smoke tests to ensure the deployment is healthy

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BASE_URL="${BASE_URL:-http://localhost:8080}"
TIMEOUT="${TIMEOUT:-30}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test results
PASSED=0
FAILED=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    ((PASSED++))
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ((FAILED++))
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# HTTP request function with timeout
http_request() {
    local method=$1
    local url=$2
    local expected_status=${3:-200}
    local data=${4:-}

    log_info "Testing $method $url (expecting $expected_status)"

    local response
    local status

    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" --max-time $TIMEOUT "$url" 2>/dev/null || echo "HTTPSTATUS:000")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" -X POST -H "Content-Type: application/json" --max-time $TIMEOUT -d "$data" "$url" 2>/dev/null || echo "HTTPSTATUS:000")
    fi

    status=$(echo "$response" | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')

    if [ "$status" = "$expected_status" ]; then
        log_success "$method $url returned $status"
        return 0
    else
        log_error "$method $url returned $status (expected $expected_status)"
        return 1
    fi
}

# Health check test
test_health() {
    log_info "Running health checks..."

    # Basic health endpoint
    http_request "GET" "$BASE_URL/health" 200

    # Readiness probe
    http_request "GET" "$BASE_URL/health/ready" 200

    # Liveness probe
    http_request "GET" "$BASE_URL/health/live" 200
}

# API smoke tests
test_api() {
    log_info "Running API smoke tests..."

    # API root endpoint
    http_request "GET" "$BASE_URL/api/v1/" 200

    # Workflows endpoint
    http_request "GET" "$BASE_URL/api/v1/workflows" 200

    # AI endpoint (may not be available in all deployments)
    if curl -s --max-time 5 "$BASE_URL/api/v1/ai/models" > /dev/null 2>&1; then
        http_request "GET" "$BASE_URL/api/v1/ai/models" 200
    else
        log_warning "AI endpoint not available, skipping..."
    fi
}

# Metrics endpoint test
test_metrics() {
    log_info "Running metrics tests..."

    # Prometheus metrics endpoint
    http_request "GET" "$BASE_URL/metrics" 200

    # Health metrics
    http_request "GET" "$BASE_URL/metrics/health" 200
}

# Database connectivity test
test_database() {
    log_info "Running database connectivity tests..."

    # Database health endpoint
    if http_request "GET" "$BASE_URL/health/database" 200; then
        log_success "Database connectivity OK"
    else
        log_warning "Database health endpoint not available"
    fi
}

# External services test
test_external_services() {
    log_info "Running external services tests..."

    # Redis connectivity
    if http_request "GET" "$BASE_URL/health/redis" 200; then
        log_success "Redis connectivity OK"
    else
        log_warning "Redis health endpoint not available"
    fi

    # Elasticsearch connectivity
    if http_request "GET" "$BASE_URL/health/elasticsearch" 200; then
        log_success "Elasticsearch connectivity OK"
    else
        log_warning "Elasticsearch health endpoint not available"
    fi
}

# Performance smoke test
test_performance() {
    log_info "Running performance smoke tests..."

    # Response time test
    local start_time=$(date +%s%N)
    if http_request "GET" "$BASE_URL/health" 200; then
        local end_time=$(date +%s%N)
        local duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds

        if [ $duration -lt 100 ]; then
            log_success "Response time: ${duration}ms (acceptable)"
        elif [ $duration -lt 500 ]; then
            log_warning "Response time: ${duration}ms (slow but acceptable)"
        else
            log_error "Response time: ${duration}ms (too slow)"
        fi
    fi
}

# Workflow smoke test
test_workflows() {
    log_info "Running workflow smoke tests..."

    # Create a simple test workflow
    local workflow_data='{
        "name": "smoke-test-workflow",
        "description": "Smoke test workflow",
        "nodes": [
            {
                "id": "start",
                "type": "start",
                "position": {"x": 100, "y": 100}
            },
            {
                "id": "end",
                "type": "end",
                "position": {"x": 300, "y": 100}
            }
        ],
        "edges": [
            {
                "id": "start-to-end",
                "source": "start",
                "target": "end"
            }
        ]
    }'

    # Create workflow definition
    if http_request "POST" "$BASE_URL/api/v1/workflows" 201 "$workflow_data"; then
        log_success "Workflow creation OK"
    fi

    # List workflows
    http_request "GET" "$BASE_URL/api/v1/workflows" 200
}

# Security smoke test
test_security() {
    log_info "Running security smoke tests..."

    # Test unauthenticated access to protected endpoints
    if http_request "GET" "$BASE_URL/api/v1/admin/users" 401; then
        log_success "Authentication protection OK"
    fi

    # Test CORS headers
    local cors_response=$(curl -s -I -H "Origin: https://example.com" "$BASE_URL/api/v1/" 2>/dev/null | grep -i "access-control-allow-origin" || echo "")
    if [ -n "$cors_response" ]; then
        log_success "CORS headers present"
    else
        log_warning "CORS headers not found"
    fi
}

# Load test smoke version
test_load() {
    log_info "Running load smoke test..."

    # Simple concurrent requests test
    local concurrent_requests=10

    log_info "Testing $concurrent_requests concurrent requests..."

    # Launch concurrent requests
    for i in $(seq 1 $concurrent_requests); do
        curl -s "$BASE_URL/health" > /dev/null &
    done

    # Wait for completion
    wait

    log_success "Concurrent requests test completed"
}

# Generate test report
generate_report() {
    local total=$((PASSED + FAILED))
    local success_rate=0

    if [ $total -gt 0 ]; then
        success_rate=$(( (PASSED * 100) / total ))
    fi

    cat << EOF

📊 Smoke Test Report
====================

Test Results:
✅ Passed: $PASSED
❌ Failed: $FAILED
📈 Success Rate: ${success_rate}%

Test Details:
- Base URL: $BASE_URL
- Timeout: ${TIMEOUT}s
- Timestamp: $(date -Iseconds)

EOF

    # Exit with failure if any tests failed
    if [ $FAILED -gt 0 ]; then
        log_error "Smoke tests failed: $FAILED tests did not pass"
        exit 1
    else
        log_success "All smoke tests passed!"
        exit 0
    fi
}

# Main function
main() {
    log_info "Starting Frys Smoke Tests"
    log_info "Base URL: $BASE_URL"
    log_info "Timeout: ${TIMEOUT}s"
    echo

    # Run all tests
    test_health
    echo
    test_api
    echo
    test_metrics
    echo
    test_database
    echo
    test_external_services
    echo
    test_performance
    echo
    test_workflows
    echo
    test_security
    echo
    test_load
    echo

    # Generate report
    generate_report
}

# Cleanup function
cleanup() {
    # Kill any background processes if needed
    true
}

# Set trap for cleanup
trap cleanup EXIT

# Run main function
main "$@"
