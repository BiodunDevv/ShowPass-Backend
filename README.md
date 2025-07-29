# 🎟️ ShowPass Backend - Event Ticketing Platform

A comprehensive event ticketing platform backend built with Node.js, Express, and MongoDB. Features role-based authentication, event management, ticket booking, payment processing with Paystack, and administrative controls.

## 🚀 Features

### 🔐 Authentication & Authorization

- JWT-based authentication with role-based access control
- Three user roles: **User**, **Organizer**, **Admin**
- Email verification and password reset functionality
- Secure password hashing with bcrypt

### 🎪 Event Management

- **Organizers** can create, edit, and manage events
- **Admins** approve/reject events before they go live
- Event categories, venue management, and ticket types
- Image uploads and event featured status
- Real-time availability tracking

### 🎟️ Ticket Booking System

- Multiple ticket types (VIP, Regular, Premium, etc.)
- Real-time availability checking
- QR code generation for tickets
- Booking cancellation with refund eligibility
- Check-in system with QR verification

### 💳 Payment Integration

- **Paystack** payment gateway integration
- Secure payment processing and verification
- Webhook handling for payment status updates
- Platform fees and VAT calculation
- Payment history and transaction tracking

### 💰 Refund Management

- User-initiated refund requests
- Admin approval workflow
- Automated refund processing via Paystack
- Processing fees and refund calculations
- Email notifications for refund status

### 📧 Email Notification System

- Welcome and email verification emails
- Ticket confirmation with QR codes
- Event update notifications
- Refund confirmation emails
- Password reset emails

### 🛡️ Admin Dashboard

- User management (block/unblock users)
- Event approval/rejection system
- Booking and payment monitoring
- Analytics and revenue reports
- Platform statistics and insights

## 🏗️ Project Structure

```
ShowPass-Backend/
├── controllers/          # Route logic and business logic
│   ├── authController.js
│   ├── eventController.js
│   ├── bookingController.js
│   ├── paymentController.js
│   ├── refundController.js
│   └── adminController.js
├── models/              # MongoDB schemas
│   ├── User.js
│   ├── Event.js
│   ├── Booking.js
│   └── RefundRequest.js
├── routes/              # API route definitions
│   ├── authRoutes.js
│   ├── eventRoutes.js
│   ├── bookingRoutes.js
│   ├── paymentRoutes.js
│   ├── refundRoutes.js
│   └── adminRoutes.js
├── middlewares/         # Authentication, validation, etc.
│   ├── auth.js
│   └── validation.js
├── utils/               # Helper functions
│   ├── helpers.js
│   ├── qrGenerator.js
│   ├── emailService.js
│   ├── paystack.js
│   └── seedData.js
├── config/              # Configuration files
│   ├── database.js
│   ├── email.js
│   └── paystack.js
├── .env                 # Environment variables
├── app.js               # Express app configuration
├── index.js             # Server entry point
└── package.json         # Dependencies and scripts
```

## 🛠️ Installation & Setup

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or cloud)
- Paystack account (for payments)
- Gmail account (for email service)

### 1. Clone and Install

```bash
git clone <repository-url>
cd ShowPass-Backend
npm install
```

### 2. Environment Configuration

The `.env` file is already configured with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb+srv://Biodun42:Balikiss@cluster0.djbve3e.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0

# JWT Configuration
JWT_SECRET=showpass_super_secret_jwt_key_2024_change_in_production
JWT_EXPIRES_IN=7d

# Paystack Configuration
PAYSTACK_SECRET_KEY=sk_test_d9b3b1ab888d011a3e63847af3fa1bc16d354e17
PAYSTACK_PUBLIC_KEY=pk_test_b1cae899d3351f04b3936181a528571989c980db

# Email Configuration
EMAIL_USER=muhammedabiodun42@gmail.com
EMAIL_PASS=pjpk vdeu vjlw umsc
EMAIL_FROM=muhammedabiodun42@gmail.com

# Application URLs
BASE_URL=http://localhost:3000

# Default Admin Account
ADMIN_EMAIL=mustapha.muhammed@bowen.edu.ng
ADMIN_PASSWORD=Balikiss12
ADMIN_FIRST_NAME=Mustapha
ADMIN_LAST_NAME=Muhammed

# Test Accounts
ORGANIZER_EMAIL=louisdiaz43@gmail.com
ORGANIZER_PASSWORD=Balikiss12
USER_EMAIL=muhammedabiodun42@gmail.com
USER_PASSWORD=Balikiss12

# Platform Revenue Configuration
PLATFORM_VAT_PERCENT=7.5
PLATFORM_SERVICE_FEE_PERCENT=5
```

### 3. Database Setup & Seeding

```bash
# Seed the database with initial data
npm run seed
```

This will create:

- Admin user: `mustapha.muhammed@bowen.edu.ng`
- Organizer user: `louisdiaz43@gmail.com`
- Regular user: `muhammedabiodun42@gmail.com`
- Sample events and data

### 4. Start the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

Server will start at: `http://localhost:3000`

## 📡 API Endpoints

### 🔐 Authentication

