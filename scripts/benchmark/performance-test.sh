#!/bin/bash

# Frys Performance Benchmark Suite
# =================================
# This script runs comprehensive performance benchmarks for Frys

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/benchmark-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_DIR="$RESULTS_DIR/$TIMESTAMP"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Setup function
setup() {
    log_info "Setting up benchmark environment..."

    # Create results directory
    mkdir -p "$REPORT_DIR"

    # Check if Frys is running
    if ! curl -f http://localhost:8080/health > /dev/null 2>&1; then
        log_error "Frys is not running on localhost:8080"
        log_info "Please start Frys before running benchmarks"
        exit 1
    fi

    # Check if k6 is installed
    if ! command -v k6 &> /dev/null; then
        log_error "k6 is not installed. Please install k6: https://k6.io/docs/get-started/installation/"
        exit 1
    fi

    # Check if hey is installed
    if ! command -v hey &> /dev/null; then
        log_warning "hey is not installed. Some benchmarks will be skipped."
        log_info "Install hey: go install github.com/rakyll/hey@latest"
    fi

    log_success "Benchmark environment setup complete"
}

# Memory benchmark
memory_benchmark() {
    log_info "Running memory benchmark..."

    local report_file="$REPORT_DIR/memory-benchmark.json"

    # Start memory monitoring in background
    {
        while true; do
            echo "$(date +%s),$(ps aux | grep frys | grep -v grep | awk '{print $6}')" >> "$REPORT_DIR/memory-usage.csv"
            sleep 1
        done
    } &
    local monitor_pid=$!

    # Run memory-intensive operations
    log_info "Running memory-intensive workflow operations..."

    # Create multiple concurrent workflows
    for i in {1..50}; do
        curl -s -X POST http://localhost:8080/api/v1/workflows/instances \
            -H "Content-Type: application/json" \
            -d "{\"definitionId\": \"memory-test-workflow\", \"context\": {\"iteration\": $i}}" &
    done

    # Wait for operations to complete
    wait

    # Stop memory monitoring
    kill $monitor_pid 2>/dev/null || true

    # Generate memory report
    cat > "$report_file" << EOF
{
    "benchmark": "memory_usage",
    "timestamp": "$(date -Iseconds)",
    "duration_seconds": 60,
    "peak_memory_mb": $(awk -F',' 'BEGIN {max=0} {if ($2>max) max=$2} END {print max/1024}' "$REPORT_DIR/memory-usage.csv" 2>/dev/null || echo "0"),
    "average_memory_mb": $(awk -F',' '{sum+=$2} END {print sum/NR/1024}' "$REPORT_DIR/memory-usage.csv" 2>/dev/null || echo "0"),
    "concurrent_workflows": 50
}
EOF

    log_success "Memory benchmark completed: $report_file"
}

# CPU benchmark
cpu_benchmark() {
    log_info "Running CPU benchmark..."

    local report_file="$REPORT_DIR/cpu-benchmark.json"

    # Start CPU monitoring in background
    {
        while true; do
            echo "$(date +%s),$(ps aux | grep frys | grep -v grep | awk '{print $3}')" >> "$REPORT_DIR/cpu-usage.csv"
            sleep 1
        done
    } &
    local monitor_pid=$!

    # Run CPU-intensive operations
    log_info "Running CPU-intensive AI inference operations..."

    # Simulate AI inference requests
    for i in {1..100}; do
        curl -s -X POST http://localhost:8080/api/v1/ai/inference \
            -H "Content-Type: application/json" \
            -d "{\"model\": \"cpu-test-model\", \"prompt\": \"Analyze this text for sentiment: The performance benchmark shows excellent results with high throughput and low latency.\", \"max_tokens\": 100}" &
    done

    # Wait for operations to complete
    wait

    # Stop CPU monitoring
    kill $monitor_pid 2>/dev/null || true

    # Generate CPU report
    cat > "$report_file" << EOF
{
    "benchmark": "cpu_usage",
    "timestamp": "$(date -Iseconds)",
    "duration_seconds": 60,
    "peak_cpu_percent": $(awk -F',' 'BEGIN {max=0} {if ($2>max) max=$2} END {print max}' "$REPORT_DIR/cpu-usage.csv" 2>/dev/null || echo "0"),
    "average_cpu_percent": $(awk -F',' '{sum+=$2} END {print sum/NR}' "$REPORT_DIR/cpu-usage.csv" 2>/dev/null || echo "0"),
    "concurrent_requests": 100
}
EOF

    log_success "CPU benchmark completed: $report_file"
}

