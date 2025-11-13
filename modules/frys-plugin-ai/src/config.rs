//! Configuration for AI Plugin

use alloc::string::String;

/// Backend types supported by the AI plugin
#[derive(Debug, Clone, PartialEq)]
pub enum BackendType {
    /// CPU-only inference
    CPU,
    /// PyTorch backend
    PyTorch,
    /// TensorFlow backend
    TensorFlow,
    /// ONNX Runtime backend
    ONNX,
    /// Custom backend
    Custom,
}

/// Device types for inference
#[derive(Debug, Clone, PartialEq)]
pub enum DeviceType {
    /// CPU device
    CPU,
    /// CUDA GPU device
    GPU,
    /// MPS (Apple Silicon) device
    MPS,
    /// TPU device
    TPU,
}

/// Model types supported by the plugin
#[derive(Debug, Clone, PartialEq)]
pub enum ModelType {
    /// Natural Language Processing models
    NLP,
    /// Computer Vision models
    Vision,
    /// Embedding models
    Embedding,
    /// Custom models
    Custom,
}

/// Main configuration for the AI plugin
#[derive(Debug, Clone)]
pub struct AIPluginConfig {
    /// Backend to use for inference
    pub backend: BackendType,
    /// Device to run inference on
    pub device: DeviceType,
    /// Maximum number of models to keep in cache
    pub model_cache_size: usize,
    /// Maximum number of concurrent inference requests
    pub max_concurrent_requests: usize,
    /// Enable training capabilities
    pub enable_training: bool,
    /// Enable monitoring and metrics collection
    pub enable_monitoring: bool,
    /// Model registry URL (optional)
    pub model_registry_url: Option<String>,
    /// Default batch size for inference
    pub default_batch_size: usize,
    /// Memory limit per model (in MB)
    pub memory_limit_mb: usize,
    /// Timeout for inference operations (in seconds)
    pub inference_timeout_secs: u64,
    /// Enable model quantization for better performance
    pub enable_quantization: bool,
    /// Enable model caching
    pub enable_model_caching: bool,
}

impl Default for AIPluginConfig {
    fn default() -> Self {
        Self {
            backend: BackendType::CPU,
            device: DeviceType::CPU,
            model_cache_size: 50,
            max_concurrent_requests: 8,
            enable_training: false,
            enable_monitoring: true,
            model_registry_url: None,
            default_batch_size: 32,
            memory_limit_mb: 2048, // 2GB
            inference_timeout_secs: 300, // 5 minutes
            enable_quantization: true,
            enable_model_caching: true,
        }
    }
}

/// Model-specific configuration
#[derive(Debug, Clone)]
pub struct ModelConfig {
    /// Model name or path
    pub name: String,
    /// Model type
    pub model_type: ModelType,
    /// Input tensor shapes (optional)
    pub input_shapes: Option<Vec<Vec<usize>>>,
    /// Output tensor shapes (optional)
    pub output_shapes: Option<Vec<Vec<usize>>>,
    /// Quantization settings
    pub quantization: QuantizationConfig,
    /// Optimization settings
    pub optimization: OptimizationConfig,
    /// Custom parameters
    pub parameters: alloc::collections::BTreeMap<String, String>,
}

impl Default for ModelConfig {
    fn default() -> Self {
        Self {
            name: String::new(),
            model_type: ModelType::Custom,
            input_shapes: None,
            output_shapes: None,
            quantization: QuantizationConfig::default(),
            optimization: OptimizationConfig::default(),
            parameters: alloc::collections::BTreeMap::new(),
        }
    }
}

/// Quantization configuration
#[derive(Debug, Clone)]
pub struct QuantizationConfig {
    /// Enable quantization
    pub enabled: bool,
    /// Quantization type
    pub quantization_type: QuantizationType,
    /// Precision level
    pub precision: PrecisionLevel,
}

impl Default for QuantizationConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            quantization_type: QuantizationType::Dynamic,
            precision: PrecisionLevel::INT8,
        }
    }
}

/// Quantization types
#[derive(Debug, Clone)]
pub enum QuantizationType {
    /// Static quantization
    Static,
    /// Dynamic quantization
    Dynamic,
    /// Quantization-aware training
    QAT,
}

/// Precision levels for quantization
#[derive(Debug, Clone)]
pub enum PrecisionLevel {
    /// 8-bit integer
    INT8,
    /// 4-bit integer
    INT4,
    /// Mixed precision
    Mixed,
}

/// Optimization configuration
#[derive(Debug, Clone)]
pub struct OptimizationConfig {
    /// Enable graph optimization
    pub graph_optimization: bool,
    /// Enable operator fusion
    pub operator_fusion: bool,
    /// Enable memory optimization
    pub memory_optimization: bool,
    /// Target platform
    pub target_platform: TargetPlatform,
}

