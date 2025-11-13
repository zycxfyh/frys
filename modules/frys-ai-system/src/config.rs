//! AI System configuration types

use alloc::collections::BTreeMap;
use alloc::string::String;
use alloc::vec::Vec;

/// AI System configuration
#[derive(Debug, Clone)]
pub struct AISystemConfig {
    /// Sira AI Gateway URL
    pub sira_gateway_url: String,
    /// Enable intelligent caching
    pub enable_caching: bool,
    /// Cache TTL in seconds
    pub cache_ttl_seconds: u64,
    /// Maximum concurrent requests
    pub max_concurrent_requests: usize,
    /// Request timeout in milliseconds
    pub request_timeout_ms: u64,
    /// Enable streaming responses
    pub enable_streaming: bool,
    /// Enable cost optimization
    pub enable_cost_optimization: bool,
    /// Enable performance monitoring
    pub enable_monitoring: bool,
    /// Local model directory
    pub local_model_dir: Option<String>,
    /// Provider configurations
    pub providers: BTreeMap<String, ProviderConfig>,
    /// Model configurations
    pub models: BTreeMap<String, ModelConfig>,
}

impl Default for AISystemConfig {
    fn default() -> Self {
        let mut providers = BTreeMap::new();
        providers.insert("openai".to_string(), ProviderConfig {
            api_key: None,
            base_url: "https://api.openai.com/v1".to_string(),
            timeout_ms: 30000,
            max_retries: 3,
            rate_limit: RateLimit {
                requests_per_minute: 60,
                requests_per_hour: 1000,
            },
        });

        let mut models = BTreeMap::new();
        models.insert("gpt-4".to_string(), ModelConfig {
            provider: "openai".to_string(),
            model_name: "gpt-4".to_string(),
            context_window: 8192,
            cost_per_token: 0.00003,
            capabilities: vec![
                AICapability::TextGeneration,
                AICapability::TextAnalysis,
                AICapability::CodeGeneration,
            ],
            enabled: true,
        });

        Self {
            sira_gateway_url: "http://localhost:8080".to_string(),
            enable_caching: true,
            cache_ttl_seconds: DEFAULT_CACHE_TTL,
            max_concurrent_requests: 100,
            request_timeout_ms: DEFAULT_AI_TIMEOUT,
            enable_streaming: true,
            enable_cost_optimization: true,
            enable_monitoring: true,
            local_model_dir: None,
            providers,
            models,
        }
    }
}

/// Provider configuration
#[derive(Debug, Clone)]
pub struct ProviderConfig {
    /// API key (optional, can be loaded from environment)
    pub api_key: Option<String>,
    /// Base URL for API calls
    pub base_url: String,
    /// Request timeout in milliseconds
    pub timeout_ms: u64,
    /// Maximum retry attempts
    pub max_retries: usize,
    /// Rate limiting configuration
    pub rate_limit: RateLimit,
}

/// Rate limiting configuration
#[derive(Debug, Clone)]
pub struct RateLimit {
    /// Requests per minute
    pub requests_per_minute: u32,
    /// Requests per hour
    pub requests_per_hour: u32,
}

/// Model configuration
#[derive(Debug, Clone)]
pub struct ModelConfig {
    /// Provider name
    pub provider: String,
    /// Model name/identifier
    pub model_name: String,
    /// Context window size (tokens)
    pub context_window: usize,
    /// Cost per token (USD)
    pub cost_per_token: f64,
    /// Supported capabilities
    pub capabilities: Vec<AICapability>,
    /// Model enabled status
    pub enabled: bool,
}

/// AI capabilities
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AICapability {
    /// Text generation
    TextGeneration,
    /// Text analysis/summarization
    TextAnalysis,
    /// Code generation
    CodeGeneration,
    /// Image generation
    ImageGeneration,
    /// Image analysis
    ImageAnalysis,
    /// Speech recognition
    SpeechRecognition,
    /// Speech synthesis
    SpeechSynthesis,
    /// Translation
    Translation,
    /// Embedding generation
    Embedding,
    /// Question answering
    QuestionAnswering,
    /// Classification
    Classification,
}

/// Inference configuration
#[derive(Debug, Clone)]
pub struct InferenceConfig {
    /// Temperature for generation (0.0-1.0)
    pub temperature: f32,
    /// Maximum tokens to generate
    pub max_tokens: usize,
    /// Top-p sampling parameter
    pub top_p: f32,
    /// Top-k sampling parameter
    pub top_k: Option<usize>,
    /// Frequency penalty
    pub frequency_penalty: f32,
    /// Presence penalty
    pub presence_penalty: f32,
    /// Stop sequences
    pub stop_sequences: Vec<String>,
}

impl Default for InferenceConfig {
    fn default() -> Self {
        Self {
            temperature: 0.7,
            max_tokens: 1000,
            top_p: 1.0,
            top_k: None,
            frequency_penalty: 0.0,
            presence_penalty: 0.0,
            stop_sequences: Vec::new(),
        }
    }
}

/// Cache configuration
#[derive(Debug, Clone)]
pub struct CacheConfig {
    /// Enable semantic caching
    pub enable_semantic_cache: bool,
    /// Similarity threshold for cache hits (0.0-1.0)
    pub similarity_threshold: f32,
    /// Maximum cache size (entries)
    pub max_cache_size: usize,
    /// Cache eviction policy
    pub eviction_policy: CacheEvictionPolicy,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            enable_semantic_cache: true,
            similarity_threshold: 0.85,
            max_cache_size: 10000,
            eviction_policy: CacheEvictionPolicy::LRU,
        }
    }
}

/// Cache eviction policies
#[derive(Debug, Clone)]
pub enum CacheEvictionPolicy {
    /// Least Recently Used
    LRU,
    /// Least Frequently Used
    LFU,
    /// Time-based expiration
    TTL,
    /// Size-based (when cache is full)
    SizeBased,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = AISystemConfig::default();
        assert!(config.enable_caching);
        assert!(config.enable_cost_optimization);
        assert!(config.max_concurrent_requests > 0);
        assert!(config.providers.contains_key("openai"));
        assert!(config.models.contains_key("gpt-4"));
    }

    #[test]
    fn test_inference_config() {
        let config = InferenceConfig::default();
        assert!(config.temperature >= 0.0 && config.temperature <= 1.0);
        assert!(config.max_tokens > 0);
        assert!(config.stop_sequences.is_empty());
    }

    #[test]
    fn test_cache_config() {
        let config = CacheConfig::default();
        assert!(config.enable_semantic_cache);
        assert!(config.similarity_threshold > 0.0 && config.similarity_threshold <= 1.0);
        assert!(config.max_cache_size > 0);
    }
}
