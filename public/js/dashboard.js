document.addEventListener('DOMContentLoaded', async () => {
    const isVoter = await checkAuth('voter');
    if (!isVoter) return;
    
    const greeting = document.getElementById('user-greeting');
    if (greeting) greeting.textContent = `Hello, ${localStorage.getItem('name')}`;
    loadElections();
    
    // Auto refresh results every 5 seconds when viewing detail
    setInterval(() => {
        if (!document.getElementById('election-detail-view').classList.contains('hidden')) {
            if (currentElectionId) loadResults(currentElectionId, false);
        }
    }, 5000);
    
    // Auto-refresh election list every 30 seconds to catch lifecycle status changes
    setInterval(() => {
        if (!document.getElementById('elections-view').classList.contains('hidden')) {
            loadElections();
        }
    }, 30000);
});

let currentChart = null;
let countdownInterval = null;
let currentElectionId = null;

let pendingVoteData = null; // Store pending identity
let verificationStream = null;
let activeTimers = []; // Track all interval IDs to prevent leaks

const pad = (n) => String(n).padStart(2, '0');

const formatCountdown = (ms) => {
    const d = Math.floor(ms / (1000 * 60 * 60 * 24));
    const h = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((ms % (1000 * 60)) / 1000);
    return `${pad(d)}:${pad(h)}:${pad(m)}:${pad(s)}`;
};

const loadElections = async () => {
    // Clear previous timers to prevent memory leaks on reload
    activeTimers.forEach(id => clearInterval(id));
    activeTimers = [];

    try {
        const data = await apiCall('/api/vote/elections');
        const grid = document.getElementById('elections-grid');
        grid.innerHTML = '';
        
        if (data.data.length === 0) {
            grid.innerHTML = '<p class="text-muted">No active elections at the moment.</p>';
            return;
        }

        data.data.forEach(election => {
            const el = document.createElement('div');
            el.className = 'glass-panel card';
            el.setAttribute('id', `election-card-${election.id}`);
            el.onclick = () => viewElection(election.id);
            
            const endDate = new Date(election.end_time).getTime();
            const startDate = new Date(election.start_time).getTime();
            const nowInit = Date.now();
            
            // Badge logic
            let badgeClass = election.status; 
            let badgeText = election.status.toUpperCase();
            if (election.has_voted) {
                badgeClass = 'voted';
                badgeText = 'ALREADY VOTED';
            }

            // Determine initial timer state
            let timerLabel = 'Loading...';
            let timerStyle = 'color: #818cf8;'; // indigo for active
            if (nowInit < startDate) {
                timerLabel = `Starts in: ${formatCountdown(startDate - nowInit)}`;
                timerStyle = 'color: #f59e0b;'; // amber for upcoming
            } else if (nowInit >= endDate) {
                timerLabel = '00:00:00:00 — CLOSED';
                timerStyle = 'color: #ef4444;';
            } else {
                timerLabel = formatCountdown(endDate - nowInit);
            }

            el.innerHTML = `
                <div class="card-header">
                    <h3>${election.title}</h3>
                    <span class="badge ${badgeClass}" id="badge-${election.id}">${badgeText}</span>
                </div>
                <div class="card-body">
                    <p class="text-muted mb-2">${election.description || 'No description'}</p>
                    <div style="display:flex; align-items:center; gap:8px; margin-top:10px;">
                        <span style="font-size:0.7rem; text-transform:uppercase; letter-spacing:1px; color:#6b7280;">⏱ Time Remaining</span>
                    </div>
                    <p id="timer-${election.id}" style="font-family: 'Courier New', monospace; font-size: 1.4rem; font-weight: 700; letter-spacing: 2px; margin-top: 4px; ${timerStyle}">${timerLabel}</p>
                </div>
            `;
            grid.appendChild(el);
            
            // Live countdown — updates every second
            const timerId = setInterval(() => {
                const timerEl = document.getElementById(`timer-${election.id}`);
                const badgeEl = document.getElementById(`badge-${election.id}`);
                if (!timerEl) return;
                
                const now = Date.now();

                // Case 1: Election hasn't started yet
                if (now < startDate) {
                    const dist = startDate - now;
                    timerEl.textContent = `Starts in: ${formatCountdown(dist)}`;
                    timerEl.style.color = '#f59e0b';
                    return;
                }
                
                // Case 2: Election is over
                const distance = endDate - now;
                if (distance <= 0) {
                    timerEl.textContent = '00:00:00:00 — CLOSED';
                    timerEl.style.color = '#ef4444';
                    
                    // Auto-update badge to CLOSED
                    if (badgeEl && !badgeEl.classList.contains('closed') && !election.has_voted) {
                        badgeEl.className = 'badge closed';
                        badgeEl.textContent = 'CLOSED';
                    }
                    
                    // Disable any vote buttons inside the detail view for this election
                    document.querySelectorAll(`[id^="vote-btn-"]`).forEach(btn => {
                        btn.disabled = true;
                        btn.textContent = 'Voting Closed';
                        btn.style.opacity = '0.5';
                        btn.style.cursor = 'not-allowed';
                    });
                    
                    clearInterval(timerId); // Stop ticking — election is done
                    return;
                }
                
                // Case 3: Active countdown
                timerEl.textContent = formatCountdown(distance);
                timerEl.style.color = distance < 60000 ? '#ef4444' : '#818cf8'; // red flash under 1 min
            }, 1000);
            
            activeTimers.push(timerId);
        });
    } catch (e) {
        showAlert(e.message);
    }
};

