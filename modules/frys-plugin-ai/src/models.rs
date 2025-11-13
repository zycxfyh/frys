//! Model management and representation

use crate::*;
use alloc::collections::BTreeMap;

/// Generic model representation
#[derive(Debug)]
pub struct Model {
    /// Model identifier
    pub id: String,
    /// Model type
    pub model_type: ModelType,
    /// Model metadata
    pub metadata: ModelMetadata,
    /// Model data (backend-specific)
    pub data: ModelData,
}

/// Model metadata
#[derive(Debug, Clone)]
pub struct ModelMetadata {
    /// Model name
    pub name: String,
    /// Model version
    pub version: String,
    /// Model description
    pub description: String,
    /// Input specifications
    pub inputs: Vec<TensorSpec>,
    /// Output specifications
    pub outputs: Vec<TensorSpec>,
    /// Model size in bytes
    pub size_bytes: u64,
    /// Creation timestamp
    pub created_at: u64,
    /// Last modified timestamp
    pub modified_at: u64,
}

/// Tensor specification
#[derive(Debug, Clone)]
pub struct TensorSpec {
    /// Tensor name
    pub name: String,
    /// Data type
    pub data_type: DataType,
    /// Shape (dimensions)
    pub shape: Vec<usize>,
    /// Optional description
    pub description: Option<String>,
}

/// Data types for tensors
#[derive(Debug, Clone)]
pub enum DataType {
    /// 32-bit float
    Float32,
    /// 64-bit float
    Float64,
    /// 32-bit integer
    Int32,
    /// 64-bit integer
    Int64,
    /// 8-bit unsigned integer
    UInt8,
    /// Boolean
    Bool,
    /// String
    String,
}

/// Model data container (backend-specific)
#[derive(Debug)]
pub enum ModelData {
    /// PyTorch model data
    PyTorch(PyTorchModelData),
    /// TensorFlow model data
    TensorFlow(TensorFlowModelData),
    /// ONNX model data
    ONNX(ONNXModelData),
    /// Custom model data
    Custom(alloc::vec::Vec<u8>),
}

/// PyTorch model data
#[derive(Debug)]
pub struct PyTorchModelData {
    /// Model bytes
    pub model_bytes: alloc::vec::Vec<u8>,
    /// State dict (optional)
    pub state_dict: Option<alloc::vec::Vec<u8>>,
    /// Model configuration
    pub config: BTreeMap<String, serde_json::Value>,
}

/// TensorFlow model data
#[derive(Debug)]
pub struct TensorFlowModelData {
    /// Saved model directory or file
    pub model_path: String,
    /// Model signature
    pub signature: Option<String>,
    /// Tags
    pub tags: Vec<String>,
}

/// ONNX model data
#[derive(Debug)]
pub struct ONNXModelData {
    /// ONNX model bytes
    pub model_bytes: alloc::vec::Vec<u8>,
    /// ONNX version
    pub onnx_version: String,
    /// Opset version
    pub opset_version: i64,
}

impl Model {
    /// Create a new model
    pub fn new(id: String, model_type: ModelType, metadata: ModelMetadata, data: ModelData) -> Self {
        Self {
            id,
            model_type,
            metadata,
            data,
        }
    }

    /// Get model size in bytes
    pub fn size_bytes(&self) -> u64 {
        match &self.data {
            ModelData::PyTorch(data) => data.model_bytes.len() as u64,
            ModelData::TensorFlow(_) => 0, // Would need to calculate actual size
            ModelData::ONNX(data) => data.model_bytes.len() as u64,
            ModelData::Custom(data) => data.len() as u64,
        }
    }

    /// Validate model compatibility
    pub fn validate(&self) -> Result<()> {
        // Basic validation
        if self.metadata.inputs.is_empty() {
            return Err(AIPluginError::InvalidModel("Model must have at least one input".to_string()));
        }

        if self.metadata.outputs.is_empty() {
            return Err(AIPluginError::InvalidModel("Model must have at least one output".to_string()));
        }

        // Validate tensor shapes
        for input in &self.metadata.inputs {
            if input.shape.is_empty() {
                return Err(AIPluginError::InvalidModel(format!("Input '{}' has empty shape", input.name)));
            }
        }

        Ok(())
    }
}

/// Model registry for managing available models
pub struct ModelRegistry {
    models: BTreeMap<String, Model>,
    model_index: BTreeMap<ModelType, Vec<String>>,
}

impl ModelRegistry {
    pub fn new() -> Self {
        Self {
            models: BTreeMap::new(),
            model_index: BTreeMap::new(),
        }
    }

