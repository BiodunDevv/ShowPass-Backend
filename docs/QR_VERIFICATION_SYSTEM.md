# QR Code Verification System - Camera Scanning Implementation

## 🎯 Overview

The ShowPass QR verification system now supports camera-based QR code scanning with automatic ticket usage tracking and email notifications. When a QR code is scanned, the system:

1. ✅ **Verifies** the QR code authenticity
2. ✅ **Marks** the specific ticket as used
3. ✅ **Updates** booking status if all tickets are used
4. ✅ **Sends** email notification to the ticket holder
5. ✅ **Prevents** duplicate usage attempts

## 🔧 API Endpoint

### POST `/api/bookings/verify-qr`

**Description**: Verify QR code and mark ticket as used (for camera scanning)

**Authentication**: Required (Organizer/Admin only)

**Request Body**:

```json
{
  "qrCode": "{\"bookingId\":\"...\",\"ticketReference\":\"TKT-...\",\"attendeeName\":\"...\",\"hash\":\"...\"}"
}
```

**Success Response (200)**:

```json
{
  "success": true,
  "message": "Ticket verified and checked in successfully! Email notification sent.",
  "data": {
    "ticket": {
      "ticketNumber": 1,
      "reference": "TKT-booking123-1",
      "attendeeName": "John Doe",
      "attendeeEmail": "john@example.com",
      "checkInTime": "2025-08-16T14:30:00.000Z",
      "isUsed": true,
      "ticketType": "Regular"
    },
    "booking": {
      "_id": "booking123",
      "allTicketsUsed": true,
      "totalTickets": 1,
      "usedTickets": 1
    },
    "event": {
      "title": "Tech Conference 2025",
      "startDate": "2025-08-16T15:00:00.000Z",
      "venue": {
        "name": "Convention Center",
        "address": "123 Main St"
      }
    }
  }
}
```

**Error Responses**:

- **400**: Invalid QR code format or ticket already used
- **403**: Only organizers/admins can verify tickets
- **404**: Booking not found

## 📱 QR Code Structure

Each ticket generates a unique QR code containing:

```json
{
  "bookingId": "booking_id",
  "ticketReference": "TKT-booking_id-ticket_number",
  "eventId": "event_id",
  "userId": "user_id",
  "ticketType": "Regular|VIP|Premium",
  "ticketNumber": 1,
  "totalTickets": 2,
  "attendeeName": "John Doe",
  "attendeeEmail": "john@example.com",
  "issuedAt": "2025-08-16T10:00:00.000Z",
  "hash": "security_hash_for_verification"
}
```

## 🔒 Security Features

### Hash Verification

- Each QR code contains a security hash
- Hash is generated using booking data + JWT secret
- Prevents QR code tampering and forgery

### Access Control

- Only event organizers and admins can verify tickets
- Verification checks organizer ownership of the event

### Usage Prevention

- Tickets can only be used once
- System tracks check-in time and verifier
- Clear error messages for already-used tickets

### Time-Based Controls

- Check-in opens 2 hours before event start
- Early check-in attempts are rejected with helpful messages

## 📧 Email Notifications

When a ticket is verified and used, the system automatically sends a professional email notification to the ticket holder containing:

### Email Content

- ✅ Check-in confirmation with success badge
- 🎪 Event details (title, date, venue)
- 🎫 Ticket information (type, number, reference)
- 🕒 Check-in details (time, verified by)
- 📋 Next steps and event guidelines

### Email Template Features

- 📱 Mobile-responsive design
- 🎨 Professional ShowPass branding
- 📊 Comprehensive ticket information table
- 💅 CSS styling with modern design elements

## 🎫 Individual Ticket Management

### Multiple Tickets per Booking

- Each attendee gets a unique QR code
- Individual tickets can be used independently
- Booking status updates when all tickets are used

### Attendee Tracking

- Each QR code is tied to a specific attendee
- Name and email verification for security
- Individual check-in tracking

## 🛠️ Implementation Guide

### Frontend Camera Integration

```javascript
// Example QR Scanner Integration
const handleQRScan = async (qrData) => {
  try {
    const response = await fetch("/api/bookings/verify-qr", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ qrCode: qrData }),
    });

    const result = await response.json();

    if (result.success) {
      // ✅ Ticket verified successfully
      showSuccessMessage(
        `Ticket verified for ${result.data.ticket.attendeeName}`
      );
      playSuccessSound();
    } else {
      // ❌ Verification failed
      showErrorMessage(result.message);
      playErrorSound();
    }
  } catch (error) {
    showErrorMessage("Network error during verification");
  }
};
```

### Mobile App Integration

```dart
// Flutter QR Scanner Example
void onQRViewCreated(QRViewController controller) {
  this.controller = controller;
  controller.scannedDataStream.listen((scanData) {
    verifyTicket(scanData.code);
  });
}

Future<void> verifyTicket(String qrCode) async {
  final response = await http.post(
    Uri.parse('$baseUrl/api/bookings/verify-qr'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $authToken',
    },
    body: jsonEncode({'qrCode': qrCode}),
  );

  if (response.statusCode == 200) {
    // Handle success
    final data = jsonDecode(response.body);
    showTicketSuccess(data['data']['ticket']);
  } else {
    // Handle error
    showError('Verification failed');
  }
}
```

## 📊 Testing with Postman

The Postman collection includes a comprehensive "Verify QR Code and Use Ticket" request with:

- 🔍 Realistic QR code data examples
- 📝 Detailed response logging
- ✅ Success/error handling
- 📋 Complete workflow testing

### Test Scenario

1. Create a free event booking
2. Extract QR code data from booking response
3. Use verify-qr endpoint to scan the ticket
4. Verify email notification is sent
5. Confirm ticket is marked as used

## 🚀 Production Considerations

### Performance

- Hash verification is computationally light
- Database queries are optimized with indexes
- Email sending is non-blocking

### Scalability

- Each ticket verification is independent
- No shared state between verifications
- Horizontal scaling friendly

### Monitoring

- Comprehensive console logging
- Error tracking for failed verifications
- Email delivery confirmation

### Security Best Practices

- JWT secret must be kept secure
- HTTPS required in production
- Rate limiting recommended for verification endpoint

## 🔄 Error Handling

The system provides clear, actionable error messages:

| Error                                 | Cause           | Resolution                  |
| ------------------------------------- | --------------- | --------------------------- |
| "Invalid QR code format"              | Malformed JSON  | Check QR code generation    |
| "Ticket already used"                 | Duplicate scan  | Show previous check-in time |
| "Event check-in opens 2 hours before" | Too early       | Display countdown timer     |
| "Only organizers can verify"          | Wrong user role | Switch to organizer account |

## 📈 Analytics & Reporting

### Check-in Metrics

- Real-time attendance tracking
- Individual ticket usage status
- Event capacity monitoring
- Check-in time analysis

### Email Delivery Tracking

- Successful notification count
- Failed delivery logging
- User engagement metrics

---

## 🎉 Ready for Production!

The QR verification system is now fully implemented with:

- ✅ Camera-ready scanning
- ✅ Automatic email notifications
- ✅ Comprehensive error handling
- ✅ Security best practices
- ✅ Mobile-friendly design
- ✅ Production-ready code

Perfect for events of any size! 🚀