impl Default for OptimizationConfig {
    fn default() -> Self {
        Self {
            graph_optimization: true,
            operator_fusion: true,
            memory_optimization: true,
            target_platform: TargetPlatform::Generic,
        }
    }
}

/// Target platforms for optimization
#[derive(Debug, Clone)]
pub enum TargetPlatform {
    /// Generic CPU
    Generic,
    /// x86-64 architecture
    X86_64,
    /// ARM architecture
    ARM,
    /// Apple Silicon (M1/M2)
    AppleSilicon,
    /// NVIDIA GPU
    NVIDIA,
    /// AMD GPU
    AMD,
}

/// Training configuration
#[derive(Debug, Clone)]
pub struct TrainingConfig {
    /// Learning rate
    pub learning_rate: f32,
    /// Batch size
    pub batch_size: usize,
    /// Number of epochs
    pub epochs: usize,
    /// Optimizer type
    pub optimizer: OptimizerType,
    /// Loss function
    pub loss_function: LossFunction,
    /// Enable early stopping
    pub early_stopping: bool,
    /// Validation split ratio
    pub validation_split: f32,
    /// Save checkpoints
    pub save_checkpoints: bool,
    /// Checkpoint interval (in epochs)
    pub checkpoint_interval: usize,
}

impl Default for TrainingConfig {
    fn default() -> Self {
        Self {
            learning_rate: 0.001,
            batch_size: 32,
            epochs: 100,
            optimizer: OptimizerType::Adam,
            loss_function: LossFunction::CrossEntropy,
            early_stopping: true,
            validation_split: 0.2,
            save_checkpoints: true,
            checkpoint_interval: 10,
        }
    }
}

/// Optimizer types
#[derive(Debug, Clone)]
pub enum OptimizerType {
    /// Stochastic Gradient Descent
    SGD,
    /// Adam optimizer
    Adam,
    /// RMSprop optimizer
    RMSprop,
    /// AdamW optimizer
    AdamW,
}

/// Loss functions
#[derive(Debug, Clone)]
pub enum LossFunction {
    /// Mean Squared Error
    MSE,
    /// Cross Entropy Loss
    CrossEntropy,
    /// Binary Cross Entropy Loss
    BCE,
    /// Custom loss function
    Custom(String),
}

/// Inference configuration
#[derive(Debug, Clone)]
pub struct InferenceConfig {
    /// Batch size for inference
    pub batch_size: usize,
    /// Timeout for inference (in seconds)
    pub timeout_secs: u64,
    /// Enable caching of results
    pub enable_caching: bool,
    /// Cache size limit
    pub cache_size_limit: usize,
    /// Enable warmup
    pub enable_warmup: bool,
    /// Number of warmup iterations
    pub warmup_iterations: usize,
}

impl Default for InferenceConfig {
    fn default() -> Self {
        Self {
            batch_size: 32,
            timeout_secs: 300,
            enable_caching: true,
            cache_size_limit: 1000,
            enable_warmup: true,
            warmup_iterations: 3,
        }
    }
}

/// Monitoring configuration
#[derive(Debug, Clone)]
pub struct MonitoringConfig {
    /// Enable metrics collection
    pub enable_metrics: bool,
    /// Metrics collection interval (in seconds)
    pub metrics_interval_secs: u64,
    /// Enable logging
    pub enable_logging: bool,
    /// Log level
    pub log_level: LogLevel,
    /// Enable tracing
    pub enable_tracing: bool,
    /// Export metrics to external system
    pub export_metrics: bool,
    /// Metrics export endpoint
    pub metrics_endpoint: Option<String>,
}

impl Default for MonitoringConfig {
    fn default() -> Self {
        Self {
            enable_metrics: true,
            metrics_interval_secs: 60,
            enable_logging: true,
            log_level: LogLevel::Info,
            enable_tracing: false,
            export_metrics: false,
            metrics_endpoint: None,
        }
    }
}

/// Log levels
#[derive(Debug, Clone)]
pub enum LogLevel {
    /// Debug level
    Debug,
    /// Info level
    Info,
    /// Warning level
    Warning,
    /// Error level
    Error,
}