    /// Register a model
    pub fn register_model(&mut self, model: Model) -> Result<()> {
        model.validate()?;

        let model_id = model.id.clone();
        let model_type = model.model_type;

        self.models.insert(model_id.clone(), model);
        self.model_index.entry(model_type).or_insert_with(Vec::new).push(model_id);

        Ok(())
    }

    /// Get model by ID
    pub fn get_model(&self, model_id: &str) -> Option<&Model> {
        self.models.get(model_id)
    }

    /// Get models by type
    pub fn get_models_by_type(&self, model_type: ModelType) -> Vec<&Model> {
        self.model_index.get(&model_type)
            .map(|ids| ids.iter().filter_map(|id| self.models.get(id)).collect())
            .unwrap_or_default()
    }

    /// List all models
    pub fn list_models(&self) -> Vec<&Model> {
        self.models.values().collect()
    }

    /// Remove model
    pub fn remove_model(&mut self, model_id: &str) -> Result<()> {
        if let Some(model) = self.models.remove(model_id) {
            if let Some(ids) = self.model_index.get_mut(&model.model_type) {
                ids.retain(|id| id != model_id);
            }
            Ok(())
        } else {
            Err(AIPluginError::ModelNotFound(model_id.to_string()))
        }
    }

    /// Search models by name
    pub fn search_models(&self, query: &str) -> Vec<&Model> {
        self.models.values()
            .filter(|model| model.metadata.name.to_lowercase().contains(&query.to_lowercase()))
            .collect()
    }
}

/// Model loader for different formats
pub struct ModelLoader;

impl ModelLoader {
    /// Load PyTorch model
    pub async fn load_pytorch(&self, path: &str) -> Result<ModelData> {
        #[cfg(feature = "ml")]
        {
            // Load PyTorch model implementation
            Ok(ModelData::PyTorch(PyTorchModelData {
                model_bytes: vec![], // Would load actual file
                state_dict: None,
                config: BTreeMap::new(),
            }))
        }
        #[cfg(not(feature = "ml"))]
        {
            Err(AIPluginError::FeatureNotEnabled("ML features not enabled".to_string()))
        }
    }

    /// Load TensorFlow model
    pub async fn load_tensorflow(&self, path: &str) -> Result<ModelData> {
        #[cfg(feature = "ml")]
        {
            Ok(ModelData::TensorFlow(TensorFlowModelData {
                model_path: path.to_string(),
                signature: None,
                tags: vec![],
            }))
        }
        #[cfg(not(feature = "ml"))]
        {
            Err(AIPluginError::FeatureNotEnabled("ML features not enabled".to_string()))
        }
    }

    /// Load ONNX model
    pub async fn load_onnx(&self, path: &str) -> Result<ModelData> {
        // Load ONNX model implementation
        Ok(ModelData::ONNX(ONNXModelData {
            model_bytes: vec![], // Would load actual file
            onnx_version: "1.12".to_string(),
            opset_version: 17,
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_model_creation() {
        let metadata = ModelMetadata {
            name: "test_model".to_string(),
            version: "1.0.0".to_string(),
            description: "Test model".to_string(),
            inputs: vec![TensorSpec {
                name: "input".to_string(),
                data_type: DataType::Float32,
                shape: vec![1, 784],
                description: Some("Input tensor".to_string()),
            }],
            outputs: vec![TensorSpec {
                name: "output".to_string(),
                data_type: DataType::Float32,
                shape: vec![1, 10],
                description: Some("Output tensor".to_string()),
            }],
            size_bytes: 1024,
            created_at: 0,
            modified_at: 0,
        };

        let data = ModelData::Custom(vec![1, 2, 3, 4]);
        let model = Model::new("test".to_string(), ModelType::Custom, metadata, data);

        assert_eq!(model.id, "test");
        assert!(model.validate().is_ok());
    }

    #[test]
    fn test_model_registry() {
        let mut registry = ModelRegistry::new();

        let model = create_test_model();
        registry.register_model(model).unwrap();

        assert_eq!(registry.list_models().len(), 1);

        let retrieved = registry.get_model("test_model");
        assert!(retrieved.is_some());
    }

    fn create_test_model() -> Model {
        let metadata = ModelMetadata {
            name: "test_model".to_string(),
            version: "1.0.0".to_string(),
            description: "Test model".to_string(),
            inputs: vec![TensorSpec {
                name: "input".to_string(),
                data_type: DataType::Float32,
                shape: vec![1, 10],
                description: None,
            }],
            outputs: vec![TensorSpec {
                name: "output".to_string(),
                data_type: DataType::Float32,
                shape: vec![1, 1],
                description: None,
            }],
            size_bytes: 100,
            created_at: 0,
            modified_at: 0,
        };

        let data = ModelData::Custom(vec![1, 2, 3]);
        Model::new("test_model".to_string(), ModelType::Custom, metadata, data)
    }
}
