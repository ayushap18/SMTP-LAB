use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::config::SmtpConfig;
use crate::error::{Result, SmtpLabError};
use crate::log::SmtpLogger;
use crate::smtp::{SmtpTester, TestResult};

/// Configuration for a batch of SMTP tests.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchConfig {
    pub targets: Vec<SmtpConfig>,
    #[serde(default)]
    pub parallel: bool,
    #[serde(default = "default_max_concurrent")]
    pub max_concurrent: usize,
}

fn default_max_concurrent() -> usize {
    4
}

/// Load a batch configuration from a TOML file.
pub fn load_batch_config(path: &Path) -> Result<BatchConfig> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| SmtpLabError::Batch(format!("Failed to read batch config: {e}")))?;
    let config: BatchConfig = toml::from_str(&content)
        .map_err(|e| SmtpLabError::Batch(format!("Failed to parse batch config TOML: {e}")))?;
    Ok(config)
}

/// Run a batch of SMTP tests, either sequentially or in parallel.
pub async fn run_batch(config: BatchConfig, logger: SmtpLogger) -> Vec<TestResult> {
    if config.parallel {
        run_parallel(config.targets, config.max_concurrent, logger).await
    } else {
        run_sequential(config.targets, logger).await
    }
}

async fn run_sequential(targets: Vec<SmtpConfig>, logger: SmtpLogger) -> Vec<TestResult> {
    let mut results = Vec::new();
    for (i, target) in targets.iter().enumerate() {
        logger.info(
            "BATCH",
            format!("Running test {}/{} — {}:{}", i + 1, targets.len(), target.host, target.port),
        );
        let test_logger = SmtpLogger::new();
        let tester = SmtpTester::new(target.clone(), test_logger);
        let result = tester.run().await;
        results.push(result);
    }
    results
}

async fn run_parallel(
    targets: Vec<SmtpConfig>,
    max_concurrent: usize,
    logger: SmtpLogger,
) -> Vec<TestResult> {
    use futures::stream::{self, StreamExt};

    let total = targets.len();
    let results: Vec<TestResult> = stream::iter(targets.into_iter().enumerate())
        .map(|(i, target)| {
            let logger = logger.clone();
            async move {
                logger.info(
                    "BATCH",
                    format!("Running test {}/{} — {}:{}", i + 1, total, target.host, target.port),
                );
                let test_logger = SmtpLogger::new();
                let tester = SmtpTester::new(target, test_logger);
                tester.run().await
            }
        })
        .buffer_unordered(max_concurrent)
        .collect()
        .await;

    results
}
