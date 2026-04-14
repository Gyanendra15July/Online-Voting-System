const fs = require('fs');
const filePath = './public/js/dashboard.js';

let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the vote button logic block
const oldBlock = `            let voteBtnHtml = '';
            if (!has_voted && election.status === 'active' && election.is_verified) {`;

const newBlock = `            let voteBtnHtml = '';
            if (has_voted) {
                voteBtnHtml = '<button class="btn mt-4" disabled style="opacity:0.5; cursor:not-allowed; background:#10b981;">\\u2713 Already Voted</button>';
            } else if (election.status === 'closed') {
                voteBtnHtml = '<button class="btn mt-4" disabled style="opacity:0.5; cursor:not-allowed;">Voting Closed</button>';
            } else if (!has_voted && election.status === 'active' && election.is_verified) {`;

if (content.includes(oldBlock)) {
    content = content.replace(oldBlock, newBlock);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('SUCCESS: Vote button states patched.');
} else {
    console.log('SKIP: Block already patched or not found.');
}
