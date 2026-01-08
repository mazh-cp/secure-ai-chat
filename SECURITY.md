# Security Policy

## Supported Versions

We actively support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability, please send an email to the maintainers with the following information:

- A description of the vulnerability
- Steps to reproduce the issue
- Potential impact and severity
- Suggested fix (if any)

We will acknowledge receipt of your report within 48 hours and provide a detailed response within 7 days indicating the next steps in handling your report.

After the vulnerability has been addressed, we will credit you (if desired) in our security acknowledgments.

## Security Best Practices

When using this application:

1. **Never commit API keys or secrets** - Use environment variables or secure storage
2. **Keep dependencies updated** - Regularly run `npm audit` and update packages
3. **Use HTTPS in production** - Never deploy without SSL/TLS
4. **Review security headers** - Ensure `next.config.js` security headers are properly configured
5. **Monitor logs** - Regularly review application logs for suspicious activity
6. **Implement rate limiting** - Add rate limiting in production environments
7. **Validate all inputs** - Ensure all user inputs are validated and sanitized

## Known Security Considerations

This application includes security features but requires additional hardening for production:

- API keys are stored in localStorage (consider server-side storage for production)
- Encryption utilities are placeholders and need implementation
- Authentication/authorization should be added for production use
- Rate limiting should be implemented
- Input validation should be enhanced

See the main README.md for more security considerations.
