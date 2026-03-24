use crate::error::{Result, SmtpLabError};
use crate::log::SmtpLogger;
use serde::{Deserialize, Serialize};
use trust_dns_resolver::config::{ResolverConfig, ResolverOpts};
use trust_dns_resolver::TokioAsyncResolver;

/// MX record info.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MxRecord {
    pub preference: u16,
    pub exchange: String,
}

/// Perform async DNS MX record lookup for the domain part of an email address.
pub async fn lookup_mx(domain: &str, logger: &SmtpLogger) -> Result<Vec<MxRecord>> {
    logger.info("DNS", format!("Looking up MX records for {domain}"));

    let resolver =
        TokioAsyncResolver::tokio(ResolverConfig::default(), ResolverOpts::default());

    let mx_lookup = resolver
        .mx_lookup(domain)
        .await
        .map_err(|e| SmtpLabError::Dns(format!("MX lookup failed for {domain}: {e}")))?;

    let mut records: Vec<MxRecord> = mx_lookup
        .iter()
        .map(|mx| MxRecord {
            preference: mx.preference(),
            exchange: mx.exchange().to_string().trim_end_matches('.').to_string(),
        })
        .collect();

    records.sort_by_key(|r| r.preference);

    if records.is_empty() {
        logger.warn("DNS", format!("No MX records found for {domain}"));
    } else {
        for r in &records {
            logger.success(
                "DNS",
                format!("MX {} → {} (priority {})", domain, r.exchange, r.preference),
            );
        }
    }

    Ok(records)
}

/// Extract domain from an email address.
pub fn domain_from_email(email: &str) -> Option<&str> {
    email.split('@').nth(1)
}

/// Run all diagnostic checks for a given host (async-safe).
pub async fn run_diagnostics(
    host: &str,
    port: u16,
    email: &str,
    logger: &SmtpLogger,
) -> DiagResult {
    let mut result = DiagResult::default();

    // MX lookup
    if let Some(domain) = domain_from_email(email) {
        match lookup_mx(domain, logger).await {
            Ok(records) => result.mx_records = records,
            Err(e) => logger.warn("DNS", format!("MX lookup error: {e}")),
        }
    }

    // STARTTLS check — runs blocking I/O, so use spawn_blocking
    let h = host.to_string();
    let p = port;
    let log = logger.clone();
    let starttls_result = tokio::task::spawn_blocking(move || {
        crate::tls::check_starttls_support(&h, p, &log)
    })
    .await;

    match starttls_result {
        Ok(Ok(supported)) => result.starttls_supported = Some(supported),
        Ok(Err(e)) => logger.warn("STARTTLS", format!("Check failed: {e}")),
        Err(e) => logger.warn("STARTTLS", format!("Task error: {e}")),
    }

    // Certificate validation (only for SSL ports)
    if port == 465 {
        let h = host.to_string();
        let p = port;
        let log = logger.clone();
        let cert_result = tokio::task::spawn_blocking(move || {
            crate::tls::validate_certificate(&h, p, &log)
        })
        .await;

        match cert_result {
            Ok(Ok(info)) => result.cert_valid = Some(info.valid),
            Ok(Err(e)) => logger.warn("TLS", format!("Certificate check failed: {e}")),
            Err(e) => logger.warn("TLS", format!("Task error: {e}")),
        }
    }

    result
}

/// Aggregated diagnostic results.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DiagResult {
    pub mx_records: Vec<MxRecord>,
    pub starttls_supported: Option<bool>,
    pub cert_valid: Option<bool>,
}
