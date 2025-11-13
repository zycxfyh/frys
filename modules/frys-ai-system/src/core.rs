//! Core AI System structures and types

use crate::*;
use alloc::collections::BTreeMap;
use alloc::string::String;
use alloc::vec::Vec;

/// Priority levels for AI requests
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Priority {
    Low = 0,
    Normal = 1,
    High = 2,
    Critical = 3,
}

/// AI task types
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AITask {
    /// Text generation
    TextGeneration,
    /// Text analysis/summarization
    TextAnalysis,
    /// Code generation
    CodeGeneration,
    /// Image generation
    ImageGeneration,
    /// Image analysis/description
    ImageAnalysis,
    /// Speech to text
    SpeechToText,
    /// Text to speech
    TextToSpeech,
    /// Translation
    Translation,
    /// Question answering
    QuestionAnswering,
    /// Embedding generation
    Embedding,
    /// Classification
    Classification,
    /// Custom task
    Custom(String),
}

/// AI request structure
#[derive(Debug, Clone)]
pub struct AIRequest {
    /// Request ID for tracking
    pub id: Option<String>,
    /// Text input
    pub text: Option<String>,
    /// Image data (base64 encoded)
    pub image: Option<alloc::vec::Vec<u8>>,
    /// Audio data
    pub audio: Option<alloc::vec::Vec<u8>>,
    /// Video data
    pub video: Option<alloc::vec::Vec<u8>>,
    /// Task type
    pub task: AITask,
    /// Request priority
    pub priority: Priority,
    /// Model preference (optional)
    pub preferred_model: Option<String>,
    /// Provider preference (optional)
    pub preferred_provider: Option<String>,
    /// Custom parameters
    pub parameters: BTreeMap<String, serde_json::Value>,
    /// Timeout in milliseconds
    pub timeout_ms: Option<u64>,
}

impl Default for AIRequest {
    fn default() -> Self {
        Self {
            id: None,
            text: None,
            image: None,
            audio: None,
            video: None,
            task: AITask::TextGeneration,
            priority: Priority::Normal,
            preferred_model: None,
            preferred_provider: None,
            parameters: BTreeMap::new(),
            timeout_ms: None,
        }
    }
}

/// AI response structure
#[derive(Debug, Clone)]
pub struct AIResponse {
    /// Response ID (matches request ID)
    pub id: String,
    /// Generated text output
    pub text: Option<String>,
    /// Generated image data
    pub image: Option<alloc::vec::Vec<u8>>,
    /// Generated audio data
    pub audio: Option<alloc::vec::Vec<u8>>,
    /// Generated video data
    pub video: Option<alloc::vec::Vec<u8>>,
    /// Embeddings (if requested)
    pub embeddings: Option<alloc::vec::Vec<f32>>,
    /// Classification results
    pub classifications: Option<alloc::vec::Vec<ClassificationResult>>,
    /// Usage statistics
    pub usage: UsageStats,
    /// Model used
    pub model_used: String,
    /// Provider used
    pub provider_used: String,
    /// Processing time in milliseconds
    pub processing_time_ms: u64,
    /// Cost in USD
    pub cost_usd: f64,
    /// Cache hit (if applicable)
    pub cache_hit: bool,
}

/// Classification result
#[derive(Debug, Clone)]
pub struct ClassificationResult {
    /// Label/class name
    pub label: String,
    /// Confidence score (0.0-1.0)
    pub confidence: f32,
    /// Additional metadata
    pub metadata: BTreeMap<String, serde_json::Value>,
}

/// Usage statistics
#[derive(Debug, Clone, Default)]
pub struct UsageStats {
    /// Input tokens (for text models)
    pub prompt_tokens: usize,
    /// Output tokens (for text models)
    pub completion_tokens: usize,
    /// Total tokens
    pub total_tokens: usize,
    /// Processing time in milliseconds
    pub processing_time_ms: u64,
    /// Cost in USD
    pub cost_usd: f64,
}

/// Streaming response chunk
#[derive(Debug, Clone)]
pub struct StreamChunk {
    /// Chunk ID
    pub id: String,
    /// Text content (if any)
    pub text: Option<String>,
    /// Is this the final chunk
    pub is_final: bool,
    /// Usage stats (included in final chunk)
    pub usage: Option<UsageStats>,
}

/// AI System main interface
pub struct AISystem {
    /// System configuration
    config: AISystemConfig,
    /// Sira gateway client
    sira_client: SiraClient,
    /// Model manager
    model_manager: ModelManager,
    /// Cache system
    cache: AICache,
    /// Metrics collector
    metrics: AIMetrics,
    /// Request processor
    processor: RequestProcessor,
}

