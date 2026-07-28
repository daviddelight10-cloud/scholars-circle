# Registration Error Handling Improvements

## Overview
Enhanced error handling for user registration with specific, actionable error messages.

---

## Backend Improvements (`server/src/routes/auth.js`)

### 1. **Zod Validation Errors**
When form validation fails, the backend now returns:
```json
{
  "error": "Password must be at least 8 characters",
  "field": "password",
  "details": [
    {
      "field": "password",
      "message": "Password must be at least 8 characters"
    }
  ]
}
```

**Code:**
```javascript
if (e instanceof z.ZodError) {
  const firstError = e.errors[0];
  return res.status(400).json({ 
    error: firstError.message,
    field: firstError.path.join('.'),
    details: e.errors.map(err => ({ 
      field: err.path.join('.'), 
      message: err.message 
    }))
  });
}
```

### 2. **Duplicate Account Errors**
When email or username already exists:
```json
{
  "error": "An account with that email already exists. Please use a different email or log in."
}
```

**Code:**
```javascript
if (e.code === "P2002") {
  const target = e.meta?.target || [];
  const field = Array.isArray(target) && target.includes("email") ? "email" : "username";
  return res.status(400).json({ 
    error: `An account with that ${field} already exists. Please use a different ${field} or log in.` 
  });
}
```

### 3. **Generic Errors with Details**
All other errors now include the actual error message:
```json
{
  "error": "Actual error message from exception",
  "details": "Actual error message from exception"
}
```

---

## Frontend Improvements (`src/App.jsx`)

### 1. **Invite Code for Both Roles**
Fixed issue where LECTURER role wasn't sending invite code:

**Before:**
```javascript
inviteCode: role === "TEACHER" ? inviteCode : undefined
```

**After:**
```javascript
inviteCode: (role === "TEACHER" || role === "LECTURER") ? inviteCode : undefined
```

### 2. **Enhanced Error Messages with Hints**

#### Password Errors:
```
Password must be at least 8 characters

Password requirements:
• At least 8 characters
• One uppercase letter
• One lowercase letter
• One number
• One special character (!@#$%^&*...)
```

#### Invite Code Errors:
```
Invalid invite code

Please check your invite code or contact an administrator.
```

#### Duplicate Account Errors:
```
An account with that email already exists. Please use a different email or log in.

Try logging in instead or use a different email/username.
```

**Code:**
```javascript
// Add helpful hints for common errors
if (errorMessage.includes("Password must")) {
  errorMessage += "\n\nPassword requirements:\n• At least 8 characters\n• One uppercase letter\n• One lowercase letter\n• One number\n• One special character (!@#$%^&*...)";
} else if (errorMessage.includes("invite code")) {
  errorMessage += "\n\nPlease check your invite code or contact an administrator.";
} else if (errorMessage.includes("already exists")) {
  errorMessage += "\n\nTry logging in instead or use a different email/username.";
}
```

### 3. **Console Logging**
Added error logging for debugging:
```javascript
console.error("Registration error:", e);
```

### 4. **Updated Placeholder Text**
Changed password input placeholder from:
```
"Password (min 6 characters)"
```

To:
```
"Password (min 8 characters, uppercase, lowercase, number, special char)"
```

---

## Password Requirements

### Current Requirements:
- ✅ Minimum 8 characters (changed from 12)
- ✅ At least one uppercase letter (A-Z)
- ✅ At least one lowercase letter (a-z)
- ✅ At least one number (0-9)
- ✅ At least one special character (!@#$%^&*(),.?":{}|<>)

### Validation Schema:
```javascript
password: z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character')
```

---

## Error Types Handled

### 1. **Validation Errors**
- Invalid email format
- Username too short/long
- Password requirements not met
- Missing required fields

### 2. **Business Logic Errors**
- Missing invite code for faculty
- Invalid invite code
- Expired invite code
- Invite code already used
- Email-specific invite code mismatch

### 3. **Database Errors**
- Duplicate email
- Duplicate username
- Duplicate activation key

### 4. **Generic Errors**
- Network failures
- Server errors
- Unexpected exceptions

---

## User Experience Improvements

### Before:
```
❌ "Registration failed"
```
No details, user doesn't know what went wrong.

### After:
```
✅ "Password must be at least 8 characters

Password requirements:
• At least 8 characters
• One uppercase letter
• One lowercase letter
• One number
• One special character (!@#$%^&*...)"
```
Clear, actionable feedback with guidance.

---

## Testing Scenarios

### ✅ Successful Registration
- Student with valid credentials
- Teacher with valid invite code
- Lecturer with valid invite code

### ✅ Validation Errors
- Password too short
- Missing uppercase letter
- Missing special character
- Invalid email format
- Username too short

### ✅ Business Logic Errors
- Faculty without invite code
- Invalid invite code
- Expired invite code
- Used invite code

### ✅ Duplicate Account
- Email already exists
- Username already exists

---

## Summary

All registration errors now provide:
1. **Specific error messages** - Users know exactly what went wrong
2. **Helpful hints** - Guidance on how to fix the issue
3. **Field-level details** - Which field caused the error
4. **Consistent formatting** - Same error structure across all errors
5. **Better UX** - Clear, actionable feedback instead of generic "failed" messages
