const fs = require('fs');
const os = require('os');
const path = require('path');

const uri = fs.readFileSync(path.join(os.tmpdir(), 'libroya-jest', 'uri.txt'), 'utf8').trim();

process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.MONGODB_URI = uri;
process.env.JWT_SECRET = 'test-jwt-secret-solo-para-pruebas-0123456789';
process.env.CLIENT_ORIGIN = 'http://localhost:3000';
process.env.PAYPAL_CLIENT_ID = 'test-client-id';
process.env.PAYPAL_CLIENT_SECRET = 'test-client-secret';
process.env.PAYPAL_API_BASE = 'https://api-m.sandbox.paypal.com';
