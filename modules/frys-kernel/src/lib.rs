//! # Frys Kernel
//!
//! Frys Kernel is the core runtime environment for the Frys distributed system.
//! It provides high-performance, zero-dependency implementations of:
//!
//! - **Memory Pool**: Arena-based memory allocation with SIMD optimization
//! - **Thread Pool**: Work-stealing scheduler with CPU affinity
//! - **Network Stack**: Zero-copy TCP/UDP with io_uring support
//! - **Storage Engine**: WAL + LSM tree persistent storage
//!
//! ## Features
//!
//! - **Zero Dependencies**: Pure Rust implementation with no external crates
//! - **Performance Optimized**: SIMD instructions, LTO, and custom allocators
//! - **Memory Safe**: Rust's ownership system guarantees memory safety
//! - **Async Native**: Built on Rust's async runtime for maximum performance
//!
//! ## Example
//!
//! ```rust,no_run
//! use frys_kernel::{FrysKernel, KernelConfig};
//!
//! #[tokio::main]
//! async fn main() -> Result<(), Box<dyn std::error::Error>> {
//!     // Create kernel configuration
//!     let config = KernelConfig {
//!         memory_limit: 1024 * 1024 * 1024, // 1GB
//!         thread_count: 8,
//!         network_buffer_size: 64 * 1024, // 64KB
//!         enable_simd: true,
//!         enable_uring: true,
//!     };
//!
//!     // Initialize kernel
//!     let kernel = FrysKernel::init(config).await?;
//!
//!     // Use kernel services...
//!
//!     // Shutdown kernel
//!     kernel.shutdown().await?;
//!
//!     Ok(())
//! }
//! ```
//!
//! ## Architecture
//!
//! The kernel is designed as a microkernel with four main components:
//!
//! 1. **Memory Pool**: Custom arena allocator with SIMD alignment
//! 2. **Thread Pool**: Work-stealing scheduler with CPU affinity
//! 3. **Network Stack**: Zero-copy I/O with io_uring optimization
//! 4. **Storage Engine**: WAL-based persistent storage with LSM indexing
//!
//! ## Performance Goals
//!
//! - **Startup Time**: < 50ms
//! - **Memory Usage**: < 10MB baseline
//! - **Throughput**: 100K+ operations/second
//! - **Latency**: < 1ms P99 for most operations
//!
#![cfg_attr(not(feature = "std"), no_std)]
#![cfg_attr(not(test), allow(unsafe_code))] // Allow unsafe for kernel operations
#![warn(missing_docs)]
#![warn(rust_2018_idioms)]
#![warn(clippy::all)]
#![warn(clippy::pedantic)]

// 重新导出std用于测试和main函数
#[cfg(any(test, feature = "std"))]
extern crate std;

// 公共模块导出
pub mod memory;
pub mod thread;
pub mod network;
pub mod storage;

// 错误类型
mod error;
pub use error::*;

// 配置类型
mod config;
pub use config::*;

// 内核主结构体
mod kernel;
pub use kernel::*;

// 工具函数
mod utils;

// 类型别名
pub type Result<T> = core::result::Result<T, KernelError>;

// 常量定义
pub const KERNEL_VERSION: &str = env!("CARGO_PKG_VERSION");
pub const SIMD_ALIGNMENT: usize = 64; // AVX-512对齐要求
pub const DEFAULT_MEMORY_LIMIT: usize = 512 * 1024 * 1024; // 512MB
pub const DEFAULT_THREAD_COUNT: usize = 4;
pub const DEFAULT_NETWORK_BUFFER_SIZE: usize = 64 * 1024; // 64KB

// 编译时检查
#[cfg(not(any(
    target_arch = "x86_64",
    target_arch = "aarch64",
    target_arch = "arm"
)))]
compile_error!("Frys Kernel only supports x86_64, aarch64, and arm architectures");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_kernel_version() {
        assert!(!KERNEL_VERSION.is_empty());
    }

    #[test]
    fn test_constants() {
        assert_eq!(SIMD_ALIGNMENT, 64);
        assert!(DEFAULT_MEMORY_LIMIT > 0);
        assert!(DEFAULT_THREAD_COUNT > 0);
        assert!(DEFAULT_NETWORK_BUFFER_SIZE > 0);
    }
}