impl AISystem {
    /// Create new AI system
    pub async fn new(config: AISystemConfig) -> Result<Self> {
        let sira_client = SiraClient::new(&config.sira_gateway_url)?;
        let model_manager = ModelManager::new(config.clone())?;
        let cache = AICache::new(config.clone())?;
        let metrics = AIMetrics::new();
        let processor = RequestProcessor::new(config.clone())?;

        Ok(Self {
            config,
            sira_client,
            model_manager,
            cache,
            metrics,
            processor,
        })
    }

    /// Process AI request
    pub async fn process_request(&mut self, request: AIRequest) -> Result<AIResponse> {
        let start_time = self.current_timestamp();

        // Check cache first
        if self.config.enable_caching {
            if let Some(cached_response) = self.cache.get(&request).await? {
                self.metrics.record_cache_hit();
                return Ok(cached_response);
            }
        }

        self.metrics.record_cache_miss();

        // Route through Sira gateway
        let response = self.sira_client.process_request(request.clone()).await?;

        // Cache the response
        if self.config.enable_caching && !response.cache_hit {
            self.cache.put(&request, &response).await?;
        }

        // Update metrics
        let processing_time = self.current_timestamp() - start_time;
        self.metrics.record_request_processed(processing_time, response.cost_usd);

        Ok(response)
    }

    /// Process streaming AI request
    pub async fn process_streaming_request(
        &mut self,
        request: AIRequest,
    ) -> Result<impl futures::Stream<Item = Result<StreamChunk>>> {
        self.sira_client.process_streaming_request(request).await
    }

    /// Get available models
    pub fn get_available_models(&self) -> Vec<ModelInfo> {
        self.model_manager.get_available_models()
    }

    /// Get system metrics
    pub fn get_metrics(&self) -> AIMetricsSnapshot {
        self.metrics.get_snapshot()
    }

    /// Health check
    pub async fn health_check(&self) -> Result<HealthStatus> {
        // Check Sira gateway connectivity
        let sira_health = self.sira_client.health_check().await?;

        // Check model manager
        let models_healthy = self.model_manager.health_check().await?;

        // Check cache
        let cache_healthy = self.cache.health_check().await?;

        let overall_health = if sira_health.is_healthy() && models_healthy && cache_healthy {
            HealthStatus::Healthy
        } else {
            HealthStatus::Degraded
        };

        Ok(overall_health)
    }

    /// Get current timestamp (placeholder)
    fn current_timestamp(&self) -> u64 {
        // In real implementation, would get current Unix timestamp
        0
    }
}

/// Model information
#[derive(Debug, Clone)]
pub struct ModelInfo {
    /// Model name
    pub name: String,
    /// Provider name
    pub provider: String,
    /// Model capabilities
    pub capabilities: Vec<AICapability>,
    /// Context window size
    pub context_window: usize,
    /// Cost per token
    pub cost_per_token: f64,
}

/// AI Cache interface
pub struct AICache {
    config: AISystemConfig,
}

impl AICache {
    pub fn new(config: AISystemConfig) -> Result<Self> {
        Ok(Self { config })
    }

    pub async fn get(&self, _request: &AIRequest) -> Result<Option<AIResponse>> {
        // Placeholder implementation
        Ok(None)
    }

    pub async fn put(&self, _request: &AIRequest, _response: &AIResponse) -> Result<()> {
        // Placeholder implementation
        Ok(())
    }

    pub async fn health_check(&self) -> Result<bool> {
        Ok(true)
    }
}

/// AI Metrics collector
pub struct AIMetrics {
    requests_processed: core::sync::atomic::AtomicU64,
    cache_hits: core::sync::atomic::AtomicU64,
    cache_misses: core::sync::atomic::AtomicU64,
    total_processing_time: core::sync::atomic::AtomicU64,
    total_cost: core::sync::atomic::AtomicU64, // Stored as micro-USD
}

impl AIMetrics {
    pub fn new() -> Self {
        Self {
            requests_processed: core::sync::atomic::AtomicU64::new(0),
            cache_hits: core::sync::atomic::AtomicU64::new(0),
            cache_misses: core::sync::atomic::AtomicU64::new(0),
            total_processing_time: core::sync::atomic::AtomicU64::new(0),
            total_cost: core::sync::atomic::AtomicU64::new(0),
        }
    }

    pub fn record_request_processed(&self, processing_time_ms: u64, cost_usd: f64) {
        self.requests_processed.fetch_add(1, core::sync::atomic::Ordering::Relaxed);
        self.total_processing_time.fetch_add(processing_time_ms, core::sync::atomic::Ordering::Relaxed);
        let cost_micros = (cost_usd * 1_000_000.0) as u64;
        self.total_cost.fetch_add(cost_micros, core::sync::atomic::Ordering::Relaxed);
    }