# API benchmark using hey
api_benchmark() {
    if ! command -v hey &> /dev/null; then
        log_warning "Skipping API benchmark - hey not installed"
        return
    fi

    log_info "Running API benchmark with hey..."

    local endpoints=(
        "GET:http://localhost:8080/health"
        "GET:http://localhost:8080/api/v1/workflows"
        "GET:http://localhost:8080/metrics"
    )

    for endpoint in "${endpoints[@]}"; do
        local method=$(echo $endpoint | cut -d: -f1)
        local url=$(echo $endpoint | cut -d: -f2-)
        local endpoint_name=$(basename "$url" | sed 's/[^a-zA-Z0-9]/-/g')

        log_info "Benchmarking $method $url..."

        hey -n 1000 -c 50 -m $method "$url" > "$REPORT_DIR/api-${endpoint_name}.txt"

        # Extract key metrics
        local response_time=$(grep -o "Total time: [0-9.]*" "$REPORT_DIR/api-${endpoint_name}.txt" | awk '{print $3}')
        local requests_per_sec=$(grep -o "Requests/sec:[[:space:]]*[0-9.]*" "$REPORT_DIR/api-${endpoint_name}.txt" | awk '{print $2}')

        cat > "$REPORT_DIR/api-${endpoint_name}-metrics.json" << EOF
{
    "endpoint": "$url",
    "method": "$method",
    "total_requests": 1000,
    "concurrency": 50,
    "response_time_seconds": ${response_time:-0},
    "requests_per_second": ${requests_per_sec:-0},
    "timestamp": "$(date -Iseconds)"
}
EOF
    done

    log_success "API benchmark completed"
}

# Database benchmark
database_benchmark() {
    log_info "Running database benchmark..."

    local report_file="$REPORT_DIR/database-benchmark.json"

    # Start timing
    local start_time=$(date +%s)

    # Run database-intensive operations
    log_info "Running database-intensive workflow operations..."

    # Create workflows with complex data
    for i in {1..100}; do
        curl -s -X POST http://localhost:8080/api/v1/workflows/instances \
            -H "Content-Type: application/json" \
            -d "{
                \"definitionId\": \"db-test-workflow\",
                \"context\": {
                    \"userId\": \"user_$i\",
                    \"data\": \"$(openssl rand -hex 100)\",
                    \"metadata\": {
                        \"created\": \"$(date -Iseconds)\",
                        \"tags\": [\"benchmark\", \"database\", \"test\"],
                        \"complex_object\": {
                            \"nested\": {
                                \"value\": $i,
                                \"array\": [1,2,3,4,5,6,7,8,9,10]
                            }
                        }
                    }
                }
            }" &
    done

    # Wait for operations to complete
    wait

    # End timing
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # Generate database report
    cat > "$report_file" << EOF
{
    "benchmark": "database_performance",
    "timestamp": "$(date -Iseconds)",
    "duration_seconds": $duration,
    "operations_count": 100,
    "operations_per_second": $(echo "scale=2; 100 / $duration" | bc -l 2>/dev/null || echo "0"),
    "data_size_kb": 100,
    "complexity": "high"
}
EOF

    log_success "Database benchmark completed: $report_file"
}

# Load test using k6
k6_load_test() {
    log_info "Running k6 load test..."

    # Set environment variables for k6
    export BASE_URL="http://localhost:8080"
    export TEST_AI="false"
    export REPORT_PATH="$REPORT_DIR"

    # Run k6 test
    k6 run --out json="$REPORT_DIR/k6-results.json" "$SCRIPT_DIR/load-test.js"

    log_success "K6 load test completed: $REPORT_DIR/k6-results.json"
}

