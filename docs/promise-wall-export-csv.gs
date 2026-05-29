/**
 * Google Apps Script - Direct CSV Download
 * Deploy as Web App and visit the URL to download promises as CSV.
 *
 * SECURITY NOTE: Credentials below are PLACEHOLDERS. Use the `/copy-script`
 * Claude skill to copy this file with the real values injected from .env,
 * or paste the token manually. Never commit the real `shpat_…` token.
 */

// Shopify credentials
const SHOP_DOMAIN = '__SHOPIFY_SHOP_DOMAIN__'
const ACCESS_TOKEN = '__SHOPIFY_ADMIN_TOKEN__'

/**
 * Handle GET requests - automatically downloads CSV when URL is visited
 */
function doGet(e) {
  try {
    // Fetch all promises
    const promises = fetchAllPromises()

    // Create CSV content
    let csv = 'ID,Handle,Name,Email,Telephone,Location,Promise Content,Membership,Date Submitted\n'

    promises.forEach(promise => {
      csv += [
        escapeCSV(promise.id),
        escapeCSV(promise.handle),
        escapeCSV(promise.name),
        escapeCSV(promise.email),
        escapeCSV(promise.telephone),
        escapeCSV(promise.location),
        escapeCSV(promise.promise_content),
        escapeCSV(promise.membership),
        escapeCSV(promise.date_submitted)
      ].join(',') + '\n'
    })

    // Create filename with current date
    const filename = `promises_export_${new Date().toISOString().split('T')[0]}.csv`

    // Return CSV as downloadable file
    return ContentService
      .createTextOutput(csv)
      .setMimeType(ContentService.MimeType.CSV)
      .downloadAsFile(filename)

  } catch (error) {
    // Return error as JSON
    return ContentService
      .createTextOutput(JSON.stringify({
        error: error.toString(),
        message: 'Failed to export promises'
      }))
      .setMimeType(ContentService.MimeType.JSON)
  }
}

/**
 * Fetch all promises from Shopify
 */
function fetchAllPromises() {
  const promises = []
  let hasNextPage = true
  let cursor = null

  const query = `
    query GetPromises($first: Int!, $after: String) {
      metaobjects(type: "promise_entry", first: $first, after: $after) {
        edges {
          cursor
          node {
            id
            handle
            fields {
              key
              value
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `

  while (hasNextPage) {
    const response = UrlFetchApp.fetch(
      `https://${SHOP_DOMAIN}.myshopify.com/admin/api/2025-07/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': ACCESS_TOKEN
        },
        payload: JSON.stringify({
          query: query,
          variables: {
            first: 250,
            after: cursor
          }
        })
      }
    )

    const data = JSON.parse(response.getContentText())

    if (data.errors) {
      throw new Error('GraphQL Error: ' + JSON.stringify(data.errors))
    }

    // Process each promise
    data.data.metaobjects.edges.forEach(edge => {
      const promise = {
        id: edge.node.id.split('/').pop(), // Get just the ID number
        handle: edge.node.handle
      }

      // Convert fields to properties
      edge.node.fields.forEach(field => {
        promise[field.key] = field.value
      })

      promises.push(promise)
    })

    hasNextPage = data.data.metaobjects.pageInfo.hasNextPage
    cursor = data.data.metaobjects.pageInfo.endCursor
  }

  return promises
}

/**
 * Helper function to escape CSV values
 */
function escapeCSV(value) {
  if (value === null || value === undefined) return ''

  value = String(value)

  // Escape quotes and wrap in quotes if needed
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    value = value.replace(/"/g, '""')
    return `"${value}"`
  }

  return value
}