/// Security configuration
#[derive(Debug, Clone)]
pub struct SecurityConfig {
    /// Enable sandboxing
    pub enable_sandbox: bool,
    /// Memory limit per inference (in MB)
    pub memory_limit_mb: usize,
    /// CPU time limit per inference (in seconds)
    pub cpu_time_limit_secs: u64,
    /// Maximum input size (in bytes)
    pub max_input_size_bytes: usize,
    /// Maximum output size (in bytes)
    pub max_output_size_bytes: usize,
    /// Allowed model sources
    pub allowed_model_sources: Vec<String>,
    /// Enable input validation
    pub enable_input_validation: bool,
    /// Enable output sanitization
    pub enable_output_sanitization: bool,
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self {
            enable_sandbox: true,
            memory_limit_mb: 1024, // 1GB
            cpu_time_limit_secs: 300, // 5 minutes
            max_input_size_bytes: 10 * 1024 * 1024, // 10MB
            max_output_size_bytes: 10 * 1024 * 1024, // 10MB
            allowed_model_sources: vec!["local".to_string(), "trusted-registry".to_string()],
            enable_input_validation: true,
            enable_output_sanitization: true,
        }
    }
}

/// Complete plugin configuration
#[derive(Debug, Clone)]
pub struct CompleteAIPluginConfig {
    /// Core plugin configuration
    pub plugin: AIPluginConfig,
    /// Training configuration
    pub training: TrainingConfig,
    /// Inference configuration
    pub inference: InferenceConfig,
    /// Monitoring configuration
    pub monitoring: MonitoringConfig,
    /// Security configuration
    pub security: SecurityConfig,
}

impl Default for CompleteAIPluginConfig {
    fn default() -> Self {
        Self {
            plugin: AIPluginConfig::default(),
            training: TrainingConfig::default(),
            inference: InferenceConfig::default(),
            monitoring: MonitoringConfig::default(),
            security: SecurityConfig::default(),
        }
    }
}

impl CompleteAIPluginConfig {
    /// Create configuration from environment variables
    pub fn from_env() -> Self {
        let mut config = Self::default();

        // Override with environment variables if present
        if let Ok(backend) = std::env::var("FRYS_AI_BACKEND") {
            config.plugin.backend = match backend.to_lowercase().as_str() {
                "pytorch" => BackendType::PyTorch,
                "tensorflow" => BackendType::TensorFlow,
                "onnx" => BackendType::ONNX,
                "custom" => BackendType::Custom,
                _ => BackendType::CPU,
            };
        }

        if let Ok(device) = std::env::var("FRYS_AI_DEVICE") {
            config.plugin.device = match device.to_lowercase().as_str() {
                "gpu" => DeviceType::GPU,
                "mps" => DeviceType::MPS,
                "tpu" => DeviceType::TPU,
                _ => DeviceType::CPU,
            };
        }

        if let Ok(cache_size) = std::env::var("FRYS_AI_MODEL_CACHE_SIZE") {
            if let Ok(size) = cache_size.parse::<usize>() {
                config.plugin.model_cache_size = size;
            }
        }

        if let Ok(max_concurrent) = std::env::var("FRYS_AI_MAX_CONCURRENT") {
            if let Ok(count) = max_concurrent.parse::<usize>() {
                config.plugin.max_concurrent_requests = count;
            }
        }

        config
    }

    /// Validate the configuration
    pub fn validate(&self) -> Result<()> {
        // Validate plugin config
        if self.plugin.model_cache_size == 0 {
            return Err(AIPluginError::InvalidConfiguration("Model cache size must be greater than 0".to_string()));
        }

        if self.plugin.max_concurrent_requests == 0 {
            return Err(AIPluginError::InvalidConfiguration("Max concurrent requests must be greater than 0".to_string()));
        }

        // Validate training config
        if self.training.learning_rate <= 0.0 || self.training.learning_rate > 1.0 {
            return Err(AIPluginError::InvalidConfiguration("Learning rate must be between 0 and 1".to_string()));
        }

        if self.training.batch_size == 0 {
            return Err(AIPluginError::InvalidConfiguration("Batch size must be greater than 0".to_string()));
        }

        // Validate security config
        if self.security.memory_limit_mb == 0 {
            return Err(AIPluginError::InvalidConfiguration("Memory limit must be greater than 0".to_string()));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = AIPluginConfig::default();
        assert_eq!(config.backend, BackendType::CPU);
        assert_eq!(config.device, DeviceType::CPU);
        assert_eq!(config.model_cache_size, 50);
        assert_eq!(config.max_concurrent_requests, 8);
    }

    #[test]
    fn test_complete_config_validation() {
        let mut config = CompleteAIPluginConfig::default();

        // Valid config should pass
        assert!(config.validate().is_ok());

        // Invalid config should fail
        config.plugin.model_cache_size = 0;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_model_config() {
        let config = ModelConfig::default();
        assert_eq!(config.model_type, ModelType::Custom);
        assert!(config.quantization.enabled);
        assert!(config.optimization.graph_optimization);
    }

    #[test]
    fn test_training_config() {
        let config = TrainingConfig::default();
        assert_eq!(config.learning_rate, 0.001);
        assert_eq!(config.batch_size, 32);
        assert_eq!(config.epochs, 100);
        assert!(config.early_stopping);
    }
}