const viewElection = async (id) => {
    currentElectionId = id;
    try {
        const data = await apiCall(`/api/vote/elections/${id}`);
        const { election, candidates, has_voted } = data.data;

        document.getElementById('elections-view').classList.add('hidden');
        document.getElementById('election-detail-view').classList.remove('hidden');
        
        document.getElementById('detail-title').textContent = election.title;
        document.getElementById('detail-desc').textContent = election.description || 'No description available.';
        
        const statusDiv = document.getElementById('detail-status');
        if (has_voted) {
            statusDiv.innerHTML = '<span class="badge voted">ALREADY VOTED - You have cast your vote in this election.</span>';
            loadResults(id, true);
        } else if (election.status !== 'active') {
            statusDiv.innerHTML = `<span class="badge ${election.status}">${election.status.toUpperCase()}</span>`;
            document.getElementById('results-container').classList.add('hidden');
        } else if (!election.is_verified) {
             statusDiv.innerHTML = `<span class="badge closed">Your account is pending verification by admin before you can vote.</span>`;
             document.getElementById('results-container').classList.add('hidden');
        } else {
            statusDiv.innerHTML = '<span class="badge active">ACTIVE - You may cast your vote</span>';
            document.getElementById('results-container').classList.add('hidden');
        }

        const grid = document.getElementById('candidates-grid');
        grid.innerHTML = '';
        
        candidates.forEach(c => {
            const el = document.createElement('div');
            el.className = 'glass-panel candidate-card';
            
            let voteBtnHtml = '';
            if (has_voted) {
                voteBtnHtml = '<button class="btn mt-4" disabled style="opacity:0.5; cursor:not-allowed; background:#10b981;">\u2713 Already Voted</button>';
            } else if (election.status === 'closed') {
                voteBtnHtml = '<button class="btn mt-4" disabled style="opacity:0.5; cursor:not-allowed;">Voting Closed</button>';
            } else if (!has_voted && election.status === 'active' && election.is_verified) {
                voteBtnHtml = `<button class="btn mt-4" id="vote-btn-${c.id}" onclick="castVote(${id}, ${c.id}, '${c.name.replace("'", "\\'")}')">Vote for ${c.name}</button>`;
            } else if (!has_voted && election.status === 'active' && !election.is_verified) {
                 voteBtnHtml = `<button class="btn mt-4" disabled>Pending Verification</button>`;
            }

            el.innerHTML = `
                <img src="${c.photo_url || 'https://via.placeholder.com/150'}" alt="${c.name}" class="candidate-photo" onerror="this.src='https://placehold.co/150/6366f1/ffffff?text=NA'">
                <h3>${c.name}</h3>
                <p class="text-primary mb-2" style="display:flex; justify-content:center; align-items:center; gap: 8px;">
                    ${c.party_logo ? `<img src="${c.party_logo}" style="height:20px; border-radius:3px; object-fit:contain;">` : ''}
                    <span>${c.party_name || c.party}</span>
                </p>
                <p class="text-muted" style="font-size: 0.875rem;">${c.bio || ''}</p>
                ${voteBtnHtml}
            `;
            grid.appendChild(el);
        });

    } catch (e) {
        showAlert(e.message);
    }
};

