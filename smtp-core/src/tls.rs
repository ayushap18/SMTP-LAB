use crate::error::{Result, SmtpLabError};
use crate::log::SmtpLogger;
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

/// Resolve hostname:port to a SocketAddr.
fn resolve_addr(host: &str, port: u16) -> Result<std::net::SocketAddr> {
    let addr_str = format!("{host}:{port}");
    addr_str
        .to_socket_addrs()
        .map_err(|e| SmtpLabError::Dns(format!("Failed to resolve {addr_str}: {e}")))?
        .next()
        .ok_or_else(|| SmtpLabError::Dns(format!("No addresses found for {addr_str}")))
}

/// Validate a TLS certificate for the given host and port.
/// Returns a description of the certificate or an error.
pub fn validate_certificate(host: &str, port: u16, logger: &SmtpLogger) -> Result<CertInfo> {
    logger.info("TLS", format!("Validating certificate for {host}:{port}"));

    let connector = native_tls::TlsConnector::new()
        .map_err(|e| SmtpLabError::Tls(format!("Failed to create TLS connector: {e}")))?;

    let sock_addr = resolve_addr(host, port)?;
    let tcp = TcpStream::connect_timeout(&sock_addr, Duration::from_secs(10))
        .map_err(|e| SmtpLabError::Connection(e.to_string()))?;

    let tls_stream = connector
        .connect(host, tcp)
        .map_err(|e| SmtpLabError::Tls(format!("TLS handshake failed: {e}")))?;

    let cert = tls_stream
        .peer_certificate()
        .map_err(|e| SmtpLabError::Tls(format!("Cannot read peer certificate: {e}")))?;

    let info = match cert {
        Some(c) => {
            let der = c.to_der().unwrap_or_default();
            CertInfo {
                subject: format!("Certificate present ({} bytes DER)", der.len()),
                valid: true,
            }
        }
        None => CertInfo {
            subject: "No peer certificate presented".into(),
            valid: false,
        },
    };

    if info.valid {
        logger.success("TLS", format!("Certificate valid: {}", info.subject));
    } else {
        logger.warn("TLS", "Server did not present a certificate");
    }

    Ok(info)
}

/// Check if a server supports STARTTLS by reading its EHLO capabilities.
pub fn check_starttls_support(host: &str, port: u16, logger: &SmtpLogger) -> Result<bool> {
    logger.info("TLS", format!("Checking STARTTLS support on {host}:{port}"));

    let sock_addr = resolve_addr(host, port)?;
    let mut stream = TcpStream::connect_timeout(&sock_addr, Duration::from_secs(10))
        .map_err(|e| SmtpLabError::Connection(e.to_string()))?;

    stream
        .set_read_timeout(Some(Duration::from_secs(10)))
        .ok();

    // Read greeting
    let greeting = read_response(&mut stream)?;
    logger.smtp("STARTTLS", parse_smtp_code(&greeting), &greeting);

    // Send EHLO
    stream
        .write_all(format!("EHLO smtp-lab\r\n").as_bytes())
        .map_err(|e| SmtpLabError::Connection(e.to_string()))?;

    let ehlo_resp = read_response(&mut stream)?;
    let has_starttls = ehlo_resp
        .to_uppercase()
        .lines()
        .any(|line| line.contains("STARTTLS"));

    if has_starttls {
        logger.success("STARTTLS", "Server advertises STARTTLS support");
    } else {
        logger.warn("STARTTLS", "Server does NOT advertise STARTTLS");
    }

    // Politely quit
    let _ = stream.write_all(b"QUIT\r\n");

    Ok(has_starttls)
}

/// Read a full SMTP multi-line response from a stream.
fn read_response(stream: &mut TcpStream) -> Result<String> {
    let mut buf = [0u8; 4096];
    let mut response = String::new();

    loop {
        let n = stream
            .read(&mut buf)
            .map_err(|e| SmtpLabError::Connection(format!("Read error: {e}")))?;
        if n == 0 {
            break;
        }
        response.push_str(&String::from_utf8_lossy(&buf[..n]));
        // SMTP multi-line: continuation lines have `-` at position 3, final has ` `.
        if let Some(last_line) = response.lines().last() {
            if last_line.len() >= 4 && last_line.as_bytes()[3] == b' ' {
                break;
            }
        }
    }

    Ok(response.trim().to_string())
}

fn parse_smtp_code(response: &str) -> u16 {
    response
        .get(..3)
        .and_then(|s| s.parse().ok())
        .unwrap_or(0)
}

/// Summary of certificate validation.
#[derive(Debug, Clone)]
pub struct CertInfo {
    pub subject: String,
    pub valid: bool,
}
