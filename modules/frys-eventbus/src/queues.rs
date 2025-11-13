//! Lock-free queue implementations for EventBus

use crate::*;
use core::sync::atomic::{AtomicPtr, AtomicUsize, Ordering};
use core::ptr;

/// Segmented lock-free queue for high-throughput event processing
///
/// This implementation uses a segmented approach where each segment is a
/// fixed-size array to reduce contention and improve cache locality.
pub struct SegmentedQueue<T> {
    /// Head segment (for producers)
    head: AtomicPtr<QueueSegment<T>>,
    /// Tail segment (for consumers)
    tail: AtomicPtr<QueueSegment<T>>,
    /// Current size
    size: AtomicUsize,
    /// Maximum size
    capacity: usize,
    /// Segment size
    segment_size: usize,
}

impl<T> SegmentedQueue<T> {
    /// Create a new segmented queue
    pub fn new(capacity: usize, segment_size: usize) -> Self {
        assert!(segment_size > 0 && segment_size.is_power_of_two());
        assert!(capacity >= segment_size);

        let initial_segment = Box::into_raw(Box::new(QueueSegment::new(segment_size)));
        let head_ptr = initial_segment;
        let tail_ptr = initial_segment;

        Self {
            head: AtomicPtr::new(head_ptr),
            tail: AtomicPtr::new(tail_ptr),
            size: AtomicUsize::new(0),
            capacity,
            segment_size,
        }
    }

    /// Push an item to the queue
    pub fn push(&self, item: T) -> Result<()> {
        let current_size = self.size.load(Ordering::Acquire);

        if current_size >= self.capacity {
            return Err(EventBusError::QueueFull {
                current_size,
                max_size: self.capacity,
            });
        }

        let mut head = self.head.load(Ordering::Acquire);

        // Try to push to current head segment
        loop {
            unsafe {
                if (*head).push(item) {
                    self.size.fetch_add(1, Ordering::AcqRel);
                    return Ok(());
                }
            }

            // Current segment is full, try to add a new segment
            let new_segment = Box::into_raw(Box::new(QueueSegment::new(self.segment_size)));
            let new_head = unsafe { (*head).next.compare_exchange(
                ptr::null_mut(),
                new_segment,
                Ordering::AcqRel,
                Ordering::Acquire,
            )};

            match new_head {
                Ok(_) => {
                    // Successfully added new segment, update head
                    self.head.store(new_segment, Ordering::Release);
                    head = new_segment;
                }
                Err(actual) => {
                    // Another thread already added a segment, use it
                    unsafe { Box::from_raw(new_segment) }; // Clean up unused segment
                    head = actual;
                }
            }
        }
    }

    /// Pop an item from the queue
    pub fn pop(&self) -> Option<T> {
        let mut tail = self.tail.load(Ordering::Acquire);

        loop {
            unsafe {
                if let Some(item) = (*tail).pop() {
                    self.size.fetch_sub(1, Ordering::AcqRel);
                    return Some(item);
                }
            }

            // Current segment is empty, try to move to next segment
            unsafe {
                let next = (*tail).next.load(Ordering::Acquire);
                if !next.is_null() {
                    self.tail.store(next, Ordering::Release);
                    // Don't free the old tail segment here - it will be cleaned up by GC
                    tail = next;
                } else {
                    // No more segments, queue is empty
                    return None;
                }
            }
        }
    }

    /// Check if the queue is empty
    pub fn is_empty(&self) -> bool {
        self.size.load(Ordering::Acquire) == 0
    }

    /// Get current size
    pub fn len(&self) -> usize {
        self.size.load(Ordering::Acquire)
    }

    /// Get capacity
    pub fn capacity(&self) -> usize {
        self.capacity
    }

    /// Check if queue is at capacity
    pub fn is_full(&self) -> bool {
        self.len() >= self.capacity
    }
}

impl<T> Drop for SegmentedQueue<T> {
    fn drop(&mut self) {
        // Clean up all segments
        let mut current = self.head.load(Ordering::Acquire);
        while !current.is_null() {
            unsafe {
                let next = (*current).next.load(Ordering::Acquire);
                Box::from_raw(current);
                current = next;
            }
        }
    }
}

/// Individual segment in the queue
struct QueueSegment<T> {
    /// Items in this segment
    items: *mut T,
    /// Capacity of this segment
    capacity: usize,
    /// Current write position
    write_pos: AtomicUsize,
    /// Current read position
    read_pos: AtomicUsize,
    /// Next segment in the chain
    next: AtomicPtr<QueueSegment<T>>,
}