# Generate summary report
generate_summary() {
    log_info "Generating benchmark summary..."

    local summary_file="$REPORT_DIR/benchmark-summary.json"

    # Collect all benchmark results
    local memory_peak=$(jq -r '.peak_memory_mb // 0' "$REPORT_DIR/memory-benchmark.json" 2>/dev/null || echo "0")
    local cpu_peak=$(jq -r '.peak_cpu_percent // 0' "$REPORT_DIR/cpu-benchmark.json" 2>/dev/null || echo "0")
    local db_ops_per_sec=$(jq -r '.operations_per_second // 0' "$REPORT_DIR/database-benchmark.json" 2>/dev/null || echo "0")

    # API metrics
    local health_rps=$(jq -r '.requests_per_second // 0' "$REPORT_DIR/api-health-metrics.json" 2>/dev/null || echo "0")
    local workflows_rps=$(jq -r '.requests_per_second // 0' "$REPORT_DIR/api-api-metrics.json" 2>/dev/null || echo "0")

    cat > "$summary_file" << EOF
{
    "benchmark_summary": {
        "timestamp": "$(date -Iseconds)",
        "duration_minutes": 10,
        "system_info": {
            "os": "$(uname -s)",
            "kernel": "$(uname -r)",
            "cpu_cores": "$(nproc 2>/dev/null || echo 'unknown')",
            "memory_gb": "$(free -g | awk 'NR==2{printf "%.1f", $2/1024}' 2>/dev/null || echo 'unknown')"
        },
        "performance_metrics": {
            "memory_usage_mb": {
                "peak": $memory_peak,
                "threshold": 1024,
                "status": "$([ $(echo "$memory_peak < 1024" | bc -l 2>/dev/null) ] && echo "PASS" || echo "FAIL")"
            },
            "cpu_usage_percent": {
                "peak": $cpu_peak,
                "threshold": 80,
                "status": "$([ $(echo "$cpu_peak < 80" | bc -l 2>/dev/null) ] && echo "PASS" || echo "FAIL")"
            },
            "database_operations_per_second": {
                "value": $db_ops_per_sec,
                "threshold": 50,
                "status": "$([ $(echo "$db_ops_per_sec > 50" | bc -l 2>/dev/null) ] && echo "PASS" || echo "FAIL")"
            }
        },
        "api_performance": {
            "health_endpoint_rps": $health_rps,
            "workflows_endpoint_rps": $workflows_rps
        },
        "recommendations": [
            $([ $(echo "$memory_peak > 1024" | bc -l 2>/dev/null) ] && echo "\"Consider increasing memory limits or optimizing memory usage\"" || echo "null"),
            $([ $(echo "$cpu_peak > 80" | bc -l 2>/dev/null) ] && echo "\"Consider optimizing CPU-intensive operations\"" || echo "null"),
            $([ $(echo "$db_ops_per_sec < 50" | bc -l 2>/dev/null) ] && echo "\"Consider database optimization or connection pooling\"" || echo "null")
        ] | grep -v null | jq -s '.'
    }
}
EOF

    log_success "Benchmark summary generated: $summary_file"
    log_info "Results saved to: $REPORT_DIR"
}

# Main function
main() {
    log_info "Starting Frys Performance Benchmark Suite"
    log_info "Results will be saved to: $REPORT_DIR"

    setup

    # Run benchmarks
    memory_benchmark
    cpu_benchmark
    api_benchmark
    database_benchmark
    k6_load_test

    # Generate summary
    generate_summary

    log_success "All benchmarks completed successfully!"
    log_info ""
    log_info "📊 Benchmark Results Summary:"
    log_info "=============================="

    if [ -f "$REPORT_DIR/benchmark-summary.json" ]; then
        jq -r '
            .benchmark_summary.performance_metrics |
            to_entries[] |
            "✅ \(.key): \(.value.value) (\(.value.status))"
        ' "$REPORT_DIR/benchmark-summary.json" 2>/dev/null || echo "Summary parsing failed"
    fi

    log_info ""
    log_info "📁 Detailed results: $REPORT_DIR"
    log_info "🔍 View summary: cat $REPORT_DIR/benchmark-summary.json | jq"
}

# Cleanup function
cleanup() {
    # Kill any background processes
    pkill -f "memory-usage.csv" 2>/dev/null || true
    pkill -f "cpu-usage.csv" 2>/dev/null || true
}

# Set trap for cleanup
trap cleanup EXIT

# Run main function
main "$@"