    pub fn record_cache_hit(&self) {
        self.cache_hits.fetch_add(1, core::sync::atomic::Ordering::Relaxed);
    }

    pub fn record_cache_miss(&self) {
        self.cache_misses.fetch_add(1, core::sync::atomic::Ordering::Relaxed);
    }

    pub fn get_snapshot(&self) -> AIMetricsSnapshot {
        let requests = self.requests_processed.load(core::sync::atomic::Ordering::Relaxed);
        let hits = self.cache_hits.load(core::sync::atomic::Ordering::Relaxed);
        let misses = self.cache_misses.load(core::sync::atomic::Ordering::Relaxed);
        let total_time = self.total_processing_time.load(core::sync::atomic::Ordering::Relaxed);
        let total_cost_micros = self.total_cost.load(core::sync::atomic::Ordering::Relaxed);

        AIMetricsSnapshot {
            requests_processed: requests,
            cache_hit_rate: if requests > 0 { hits as f64 / requests as f64 } else { 0.0 },
            average_processing_time_ms: if requests > 0 { total_time / requests } else { 0 },
            total_cost_usd: total_cost_micros as f64 / 1_000_000.0,
        }
    }
}

/// AI Metrics snapshot
#[derive(Debug, Clone)]
pub struct AIMetricsSnapshot {
    /// Total requests processed
    pub requests_processed: u64,
    /// Cache hit rate (0.0-1.0)
    pub cache_hit_rate: f64,
    /// Average processing time in milliseconds
    pub average_processing_time_ms: u64,
    /// Total cost in USD
    pub total_cost_usd: f64,
}

/// Health status
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HealthStatus {
    /// System is healthy
    Healthy,
    /// System is degraded but functional
    Degraded,
    /// System is unhealthy
    Unhealthy,
}

impl HealthStatus {
    pub fn is_healthy(&self) -> bool {
        matches!(self, HealthStatus::Healthy)
    }
}

// Placeholder implementations
pub struct SiraClient;
impl SiraClient {
    pub fn new(_url: &str) -> Result<Self> { Ok(Self) }
    pub async fn process_request(&self, _request: AIRequest) -> Result<AIResponse> {
        Ok(AIResponse {
            id: "test".to_string(),
            text: Some("Test response".to_string()),
            image: None,
            audio: None,
            video: None,
            embeddings: None,
            classifications: None,
            usage: UsageStats::default(),
            model_used: "gpt-4".to_string(),
            provider_used: "openai".to_string(),
            processing_time_ms: 100,
            cost_usd: 0.01,
            cache_hit: false,
        })
    }
    pub async fn process_streaming_request(&self, _request: AIRequest) -> Result<std::pin::Pin<Box<dyn futures::Stream<Item = Result<StreamChunk>>>>> {
        // Placeholder
        Err(AIError::UnsupportedOperation {
            operation: "streaming".to_string(),
            reason: "Not implemented".to_string(),
        })
    }
    pub async fn health_check(&self) -> Result<HealthStatus> {
        Ok(HealthStatus::Healthy)
    }
}

pub struct ModelManager;
impl ModelManager {
    pub fn new(_config: AISystemConfig) -> Result<Self> { Ok(Self) }
    pub fn get_available_models(&self) -> Vec<ModelInfo> { Vec::new() }
    pub async fn health_check(&self) -> Result<bool> { Ok(true) }
}

pub struct RequestProcessor;
impl RequestProcessor {
    pub fn new(_config: AISystemConfig) -> Result<Self> { Ok(Self) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ai_request_creation() {
        let request = AIRequest {
            text: Some("Hello, AI!".to_string()),
            task: AITask::TextGeneration,
            priority: Priority::High,
            ..Default::default()
        };

        assert_eq!(request.text.as_ref().unwrap(), "Hello, AI!");
        assert_eq!(request.priority, Priority::High);
    }

    #[test]
    fn test_ai_response_creation() {
        let response = AIResponse {
            id: "test-123".to_string(),
            text: Some("AI response".to_string()),
            usage: UsageStats {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30,
                processing_time_ms: 500,
                cost_usd: 0.002,
            },
            model_used: "gpt-4".to_string(),
            provider_used: "openai".to_string(),
            processing_time_ms: 500,
            cost_usd: 0.002,
            cache_hit: false,
            image: None,
            audio: None,
            video: None,
            embeddings: None,
            classifications: None,
        };

        assert_eq!(response.id, "test-123");
        assert_eq!(response.usage.total_tokens, 30);
        assert_eq!(response.model_used, "gpt-4");
    }

    #[test]
    fn test_health_status() {
        assert!(HealthStatus::Healthy.is_healthy());
        assert!(!HealthStatus::Degraded.is_healthy());
        assert!(!HealthStatus::Unhealthy.is_healthy());
    }
}