impl<T> QueueSegment<T> {
    fn new(capacity: usize) -> Self {
        let items = unsafe {
            let layout = core::alloc::Layout::array::<T>(capacity).unwrap();
            core::alloc::alloc(layout) as *mut T
        };

        Self {
            items,
            capacity,
            write_pos: AtomicUsize::new(0),
            read_pos: AtomicUsize::new(0),
            next: AtomicPtr::new(ptr::null_mut()),
        }
    }

    /// Try to push an item to this segment
    fn push(&self, item: T) -> bool {
        let write_pos = self.write_pos.load(Ordering::Acquire);

        if write_pos >= self.capacity {
            return false; // Segment is full
        }

        match self.write_pos.compare_exchange(
            write_pos,
            write_pos + 1,
            Ordering::AcqRel,
            Ordering::Acquire,
        ) {
            Ok(_) => {
                // Successfully reserved slot, write the item
                unsafe {
                    ptr::write(self.items.add(write_pos), item);
                }
                true
            }
            Err(_) => false, // Another thread got the slot
        }
    }

    /// Try to pop an item from this segment
    fn pop(&self) -> Option<T> {
        let read_pos = self.read_pos.load(Ordering::Acquire);
        let write_pos = self.write_pos.load(Ordering::Acquire);

        if read_pos >= write_pos {
            return None; // No items available
        }

        match self.read_pos.compare_exchange(
            read_pos,
            read_pos + 1,
            Ordering::AcqRel,
            Ordering::Acquire,
        ) {
            Ok(_) => {
                // Successfully reserved item, read and return it
                unsafe {
                    Some(ptr::read(self.items.add(read_pos)))
                }
            }
            Err(_) => None, // Another thread got the item
        }
    }

    /// Check if segment is empty
    fn is_empty(&self) -> bool {
        self.read_pos.load(Ordering::Acquire) >= self.write_pos.load(Ordering::Acquire)
    }

    /// Check if segment is full
    fn is_full(&self) -> bool {
        self.write_pos.load(Ordering::Acquire) >= self.capacity
    }
}

impl<T> Drop for QueueSegment<T> {
    fn drop(&mut self) {
        // Drop all remaining items in the segment
        let read_pos = self.read_pos.load(Ordering::Acquire);
        let write_pos = self.write_pos.load(Ordering::Acquire);

        for i in read_pos..write_pos {
            unsafe {
                ptr::drop_in_place(self.items.add(i));
            }
        }

        // Deallocate the items array
        unsafe {
            let layout = core::alloc::Layout::array::<T>(self.capacity).unwrap();
            core::alloc::dealloc(self.items as *mut u8, layout);
        }
    }
}

/// Priority queue for events with different priorities
pub struct PriorityQueue<T> {
    /// Queues for different priorities (higher index = higher priority)
    queues: alloc::vec::Vec<SegmentedQueue<T>>,
    /// Priority levels
    priority_levels: usize,
}

impl<T> PriorityQueue<T> {
    /// Create a new priority queue
    pub fn new(priority_levels: usize, capacity_per_level: usize, segment_size: usize) -> Self {
        let mut queues = alloc::vec::Vec::with_capacity(priority_levels);
        for _ in 0..priority_levels {
            queues.push(SegmentedQueue::new(capacity_per_level, segment_size));
        }

        Self {
            queues,
            priority_levels,
        }
    }

    /// Push an item with a specific priority
    pub fn push(&self, item: T, priority: usize) -> Result<()> {
        if priority >= self.priority_levels {
            return Err(EventBusError::InvalidConfiguration {
                field: "priority",
                reason: "priority level out of range",
            });
        }

        self.queues[priority].push(item)
    }

    /// Pop the highest priority item
    pub fn pop(&self) -> Option<T> {
        // Check queues from highest to lowest priority
        for queue in self.queues.iter().rev() {
            if let Some(item) = queue.pop() {
                return Some(item);
            }
        }
        None
    }

    /// Check if all queues are empty
    pub fn is_empty(&self) -> bool {
        self.queues.iter().all(|q| q.is_empty())
    }

    /// Get total size across all priority levels
    pub fn len(&self) -> usize {
        self.queues.iter().map(|q| q.len()).sum()
    }

    /// Get capacity across all priority levels
    pub fn capacity(&self) -> usize {
        self.queues.iter().map(|q| q.capacity()).sum()
    }

    /// Check if any queue is at capacity
    pub fn is_full(&self) -> bool {
        self.queues.iter().any(|q| q.is_full())
    }
}

