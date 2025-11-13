//! Utility functions

/// Align size to the given alignment
pub fn align_up(size: usize, alignment: usize) -> usize {
    (size + alignment - 1) & !(alignment - 1)
}

/// Align size down to the given alignment
pub fn align_down(size: usize, alignment: usize) -> usize {
    size & !(alignment - 1)
}

/// Check if SIMD is supported
pub fn is_simd_supported() -> bool {
    #[cfg(target_feature = "avx2")]
    {
        true
    }
    #[cfg(not(target_feature = "avx2"))]
    {
        false
    }
}