#!/bin/bash

# Create SSL directory if it doesn't exist
mkdir -p ssl

# Generate private key
openssl genrsa -out ssl/private-key.pem 2048

# Generate certificate signing request
openssl req -new -key ssl/private-key.pem -out ssl/csr.pem -subj "/C=SN/ST=Dakar/L=Dakar/O=MonPetitBiz/OU=Development/CN=localhost"

# Generate self-signed certificate
openssl x509 -req -days 365 -in ssl/csr.pem -signkey ssl/private-key.pem -out ssl/certificate.pem

# Clean up CSR file
rm ssl/csr.pem

echo "SSL certificates generated in ssl/ directory"
echo "Private key: ssl/private-key.pem"
echo "Certificate: ssl/certificate.pem"