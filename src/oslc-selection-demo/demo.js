// Import the OSLC Selection WebComponent
import '@oslc/oslc-selection-webcomponent'
import { buildVersion } from './build-info.js'

const buildInfoElement = document.getElementById('build-version')
if (buildInfoElement) {
    buildInfoElement.textContent = `Using @oslc/postmessage-helper and @oslc/selection-webcomponent ${buildVersion}`
}

// Load OSLC components
async function loadOslcComponents() {
    try {
        console.log('🔄 Loading OSLC Selection WebComponent...')
        
        // Check if the component is available
        const checkComponent = () => {
            if (customElements.get('oslc-selection-button')) {
                console.log('✅ OSLC Selection WebComponent loaded successfully')
                window.oslcProductionLoaded = true
                updateBuildStatus()
            } else {
                console.log('⏳ Waiting for OSLC component to load...')
                setTimeout(checkComponent, 100)
            }
        }
        
        checkComponent()
        
    } catch (error) {
        console.error('❌ Failed to load OSLC component:', error)
        window.oslcLoadError = error.message
        updateBuildStatus()
    }
}

// Make updateBuildStatus available globally
window.updateBuildStatus = function() {
    const statusElement = document.getElementById('build-status')
    if (statusElement) {
        if (window.oslcProductionLoaded) {
            statusElement.innerHTML = '<span class="text-success">✅ Production components loaded successfully</span>'
        } else if (window.oslcLoadError) {
            statusElement.innerHTML = `<span class="text-danger">❌ Failed to load components: ${window.oslcLoadError}</span>`
        } else {
            statusElement.innerHTML = '<span class="text-warning">⚠️ Components not loaded yet</span>'
        }
    }
}

// Load components immediately
loadOslcComponents()