const showElections = () => {
    currentElectionId = null;
    document.getElementById('election-detail-view').classList.add('hidden');
    document.getElementById('elections-view').classList.remove('hidden');
    if (currentChart) {
        currentChart.destroy();
        currentChart = null;
    }
};

const castVote = async (electionId, candidateId, candidateName) => {
    console.log(`[Voting] Initiating vote for candidate ${candidateId} in election ${electionId}`);
    pendingVoteData = { electionId, candidateId, candidateName };
    
    // Reset Modal UI
    const btn = document.getElementById('btn-verify-vote');
    if (btn) {
        btn.disabled = false;
        btn.textContent = 'Scan Face & Check Identity';
    }
    const voterIdInput = document.getElementById('verify-voter-id');
    if (voterIdInput) voterIdInput.value = '';
    
    // Open Biometric Modal
    document.getElementById('biometric-modal').classList.remove('hidden');
    
    // Start Webcam with fallback
    try {
         console.log('[Camera] Requesting video stream...');
         verificationStream = await navigator.mediaDevices.getUserMedia({ 
             video: { width: { ideal: 640 }, height: { ideal: 480 } } 
         });
         const video = document.getElementById('verify-webcam');
         if (video) {
             video.srcObject = verificationStream;
             video.onloadedmetadata = () => video.play();
         }
         console.log('[Camera] Stream active.');
    } catch (e) {
         console.error('[Camera Error]', e);
         showAlert('Camera Access Failed: Please ensure you have given permission and your camera is not being used by another app.', 'error');
         document.getElementById('biometric-modal').classList.add('hidden');
    }
};

document.getElementById('btn-cancel-vote')?.addEventListener('click', () => {
     document.getElementById('biometric-modal').classList.add('hidden');
     if (verificationStream) {
         verificationStream.getTracks().forEach(track => track.stop());
     }
     pendingVoteData = null;
});

document.getElementById('btn-verify-vote')?.addEventListener('click', async () => {
     if (!pendingVoteData) return;
     const voterId = document.getElementById('verify-voter-id').value;
     if (!voterId) return showAlert('Voter ID is required', 'error');

     const btn = document.getElementById('btn-verify-vote');
     btn.disabled = true;
     btn.textContent = 'Verifying Biometrics...';

     const video = document.getElementById('verify-webcam');
     const canvas = document.getElementById('verify-canvas');
     const context = canvas.getContext('2d');
     
     // Visual Flash Effect
     video.style.filter = 'brightness(3)';
     setTimeout(() => video.style.filter = 'brightness(1)', 150);

     console.log('[Capture] High-res frame stabilized. Extracting biometric signature...');
     context.drawImage(video, 0, 0, canvas.width, canvas.height);
     const faceData = canvas.toDataURL('image/jpeg');

     try {
         // Step 1: Verify Biometrics
         console.log('[Verify] Submitting identity probe to secure endpoint...');
         await apiCall('/api/vote/verify', 'POST', { voter_id: voterId, face_data: faceData });
         
         // Step 2: Cast Secure Vote
         btn.textContent = 'Casting Vote...';
         await apiCall(`/api/vote/elections/${pendingVoteData.electionId}/vote`, 'POST', { candidate_id: pendingVoteData.candidateId });
         
         // SUCCESS: Close modal, stop webcam, stay on dashboard
         showAlert('✅ Identity Verified! Vote cast successfully!', 'success');
         document.getElementById('biometric-modal').classList.add('hidden');
         if (verificationStream) {
             verificationStream.getTracks().forEach(track => track.stop());
             verificationStream = null;
         }
         
         // Reload the election view to show "ALREADY VOTED" badge + results
         const electionId = pendingVoteData.electionId;
         pendingVoteData = null;
         await viewElection(electionId);
         
     } catch (e) {
         // If "already voted", close modal and refresh to show voted state
         if (e.message && e.message.includes('already voted')) {
             showAlert('You have already voted in this election.', 'error');
             document.getElementById('biometric-modal').classList.add('hidden');
             if (verificationStream) {
                 verificationStream.getTracks().forEach(track => track.stop());
                 verificationStream = null;
             }
             if (pendingVoteData) {
                 await viewElection(pendingVoteData.electionId);
                 pendingVoteData = null;
             }
         } else {
             showAlert(e.message, 'error');
         }
     }
     
     btn.disabled = false;
     btn.textContent = 'Scan Face & Check Identity';
});

