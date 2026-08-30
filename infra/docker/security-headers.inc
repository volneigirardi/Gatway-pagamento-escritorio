add_header X-Frame-Options "DENY" always; add_header X-Content-Type-Options
"nosniff" always; add_header Referrer-Policy "strict-origin-when-cross-origin"
always; add_header Permissions-Policy "camera=(), microphone=(), geolocation=()"
always; add_header X-XSS-Protection "0" always; add_header
Content-Security-Policy "default-src 'self'; base-uri 'self'; object-src 'none';
script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;
connect-src 'self'; form-action 'self'; frame-ancestors 'none'" always;
