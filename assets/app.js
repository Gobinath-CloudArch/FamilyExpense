const form = document.getElementById('transactionForm');
const amountInput = document.getElementById('txnAmount');
const scopeSelect = document.getElementById('txnScope');
const categorySelect = document.getElementById('txnCategory');
const descriptionInput = document.getElementById('txnDescription');
const voiceBtn = document.getElementById('voiceBtn');
const statusMessage = document.getElementById('statusMessage');
const saveBtn = document.getElementById('saveTxnBtn');

// Initialize Web Speech API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (typeof SpeechRecognition !== "undefined") {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-IN'; 

    let isListening = false;

    voiceBtn.addEventListener('click', () => {
        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });

    recognition.onstart = () => {
        isListening = true;
        voiceBtn.textContent = '🛑 Listening... Speak now';
        voiceBtn.classList.add('recording');
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        
        // Parse Amount
        const amountMatch = transcript.match(/\d+/);
        if (amountMatch) amountInput.value = amountMatch[0];

        // Parse Scope
        if (transcript.includes('family') || transcript.includes('shared')) {
            scopeSelect.value = 'Family';
        } else if (transcript.includes('personal') || transcript.includes('individual')) {
            scopeSelect.value = 'Personal';
        }

        // Parse Category
        if (transcript.includes('grocery') || transcript.includes('food')) {
            categorySelect.value = 'Groceries';
        } else if (transcript.includes('electricity') || transcript.includes('utility')) {
            categorySelect.value = 'Utilities';
        } else if (transcript.includes('hospital') || transcript.includes('medicine')) {
            categorySelect.value = 'Healthcare';
        }

        // Apply remaining recognized text to Description
        descriptionInput.value = transcript;
    };

    recognition.onspeechend = () => {
        recognition.stop();
    };

    recognition.onend = () => {
        isListening = false;
        voiceBtn.textContent = '🎤 Start Voice Input';
        voiceBtn.classList.remove('recording');
    };

    recognition.onerror = (event) => {
        console.error(`Speech recognition error: ${event.error}`);
        isListening = false;
        voiceBtn.textContent = '🎤 Start Voice Input';
    };
} else {
    voiceBtn.style.display = 'none';
    console.warn("Speech Recognition API not supported in this browser.");
}

// Form Submission
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    const payload = {
        action: 'addTransaction',
        amount: amountInput.value,
        category: categorySelect.value,
        scope: scopeSelect.value,
        description: descriptionInput.value,
        familySplit: "" // Ensures Google Sheet column stays blank
    };

    try {
        const response = await fetch(CONFIG_API_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });

        const result = await response.json();

        if (result.status === 'success') {
            statusMessage.textContent = 'Transaction saved successfully.';
            statusMessage.style.color = '#10b981';
            form.reset();
            // Call existing function to refresh the ledger view here
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        statusMessage.textContent = 'Error saving transaction.';
        statusMessage.style.color = '#ef4444';
        console.error(error);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Transaction';
        setTimeout(() => statusMessage.textContent = '', 3000);
    }
});
