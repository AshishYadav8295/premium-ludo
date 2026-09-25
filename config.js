// Automatically detect kar lega ki site localhost par hai ya live domain par
const getApiBaseUrl = () => {
    const hostname = window.location.hostname;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://127.0.0.1:3000'; // Local development ke liye
    }
    
    // Live environment (Render ya future custom domain jaise ludoverse.com) ke liye empty string (Relative URL)
    // Relative URL use karne se frontend usi domain se automatically API request le leta hai jahan wo hosted hai.
    return ''; 
};

const API_BASE = getApiBaseUrl();