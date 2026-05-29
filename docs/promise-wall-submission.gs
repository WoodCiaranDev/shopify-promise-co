/**
 * Promise Wall - submission handler (Google Apps Script)
 * ---------------------------------------------------------------------------
 * Deployed as a Google Apps Script Web App. Receives a POST from the promise
 * wall form, geocodes the supplied location via Mapbox, then creates a
 * `promise_entry` metaobject in Shopify via the Admin GraphQL API.
 *
 * SECURITY NOTE: Credentials below are PLACEHOLDERS (__SHOPIFY_ADMIN_TOKEN__,
 * __SHOPIFY_SHOP_DOMAIN__, __MAPBOX_TOKEN__). Use the `/copy-script` Claude skill
 * to copy this file with the real values injected from .env, or paste them
 * manually. Never commit the real `shpat_…` token to this repo.
 * ---------------------------------------------------------------------------
 */

// Mapbox Geocoding API token (publishable) - placeholder, inject with /copy-script
const MAPBOX_TOKEN = '__MAPBOX_TOKEN__'

/**
 * Geocode a location string to latitude/longitude using Mapbox
 * @param {string} location - Location string (e.g., "London, UK")
 * @returns {object} - { latitude: string, longitude: string } or { latitude: '', longitude: '' }
 */
function geocodeLocation(location) {
    if (!location || location.trim() === '') {
        return { latitude: '', longitude: '' }
    }

    try {
        const encodedLocation = encodeURIComponent(location.trim())
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedLocation}.json?access_token=${MAPBOX_TOKEN}&limit=1`

        const response = UrlFetchApp.fetch(url, {
            method: 'GET',
            muteHttpExceptions: true,
        })

        const data = JSON.parse(response.getContentText())

        if (data.features && data.features.length > 0) {
            const [longitude, latitude] = data.features[0].center
            return {
                latitude: latitude.toString(),
                longitude: longitude.toString(),
            }
        } else {
            console.warn(`Geocoding failed for "${location}": No results found`)
            return { latitude: '', longitude: '' }
        }
    } catch (error) {
        console.error(`Geocoding error for "${location}":`, error)
        return { latitude: '', longitude: '' }
    }
}

function doPost(e) {
    try {
        // Parse the form data
        const formData = JSON.parse(e.postData.contents)

        // Your Shopify credentials (placeholders - inject with /copy-script)
        const SHOP_DOMAIN = '__SHOPIFY_SHOP_DOMAIN__'
        const ACCESS_TOKEN = '__SHOPIFY_ADMIN_TOKEN__'

        // Geocode the location
        const coordinates = geocodeLocation(formData.location)

        // GraphQL mutation to create metaobject entry
        const mutation = `
      mutation CreateMetaobject($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject {
            handle
            id
            displayName
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `

        // Variables for the mutation
        const variables = {
            metaobject: {
                type: 'promise_entry', // Update this to match your actual metaobject type
                capabilities: {
                    publishable: {
                        status: 'ACTIVE',
                    },
                },
                fields: [
                    { key: 'name', value: formData.name || '' },
                    { key: 'email', value: formData.email || '' },
                    { key: 'telephone', value: formData.telephone || '' },
                    { key: 'location', value: formData.location || '' },
                    { key: 'latitude', value: coordinates.latitude },
                    { key: 'longitude', value: coordinates.longitude },
                    { key: 'promise_content', value: formData.promise_content || '' },
                    { key: 'membership', value: formData.membership ? 'yes' : 'no' },
                    { key: 'date_submitted', value: new Date().toISOString() },
                ],
            },
        }

        // Make the API call to Shopify
        const response = UrlFetchApp.fetch(`https://${SHOP_DOMAIN}.myshopify.com/admin/api/2025-07/graphql.json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': ACCESS_TOKEN,
            },
            payload: JSON.stringify({
                query: mutation,
                variables: variables,
            }),
        })

        const responseData = JSON.parse(response.getContentText())

        // Check for errors
        if (responseData.errors) {
            console.error('GraphQL Errors:', responseData.errors)
            return ContentService.createTextOutput(
                JSON.stringify({
                    success: false,
                    error: 'GraphQL Error: ' + JSON.stringify(responseData.errors),
                }),
            ).setMimeType(ContentService.MimeType.JSON)
        }

        if (responseData.data.metaobjectCreate.userErrors.length > 0) {
            console.error('User Errors:', responseData.data.metaobjectCreate.userErrors)
            return ContentService.createTextOutput(
                JSON.stringify({
                    success: false,
                    error: 'Validation Error: ' + JSON.stringify(responseData.data.metaobjectCreate.userErrors),
                }),
            ).setMimeType(ContentService.MimeType.JSON)
        }

        // Success response
        return ContentService.createTextOutput(
            JSON.stringify({
                success: true,
                metaobject: responseData.data.metaobjectCreate.metaobject,
            }),
        ).setMimeType(ContentService.MimeType.JSON)
    } catch (error) {
        console.error('Script Error:', error)
        return ContentService.createTextOutput(
            JSON.stringify({
                success: false,
                error: error.toString(),
            }),
        ).setMimeType(ContentService.MimeType.JSON)
    }
}
