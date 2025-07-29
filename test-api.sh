#!/bin/bash

echo "Testing ShowPass Backend API..."
echo "================================"

# Test health check
echo "1. Testing health check:"
curl -s http://localhost:3000/ | head -1
echo -e "\n"

# Test events endpoint
echo "2. Testing events (should return events):"
EVENTS_COUNT=$(curl -s http://localhost:3000/api/events | jq '.data | length')
echo "Events found: $EVENTS_COUNT"
echo ""

# Test admin login
echo "3. Testing admin login:"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mustapha.muhammed@bowen.edu.ng","password":"Balikiss12"}')

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
    echo "✅ Admin login successful"
    TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token')
    echo "Token generated: ${TOKEN:0:20}..."
else
    echo "❌ Admin login failed"
    echo "$LOGIN_RESPONSE"
fi
echo ""

# Test organizer login
echo "4. Testing organizer login:"
ORG_LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"louisdiaz43@gmail.com","password":"Balikiss12"}')

if echo "$ORG_LOGIN_RESPONSE" | grep -q '"success":true'; then
    echo "✅ Organizer login successful"
else
    echo "❌ Organizer login failed"
    echo "$ORG_LOGIN_RESPONSE"
fi
echo ""

# Test user login
echo "5. Testing user login:"
USER_LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"muhammedabiodun42@gmail.com","password":"Balikiss12"}')

if echo "$USER_LOGIN_RESPONSE" | grep -q '"success":true'; then
    echo "✅ User login successful"
else
    echo "❌ User login failed"
    echo "$USER_LOGIN_RESPONSE"
fi
echo ""

echo "API Testing Complete!"
echo "====================="
echo "🌐 Server running at: http://localhost:3000"
echo "📚 Full API documentation available in README.md"
