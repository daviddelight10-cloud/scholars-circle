# Security Implementation Guide - Phase 1

This guide provides step-by-step instructions to implement critical security fixes.

---

## Step 1: Install Security Packages

```bash
cd server
npm install helmet express-mongo-sanitize cookie-parser winston sanitize-html
```

---

## Step 2: Update server/src/index.js

Add security middleware after imports:

```javascript
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import cookieParser from 'cookie-parser';

// After line 36 (const app = express();)

// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || "http://localhost:5173"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Sanitize data to prevent NoSQL injection
app.use(mongoSanitize());

// Cookie parser
app.use(cookieParser());

// Body parsing with size limits (BEFORE line 63)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// HTTPS enforcement in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(`https://${req.header('host')}${req.url}`);
    }
    next();
  });
}
```

---

## Step 3: Tighten CORS Configuration

Replace the CORS section (lines 38-61) with:

```javascript
// CORS configuration - whitelist specific origins
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin is in whitelist
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`Blocked CORS request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
```

---

## Step 4: Improve Error Handling

Replace error handler (lines 102-105) with:

```javascript
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  
  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production') {
    res.status(err.status || 500).json({ 
      error: 'Internal server error' 
    });
  } else {
    res.status(err.status || 500).json({ 
      error: err.message,
      stack: err.stack 
    });
  }
});
```

---

## Step 5: Update Environment Variables

Add to `server/.env`:

```env
# Security
NODE_ENV=production
ALLOWED_ORIGINS=https://scholarscircle.com,https://www.scholarscircle.com
FRONTEND_URL=https://scholarscircle.com

# For development, use:
# NODE_ENV=development
# ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174
# FRONTEND_URL=http://localhost:5173
```

---

## Step 6: Add Security Meta Tags to index.html

Add after line 6 in `index.html`:

```html
<!-- Security Headers -->
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://scholars-circle-production.up.railway.app;" />
<meta http-equiv="X-Content-Type-Options" content="nosniff" />
<meta http-equiv="X-Frame-Options" content="DENY" />
<meta name="referrer" content="strict-origin-when-cross-origin" />
```

---

## Step 7: Sanitize User Input in Routes

Example for announcements route:

```javascript
import sanitizeHtml from 'sanitize-html';

// In POST /announcements
const sanitizedTitle = sanitizeHtml(req.body.title, {
  allowedTags: [],
  allowedAttributes: {}
});

const sanitizedMessage = sanitizeHtml(req.body.message, {
  allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br'],
  allowedAttributes: {}
});
```

---

## Step 8: Add Audit Logging

Create `server/src/lib/logger.js`:

```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/security.log', level: 'warn' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Console logging in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

export const logSecurityEvent = (userId, eventType, details, req) => {
  logger.warn({
    type: 'security',
    userId,
    eventType,
    details,
    ip: req?.ip,
    userAgent: req?.get('user-agent'),
    timestamp: new Date().toISOString()
  });
};

export default logger;
```

Use in auth routes:

```javascript
import { logSecurityEvent } from '../lib/logger.js';

// In login route after failed attempt
if (!ok) {
  logSecurityEvent(user.id, 'failed_login', { reason: 'invalid_password' }, req);
  return res.status(401).json({ error: "Invalid credentials" });
}

// After successful login
logSecurityEvent(user.id, 'login_success', {}, req);
```

---

## Step 9: Strengthen Password Requirements

Update `server/src/routes/auth.js`:

```javascript
const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
  role: z.enum(["STUDENT", "TEACHER", "LECTURER"]).optional(),
  inviteCode: z.string().optional(),
});
```

---

## Step 10: Testing Checklist

After implementation, test:

- [ ] CORS blocks unauthorized origins
- [ ] Security headers present in response
- [ ] Large payloads rejected (>10MB)
- [ ] Error messages don't leak details in production
- [ ] Password validation works
- [ ] Audit logs created for security events
- [ ] HTTPS redirect works in production
- [ ] NoSQL injection attempts blocked

---

## Deployment Steps

1. Install packages on server
2. Update code files
3. Set environment variables
4. Create logs directory: `mkdir -p logs`
5. Restart server
6. Monitor logs for issues
7. Test all functionality

---

## Monitoring

After deployment, monitor:
- `logs/security.log` for security events
- `logs/error.log` for errors
- Failed login attempts
- CORS violations
- Large payload attempts

---

**Next Phase:** Implement httpOnly cookies for auth tokens (requires frontend changes)