const loadResults = async (electionId, forceRebuild = false) => {
    try {
        const data = await apiCall(`/api/vote/elections/${electionId}/results`);
        const resultsContainer = document.getElementById('results-container');
        resultsContainer.classList.remove('hidden');
        
        const { candidates, totalVotes, winner } = data.data;
        
        const labels = candidates.map(c => c.name);
        const votes = candidates.map(c => c.vote_count);

        // Build percentage labels for chart axis
        const percentageLabels = candidates.map(c => 
            `${c.name} (${c.vote_count} votes, ${c.percentage}%)`
        );

        // Winner & stats banner
        const statusDiv = document.getElementById('detail-status');
        let statsHtml = '';
        if (winner) {
            statsHtml = `<div style="background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(99,102,241,0.15)); border: 1px solid rgba(16,185,129,0.3); border-radius: 8px; padding: 12px 16px; margin-top: 12px;">
                <p style="margin:0; color:#10b981; font-weight:700; font-size: 1.1rem;">🏆 Winner: ${winner.name}</p>
                <p style="margin:4px 0 0; color:#9ca3af; font-size: 0.85rem;">${winner.party || 'Independent'} — ${winner.votes} votes (${winner.percentage}%) | Total Votes Cast: ${totalVotes}</p>
            </div>`;
        } else {
            statsHtml = `<p class="mt-2 text-muted">No votes have been cast yet. Total: ${totalVotes}</p>`;
        }
        
        // Update or append the stats block
        const existingStats = document.getElementById('results-stats-banner');
        if (existingStats) {
            existingStats.outerHTML = `<div id="results-stats-banner">${statsHtml}</div>`;
        } else {
            statusDiv.insertAdjacentHTML('beforeend', `<div id="results-stats-banner">${statsHtml}</div>`);
        }
        
        const ctx = document.getElementById('resultsChart').getContext('2d');
        
        if (currentChart && !forceRebuild) {
             currentChart.data.labels = percentageLabels;
             currentChart.data.datasets[0].data = votes;
             currentChart.update();
             return;
        }

        if (currentChart) currentChart.destroy();
        
        currentChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: percentageLabels,
                datasets: [{
                    label: 'Votes',
                    data: votes,
                    backgroundColor: candidates.map((_, i) => {
                        const colors = ['rgba(99,102,241,0.8)', 'rgba(236,72,153,0.8)', 'rgba(16,185,129,0.8)', 'rgba(245,158,11,0.8)', 'rgba(139,92,246,0.8)', 'rgba(6,182,212,0.8)'];
                        return colors[i % colors.length];
                    }),
                    borderColor: 'transparent',
                    borderWidth: 0,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, color: '#9ca3af' },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    },
                    x: {
                        ticks: { color: '#9ca3af', font: { size: 11 } },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });

    } catch (e) {
        // If results aren't published yet, silently hide the container
        if (e.message && e.message.includes('not available yet')) {
            document.getElementById('results-container').classList.add('hidden');
        } else {
            console.error(e);
        }
    }
};
