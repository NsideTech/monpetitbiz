#!/bin/bash

# Health Monitor Script for WhatsApp Bot
# This script performs basic health checks and can be used with cron for automated monitoring
# For comprehensive monitoring setup, see docs/twilio-monitoring-alerting-guide.md

set -e

# Configuration
APP_URL="${APP_URL:-http://localhost:3000}"
LOG_FILE="${LOG_FILE:-/var/log/whatsapp-bot/health-monitor.log}"
ALERT_EMAIL="${ALERT_EMAIL:-}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to log with timestamp
log_message() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Create log directory if it doesn't exist
    mkdir -p "$(dirname "$LOG_FILE")"
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    # Also output to console with colors
    case $level in
        "ERROR")
            echo -e "${RED}[$timestamp] [$level] $message${NC}"
            ;;
        "WARN")
            echo -e "${YELLOW}[$timestamp] [$level] $message${NC}"
            ;;
        "INFO")
            echo -e "${GREEN}[$timestamp] [$level] $message${NC}"
            ;;
        *)
            echo "[$timestamp] [$level] $message"
            ;;
    esac
}

# Function to send email alert
send_email_alert() {
    local subject="$1"
    local message="$2"
    
    if [ -n "$ALERT_EMAIL" ] && command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "$subject" "$ALERT_EMAIL"
        log_message "INFO" "Email alert sent to $ALERT_EMAIL"
    fi
}

# Function to send Slack alert
send_slack_alert() {
    local message="$1"
    local color="$2"  # good, warning, danger
    
    if [ -n "$SLACK_WEBHOOK" ] && command -v curl >/dev/null 2>&1; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"WhatsApp Bot Health Alert\",
                    \"text\": \"$message\",
                    \"ts\": $(date +%s)
                }]
            }" \
            "$SLACK_WEBHOOK" >/dev/null 2>&1
        log_message "INFO" "Slack alert sent"
    fi
}

# Function to send alert via all configured channels
send_alert() {
    local subject="$1"
    local message="$2"
    local severity="${3:-warning}"  # info, warning, danger
    
    log_message "ALERT" "$subject - $message"
    send_email_alert "$subject" "$message"
    send_slack_alert "$message" "$severity"
}

# Check if application is responding
check_app_health() {
    log_message "INFO" "Checking application health..."
    
    if curl -f -s --max-time 10 "$APP_URL/health" >/dev/null 2>&1; then
        log_message "INFO" "✓ Application health check passed"
        return 0
    else
        local error_msg="Application at $APP_URL is not responding to health checks"
        log_message "ERROR" "✗ $error_msg"
        send_alert "Application Health Check Failed" "$error_msg" "danger"
        return 1
    fi
}

# Check Twilio connectivity
check_twilio_health() {
    log_message "INFO" "Checking Twilio connectivity..."
    
    if curl -f -s --max-time 10 "$APP_URL/health/twilio" >/dev/null 2>&1; then
        log_message "INFO" "✓ Twilio connectivity check passed"
        return 0
    else
        local error_msg="Twilio service connectivity check failed"
        log_message "ERROR" "✗ $error_msg"
        send_alert "Twilio Connectivity Failed" "$error_msg" "danger"
        return 1
    fi
}

# Check database connectivity
check_database_health() {
    log_message "INFO" "Checking database connectivity..."
    
    if curl -f -s --max-time 10 "$APP_URL/health/database" >/dev/null 2>&1; then
        log_message "INFO" "✓ Database connectivity check passed"
        return 0
    else
        local error_msg="Database connectivity check failed"
        log_message "ERROR" "✗ $error_msg"
        send_alert "Database Connectivity Failed" "$error_msg" "danger"
        return 1
    fi
}

# Check response time
check_response_time() {
    log_message "INFO" "Checking response time..."
    
    local response_time
    if command -v curl >/dev/null 2>&1; then
        response_time=$(curl -o /dev/null -s -w '%{time_total}' --max-time 30 "$APP_URL/health" 2>/dev/null || echo "timeout")
        
        if [ "$response_time" = "timeout" ]; then
            local error_msg="Health endpoint timed out (>30s)"
            log_message "ERROR" "✗ $error_msg"
            send_alert "High Response Time" "$error_msg" "warning"
            return 1
        fi
        
        # Check if response time is greater than 2 seconds
        if command -v bc >/dev/null 2>&1 && (( $(echo "$response_time > 2.0" | bc -l) )); then
            local warn_msg="High response time detected: ${response_time}s"
            log_message "WARN" "⚠ $warn_msg"
            send_alert "High Response Time" "$warn_msg" "warning"
            return 1
        else
            log_message "INFO" "✓ Response time check passed (${response_time}s)"
            return 0
        fi
    else
        log_message "WARN" "curl not available, skipping response time check"
        return 0
    fi
}