/// Backpressure-aware queue that signals when capacity thresholds are reached
pub struct BackpressureQueue<T> {
    /// Underlying queue
    queue: SegmentedQueue<T>,
    /// High water mark for backpressure (percentage)
    high_water_mark: usize,
    /// Low water mark for backpressure relief (percentage)
    low_water_mark: usize,
    /// Backpressure state
    backpressure_active: core::sync::atomic::AtomicBool,
}

impl<T> BackpressureQueue<T> {
    /// Create a new backpressure queue
    pub fn new(capacity: usize, segment_size: usize, high_water_mark: usize, low_water_mark: usize) -> Self {
        assert!(high_water_mark > low_water_mark);
        assert!(high_water_mark <= 100);
        assert!(low_water_mark <= 100);

        Self {
            queue: SegmentedQueue::new(capacity, segment_size),
            high_water_mark,
            low_water_mark,
            backpressure_active: core::sync::atomic::AtomicBool::new(false),
        }
    }

    /// Push an item, applying backpressure if necessary
    pub fn push(&self, item: T) -> Result<()> {
        // Check if we should apply backpressure
        let current_size = self.queue.len();
        let capacity = self.queue.capacity();
        let usage_percentage = (current_size * 100) / capacity;

        if usage_percentage >= self.high_water_mark {
            self.backpressure_active.store(true, Ordering::Release);

            // Apply backpressure by rejecting the push
            return Err(EventBusError::BackpressureTriggered {
                queue_size: current_size,
                threshold: (capacity * self.high_water_mark) / 100,
            });
        }

        // Check if we should relieve backpressure
        if self.backpressure_active.load(Ordering::Acquire) && usage_percentage <= self.low_water_mark {
            self.backpressure_active.store(false, Ordering::Release);
        }

        self.queue.push(item)
    }

    /// Pop an item
    pub fn pop(&self) -> Option<T> {
        self.queue.pop()
    }

    /// Check if backpressure is currently active
    pub fn backpressure_active(&self) -> bool {
        self.backpressure_active.load(Ordering::Acquire)
    }

    /// Get current size
    pub fn len(&self) -> usize {
        self.queue.len()
    }

    /// Get capacity
    pub fn capacity(&self) -> usize {
        self.queue.capacity()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.queue.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_segmented_queue_basic() {
        let queue = SegmentedQueue::<i32>::new(100, 16);

        // Test empty queue
        assert!(queue.is_empty());
        assert_eq!(queue.len(), 0);

        // Test push and pop
        assert!(queue.push(42).is_ok());
        assert!(!queue.is_empty());
        assert_eq!(queue.len(), 1);

        assert_eq!(queue.pop(), Some(42));
        assert!(queue.is_empty());
        assert_eq!(queue.len(), 0);
    }

    #[test]
    fn test_segmented_queue_capacity() {
        let queue = SegmentedQueue::<i32>::new(10, 16);

        // Fill the queue
        for i in 0..10 {
            assert!(queue.push(i).is_ok());
        }

        // Queue should be full
        assert!(queue.is_full());
        assert_eq!(queue.len(), 10);

        // Try to push one more (should fail)
        assert!(queue.push(99).is_err());

        // Pop all items
        for i in 0..10 {
            assert_eq!(queue.pop(), Some(i));
        }

        assert!(queue.is_empty());
    }

    #[test]
    fn test_priority_queue() {
        let queue = PriorityQueue::<i32>::new(3, 10, 16); // 3 priority levels

        // Push items with different priorities
        assert!(queue.push(100, 2).is_ok()); // High priority
        assert!(queue.push(200, 1).is_ok()); // Medium priority
        assert!(queue.push(300, 0).is_ok()); // Low priority

        // Should pop high priority first
        assert_eq!(queue.pop(), Some(100));
        assert_eq!(queue.pop(), Some(200));
        assert_eq!(queue.pop(), Some(300));
        assert!(queue.is_empty());
    }

    #[test]
    fn test_backpressure_queue() {
        let queue = BackpressureQueue::<i32>::new(10, 16, 80, 20); // 80% high, 20% low

        // Fill to 70% (7 items) - should work
        for i in 0..7 {
            assert!(queue.push(i).is_ok());
        }
        assert!(!queue.backpressure_active());

        // Try to add more - should trigger backpressure
        assert!(queue.push(99).is_err());
        assert!(queue.backpressure_active());

        // Drain to below low water mark
        for _ in 0..5 { // Drain to 2 items (20%)
            assert!(queue.pop().is_some());
        }

        // Backpressure should be relieved
        assert!(!queue.backpressure_active());
    }
}