```
POST   /api/auth/register           # Register new user
POST   /api/auth/login              # Login user
GET    /api/auth/me                 # Get current user
PUT    /api/auth/profile            # Update profile
GET    /api/auth/verify-email       # Verify email
POST   /api/auth/resend-verification # Resend verification
POST   /api/auth/forgot-password    # Request password reset
POST   /api/auth/reset-password     # Reset password
PUT    /api/auth/change-password    # Change password
POST   /api/auth/logout             # Logout
```

### 🎪 Events

```
GET    /api/events                  # Get all events (public)
GET    /api/events/categories       # Get event categories
POST   /api/events                  # Create event (organizer)
GET    /api/events/organizer        # Get organizer's events
GET    /api/events/:id              # Get single event
PUT    /api/events/:id              # Update event (organizer)
DELETE /api/events/:id              # Delete event (organizer)
GET    /api/events/:id/attendees    # Get event attendees (organizer)
```

### 🎟️ Bookings

```
POST   /api/booking                 # Create booking
GET    /api/booking/my-tickets      # Get user's tickets
GET    /api/booking/:id             # Get booking details
POST   /api/booking/confirm-payment # Confirm payment
PUT    /api/booking/:id/cancel      # Cancel booking
PUT    /api/booking/:id/checkin     # Check-in attendee (organizer)
POST   /api/booking/verify-qr       # Verify QR code (organizer)
```

### 💳 Payments

```
POST   /api/payment/initiate        # Initialize payment
GET    /api/payment/verify          # Verify payment
POST   /api/payment/webhook         # Paystack webhook
GET    /api/payment/status/:ref     # Get payment status
GET    /api/payment/history         # Payment history
```

### 💰 Refunds

```
POST   /api/refund/request          # Create refund request
GET    /api/refund/my-requests      # Get user's refund requests
GET    /api/refund/:id              # Get refund details
PUT    /api/refund/:id/cancel       # Cancel refund request
GET    /api/refund/admin/all        # Get all refunds (admin)
PUT    /api/refund/admin/:id/resolve # Resolve refund (admin)
```

### 🛡️ Admin

```
GET    /api/admin/dashboard         # Dashboard statistics
GET    /api/admin/analytics         # Platform analytics
GET    /api/admin/users             # Get all users
PUT    /api/admin/users/:id/toggle-status # Block/unblock user
GET    /api/admin/events            # Get all events (admin)
PUT    /api/admin/events/:id/review # Approve/reject event
PUT    /api/admin/events/:id/toggle-featured # Toggle featured status
GET    /api/admin/bookings          # Get all bookings
POST   /api/admin/notifications/send # Send system notifications
```

## 👥 User Roles & Permissions

### 👤 User (Attendee)

- Browse and view events
- Purchase tickets
- Manage bookings
- Request refunds
- View payment history

### 🎯 Organizer

- All user permissions
- Create and manage events
- View event attendees
- Check-in attendees via QR
- View booking analytics

### 👑 Admin

- All organizer permissions
- Approve/reject events
- Manage all users
- Handle refund requests
- Access platform analytics
- Send system notifications

## 🔧 Key Features Explained

### QR Code System

- Each confirmed booking generates a unique QR code
- QR codes contain encrypted booking information
- Organizers can scan QR codes for quick check-in
- Prevents ticket fraud and duplicate entries

### Payment Flow

1. User creates booking (status: pending)
2. Payment initiated with Paystack
3. User completes payment
4. Webhook confirms payment
5. Booking confirmed, QR generated
6. Email sent with ticket

### Refund Process

1. User requests refund with reason
2. Admin reviews request
3. If approved, Paystack processes refund
4. Booking status updated
5. Email confirmation sent

### Email System

- HTML email templates
- Automatic sending for key events
- QR code attachments
- Mobile-responsive design

## 🚀 Deployment

### Environment Variables for Production

Update the following in production:

```env
NODE_ENV=production
JWT_SECRET=your_super_secure_secret_key
MONGODB_URI=your_production_mongodb_uri
BASE_URL=https://your-domain.com
```

### Production Checklist

- [ ] Update JWT secret
- [ ] Configure production MongoDB
- [ ] Set up production email service
- [ ] Configure Paystack live keys
- [ ] Set up SSL certificates
- [ ] Configure CORS for frontend domain
- [ ] Set up monitoring and logging

## 🔒 Security Features

- Password hashing with bcrypt
- JWT token expiration
- Input validation and sanitization
- Rate limiting (can be added)
- CORS configuration
- Environment variable protection
- Paystack webhook signature verification

## 📧 Email Templates

Professional HTML email templates for:

- Welcome and verification
- Ticket confirmations with QR codes
- Event updates and changes
- Refund confirmations
- Password reset instructions

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📝 License

This project is licensed under the MIT License.

## 👨‍💻 Author

**Mustapha Muhammed**

- Email: mustapha.muhammed@bowen.edu.ng

---

### 🎯 Ready to Go!

Your ShowPass backend is now fully configured and ready for use. The system includes everything needed for a complete event ticketing platform with modern features and security best practices.

**Default Login Credentials:**

- **Admin:** mustapha.muhammed@bowen.edu.ng / Balikiss12
- **Organizer:** louisdiaz43@gmail.com / Balikiss12
- **User:** muhammedabiodun42@gmail.com / Balikiss12