# Check system resources
check_system_resources() {
    log_message "INFO" "Checking system resources..."
    
    # Check memory usage
    if command -v free >/dev/null 2>&1; then
        local memory_usage=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
        if command -v bc >/dev/null 2>&1 && (( $(echo "$memory_usage > 85.0" | bc -l) )); then
            local warn_msg="High memory usage: ${memory_usage}%"
            log_message "WARN" "⚠ $warn_msg"
            send_alert "High Memory Usage" "$warn_msg" "warning"
        else
            log_message "INFO" "✓ Memory usage normal (${memory_usage}%)"
        fi
    fi
    
    # Check disk space
    if command -v df >/dev/null 2>&1; then
        local disk_usage=$(df /var/log 2>/dev/null | tail -1 | awk '{print $5}' | sed 's/%//' || echo "0")
        if [ "$disk_usage" -gt 85 ]; then
            local warn_msg="High disk usage: ${disk_usage}%"
            log_message "WARN" "⚠ $warn_msg"
            send_alert "High Disk Usage" "$warn_msg" "warning"
        else
            log_message "INFO" "✓ Disk usage normal (${disk_usage}%)"
        fi
    fi
}

# Check for recent errors in application logs
check_error_logs() {
    log_message "INFO" "Checking for recent errors..."
    
    local app_log_dir="/var/log/whatsapp-bot"
    local error_threshold=10
    
    if [ -d "$app_log_dir" ]; then
        # Count errors in the last 100 lines of all log files
        local error_count=0
        for log_file in "$app_log_dir"/*.log; do
            if [ -f "$log_file" ]; then
                local file_errors=$(tail -100 "$log_file" 2>/dev/null | grep -ci "error\|critical\|fatal" || echo "0")
                error_count=$((error_count + file_errors))
            fi
        done
        
        if [ "$error_count" -gt "$error_threshold" ]; then
            local warn_msg="High error count detected: $error_count errors in recent logs"
            log_message "WARN" "⚠ $warn_msg"
            send_alert "High Error Rate" "$warn_msg" "warning"
        else
            log_message "INFO" "✓ Error rate normal ($error_count recent errors)"
        fi
    else
        log_message "WARN" "Application log directory not found: $app_log_dir"
    fi
}

# Display usage information
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -u, --url URL          Application URL (default: http://localhost:3000)"
    echo "  -l, --log FILE         Log file path (default: /var/log/whatsapp-bot/health-monitor.log)"
    echo "  -e, --email EMAIL      Alert email address"
    echo "  -s, --slack WEBHOOK    Slack webhook URL for alerts"
    echo "  -q, --quiet           Suppress console output"
    echo "  -h, --help            Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  APP_URL               Application URL"
    echo "  LOG_FILE              Log file path"
    echo "  ALERT_EMAIL           Alert email address"
    echo "  SLACK_WEBHOOK         Slack webhook URL"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Basic health check"
    echo "  $0 -e admin@company.com              # With email alerts"
    echo "  $0 -u https://api.company.com        # Custom URL"
    echo "  $0 -q                                # Quiet mode"
    echo ""
    echo "Cron Job Example:"
    echo "  */5 * * * * /path/to/health-monitor.sh -q -e admin@company.com"
}

# Parse command line arguments
QUIET=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--url)
            APP_URL="$2"
            shift 2
            ;;
        -l|--log)
            LOG_FILE="$2"
            shift 2
            ;;
        -e|--email)
            ALERT_EMAIL="$2"
            shift 2
            ;;
        -s|--slack)
            SLACK_WEBHOOK="$2"
            shift 2
            ;;
        -q|--quiet)
            QUIET=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Redirect output to /dev/null if quiet mode is enabled
if [ "$QUIET" = true ]; then
    exec 1>/dev/null
fi

# Main execution
main() {
    log_message "INFO" "Starting health monitoring checks..."
    log_message "INFO" "Application URL: $APP_URL"
    
    local failed_checks=0
    
    # Run all health checks
    check_app_health || ((failed_checks++))
    check_twilio_health || ((failed_checks++))
    check_database_health || ((failed_checks++))
    check_response_time || ((failed_checks++))
    check_system_resources || ((failed_checks++))
    check_error_logs || ((failed_checks++))
    
    # Summary
    if [ $failed_checks -eq 0 ]; then
        log_message "INFO" "✅ All health checks passed successfully"
        exit 0
    else
        log_message "ERROR" "❌ $failed_checks health check(s) failed"
        exit 1
    fi
}

# Run main function
main "$@"