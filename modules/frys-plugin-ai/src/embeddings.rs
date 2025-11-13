//! Embedding generation and management

use crate::*;

/// Embedding generator
pub struct EmbeddingGenerator;

impl EmbeddingGenerator {
    /// Generate embeddings for text
    pub async fn generate_text_embeddings(&self, texts: &[String]) -> Result<Vec<Vec<f32>>> {
        // Placeholder implementation
        Ok(vec![vec![0.1, 0.2, 0.3, 0.4]; texts.len()])
    }

    /// Generate embeddings for images
    pub async fn generate_image_embeddings(&self, images: &[Vec<u8>]) -> Result<Vec<Vec<f32>>> {
        #[cfg(feature = "vision")]
        {
            // Actual image embedding implementation
            Ok(vec![vec![0.5, 0.6, 0.7, 0.8]; images.len()])
        }
        #[cfg(not(feature = "vision"))]
        {
            Err(AIPluginError::FeatureNotEnabled("Vision features not enabled".to_string()))
        }
    }

    /// Calculate similarity between embeddings
    pub fn calculate_similarity(&self, embedding1: &[f32], embedding2: &[f32]) -> f32 {
        // Cosine similarity
        let dot_product: f32 = embedding1.iter().zip(embedding2.iter()).map(|(a, b)| a * b).sum();
        let norm1: f32 = embedding1.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm2: f32 = embedding2.iter().map(|x| x * x).sum::<f32>().sqrt();

        if norm1 == 0.0 || norm2 == 0.0 {
            0.0
        } else {
            dot_product / (norm1 * norm2)
        }
    }

    /// Find most similar embeddings
    pub fn find_similar(&self, query_embedding: &[f32], embeddings: &[(String, Vec<f32>)], top_k: usize) -> Vec<(String, f32)> {
        let mut similarities: Vec<(String, f32)> = embeddings
            .iter()
            .map(|(id, emb)| (id.clone(), self.calculate_similarity(query_embedding, emb)))
            .collect();

        similarities.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        similarities.into_iter().take(top_k).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_similarity_calculation() {
        let generator = EmbeddingGenerator {};

        let emb1 = vec![1.0, 0.0, 0.0];
        let emb2 = vec![0.0, 1.0, 0.0];
        let similarity = generator.calculate_similarity(&emb1, &emb2);
        assert_eq!(similarity, 0.0);

        let emb3 = vec![1.0, 0.0, 0.0];
        let emb4 = vec![1.0, 0.0, 0.0];
        let similarity2 = generator.calculate_similarity(&emb3, &emb4);
        assert_eq!(similarity2, 1.0);
    }

    #[test]
    fn test_find_similar() {
        let generator = EmbeddingGenerator {};

        let query = vec![1.0, 0.0, 0.0];
        let embeddings = vec![
            ("item1".to_string(), vec![1.0, 0.0, 0.0]),
            ("item2".to_string(), vec![0.0, 1.0, 0.0]),
            ("item3".to_string(), vec![0.5, 0.5, 0.0]),
        ];

        let similar = generator.find_similar(&query, &embeddings, 2);
        assert_eq!(similar.len(), 2);
        assert_eq!(similar[0].0, "item1");
        assert_eq!(similar[0].1, 1.0);
    }
}
