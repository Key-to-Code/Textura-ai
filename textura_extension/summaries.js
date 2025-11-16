document.addEventListener('DOMContentLoaded', async () => {
    const listContainer = document.getElementById('summariesList');
    const noSummariesMessage = document.getElementById('noSummariesMessage');

    const result = await chrome.storage.local.get('allResults');
    const allResults = result.allResults || [];

    if (allResults.length === 0) {
        noSummariesMessage.classList.remove('hidden');
    } else {
        allResults.forEach(item => {
            const summaryDiv = document.createElement('div');
            summaryDiv.className = 'summary-item';
            summaryDiv.innerHTML = `
                <div class="summary-header">
                    <span class="summary-title">${item.operation.replace('-', ' ')}</span>
                    <span class="summary-date">${new Date(item.timestamp).toLocaleString()}</span>
                </div>
                <div class="summary-preview">${item.content}</div>
            `;
            // Add a click listener to show the full result
            summaryDiv.addEventListener('click', () => {
                // You can create a modal or a new page to show the full content
                alert(`Full Content:\n\n${item.content}`);
            });
            listContainer.appendChild(summaryDiv);
        });
    }
});