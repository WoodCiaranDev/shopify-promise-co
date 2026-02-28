/**
 * Promise Export Functionality
 * Exports all promises from the promise wall to CSV format
 */

class PromiseExporter {
  constructor() {
    this.promises = [];
  }

  /**
   * Fetch all promises from the promise wall API
   */
  async fetchAllPromises() {
    try {
      const response = await fetch('/apps/promise-wall/promises', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.promises = data.promises || [];
      return this.promises;
    } catch (error) {
      console.error('Error fetching promises:', error);
      throw error;
    }
  }

  /**
   * Convert promises array to CSV format
   */
  convertToCSV(promises) {
    if (!promises || promises.length === 0) {
      return 'No data available';
    }

    // Define headers
    const headers = [
      'ID',
      'Name', 
      'Email',
      'Location',
      'Promise Content',
      'Date Submitted'
    ];

    // Create CSV content
    let csv = headers.join(',') + '\n';

    promises.forEach(promise => {
      const row = [
        promise.id || '',
        this.escapeCSV(promise.author_name || promise.name || ''),
        this.escapeCSV(promise.email || ''),
        this.escapeCSV(promise.location || ''),
        this.escapeCSV(promise.promise_content || promise.content || ''),
        promise.date || promise.created_at || new Date().toISOString()
      ];
      
      csv += row.join(',') + '\n';
    });

    return csv;
  }

  /**
   * Escape CSV values properly
   */
  escapeCSV(value) {
    if (value === null || value === undefined) return '""';
    
    // Convert to string
    value = String(value);
    
    // Check if value needs to be quoted
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
      // Escape quotes by doubling them
      value = value.replace(/"/g, '""');
      // Wrap in quotes
      return `"${value}"`;
    }
    
    return value;
  }

  /**
   * Trigger CSV download in browser
   */
  downloadCSV(csvContent, filename) {
    // Create blob
    const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Create download link
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } else {
      // Fallback for older browsers
      alert('Your browser does not support automatic downloads. Please copy the data manually.');
      console.log(csvContent);
    }
  }

  /**
   * Main export function
   */
  async exportPromises() {
    try {
      // Show loading state
      this.showLoading(true);
      
      // Fetch promises
      const promises = await this.fetchAllPromises();
      
      // Convert to CSV
      const csv = this.convertToCSV(promises);
      
      // Generate filename with timestamp
      const date = new Date().toISOString().split('T')[0];
      const filename = `promise_export_${date}.csv`;
      
      // Download
      this.downloadCSV(csv, filename);
      
      // Show success
      this.showSuccess(promises.length);
      
    } catch (error) {
      this.showError(error.message);
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * UI Helper Methods
   */
  showLoading(show) {
    const button = document.querySelector('[data-promise-export]');
    if (button) {
      button.disabled = show;
      button.textContent = show ? 'Exporting...' : 'Export Promises to CSV';
    }
  }

  showSuccess(count) {
    const message = `Successfully exported ${count} promises!`;
    if (window.showNotification) {
      window.showNotification(message, 'success');
    } else {
      alert(message);
    }
  }

  showError(error) {
    const message = `Export failed: ${error}`;
    if (window.showNotification) {
      window.showNotification(message, 'error');
    } else {
      alert(message);
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Add export button to promise wall page if it exists
  const promiseWall = document.querySelector('.promise-wall');
  if (promiseWall) {
    const exportButton = document.createElement('button');
    exportButton.className = 'button button--primary';
    exportButton.setAttribute('data-promise-export', 'true');
    exportButton.textContent = 'Export Promises to CSV';
    exportButton.style.margin = '20px auto';
    exportButton.style.display = 'block';
    
    exportButton.addEventListener('click', async function() {
      const exporter = new PromiseExporter();
      await exporter.exportPromises();
    });
    
    // Insert before promise wall or at the top
    promiseWall.parentNode.insertBefore(exportButton, promiseWall);
  }
});

// Also expose globally for manual use
window.PromiseExporter = PromiseExporter;