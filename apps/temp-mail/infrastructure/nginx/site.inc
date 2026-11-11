root /usr/share/nginx/html;
index index.html;
client_max_body_size 16k;
access_log off;
server_tokens off;
add_header Referrer-Policy no-referrer always;
add_header X-Content-Type-Options nosniff always;
add_header X-Frame-Options DENY always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" always;

location /api/ {
    proxy_pass http://api:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
    proxy_set_header Authorization "";
    proxy_buffering off;
    proxy_read_timeout 75s;
    gzip off;
}
location /assets/ {
    try_files $uri =404;
    expires 7d;
}
location / {
    try_files $uri /index.html;
}
