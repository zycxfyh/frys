//! Example usage of Frys Plugin System

use frys_plugin_system::*;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Frys Plugin System Example");
    println!("===========================");

    // Create plugin manager
    let manager = PluginManager::builder()
        .with_sandbox(true)
        .with_hot_reload(false)
        .build()
        .await?;

    println!("\nPlugin manager created successfully!");
    println!("Sandbox enabled: true");
    println!("Hot reload enabled: false");

    // Create sample plugin metadata
    let metadata = PluginMetadata {
        id: "example-plugin".into(),
        name: "Example Plugin".into(),
        version: PluginVersion::new(1, 0, 0),
        description: "A sample plugin for demonstration".into(),
        author: "Frys Team".into(),
        license: "MIT".into(),
        dependencies: vec![],
        capabilities: vec![PluginCapability::DataProcessing],
        permissions: vec![PluginPermission::Read, PluginPermission::Execute],
        resource_limits: ResourceLimits::default(),
    };

    println!("\nSample plugin metadata:");
    println!("ID: {}", metadata.id);
    println!("Name: {}", metadata.name);
    println!("Version: {}", metadata.version);
    println!("Capabilities: {:?}", metadata.capabilities);
    println!("Permissions: {:?}", metadata.permissions);

    // Note: In a real implementation, we would load actual plugins
    // For this example, we just demonstrate the API structure

    println!("\nPlugin loading simulation...");
    println!("✓ Plugin 'example-plugin' would be loaded");

    // Execute plugin simulation
    println!("\nPlugin execution simulation...");
    println!("✓ Function 'process_data' would be called");
    println!("✓ Result: 'processed_data'");

    // Get plugin statistics
    let stats = manager.stats();
    println!("\nPlugin Manager Statistics:");
    println!("Plugins loaded: {}", stats.plugins_loaded);
    println!("Plugins unloaded: {}", stats.plugins_unloaded);
    println!("Total executions: {}", stats.total_executions);
    println!("Successful executions: {}", stats.successful_executions);
    println!("Failed executions: {}", stats.failed_executions);
    println!("Success rate: {:.1}%", stats.success_rate() * 100.0);

    // Test isolation
    let mut isolation_manager = IsolationManager::new();
    isolation_manager.isolate_plugin("example-plugin".into(), &metadata).await?;
    println!("\nIsolation test:");
    println!("✓ Plugin isolated successfully");

    let isolation_stats = isolation_manager.stats();
    println!("Active isolations: {}", isolation_stats.total_isolations);

    // Test communication
    let mut broker = CommunicationBroker::new();
    #[cfg(feature = "async")]
    {
        broker.create_channel("plugin-a".into(), "plugin-b".into()).await?;
        println!("\nCommunication test:");
        println!("✓ Communication channel created");

        let broker_stats = broker.stats();
        println!("Active channels: {}", broker_stats.channels_active);
    }

    println!("\nExample completed successfully!");
    println!("\nNote: This is a demonstration of the plugin system API.");
    println!("In a real implementation, plugins would be loaded from WASM files");
    println!("and executed in secure sandboxes.");

    Ok(())
}
