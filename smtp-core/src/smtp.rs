use crate::config::{Encryption, SmtpConfig};
use crate::diagnostics::{self, DiagResult};
use crate::error::{Result, SmtpLabError};
use crate::log::{LogLevel, SmtpLogger};

use lettre::transport::smtp::authentication::{Credentials, Mechanism};
use lettre::transport::smtp::client::{Tls, TlsParameters};
use lettre::transport::smtp::PoolConfig;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use std::time::Duration;

/// Outcome of a full SMTP test session.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TestResult {
    pub success: bool,
    pub message: String,
    pub diagnostics: Option<DiagResult>,
    pub logs: Vec<crate::log::LogEntry>,
    pub elapsed_ms: u64,
}

/// The main entry-point for SMTP testing.
pub struct SmtpTester {
    config: SmtpConfig,
    logger: SmtpLogger,
}

impl SmtpTester {
    pub fn new(config: SmtpConfig, logger: SmtpLogger) -> Self {
        Self { config, logger }
    }

    pub fn logger(&self) -> &SmtpLogger {
        &self.logger
    }

    /// Run diagnostics only (DNS, STARTTLS, cert).
    pub async fn diagnose(&self) -> DiagResult {
        diagnostics::run_diagnostics(
            &self.config.host,
            self.config.port,
            &self.config.to,
            &self.logger,
        )
        .await
    }

    /// Run a full SMTP test: validate config → connect → auth → send.
    pub async fn run(&self) -> TestResult {
        let start = std::time::Instant::now();
        self.logger.clear();

        self.logger.info("INIT", "Starting SMTP test session");
        self.logger.info(
            "INIT",
            format!(
                "Target: {}:{} ({})",
                self.config.host, self.config.port, self.config.encryption
            ),
        );

        // Validate config
        if let Err(e) = self.config.validate() {
            self.logger.error("CONFIG", format!("{e}"));
            return self.result(false, e.to_string(), None, start);
        }
        self.logger.success("CONFIG", "Configuration validated");

        // Run diagnostics (async)
        let diag = self.diagnose().await;

        // Build transport and send
        match self.execute_smtp().await {
            Ok(msg) => {
                self.logger.log(
                    LogLevel::Success,
                    "DONE",
                    &msg,
                    None,
                );
                self.result(true, msg, Some(diag), start)
            }
            Err(e) => {
                self.logger.error("FAIL", format!("{e}"));
                self.logger
                    .info("HINT", e.explanation().to_string());
                self.result(false, e.to_string(), Some(diag), start)
            }
        }
    }

    /// Core SMTP execution using lettre.
    async fn execute_smtp(&self) -> Result<String> {
        let timeout = Duration::from_secs(self.config.timeout_secs);

        // Build TLS parameters
        self.logger.info("CONNECT", "Building transport…");

        let mut builder = match self.config.encryption {
            Encryption::Ssl => {
                self.logger.info("TLS", "Using implicit SSL/TLS");
                let tls_params = TlsParameters::new(self.config.host.clone())
                    .map_err(|e| SmtpLabError::Tls(format!("TLS params error: {e}")))?;
                AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&self.config.host)
                    .port(self.config.port)
                    .tls(Tls::Wrapper(tls_params))
            }
            Encryption::StartTls => {
                self.logger.info("TLS", "Using STARTTLS upgrade");
                let tls_params = TlsParameters::new(self.config.host.clone())
                    .map_err(|e| SmtpLabError::Tls(format!("TLS params error: {e}")))?;
                AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&self.config.host)
                    .port(self.config.port)
                    .tls(Tls::Required(tls_params))
            }
            Encryption::None => {
                self.logger.warn("TLS", "No encryption — connection is plaintext!");
                AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&self.config.host)
                    .port(self.config.port)
                    .tls(Tls::None)
            }
        };

        // Timeout
        builder = builder.timeout(Some(timeout));

        // Pool config (single connection for testing)
        builder = builder.pool_config(PoolConfig::new().max_size(1));

        // Authentication
        if self.config.has_auth() {
            self.logger.info(
                "AUTH",
                format!("Authenticating as '{}'", self.config.username),
            );
            // Mask password in logs
            self.logger
                .debug("AUTH", "Password: ******* (redacted)");

            let creds = Credentials::new(
                self.config.username.clone(),
                self.config.password.clone(),
            );
            builder = builder
                .credentials(creds)
                .authentication(vec![Mechanism::Plain, Mechanism::Login]);
        } else {
            self.logger.info("AUTH", "No credentials — skipping authentication");
        }

        let transport = builder.build();

        // Test connection
        self.logger.info("CONNECT", "Opening connection…");
        let test_result = tokio::time::timeout(timeout, transport.test_connection()).await;

        match test_result {
            Ok(Ok(true)) => {
                self.logger
                    .success("CONNECT", "Connection established and verified");
            }
            Ok(Ok(false)) => {
                return Err(SmtpLabError::Connection(
                    "Server rejected the connection test".into(),
                ));
            }
            Ok(Err(e)) => {
                return Err(SmtpLabError::Connection(format!(
                    "Connection test failed: {e}"
                )));
            }
            Err(_) => {
                return Err(SmtpLabError::Timeout(self.config.timeout_secs));
            }
        }

        // Build message
        self.logger.info("MESSAGE", "Building email message…");
        let email = Message::builder()
            .from(
                self.config
                    .from
                    .parse()
                    .map_err(|e| SmtpLabError::Config(format!("Invalid From address: {e}")))?,
            )
            .to(self.config
                .to
                .parse()
                .map_err(|e| SmtpLabError::Config(format!("Invalid To address: {e}")))?)
            .subject(&self.config.subject)
            .body(self.config.body.clone())
            .map_err(|e| SmtpLabError::Send(format!("Failed to build message: {e}")))?;

        // Send
        self.logger.info("SEND", "Sending email…");
        let send_result = tokio::time::timeout(timeout, transport.send(email)).await;

        match send_result {
            Ok(Ok(response)) => {
                let code_u16: u16 = response.code().into();
                self.logger.smtp(
                    "SEND",
                    code_u16,
                    format!("Server response: {}", response.message().collect::<Vec<_>>().join(" ")),
                );
                Ok(format!(
                    "Email sent successfully to {}",
                    self.config.to
                ))
            }
            Ok(Err(e)) => Err(SmtpLabError::Send(e.to_string())),
            Err(_) => Err(SmtpLabError::Timeout(self.config.timeout_secs)),
        }
    }

    fn result(
        &self,
        success: bool,
        message: String,
        diagnostics: Option<DiagResult>,
        start: std::time::Instant,
    ) -> TestResult {
        TestResult {
            success,
            message,
            diagnostics,
            logs: self.logger.entries(),
            elapsed_ms: start.elapsed().as_millis() as u64,
        }
    }
}
